/** OpenAI Responses transport for GPT-6 Astra and compatible endpoints. */

import { deadline, timeoutOf } from '@deepseek-ai/dsh-timeout';
import {
  LlmAdapter,
  LlmError,
  ProviderRequestId,
  ReasoningEffortId,
  type ContentBlock,
  type GenerateOptions,
  type LlmModelInfo,
  type LlmResolvedModelInfo,
  type StreamChunk,
  type ToolCallId,
} from '@deepseek-ai/dsh-llm';
import { brandString } from '@deepseek-ai/dsh-brand';
import type { ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment';

export interface OpenAIResponsesModel {
  id: string;
  name?: string;
  inputModalities?: readonly ('text' | 'image')[];
  contextWindow?: number;
  maxTokens?: number;
}

export interface OpenAIResponsesOptions {
  /** API root including `/v1` where required; no credentials, query or fragment. */
  baseURL: string;
  models: readonly OpenAIResponsesModel[];
  apiKey?: (signal: AbortSignal) => string | Promise<string>;
  resolveImage?: (ref: ImageAttachmentRef, signal: AbortSignal) => Promise<RequestImageAttachment>;
  timeoutMs?: number;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  maxImagesPerRequest?: number;
}

function positive(value: number | undefined, fallback: number): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result <= 0 || result > 2_147_483_647)
    throw new Error('Responses transport limits must be positive bounded integers.');
  return result;
}

function text(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

type ResponsesItem = Record<string, unknown>;

async function imageData(
  block: Extract<ContentBlock, { type: 'image' }>,
  resolver: OpenAIResponsesOptions['resolveImage'],
  signal: AbortSignal,
): Promise<ResponsesItem> {
  if (!resolver) throw new LlmError('No image resolver is configured.', 'UNSUPPORTED_CONTENT');
  const image = await resolver(structuredClone(block.attachment), signal);
  if (
    image.attachment.attachmentId !== block.attachment.attachmentId ||
    image.bytes !== image.data.byteLength ||
    image.bytes <= 0 ||
    !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(image.mediaType)
  )
    throw new LlmError('Image resolver returned inconsistent image data.', 'INVALID_REQUEST');
  return {
    type: 'input_image',
    image_url: `data:${image.mediaType};base64,${Buffer.from(image.data).toString('base64')}`,
  };
}

async function inputItems(
  options: GenerateOptions,
  config: OpenAIResponsesOptions,
  signal: AbortSignal,
): Promise<ResponsesItem[]> {
  const items: ResponsesItem[] = [];
  let imageCount = 0;
  const blocks = async (content: readonly ContentBlock[]): Promise<ResponsesItem[]> => {
    const result: ResponsesItem[] = [];
    for (const block of content) {
      signal.throwIfAborted();
      if (block.type === 'text') result.push({ type: 'input_text', text: block.text });
      else if (block.type === 'image') {
        if (++imageCount > (config.maxImagesPerRequest ?? 16))
          throw new LlmError('Request image count exceeded.', 'INVALID_REQUEST');
        result.push(await imageData(block, config.resolveImage, signal));
      } else if (block.type === 'tool-result') {
        result.push(...(await blocks(block.content)));
      }
    }
    return result;
  };
  for (const message of options.messages) {
    if (message.role === 'system') continue;
    const toolCalls = message.content.filter(
      (block): block is Extract<ContentBlock, { type: 'tool-call' }> => block.type === 'tool-call',
    );
    if (message.role === 'assistant') {
      for (const call of toolCalls)
        items.push({
          type: 'function_call',
          call_id: call.id,
          name: call.name,
          arguments: call.arguments,
        });
      const parts = await blocks(message.content.filter((block) => block.type !== 'tool-call'));
      if (parts.length) items.push({ role: 'assistant', content: parts });
      continue;
    }
    const results = message.content.filter(
      (block): block is Extract<ContentBlock, { type: 'tool-result' }> =>
        block.type === 'tool-result',
    );
    const regular = message.content.filter((block) => block.type !== 'tool-result');
    const parts = await blocks(regular);
    if (parts.length) items.push({ role: 'user', content: parts });
    for (const result of results)
      items.push({
        type: 'function_call_output',
        call_id: result.toolCallId,
        output: text(result.content) || '(no output)',
      });
  }
  return items;
}

async function* responseEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: any }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';
  let data: string[] = [];
  const flush = (): { event: string; data: any } | undefined => {
    if (!data.length) return undefined;
    const payload = data.join('\n');
    data = [];
    const current = { event: event || 'message', data: JSON.parse(payload) };
    event = '';
    return current;
  };
  try {
    while (true) {
      const next = await reader.read();
      buffer += decoder.decode(next.value ?? new Uint8Array(), { stream: !next.done });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        let line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line) {
          const result = flush();
          if (result) yield result;
        } else if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (next.done) break;
    }
    const result = flush();
    if (result) yield result;
  } finally {
    reader.releaseLock();
  }
}

