import { z } from 'zod';
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout';
import { snapshotSessionEvent, type SessionEvent } from '@deepseek-ai/dsh-session';
import { CORE_TOOLS, nativeToolName } from '@edh/tools';

const text = z.string();
const count = z.number().int().nonnegative().safe();
const step = { turn: count.positive(), step: count.positive() };
const jsonObject = z.record(text, z.unknown());
const range = z.object({ start: count, end: count }).strict();
const nativeTools = new Set(CORE_TOOLS.map(nativeToolName));
const toolName = text.refine((name) => nativeTools.has(name), 'Unknown native tool payload.');
const retryFields = {
  retryId: text.min(1),
  ...step,
  provider: text.min(1),
  policyKey: text.min(1),
  retry: count.positive(),
  delayMs: z.number().finite().nonnegative().max(MAX_TIMER_DELAY_MS),
  failure: jsonObject,
};
const nativeData = {
  'turn/start': z.object({ turn: count.positive() }).strict(),
  'turn/end': z.object({ turn: count.positive(), reason: jsonObject }).strict(),
  'step/start': z.object(step).strict(),
  'step/end': z.object(step).strict(),
  'user/message': jsonObject,
  'assistant/message': z
    .object({
      ...step,
      message: jsonObject,
      stream: z.array(jsonObject),
      usage: jsonObject.optional(),
      interrupted: z.literal(true).optional(),
    })
    .strict(),
  'assistant/attempt': z.object({ ...step, stream: z.array(jsonObject) }).strict(),
  'tool/call': z.object({ ...step, callId: text.min(1), name: toolName, arguments: text }).strict(),
  'tool/result': z
    .object({
      ...step,
      message: jsonObject,
      error: z.object({ name: text, code: text }).strict().optional(),
    })
    .strict(),
  'request/header': z
    .object({
      header: z
        .object({
          config: jsonObject,
          adapterDefaults: jsonObject.optional(),
          system: text.optional(),
          tools: z.array(jsonObject).optional(),
        })
        .strict(),
      reason: z.enum(['initial', 'resume', 'change', 'series']),
      startsSeries: z.literal(true).optional(),
    })
    .strict(),
  'request/context': z
    .object({
      provider: text.min(1),
      model: text.min(1),
      contextWindow: count.positive().optional(),
    })
    .strict(),
  'session/end-seed': z.object({ inherited: z.literal(true).optional() }).strict(),
  'agent/inbox/spliced': z
    .object({
      target: z.enum(['next-turn', 'next-step']),
      start: count,
      removedCount: count.optional(),
      inserted: z.array(jsonObject),
      outcome: z.literal('canceled').optional(),
    })
    .strict(),
  'todo/write': z
    .object({
      todos: z.array(
        z
          .object({ content: text, status: z.enum(['pending', 'in_progress', 'completed']) })
          .strict(),
      ),
    })
    .strict(),
  'compaction/start': z
    .object({ compactionId: text.min(1), sourceCommandId: text.optional(), turn: count.nullable() })
    .strict(),
  'compaction/end': z
    .object({
      compactionId: text.min(1),
      sourceCommandId: text.optional(),
      turn: count.nullable(),
      error: text.optional(),
    })
    .strict(),
  'compaction/prune': z
    .object({ shadowedRange: range, shadowedSeqs: z.array(count), shadowedTokenCount: count })
    .strict(),
  'compaction/summary': z
    .object({
      compactionId: text.min(1),
      sourceCommandId: text.optional(),
      summary: z.array(jsonObject),
      shadowedRange: range,
      shadowedSeqs: z.array(count),
      shadowedTokenCount: count,
      provider: text.min(1),
      model: text.min(1),
      maxTokens: count.positive().optional(),
      usage: jsonObject.optional(),
      rawOutput: z.array(jsonObject).optional(),
      llmStreamCall: z.literal(true).optional(),
    })
    .strict(),
  'edh/visual-history': z
    .object({
      maxImages: count.positive(),
      incomingImages: count,
      retainedImages: count,
      omitted: z.array(
        z
          .object({ originalSeq: count, replacementSeq: count, attachmentIds: z.array(text) })
          .strict(),
      ),
    })
    .strict(),
  'llm/retry': z
    .discriminatedUnion('mode', [
      z
        .object({ ...retryFields, mode: z.literal('normal'), maxRetries: count.positive() })
        .strict(),
      z.object({ ...retryFields, mode: z.literal('always') }).strict(),
    ])
    .refine((value) => value.mode === 'always' || value.retry <= value.maxRetries),
  'llm/retry-started': z
    .object({ retryId: text.min(1), ...step, retry: count.positive() })
    .strict(),
} satisfies Record<string, z.ZodType>;
const nativeEnvelope = z
  .object({
    type: text.min(1),
    seq: count,
    time: z.number().finite(),
    data: z.unknown(),
    ignorable: z.literal(true).optional(),
    sourceEventSeqs: z.array(count).optional(),
    surfaceOp: z.unknown().optional(),
  })
  .strict();

export function admitNativeAuditEvent(value: unknown): SessionEvent {
  const event = nativeEnvelope.parse(value);
  if (!Object.hasOwn(nativeData, event.type))
    throw new Error(`Unknown native audit event schema: ${event.type}`);
  nativeData[event.type as keyof typeof nativeData].parse(event.data);
  if (event.type === 'request/header')
    for (const tool of nativeData['request/header'].parse(event.data).header.tools ?? [])
      toolName.parse(tool.name);
  const pending = [event.data];
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== 'object') continue;
    const fields = item as Record<string, unknown>;
    if (fields.type === 'tool-call') toolName.parse(fields.name);
    if (fields.type === 'file')
      throw new Error('Native file attachment extensions require their own retention binding.');
    pending.push(...Object.values(item).filter((child) => child && typeof child === 'object'));
  }
  return snapshotSessionEvent(event as SessionEvent);
}
