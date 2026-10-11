import { brandString } from '@deepseek-ai/dsh-brand';
import {
  LlmError,
  type ContentBlock,
  type StreamChunk,
  type ToolCallId,
} from '@deepseek-ai/dsh-llm';
import { z } from 'zod';

const indexSchema = z.number().int().nonnegative().safe();
const identitySchema = z.string().min(1);
const itemSchema = z.object({
  type: z.literal('function_call'),
  call_id: identitySchema,
  name: identitySchema,
  arguments: z.string(),
  id: identitySchema.nullish(),
  status: z.enum(['in_progress', 'completed', 'incomplete']).nullish(),
});
const eventBase = {
  output_index: indexSchema,
  sequence_number: indexSchema,
};
const addedSchema = z.object({
  ...eventBase,
  type: z.literal('response.output_item.added'),
  item: itemSchema,
});
const closedSchema = z.object({
  ...eventBase,
  type: z.literal('response.output_item.done'),
  item: itemSchema,
});
const deltaSchema = z.object({
  ...eventBase,
  type: z.literal('response.function_call_arguments.delta'),
  item_id: identitySchema,
  delta: z.string(),
});
const argumentsDoneSchema = z.object({
  ...eventBase,
  type: z.literal('response.function_call_arguments.done'),
  item_id: identitySchema,
  arguments: z.string(),
});
const terminalSchema = z.object({
  type: z.enum(['response.completed', 'response.incomplete']),
  sequence_number: indexSchema,
  response: z
    .object({
      status: z.enum(['completed', 'incomplete']),
      output: z.array(z.object({ type: identitySchema }).passthrough()),
    })
    .passthrough(),
});

function protocol(message: string): never {
  throw new LlmError(message, 'PROVIDER_PROTOCOL_ERROR');
}

function admit<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) protocol('Invalid Responses function-call event fields.');
  return result.data;
}

export function responsesEventType(event: string, data: unknown): string {
  const value = admit(z.object({ type: identitySchema }), data);
  if (event !== 'message' && event !== value.type)
    protocol('Responses event name does not match its payload type.');
  return value.type;
}

export function responsesReplayOutput(
  response: unknown,
  retainedCalls: readonly Extract<ContentBlock, { type: 'tool-call' }>[],
): Record<string, unknown>[] {
  const value = admit(
    z.object({ output: z.array(z.object({ type: identitySchema }).passthrough()) }),
    response,
  );
  const retained = new Map(retainedCalls.map((call) => [call.id, call]));
  if (retained.size !== retainedCalls.length)
    protocol('Responses replay contains duplicate retained function calls.');
  const seen = new Set<string>();
  const output: Record<string, unknown>[] = [];
  for (const candidate of value.output) {
    if (candidate.type !== 'function_call') {
      output.push(structuredClone(candidate));
      continue;
    }
    const item = admit(itemSchema, candidate);
    if (seen.has(item.call_id)) protocol('Responses replay contains duplicate function calls.');
    seen.add(item.call_id);
    const call = retained.get(brandString<ToolCallId>(item.call_id));
    if (!call) continue;
    if (
      item.name !== call.name ||
      item.arguments !== call.arguments ||
      (item.status != null && item.status !== 'completed')
    )
      protocol('Responses replay does not match its retained function call.');
    output.push(structuredClone(candidate));
  }
  if (retainedCalls.some((call) => !seen.has(call.id)))
    protocol('Responses replay omits a retained function call.');
  return output;
}

interface FunctionCall {
  readonly index: number;
  readonly id: ToolCallId;
  readonly name: string;
  itemId: string | undefined;
  arguments: string;
  argumentsDone: boolean;
  closed: boolean;
  status: string | null | undefined;
}

// 此状态只检查 Responses wire 数据；工具分发与 Agent loop 仍由 DSH 负责。
export class ResponsesFunctionCalls {
  private readonly calls = new Map<number, FunctionCall>();
  private readonly callIds = new Set<string>();
  private readonly itemIds = new Map<string, number>();
  private sequence = -1;
  private terminated = false;

  private advance(sequence: number): void {
    if (this.terminated) protocol('Responses event follows its terminal event.');
    if (sequence <= this.sequence) protocol('Responses function-call events are out of order.');
    this.sequence = sequence;
  }

  private call(outputIndex: number): FunctionCall {
    const call = this.calls.get(outputIndex);
    if (!call) protocol('Responses arguments reference an unstarted function call.');
    return call;
  }

