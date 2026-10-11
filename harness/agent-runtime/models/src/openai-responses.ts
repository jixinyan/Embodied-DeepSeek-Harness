/** OpenAI Responses transport for GPT-6 Astra and compatible endpoints. */

import { deadline, timeoutOf } from '@deepseek-ai/dsh-timeout';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import {
  LlmAdapter,
  LlmError,
  ReasoningEffortId,
  type GenerateOptions,
  type LlmModelInfo,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm';
import type { ModelImageResolver } from './model-images.js';
import { responsesInputItems } from './responses-input.js';
import { ResponsesFunctionCalls, responsesEventType } from './responses-function-calls.js';
import { modelHttpFailure, modelProviderFailureCode } from './model-failures.js';

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
  resolveImage?: ModelImageResolver;
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

async function* responseEvents(
  stream: ReadableStream<Uint8Array<ArrayBuffer>>,
): AsyncGenerator<{ event: string; data: any }> {
  const reader = stream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(
      new EventSourceParserStream({ onError: 'terminate', maxBufferSize: 32 * 1024 * 1024 }),
    )
    .getReader();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      yield { event: next.value.event ?? 'message', data: JSON.parse(next.value.data) };
    }
  } finally {
    await reader.cancel();
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
  private readonly imageLimit: number;

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
    this.imageLimit = positive(options.maxImagesPerRequest, 16);
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
    const input = await responsesInputItems(
      options,
      {
        ...(this.config.resolveImage ? { resolveImage: this.config.resolveImage } : {}),
        maxImagesPerRequest: this.imageLimit,
        maxRequestBytes: this.requestLimit,
      },
      signal,
    );
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
    let stage = 'credential resolution';
    try {
      signal.throwIfAborted();
      const key = await this.config.apiKey?.(signal);
      signal.throwIfAborted();
      if (key !== undefined && !key.trim())
        throw new LlmError('Configured model credential is empty.', 'MISSING_CREDENTIAL');
      stage = 'request preparation';
      const body = await this.request(options, signal);
      signal.throwIfAborted();
      stage = 'HTTP connection';
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
        throw await modelHttpFailure(response, this.responseLimit, signal);
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
      stage = 'SSE response';
      const responseLimit = this.responseLimit;
      const bounded = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array<ArrayBuffer>>({
          transform(chunk, controller) {
            bytes += chunk.byteLength;
            if (bytes > responseLimit)
              throw new LlmError('Model response exceeds byte limit.', 'RESPONSE_TOO_LARGE');
            controller.enqueue(new Uint8Array(chunk));
          },
        }),
      );
      yield* this.translate(responseEvents(bounded));
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason;
      if (timeoutOf(signal)) throw new LlmError('Model request timed out.', 'TIMEOUT');
      if (error instanceof LlmError) throw error;
      throw new LlmError(`Responses request failed during ${stage}.`, 'TRANSPORT_ERROR', {
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
    const calls = new ResponsesFunctionCalls();
    for await (const { event: wireEvent, data } of events) {
      const event = responsesEventType(wireEvent, data);
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
        yield* calls.added(data, nextIndex++);
      } else if (event === 'response.function_call_arguments.delta') {
        yield* calls.append(data);
      } else if (event === 'response.function_call_arguments.done') {
        yield* calls.argumentsDone(data);
      } else if (event === 'response.output_item.done' && data?.item?.type === 'function_call') {
        yield* calls.closed(data);
      } else if (event === 'response.completed' || event === 'response.incomplete') {
        const response = calls.terminal(data);
        if (textIndex !== undefined)
          yield { type: 'block-end', index: textIndex, block: { type: 'text', text: textValue } };
        if (reasoningIndex !== undefined)
          yield {
            type: 'block-end',
            index: reasoningIndex,
            block: { type: 'reasoning', text: reasoningValue },
          };
        pendingUsage = usage(response?.usage);
        if (pendingUsage) yield { type: 'usage', usage: pendingUsage };
        yield {
          type: 'finish',
          reason: finishReason(response),
          ...(response && typeof response === 'object'
            ? { replayState: { response: structuredClone(response) } }
            : {}),
        };
        return;
      } else if (event === 'response.failed' || event === 'error') {
        throw new LlmError(
          'Responses model returned a failed event.',
          modelProviderFailureCode(event === 'response.failed' ? data?.response?.error : data),
        );
      }
    }
    throw new LlmError('Responses stream ended without a terminal event.', 'STREAM_CLOSED');
  }
}
