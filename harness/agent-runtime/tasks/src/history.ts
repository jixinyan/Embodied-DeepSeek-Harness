import { isDeepStrictEqual } from 'node:util';
import type { LocalStore } from '@edh/storage';
import type { RunEvent, RunState } from './run-state.js';

export interface RunEventPage {
  runId: string;
  afterSequence: number;
  throughSequence: number;
  eventTotal: number;
  events: RunEvent[];
}

/** Published run events plus an explicit restart annotation; never resumes sessions or motion. */
export class RunHistory {
  constructor(private readonly store: LocalStore) {}
  append(
    state: RunState,
    expectedVersion: number,
    type: string,
    detail: Record<string, unknown>,
  ): { event: RunEvent; version: number } {
    if (state.eventCount === undefined || state.events.length)
      throw new Error('Event publication requires a run projection.');
    const sequence = this.publishedCount(state) + 1;
    if (!Number.isSafeInteger(sequence)) throw new Error('Run event sequence exhausted.');
    if (!type.trim()) throw new Error('Run event type is required.');
    const event: RunEvent = {
      sequence,
      at: new Date().toISOString(),
      type,
      detail: structuredClone(detail),
    };
    this.store.put(`event:${state.id}:${sequence}`, event, 0);
    const version = this.store.put(
      `run:${state.id}`,
      { ...state, updatedAt: event.at, eventCount: sequence },
      expectedVersion,
    );
    state.updatedAt = event.at;
    state.eventCount = sequence;
    return { event, version };
  }
  private publishedCount(state: RunState): number {
    const count = state.eventCount ?? state.events.length;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid run event count.');
    return count;
  }
  private interruption(state: RunState): RunEvent | undefined {
    if (state.state !== 'interrupted') return undefined;
    const event = this.store.get<RunEvent>(`run-interruption:${state.id}`)?.value;
    if (
      event &&
      (event.sequence !== this.publishedCount(state) + 1 || event.type !== 'run.interrupted')
    )
      throw new Error('Restart annotation does not match published history.');
    return event;
  }
  total(state: RunState): number {
    return this.publishedCount(state) + (this.interruption(state) ? 1 : 0);
  }
  page(
    state: RunState,
    afterSequence: number,
    throughSequence = this.total(state),
    limit = 128,
    maxBytes = 256 * 1024,
  ): RunEventPage {
    const published = this.publishedCount(state);
    const interruption = this.interruption(state);
    const total = published + (interruption ? 1 : 0);
    if (
      !Number.isSafeInteger(afterSequence) ||
      !Number.isSafeInteger(throughSequence) ||
      afterSequence < 0 ||
      afterSequence > throughSequence ||
      throughSequence > total ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1
    )
      throw new Error('Invalid run history page boundary.');
    const events: RunEvent[] = [];
    let bytes = 0;
    const end = Math.min(afterSequence + limit, throughSequence);
    for (let sequence = afterSequence + 1; sequence <= end; sequence++) {
      if (events.length && bytes >= maxBytes) break;
      const event =
        sequence > published
          ? interruption
          : state.eventCount === undefined
            ? structuredClone(state.events[sequence - 1])
            : this.store.get<RunEvent>(`event:${state.id}:${sequence}`)?.value;
      if (!event || event.sequence !== sequence)
        throw new Error('Incomplete published run history.');
      const size = Buffer.byteLength(JSON.stringify(event));
      if (events.length && bytes + size > maxBytes) break;
      events.push(event);
      bytes += size;
    }
    return {
      runId: state.id,
      afterSequence,
      throughSequence: afterSequence + events.length,
      eventTotal: throughSequence,
      events,
    };
  }
  restore(state: RunState): RunState {
    const result = structuredClone({ ...state, events: [] as RunEvent[] });
    const total = this.total(state);
    while (result.events.length < total)
      result.events.push(...this.page(state, result.events.length, total).events);
    return result;
  }
  before(
    state: RunState,
    beforeSequence: number,
    limit = 128,
    maxBytes = 256 * 1024,
  ): RunEventPage {
    this.page(state, beforeSequence, beforeSequence, limit, maxBytes);
    const events: RunEvent[] = [];
    let bytes = 0;
    for (
      let sequence = beforeSequence;
      sequence > Math.max(0, beforeSequence - limit);
      sequence--
    ) {
      if (events.length && bytes >= maxBytes) break;
      const event = this.page(state, sequence - 1, sequence, 1).events[0]!;
      const size = Buffer.byteLength(JSON.stringify(event));
      if (events.length && bytes + size > maxBytes) break;
      events.push(event);
      bytes += size;
    }
    return {
      runId: state.id,
      afterSequence: beforeSequence - events.length,
      throughSequence: beforeSequence,
      eventTotal: beforeSequence,
      events: events.reverse(),
    };
  }
  interrupt(state: RunState, expectedVersion: number): void {
    if (!['running', 'paused', 'verifying'].includes(state.state)) return;
    const published = this.total(state);
    for (let after = 0; after < published; )
      after = this.page(state, after, published).throughSequence;
    // Migrate legacy inline histories without replacing existing immutable events.
    if (state.eventCount === undefined)
      for (const [index, event] of state.events.entries()) {
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
      sequence: published + 1,
      at: new Date().toISOString(),
      type: 'run.interrupted',
      detail: { reason },
    };
    if (annotation.sequence !== published + 1 || annotation.type !== 'run.interrupted')
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
        eventCount: published,
      },
      expectedVersion,
    );
  }
}