  private bind(outputIndex: number, call: FunctionCall, itemId: string | null | undefined): void {
    if (itemId == null) return;
    if (call.itemId !== undefined && call.itemId !== itemId)
      protocol('Responses function-call item identity changed.');
    const owner = this.itemIds.get(itemId);
    if (owner !== undefined && owner !== outputIndex)
      protocol('Responses function-call item identity is duplicated.');
    call.itemId = itemId;
    this.itemIds.set(itemId, outputIndex);
  }

  private identity(
    outputIndex: number,
    call: FunctionCall,
    item: z.infer<typeof itemSchema>,
  ): void {
    if (item.call_id !== call.id || item.name !== call.name)
      protocol('Responses function-call identity changed.');
    this.bind(outputIndex, call, item.id);
  }

  private delta(call: FunctionCall, argumentsDelta: string): StreamChunk {
    return {
      type: 'tool-call-delta',
      index: call.index,
      id: call.id,
      name: call.name,
      argumentsDelta,
    };
  }

  added(data: unknown, index: number): StreamChunk[] {
    const value = admit(addedSchema, data);
    admit(indexSchema, index);
    this.advance(value.sequence_number);
    if (this.calls.has(value.output_index) || this.callIds.has(value.item.call_id))
      protocol('Responses function-call identity is duplicated.');
    const call: FunctionCall = {
      index,
      id: brandString<ToolCallId>(value.item.call_id),
      name: value.item.name,
      itemId: undefined,
      arguments: value.item.arguments,
      argumentsDone: false,
      closed: false,
      status: value.item.status,
    };
    this.bind(value.output_index, call, value.item.id);
    this.calls.set(value.output_index, call);
    this.callIds.add(call.id);
    return [
      { type: 'block-start', index, blockType: 'tool-call' },
      this.delta(call, call.arguments),
    ];
  }

  append(data: unknown): StreamChunk[] {
    const value = admit(deltaSchema, data);
    this.advance(value.sequence_number);
    const call = this.call(value.output_index);
    if (call.closed || call.argumentsDone)
      protocol('Responses arguments follow function-call finalization.');
    this.bind(value.output_index, call, value.item_id);
    call.arguments += value.delta;
    return [this.delta(call, value.delta)];
  }

  argumentsDone(data: unknown): StreamChunk[] {
    const value = admit(argumentsDoneSchema, data);
    this.advance(value.sequence_number);
    const call = this.call(value.output_index);
    if (call.closed || call.argumentsDone)
      protocol('Responses function-call arguments are finalized more than once.');
    this.bind(value.output_index, call, value.item_id);
    const chunks = this.finalArguments(call, value.arguments);
    call.argumentsDone = true;
    return chunks;
  }

  private finalArguments(call: FunctionCall, argumentsValue: string): StreamChunk[] {
    if (call.arguments !== '' && call.arguments !== argumentsValue)
      protocol('Responses final arguments do not match streamed arguments.');
    if (call.argumentsDone && call.arguments !== argumentsValue)
      protocol('Responses finalized arguments changed.');
    if (call.arguments === argumentsValue) return [];
    call.arguments = argumentsValue;
    return [this.delta(call, argumentsValue)];
  }

  closed(data: unknown): StreamChunk[] {
    const value = admit(closedSchema, data);
    this.advance(value.sequence_number);
    const call = this.call(value.output_index);
    if (call.closed) protocol('Responses function call is completed more than once.');
    this.identity(value.output_index, call, value.item);
    const chunks = this.finalArguments(call, value.item.arguments);
    call.closed = true;
    call.status = value.item.status;
    chunks.push({
      type: 'block-end',
      index: call.index,
      block: { type: 'tool-call', id: call.id, name: call.name, arguments: call.arguments },
    });
    return chunks;
  }

  terminal(data: unknown): Record<string, unknown> {
    const value = admit(terminalSchema, data);
    this.advance(value.sequence_number);
    if (`response.${value.response.status}` !== value.type)
      protocol('Responses terminal event does not match its response status.');
    if (value.response.status === 'completed') {
      const outputCalls = value.response.output
        .map((item, outputIndex) => ({ item, outputIndex }))
        .filter(({ item }) => item.type === 'function_call');
      if (outputCalls.length !== this.calls.size)
        protocol('Responses terminal output does not match streamed function calls.');
      for (const { item, outputIndex } of outputCalls) {
        const finalItem = admit(itemSchema, item);
        const call = this.call(outputIndex);
        this.identity(outputIndex, call, finalItem);
        if (!call.closed || call.arguments !== finalItem.arguments)
          protocol('Responses terminal function call is incomplete or inconsistent.');
        if (
          (call.status != null && call.status !== 'completed') ||
          (finalItem.status != null && finalItem.status !== 'completed')
        )
          protocol('Responses completed output contains an unfinished function call.');
      }
    }
    this.terminated = true;
    return value.response;
  }
}
