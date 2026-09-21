import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { LocalStore } from './local-store.js';

const auditIndexSchema = z
  .object({
    format: z.literal('edh.session-audit.v1'),
    count: z.number().int().nonnegative().safe(),
  })
  .strict();
type AuditIndex = z.infer<typeof auditIndexSchema>;
const identity = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9-]+$/);
export const auditPageLimits = Object.freeze({ assignments: 64, events: 128, bytes: 256 * 1024 });
export interface SessionAuditIndexPage {
  runId: string;
  sessions: { assignmentId: string; eventTotal: number }[];
  nextAfter: string | null;
}
export interface SessionAuditPage {
  runId: string;
  assignmentId: string;
  afterOffset: number;
  throughOffset: number;
  eventTotal: number;
  events: unknown[];
}

function countOf(value: AuditIndex | unknown[]): number {
  return Array.isArray(value) ? value.length : auditIndexSchema.parse(value).count;
}
/** Append native DSH audit events separately; this is not a resumable session backend. */
export class SessionAudits {
  constructor(private readonly store: LocalStore) {}
  append(runId: string, assignmentId: string, events: unknown): void {
    identity.parse(runId);
    identity.parse(assignmentId);
    if (!Array.isArray(events)) throw new Error('Expected a native session event array.');
    const key = `session-audit:${runId}:${assignmentId}`;
    const prior = this.store.get<AuditIndex | unknown[]>(key);
    const legacy = Array.isArray(prior?.value) ? prior.value : undefined;
    const count = prior ? countOf(prior.value) : 0;
    if (events.length < count) throw new Error('Session audit history regressed.');
    const eventKey = (index: number) => `session-audit-event:${runId}:${assignmentId}:${index}`;
    if (
      count &&
      !isDeepStrictEqual(
        events[count - 1],
        legacy?.[count - 1] ?? this.store.get(eventKey(count - 1))?.value,
      )
    )
      throw new Error('Native session audit prefix changed.');
    if (events.length === count && !legacy) return;
    for (let index = legacy ? 0 : count; index < events.length; index++) {
      const existing = this.store.get(eventKey(index));
      if (existing) {
        if (!isDeepStrictEqual(existing.value, events[index]))
          throw new Error('Session audit append conflict.');
      } else this.store.put(eventKey(index), events[index], 0);
    }
    // Publish only after all event writes; interrupted suffixes remain invisible until reconciled.
    this.store.put(
      key,
      { format: 'edh.session-audit.v1', count: events.length },
      prior?.version ?? 0,
    );
  }
  index(runId: string, afterAssignment?: string): SessionAuditIndexPage {
    identity.parse(runId);
    if (afterAssignment !== undefined) identity.parse(afterAssignment);
    const prefix = `session-audit:${runId}:`;
    if (afterAssignment !== undefined && !this.store.get(prefix + afterAssignment))
      throw new Error('Unknown audit assignment cursor.');
    let reached = afterAssignment === undefined;
    const sessions: SessionAuditIndexPage['sessions'] = [];
    for (const record of this.store.scan<AuditIndex | unknown[]>(prefix)) {
      const assignmentId = identity.parse(record.key.slice(prefix.length));
      if (!reached) {
        reached = assignmentId === afterAssignment;
        continue;
      }
      if (sessions.length === auditPageLimits.assignments)
        return { runId, sessions, nextAfter: sessions.at(-1)!.assignmentId };
      sessions.push({ assignmentId, eventTotal: countOf(record.value) });
    }
    return { runId, sessions, nextAfter: null };
  }
  page(
    runId: string,
    assignmentId: string,
    afterOffset = 0,
    eventTotal?: number,
  ): SessionAuditPage {
    return this.range(runId, assignmentId, 'forward', afterOffset, eventTotal);
  }
  before(
    runId: string,
    assignmentId: string,
    beforeOffset?: number,
    eventTotal?: number,
  ): SessionAuditPage {
    return this.range(runId, assignmentId, 'backward', beforeOffset, eventTotal);
  }
  private range(
    runId: string,
    assignmentId: string,
    direction: 'forward' | 'backward',
    boundary?: number,
    eventTotal?: number,
  ): SessionAuditPage {
    identity.parse(runId);
    identity.parse(assignmentId);
    const record = this.store.get<AuditIndex | unknown[]>(`session-audit:${runId}:${assignmentId}`);
    if (!record) throw new Error('Audit assignment not found.');
    const published = countOf(record.value);
    const total = eventTotal ?? published;
    const cursor = boundary ?? total;
    if (
      !Number.isSafeInteger(total) ||
      total < 0 ||
      total > published ||
      !Number.isSafeInteger(cursor) ||
      cursor < 0 ||
      cursor > total
    )
      throw new Error('Invalid audit page boundary.');
    const legacy = Array.isArray(record.value) ? record.value : undefined;
    const events: unknown[] = [];
    let bytes = 0;
    let position = direction === 'forward' ? cursor : cursor - 1;
    while (position >= 0 && position < total && events.length < auditPageLimits.events) {
      const entry = legacy
        ? { value: legacy[position] }
        : this.store.get(`session-audit-event:${runId}:${assignmentId}:${position}`);
      if (!entry) throw new Error('Incomplete session audit.');
      const size = Buffer.byteLength(JSON.stringify(entry.value));
      if (events.length && bytes + size > auditPageLimits.bytes) break;
      events.push(entry.value);
      bytes += size;
      if (bytes >= auditPageLimits.bytes) break;
      position += direction === 'forward' ? 1 : -1;
    }
    return {
      runId,
      assignmentId,
      afterOffset: direction === 'forward' ? cursor : cursor - events.length,
      throughOffset: direction === 'forward' ? cursor + events.length : cursor,
      eventTotal: total,
      events: direction === 'forward' ? events : events.reverse(),
    };
  }
  read(runId: string) {
    identity.parse(runId);
    return this.store.list<AuditIndex | unknown[]>(`session-audit:${runId}:`).map((record) => {
      if (Array.isArray(record.value)) return record;
      const count = countOf(record.value);
      const assignmentId = record.key.slice(`session-audit:${runId}:`.length);
      const events = Array.from({ length: count }, (_, index) => {
        const entry = this.store.get(`session-audit-event:${runId}:${assignmentId}:${index}`);
        if (!entry) throw new Error('Incomplete session audit.');
        return entry.value;
      });
      return { ...record, value: events };
    });
  }
}
