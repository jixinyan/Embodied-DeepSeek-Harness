import { isDeepStrictEqual } from 'node:util';
import type { LocalStore } from '@edh/storage';
import type { RunEvent, RunState } from './run-state.js';

/** Published run events plus an explicit restart annotation; never resumes sessions or motion. */
export class RunHistory {
  constructor(private readonly store: LocalStore) {}
  restore(state: RunState): RunState {
    const result = structuredClone(state);
    if (result.eventCount !== undefined) {
      if (!Number.isSafeInteger(result.eventCount) || result.eventCount < 0)
        throw new Error('Invalid run event count.');
      result.events = Array.from({ length: result.eventCount }, (_, index) => {
        const event = this.store.get<RunEvent>(`event:${result.id}:${index + 1}`)?.value;
        if (!event || event.sequence !== index + 1)
          throw new Error('Incomplete published run history.');
        return event;
      });
    }
    if (result.state === 'interrupted') {
      const interruption = this.store.get<RunEvent>(`run-interruption:${result.id}`)?.value;
      if (interruption) {
        if (interruption.sequence !== result.events.length + 1)
          throw new Error('Restart annotation does not match published history.');
        result.events.push(interruption);
      }
    }
    return result;
  }
  interrupt(state: RunState, expectedVersion: number): void {
    if (!['running', 'paused', 'verifying'].includes(state.state)) return;
    const published = this.restore(state).events;
    // Migrate legacy inline histories without replacing existing immutable events.
    if (state.eventCount === undefined)
      for (const [index, event] of published.entries()) {
        if (event.sequence !== index + 1) throw new Error('Invalid legacy run event sequence.');
        const key = `event:${state.id}:${event.sequence}`;
        const existing = this.store.get<RunEvent>(key);
        if (existing) {
          if (!isDeepStrictEqual(existing.value, event))
            throw new Error('Legacy run history conflicts with persisted events.');
        } else this.store.put(key, event, 0);
      }
    const key = `run-interruption:${state.id}`;
    const reason = 'The previous server stopped. History is read-only; execution is not resumed.';
    const annotation = this.store.get<RunEvent>(key)?.value ?? {
      sequence: published.length + 1,
      at: new Date().toISOString(),
      type: 'run.interrupted',
      detail: { reason },
    };
    if (annotation.sequence !== published.length + 1 || annotation.type !== 'run.interrupted')
      throw new Error('Conflicting restart annotation.');
    // Separate namespace preserves an uncommitted ordinary event at the same sequence.
    // A crash after this write is idempotently reconciled on the next startup.
    if (!this.store.get(key)) this.store.put(key, annotation, 0);
    this.store.put(
      `run:${state.id}`,
      {
        ...state,
        state: 'interrupted',
        updatedAt: annotation.at,
        error: reason,
        events: [],
        eventCount: published.length,
      },
      expectedVersion,
    );
  }
}