function finishReason(response: any): Extract<StreamChunk, { type: 'finish' }>['reason'] {
  const status = response?.status;
  if (status === 'incomplete') {
    const reason = response?.incomplete_details?.reason;
    return reason === 'max_output_tokens'
      ? { kind: 'max-tokens' }
      : {
          kind: 'error',
          failure: {
            message: 'Responses generation was incomplete.',
            code: String(reason ?? 'INCOMPLETE'),
          },
        };
  }
  const hasTool =
    Array.isArray(response?.output) &&
    response.output.some((item: any) => item?.type === 'function_call');
  return hasTool ? { kind: 'tool-calls' } : { kind: 'stop' };
}

function usage(
  value: any,
):
  | { inputTokens: number; outputTokens: number; totalTokens?: number; reasoningTokens?: number }
  | undefined {
  if (
    !value ||
    !Number.isSafeInteger(value.input_tokens) ||
    !Number.isSafeInteger(value.output_tokens)
  )
    return undefined;
  const input = Math.max(0, value.input_tokens);
  const output = Math.max(0, value.output_tokens);
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    ...(Number.isSafeInteger(value.output_tokens_details?.reasoning_tokens)
      ? { reasoningTokens: value.output_tokens_details.reasoning_tokens }
      : {}),
  };
}

/** OpenAI Responses adapter. It is a transport adapter only; DSH still owns tool dispatch and the loop. */
export class OpenAIResponsesAdapter extends LlmAdapter {
  private readonly endpoint: string;
  private readonly config: OpenAIResponsesOptions;
  private readonly models: readonly OpenAIResponsesModel[];
  private readonly timeout: number;
  private readonly requestLimit: number;
  private readonly responseLimit: number;

