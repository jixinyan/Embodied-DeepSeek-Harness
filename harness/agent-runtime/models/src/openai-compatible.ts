import {
  CONTEXT_WINDOW_EXCEEDED_CODE,
  LlmAdapter,
  LlmError,
  ProviderRequestId,
  type ContentBlock,
  type GenerateOptions,
  type LlmModelInfo,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm';
import type { ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment';
import { deadline, timeoutOf } from '@deepseek-ai/dsh-timeout';
import {
  serializeMessages,
  serializeMessagesWithImages,
} from './dsh/chat-completions/serialize.ts';
import { parseSse } from './dsh/chat-completions/sse.ts';
import { translate } from './dsh/chat-completions/translate.ts';

export interface OpenAICompatibleModel {
  id: string;
  name?: string;
  inputModalities?: readonly ('text' | 'image')[];
  contextWindow?: number;
  maxTokens?: number;
}
export interface OpenAICompatibleOptions {
  /** API root including /v1 where required; no credentials, query or fragment. */
  baseURL: string;
  models: readonly OpenAICompatibleModel[];
  /** Private credential resolver; omission supports unauthenticated local vLLM. */
  apiKey?: (signal: AbortSignal) => string | Promise<string>;
  /** Resolve admitted immutable image references, never arbitrary model-supplied URLs. */
  resolveImage?: (ref: ImageAttachmentRef, signal: AbortSignal) => Promise<RequestImageAttachment>;
  timeoutMs?: number;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  maxImagesPerRequest?: number;
  systemRole?: 'system' | 'developer';
  maxTokensField?: 'max_tokens' | 'max_completion_tokens';
  /** Opt in only when the endpoint explicitly requires reasoning_content replay. */
  passReasoningContent?: boolean;
  /** Server-specific generation options, e.g. vLLM chat_template_kwargs. */
  extraBody?: Readonly<Record<string, unknown>>;
}
const reserved = new Set([
  'model',
  'messages',
  'tools',
  'tool_choice',
  'stream',
  'stream_options',
  'n',
  'max_tokens',
  'max_completion_tokens',
  'temperature',
  'stop',
  'reasoning_effort',
]);
function limit(value: number | undefined, fallback: number): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result <= 0 || result > 2_147_483_647)
    throw new Error('Model transport limits must be positive bounded integers.');
  return result;
}
/** Recognize only an explicit structured overflow; never expose provider error text. */
async function contextOverflow(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<boolean> {
  if (![400, 413].includes(response.status) || !response.body) return false;
  const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (!mediaType || !/^application\/(?:[a-z0-9.+-]+\+)?json$/.test(mediaType)) return false;
  const reader = response.body.getReader();
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) return false;
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || !('error' in parsed)) return false;
    const error = parsed.error;
    return Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'context_length_exceeded',
    );
  } catch {
    signal.throwIfAborted();
    return false;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
/** Native DSH adapter shared by local vLLM and remote Chat Completions endpoints. */
export class OpenAICompatibleAdapter extends LlmAdapter {
  private readonly endpoint: string;
  private readonly config: OpenAICompatibleOptions;
  private readonly models: readonly OpenAICompatibleModel[];
  private readonly extra: Record<string, unknown>;
  private readonly timeout: number;
  private readonly requestLimit: number;
  private readonly responseLimit: number;
  private readonly imageLimit: number;
  constructor(options: OpenAICompatibleOptions) {
    super();
    const url = new URL(options.baseURL);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        'Model baseURL must be an HTTP(S) API root without credentials, query or fragment.',
      );
    this.endpoint = url.toString().replace(/\/$/, '') + '/chat/completions';
    this.config = { ...options };
    this.models = structuredClone(options.models);
    const ids = new Set<string>();
    for (const model of this.models) {
      if (!model.id.trim() || ids.has(model.id)) throw new Error('Invalid or duplicate model ID.');
      ids.add(model.id);
      if (model.contextWindow !== undefined) limit(model.contextWindow, 1);
      if (model.maxTokens !== undefined) limit(model.maxTokens, 1);
    }
    this.extra = structuredClone(options.extraBody ?? {});
    if (Array.isArray(this.extra) || Object.keys(this.extra).some((key) => reserved.has(key)))
      throw new Error(
        'extraBody cannot override DSH request identity, tools or generation fields.',
      );
    JSON.stringify(this.extra);
    this.timeout = limit(options.timeoutMs, 120_000);
    this.requestLimit = limit(options.maxRequestBytes, 32 * 1024 * 1024);
    this.responseLimit = limit(options.maxResponseBytes, 32 * 1024 * 1024);
    this.imageLimit = limit(options.maxImagesPerRequest, 16);
  }
  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return this.models.map((model) => ({
      provider,
      id: model.id,
      name: model.name ?? model.id,
      ...(model.inputModalities ? { inputModalities: [...model.inputModalities] } : {}),
    }));
  }
  override async resolveModel(provider: string, id: string): Promise<LlmResolvedModelInfo> {
    const model = this.models.find((entry) => entry.id === id);
    return {
      provider,
      id,
      name: model?.name ?? id,
      ...(model?.inputModalities ? { inputModalities: [...model.inputModalities] } : {}),
      ...(model?.contextWindow ? { context: { contextWindow: model.contextWindow } } : {}),
      ...(model?.maxTokens ? { defaultMaxTokens: model.maxTokens } : {}),
    };
  }
  private async request(options: GenerateOptions, signal: AbortSignal): Promise<string> {
    const images = new Map<ImageAttachmentRef['attachmentId'], RequestImageAttachment>();
    let imageBytes = 0;
    let imageCount = 0;
    const collect = async (blocks: readonly ContentBlock[]): Promise<void> => {
      for (const block of blocks) {
        signal.throwIfAborted();
        if (block.type === 'tool-result') await collect(block.content);
        if (block.type !== 'image') continue;
        if (++imageCount > this.imageLimit)
          throw new LlmError('Request image count exceeded.', 'INVALID_REQUEST');
        if (images.has(block.attachment.attachmentId)) continue;
        if (!this.config.resolveImage)
          throw new LlmError('No image resolver is configured.', 'UNSUPPORTED_CONTENT');
        const image = await this.config.resolveImage(structuredClone(block.attachment), signal);
        signal.throwIfAborted();
        if (
          image.attachment.attachmentId !== block.attachment.attachmentId ||
          image.bytes !== image.data.byteLength ||
          image.bytes <= 0 ||
          !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(image.mediaType)
        )
          throw new LlmError('Image resolver returned inconsistent image data.', 'INVALID_REQUEST');
        imageBytes += Math.ceil(image.bytes / 3) * 4;
        if (imageBytes > this.requestLimit)
          throw new LlmError('Request image bytes exceeded.', 'INVALID_REQUEST');
        images.set(block.attachment.attachmentId, image);
      }
    };
    for (const message of options.messages) await collect(message.content);
    const messages = images.size
      ? await serializeMessagesWithImages(options.messages, {
          representation: { kind: 'base64' },
          requestImages: images,
          maxRequestImageBytes: this.requestLimit,
        })
      : serializeMessages(options.messages);
    if (!this.config.passReasoningContent)
      for (const message of messages)
        if (message.role === 'assistant') delete message.reasoning_content;
    const body = JSON.stringify({
      ...this.extra,
      model: options.model,
      messages: [
        ...(options.system === undefined
          ? []
          : [{ role: this.config.systemRole ?? 'system', content: options.system }]),
        ...messages,
      ],
      stream: true,
      stream_options: { include_usage: true },
      ...(options.tools?.length
        ? {
            tools: options.tools.map((tool) => ({ type: 'function', function: tool })),
            tool_choice: 'auto',
          }
        : {}),
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(options.maxTokens === undefined
        ? {}
        : { [this.config.maxTokensField ?? 'max_tokens']: options.maxTokens }),
      ...(options.stop === undefined ? {} : { stop: options.stop }),
      ...(options.reasoningEffort === undefined
        ? {}
        : { reasoning_effort: options.reasoningEffort }),
    });
    if (Buffer.byteLength(body) > this.requestLimit)
      throw new LlmError('Model request exceeds byte limit.', 'INVALID_REQUEST');
    return body;
  }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    using requestDeadline = deadline(options.signal, this.timeout, 'MODEL_REQUEST_TIMEOUT');
    const { signal } = requestDeadline;
    let response: Response | undefined;
    try {
      signal.throwIfAborted();
      const key = await this.config.apiKey?.(signal);
      signal.throwIfAborted();
      if (key !== undefined && !key.trim())
        throw new LlmError('Configured model credential is empty.', 'MISSING_CREDENTIAL');
      const body = await this.request(options, signal);
      signal.throwIfAborted();
      response = await fetch(this.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body,
      });
      if (!response.ok) {
        const retry = response.headers.get('retry-after');
        const delay = retry
          ? Number.isFinite(Number(retry))
            ? Number(retry) * 1000
            : Date.parse(retry) - Date.now()
          : 0;
        const requestId = response.headers.get('x-request-id');
        const overflow = await contextOverflow(
          response,
          Math.min(this.responseLimit, 64 * 1024),
          signal,
        );
        signal.throwIfAborted();
        throw new LlmError(
          `Model endpoint returned HTTP ${response.status}.`,
          response.status === 401 || response.status === 403
            ? 'AUTH'
            : response.status === 429
              ? 'RATE_LIMIT'
              : overflow
                ? CONTEXT_WINDOW_EXCEEDED_CODE
                : 'HTTP_ERROR',
          {
            status: response.status,
            ...(delay > 0 && Number.isFinite(delay) ? { providerRetryAfterMs: delay } : {}),
            ...(requestId ? { requestId: ProviderRequestId(requestId) } : {}),
          },
        );
      }
      if (
        !response.body ||
        !response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')
      )
        throw new LlmError('Model endpoint did not return an SSE stream.', 'MALFORMED_RESPONSE');
      let bytes = 0;
      const bounded = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array<ArrayBuffer>>({
          transform: (chunk, controller) => {
            bytes += chunk.byteLength;
            if (bytes > this.responseLimit)
              throw new LlmError('Model response exceeds byte limit.', 'RESPONSE_TOO_LARGE');
            controller.enqueue(new Uint8Array(chunk));
          },
        }),
      );
      yield* translate(parseSse(bounded));
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason;
      if (timeoutOf(signal)) throw new LlmError('Model request timed out.', 'TIMEOUT');
      if (error instanceof LlmError) throw error;
      throw new LlmError('Model transport or response processing failed.', 'TRANSPORT_ERROR', {
        cause: error,
      });
    } finally {
      if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
    }
  }
}
