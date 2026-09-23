import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { LocalStore } from '@edh/storage';

const identifier = z.string().regex(/^[A-Za-z0-9-]{1,128}$/);
const headSchema = z
  .object({
    format: z.literal('edh.session-task-history.v1'),
    count: z.number().int().nonnegative().safe(),
    lastRunId: identifier.nullable(),
  })
  .strict()
  .refine((value) => (value.count === 0) === (value.lastRunId === null));
export type SessionTaskFields =
  | { runIds: string[]; taskHistory?: undefined }
  | { runIds?: undefined; taskHistory: z.infer<typeof headSchema> };
export type SessionTaskRecord = { id: string } & SessionTaskFields;
const sessionSchema = z.union([
  z.object({ id: identifier, runIds: z.array(identifier), taskHistory: z.never().optional() }),
  z.object({ id: identifier, runIds: z.never().optional(), taskHistory: headSchema }),
]);
const memberSchema = z
  .object({
    format: z.literal('edh.session-task-member.v1'),
    sessionId: identifier,
    runId: identifier,
    position: z.number().int().positive().safe(),
  })
  .strict();
type Member = z.infer<typeof memberSchema>;
type Compact<T> = Omit<T, 'runIds' | 'taskHistory'> & {
  taskHistory: z.infer<typeof headSchema>;
};

export const sessionTaskKey = (sessionId: string, runId: string) =>
  `session-task-member:${JSON.stringify([identifier.parse(sessionId), identifier.parse(runId)])}`;
export const emptySessionTaskHistory = (): z.infer<typeof headSchema> => ({
  format: 'edh.session-task-history.v1',
  count: 0,
  lastRunId: null,
});
export function sessionTaskCount(record: unknown): number {
  const checked = sessionSchema.parse(record);
  return checked.taskHistory ? checked.taskHistory.count : checked.runIds!.length;
}
export const readSessionTasks = (record: unknown): SessionTaskRecord => sessionSchema.parse(record);

export class SessionTaskHistory {
  constructor(private readonly store: LocalStore) {}

  readMember(sessionId: string, runId: string): Member | undefined {
    const row = this.store.get(sessionTaskKey(sessionId, runId));
    if (!row) return undefined;
    const member = memberSchema.parse(row.value);
    if (row.version !== 1 || member.sessionId !== sessionId || member.runId !== runId)
      throw new Error('Session task membership identity or version conflicts.');
    return member;
  }

  private retain(member: Member): void {
    memberSchema.parse(member);
    const prior = this.readMember(member.sessionId, member.runId);
    if (prior) {
      if (!isDeepStrictEqual(prior, member))
        throw new Error('Session task membership conflicts with its published position.');
      return;
    }
    this.store.put(sessionTaskKey(member.sessionId, member.runId), member, 0);
  }

  validate(record: unknown): SessionTaskRecord {
    const checked = sessionSchema.parse(record);
    if (checked.taskHistory?.lastRunId) {
      const tail = this.readMember(checked.id, checked.taskHistory.lastRunId);
      if (!tail || tail.position !== checked.taskHistory.count)
        throw new Error('Session task history head has no matching published membership.');
    }
    return checked;
  }

  has(record: unknown, runId: string): boolean {
    identifier.parse(runId);
    const checked = readSessionTasks(record);
    if (checked.runIds) return checked.runIds.includes(runId);
    const member = this.readMember(checked.id, runId);
    if (!member) return false;
    if (member.position > checked.taskHistory!.count)
      throw new Error('Session task membership is outside the published history.');
    if (
      (member.position === checked.taskHistory!.count) !==
      (runId === checked.taskHistory!.lastRunId)
    )
      throw new Error('Session task membership conflicts with the published history head.');
    return true;
  }

  migrate<T extends SessionTaskRecord>(record: T, version: number): Compact<T> {
    const checked = this.validate(record);
    if (checked.runIds && new Set(checked.runIds).size !== checked.runIds.length)
      throw new Error('Session task history contains duplicate task identities.');
    const source = this.store.get<T>(`user-session:${checked.id}`);
    if (source?.version !== version || !isDeepStrictEqual(source.value, record))
      throw new Error('Session task history source changed before migration.');
    if (checked.taskHistory) return record as Compact<T>;
    for (const [index, runId] of checked.runIds!.entries())
      this.retain({
        format: 'edh.session-task-member.v1',
        sessionId: checked.id,
        runId,
        position: index + 1,
      });
    const { runIds, ...rest } = record;
    const next = {
      ...rest,
      taskHistory: {
        ...emptySessionTaskHistory(),
        count: runIds!.length,
        lastRunId: runIds!.at(-1) ?? null,
      },
    } as Compact<T>;
    this.store.put(`user-session:${record.id}`, next, version);
    return next;
  }

  append<T extends SessionTaskRecord>(record: T, runId: string): Compact<T> {
    const checked = this.validate(record);
    if (!checked.taskHistory) throw new Error('Session task history requires startup migration.');
    const source = this.store.get<T>(`user-session:${checked.id}`);
    if (!source || !isDeepStrictEqual(source.value, record))
      throw new Error('Session task history source changed before admission.');
    if (this.readMember(checked.id, runId))
      throw new Error('Session task membership already exists.');
    const member: Member = {
      format: 'edh.session-task-member.v1',
      sessionId: checked.id,
      runId,
      position: checked.taskHistory.count + 1,
    };
    this.retain(member);
    const next = {
      ...record,
      updatedAt: new Date().toISOString(),
      taskHistory: { ...checked.taskHistory, count: member.position, lastRunId: runId },
    } as Compact<T>;
    this.store.put(`user-session:${checked.id}`, next, source.version);
    return next;
  }

  *members(record: unknown): Generator<Member> {
    const checked = this.validate(record);
    if (checked.runIds) {
      if (new Set(checked.runIds).size !== checked.runIds.length)
        throw new Error('Session task history contains duplicate task identities.');
      for (const [index, runId] of checked.runIds.entries())
        yield {
          format: 'edh.session-task-member.v1',
          sessionId: checked.id,
          runId,
          position: index + 1,
        };
      return;
    }
    const head = checked.taskHistory!;
    const positions = new Set<number>();
    for (const row of this.store.scan(`session-task-member:[${JSON.stringify(checked.id)},`)) {
      const member = memberSchema.parse(row.value);
      if (
        row.version !== 1 ||
        member.sessionId !== checked.id ||
        row.key !== sessionTaskKey(member.sessionId, member.runId)
      )
        throw new Error('Session task membership identity or version conflicts.');
      if (member.position > head.count) continue;
      if (
        positions.has(member.position) ||
        (member.position === head.count) !== (member.runId === head.lastRunId)
      )
        throw new Error('Session task membership conflicts with its published position.');
      positions.add(member.position);
      yield member;
    }
    if (positions.size !== head.count)
      throw new Error('Published session task membership is incomplete.');
  }
}