  constructor(options: OpenAIResponsesOptions) {
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
        'Responses baseURL must be an HTTP(S) API root without credentials, query or fragment.',
      );
    this.endpoint = `${url.toString().replace(/\/$/, '')}/responses`;
    this.config = { ...options };
    this.models = structuredClone(options.models);
    const ids = new Set<string>();
    for (const model of this.models) {
      if (!model.id.trim() || ids.has(model.id))
        throw new Error('Invalid or duplicate Responses model ID.');
      ids.add(model.id);
    }
    this.timeout = positive(options.timeoutMs, 120_000);
    this.requestLimit = positive(options.maxRequestBytes, 32 * 1024 * 1024);
    this.responseLimit = positive(options.maxResponseBytes, 32 * 1024 * 1024);
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
      reasoning: {
        efforts: ['low', 'medium', 'high', 'xhigh', 'max'].map((id) => ({
          id: ReasoningEffortId(id),
          name: id,
        })),
      },
    };
  }

  private async request(options: GenerateOptions, signal: AbortSignal): Promise<string> {
    const input = await inputItems(options, this.config, signal);
    const body = JSON.stringify({
      model: options.model,
      ...(options.system === undefined ? {} : { instructions: options.system }),
      input,
      stream: true,
      ...(options.tools?.length
        ? {
            tools: options.tools.map((tool) => ({
              type: 'function',
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          }
        : {}),
      ...(options.maxTokens === undefined ? {} : { max_output_tokens: options.maxTokens }),
      ...(options.stop === undefined ? {} : { stop: options.stop }),
      ...(options.reasoningEffort && options.reasoningEffort !== 'off'
        ? { reasoning: { effort: options.reasoningEffort } }
        : {}),
      ...(options.temperature === undefined ||
      (options.reasoningEffort && options.reasoningEffort !== 'off')
        ? {}
        : { temperature: options.temperature }),
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
      const body = await this.request(options, signal);
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
        const requestId = response.headers.get('x-request-id');
        throw new LlmError(
          `Responses endpoint returned HTTP ${response.status}.`,
          response.status === 401 || response.status === 403
            ? 'AUTH'
            : response.status === 429
              ? 'RATE_LIMIT'
              : 'HTTP_ERROR',
          {
            status: response.status,
            ...(requestId ? { requestId: ProviderRequestId(requestId) } : {}),
          },
        );
      }
      if (
        !response.body ||
        !response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')
      )
        throw new LlmError(
          'Responses endpoint did not return an SSE stream.',
          'MALFORMED_RESPONSE',
        );
      let bytes = 0;
      const responseLimit = this.responseLimit;
      const bounded = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            bytes += chunk.byteLength;
            if (bytes > responseLimit)
              throw new LlmError('Model response exceeds byte limit.', 'RESPONSE_TOO_LARGE');
            controller.enqueue(chunk);
          },
        }),
      );
      yield* this.translate(responseEvents(bounded));
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason;
      if (timeoutOf(signal)) throw new LlmError('Model request timed out.', 'TIMEOUT');
      if (error instanceof LlmError) throw error;
      throw new LlmError('Responses model transport failed.', 'TRANSPORT_ERROR', {
        cause: error,
        ...(response ? { status: response.status } : {}),
      });
    } finally {
      if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
    }
  }

  private async *translate(
    events: AsyncIterable<{ event: string; data: any }>,
  ): AsyncGenerator<StreamChunk> {
    let nextIndex = 0;
    let textIndex: number | undefined;
    let reasoningIndex: number | undefined;
    let textValue = '';
    let reasoningValue = '';
    let pendingUsage: ReturnType<typeof usage>;
    const calls = new Map<
      number,
      { index: number; id: ToolCallId; name: string; arguments: string }
    >();
    for await (const { event, data } of events) {
      if (event === 'response.output_text.delta') {
        const delta = typeof data?.delta === 'string' ? data.delta : '';
        if (!delta) continue;
        textIndex ??= nextIndex++;
        if (textValue === '') yield { type: 'block-start', index: textIndex, blockType: 'text' };
        textValue += delta;
        yield { type: 'text-delta', index: textIndex, text: delta };
      } else if (event === 'response.reasoning_summary_text.delta') {
        const delta = typeof data?.delta === 'string' ? data.delta : '';
        if (!delta) continue;
        reasoningIndex ??= nextIndex++;
        if (reasoningValue === '')
          yield { type: 'block-start', index: reasoningIndex, blockType: 'reasoning' };
        reasoningValue += delta;
        yield { type: 'reasoning-delta', index: reasoningIndex, text: delta };
      } else if (event === 'response.output_item.added' && data?.item?.type === 'function_call') {
        const outputIndex = Number(data.output_index);
        if (!Number.isSafeInteger(outputIndex)) continue;
        const id = brandString<ToolCallId>(
          String(data.item.call_id ?? data.item.id ?? `call-${outputIndex}`),
        );
        const call = { index: nextIndex++, id, name: String(data.item.name ?? ''), arguments: '' };
        calls.set(outputIndex, call);
        yield { type: 'block-start', index: call.index, blockType: 'tool-call' };
      } else if (event === 'response.function_call_arguments.delta') {
        const outputIndex = Number(data.output_index);
        const call = calls.get(outputIndex);
        if (!call) continue;
        const delta = typeof data.delta === 'string' ? data.delta : '';
        call.arguments += delta;
        yield {
          type: 'tool-call-delta',
          index: call.index,
          id: call.id,
          ...(call.name ? { name: call.name } : {}),
          argumentsDelta: delta,
        };
      } else if (event === 'response.output_item.done' && data?.item?.type === 'function_call') {
        const outputIndex = Number(data.output_index);
        const call = calls.get(outputIndex);
        if (!call) continue;
        if (!call.arguments && typeof data.item.arguments === 'string') {
          call.arguments = data.item.arguments;
          yield {
            type: 'tool-call-delta',
            index: call.index,
            id: call.id,
            ...(call.name ? { name: call.name } : {}),
            argumentsDelta: call.arguments,
          };
        }
        yield {
          type: 'block-end',
          index: call.index,
          block: { type: 'tool-call', id: call.id, name: call.name, arguments: call.arguments },
        };
      } else if (event === 'response.completed' || event === 'response.incomplete') {
        if (textIndex !== undefined)
          yield { type: 'block-end', index: textIndex, block: { type: 'text', text: textValue } };
        if (reasoningIndex !== undefined)
          yield {
            type: 'block-end',
            index: reasoningIndex,
            block: { type: 'reasoning', text: reasoningValue },
          };
        pendingUsage = usage(data?.response?.usage);
        if (pendingUsage) yield { type: 'usage', usage: pendingUsage };
        yield { type: 'finish', reason: finishReason(data?.response ?? data) };
        return;
      } else if (event === 'response.failed' || event === 'error') {
        throw new LlmError('Responses model returned a failed event.', 'PROVIDER_ERROR');
      }
    }
    throw new LlmError('Responses stream ended without a terminal event.', 'STREAM_CLOSED');
  }
}
