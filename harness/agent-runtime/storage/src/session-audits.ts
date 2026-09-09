import { isDeepStrictEqual } from 'node:util';
import type { LocalStore } from './local-store.js';

interface AuditIndex {
  format: 'edh.session-audit.v1';
  count: number;
}
/** Append native DSH audit events separately; this is not a resumable session backend. */
export class SessionAudits {
  constructor(private readonly store: LocalStore) {}
  append(runId: string, assignmentId: string, events: unknown): void {
    if (!Array.isArray(events)) throw new Error('Expected a native session event array.');
    const key = `session-audit:${runId}:${assignmentId}`;
    const prior = this.store.get<AuditIndex | unknown[]>(key);
    const legacy = Array.isArray(prior?.value) ? prior.value : undefined;
    const count = legacy?.length ?? (prior?.value as AuditIndex | undefined)?.count ?? 0;
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
  read(runId: string) {
    return this.store.list<AuditIndex | unknown[]>(`session-audit:${runId}:`).map((record) => {
      if (Array.isArray(record.value)) return record;
      if (record.value.format !== 'edh.session-audit.v1') throw new Error('Unknown audit index.');
      const assignmentId = record.key.slice(`session-audit:${runId}:`.length);
      const events = Array.from({ length: record.value.count }, (_, index) => {
        const entry = this.store.get(`session-audit-event:${runId}:${assignmentId}:${index}`);
        if (!entry) throw new Error('Incomplete session audit.');
        return entry.value;
      });
      return { ...record, value: events };
    });
  }
}
