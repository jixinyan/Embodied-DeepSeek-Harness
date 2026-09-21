import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { LocalStore } from '@edh/storage';
import type { UserClarification } from '@edh/tasks';

const identity = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const scopeIdentity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/);
const text = z.string().trim().min(1).max(12000);
const requestSchema = z
  .object({
    assignmentId: identity,
    callId: z.string().min(1).max(256),
    goalId: scopeIdentity,
    attemptId: scopeIdentity,
    question: text,
    reason: text,
    options: z.array(z.string().trim().min(1).max(1000)).max(8),
  })
  .strict();
export const clarificationResponseSchema = z
  .object({
    requestId: z.string().uuid(),
    text,
  })
  .strict();
const recordSchema: z.ZodType<UserClarification> = requestSchema
  .extend({
    format: z.literal('edh.clarification.v1'),
    id: z.string().regex(/^[a-f0-9]{64}$/),
    runId: identity,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    state: z.enum(['pending', 'answered', 'cancelled', 'interrupted']),
    response: clarificationResponseSchema.nullable(),
    delivery: z.enum(['none', 'queued', 'settled', 'failed', 'interrupted']),
    error: z.string().min(1).nullable(),
  })
  .superRefine((value, ctx) => {
    const answered = value.state === 'answered';
    if (answered !== (value.response !== null) || answered === (value.delivery === 'none'))
      ctx.addIssue({
        code: 'custom',
        message: 'Clarification response and delivery state disagree.',
      });
    if (new Set(value.options).size !== value.options.length)
      ctx.addIssue({ code: 'custom', message: 'Clarification choices must be distinct.' });
    const errorExpected =
      ['cancelled', 'interrupted'].includes(value.state) ||
      ['failed', 'interrupted'].includes(value.delivery);
    if (errorExpected !== (value.error !== null))
      ctx.addIssue({
        code: 'custom',
        message: 'Clarification error and lifecycle state disagree.',
      });
  });
export class ClarificationConflict extends Error {}

function questionId(runId: string, assignmentId: string, callId: string): string {
  return createHash('sha256')
    .update(JSON.stringify([runId, assignmentId, callId]))
    .digest('hex');
}
function key(runId: string, id: string): string {
  identity.parse(runId);
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(id);
  return `clarification:${runId}:${id}`;
}
function parseRecord(value: unknown, expectedKey: string): UserClarification {
  const record = recordSchema.parse(value);
  if (!isDeepStrictEqual(record, value)) throw new Error('Clarification record is not canonical.');
  if (
    key(record.runId, record.id) !== expectedKey ||
    questionId(record.runId, record.assignmentId, record.callId) !== record.id
  )
    throw new Error('Clarification record identity conflicts with its storage key.');
  return record;
}
export function readClarification(store: LocalStore, runId: string, id: string) {
  const name = key(runId, id);
  const record = store.get(name);
  return record ? parseRecord(record.value, name) : undefined;
}
export function replayClarificationResponse(record: UserClarification, input: unknown) {
  const response = clarificationResponseSchema.parse(input);
  if (record.state === 'answered') {
    if (!isDeepStrictEqual(record.response, response))
      throw new ClarificationConflict('This question already has a different response.');
    return record;
  }
  if (record.state !== 'pending')
    throw new ClarificationConflict('This question is no longer accepting responses.');
  return undefined;
}
export function interruptClarifications(store: LocalStore): void {
  for (const entry of store.scan('clarification:')) {
    const record = parseRecord(entry.value, entry.key);
    if (record.state !== 'pending' && record.delivery !== 'queued') continue;
    store.put(
      entry.key,
      {
        ...record,
        state: record.state === 'pending' ? 'interrupted' : record.state,
        delivery: record.delivery === 'queued' ? 'interrupted' : record.delivery,
        updatedAt: new Date().toISOString(),
        error: 'The server stopped before this interaction settled.',
      } satisfies UserClarification,
      entry.version,
    );
  }
}

export class UserClarifications {
  constructor(
    private readonly store: LocalStore,
    readonly runId: string,
    private readonly changed: (record: UserClarification) => void,
  ) {
    identity.parse(runId);
  }
  request(input: unknown): UserClarification {
    const request = requestSchema.parse(input);
    if (new Set(request.options).size !== request.options.length)
      throw new Error('Clarification choices must be distinct.');
    const id = questionId(this.runId, request.assignmentId, request.callId);
    const existing = readClarification(this.store, this.runId, id);
    if (existing) {
      const prior = requestSchema.parse({
        assignmentId: existing.assignmentId,
        callId: existing.callId,
        goalId: existing.goalId,
        attemptId: existing.attemptId,
        question: existing.question,
        reason: existing.reason,
        options: existing.options,
      });
      if (!isDeepStrictEqual(prior, request))
        throw new ClarificationConflict('A tool-call identity cannot change its question.');
      if (existing.state !== 'pending')
        throw new ClarificationConflict('This question has already been resolved.');
      return existing;
    }
    for (const entry of this.store.scan(`clarification:${this.runId}:`))
      if (parseRecord(entry.value, entry.key).state === 'pending')
        throw new ClarificationConflict('Answer the pending question before asking another.');
    const now = new Date().toISOString();
    return this.publish(
      {
        format: 'edh.clarification.v1',
        id,
        runId: this.runId,
        ...request,
        createdAt: now,
        updatedAt: now,
        state: 'pending',
        response: null,
        delivery: 'none',
        error: null,
      },
      0,
    );
  }
  answer(id: string, input: unknown): { record: UserClarification; replay: boolean } {
    const entry = this.store.get(key(this.runId, id));
    if (!entry) throw new ClarificationConflict('Question not found.');
    const record = parseRecord(entry.value, key(this.runId, id));
    const response = clarificationResponseSchema.parse(input);
    const replay = replayClarificationResponse(record, response);
    if (replay) return { record: replay, replay: true };
    return {
      record: this.publish(
        {
          ...record,
          state: 'answered',
          response,
          delivery: 'queued',
          updatedAt: new Date().toISOString(),
        },
        entry.version,
      ),
      replay: false,
    };
  }
  delivered(id: string, error?: string): UserClarification {
    const entry = this.store.get(key(this.runId, id));
    if (!entry) throw new ClarificationConflict('Question not found.');
    const record = parseRecord(entry.value, key(this.runId, id));
    if (record.state !== 'answered' || record.delivery !== 'queued')
      throw new ClarificationConflict('Response delivery is no longer pending.');
    return this.publish(
      {
        ...record,
        delivery: error === undefined ? 'settled' : 'failed',
        error: error ?? null,
        updatedAt: new Date().toISOString(),
      },
      entry.version,
    );
  }
  cancel(reason: string, assignmentId?: string): void {
    for (const entry of this.store.scan(`clarification:${this.runId}:`)) {
      const record = parseRecord(entry.value, entry.key);
      if (record.state !== 'pending' || (assignmentId && record.assignmentId !== assignmentId))
        continue;
      this.publish(
        { ...record, state: 'cancelled', error: reason, updatedAt: new Date().toISOString() },
        entry.version,
      );
    }
  }
  private publish(record: UserClarification, version: number): UserClarification {
    const admitted = recordSchema.parse(record);
    this.store.put(key(this.runId, record.id), admitted, version);
    this.changed(structuredClone(admitted));
    return structuredClone(admitted);
  }
}
