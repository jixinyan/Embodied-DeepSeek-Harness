import type { VerificationResult } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
import type { RunEvent, RunState } from './run-state.js';

export type RecoveryEvent = Pick<RunEvent, 'sequence' | 'type' | 'detail'>;
export interface RecoveryTrace {
  context: Record<string, unknown>;
  events: RecoveryEvent[];
  result: VerificationResult | null;
  error: string | null;
  runId?: string;
  eventCount?: number;
}
export interface RecoveryPage {
  recoveryId: string;
  afterIndex: number;
  throughIndex: number;
  eventTotal: number;
  events: RecoveryEvent[];
}

export class RecoveryHistory {
  constructor(private readonly store: LocalStore) {}
  create(id: string, runId: string, context: Record<string, unknown>): void {
    if (!id.trim() || !runId.trim()) throw new Error('Recovery and run identities are required.');
    this.store.put(
      `recovery:${id}`,
      { runId, context, events: [], eventCount: 0, result: null, error: null },
      0,
    );
  }
  read(id: string): RecoveryTrace {
    const record = this.store.get<RecoveryTrace>(`recovery:${id}`);
    if (!record) throw new Error('Recovery history not found.');
    this.count(record.value);
    return record.value;
  }
  private count(trace: RecoveryTrace): number {
    const count = trace.eventCount ?? trace.events.length;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid recovery event count.');
    if (trace.eventCount !== undefined && !trace.runId)
      throw new Error('Recovery history requires a run identity.');
    return count;
  }
  private event(runId: string, sequence: number): RecoveryEvent {
    const state = this.store.get<RunState>(`run:${runId}`)?.value;
    const count = state?.eventCount ?? state?.events.length;
    if (
      !state ||
      state.id !== runId ||
      !Number.isSafeInteger(count) ||
      count! < 0 ||
      !Number.isSafeInteger(sequence) ||
      sequence < 1 ||
      sequence > count!
    )
      throw new Error('Recovery event is outside published run history.');
    const event =
      state.eventCount === undefined
        ? state.events[sequence - 1]
        : this.store.get<RunEvent>(`event:${runId}:${sequence}`)?.value;
    if (!event || event.sequence !== sequence)
      throw new Error('Recovery references a missing run event.');
    return { sequence: event.sequence, type: event.type, detail: event.detail };
  }
  append(id: string, runId: string, sequence: number): number {
    const key = `recovery:${id}`;
    const record = this.store.get<RecoveryTrace>(key);
    if (!record) throw new Error('Recovery history not found.');
    const trace = record.value;
    const count = this.count(trace);
    if (trace.eventCount === undefined || trace.runId !== runId || trace.result)
      throw new Error('Recovery does not accept events from this run.');
    if (!Number.isSafeInteger(count + 1)) throw new Error('Recovery event index exhausted.');
    this.event(runId, sequence);
    if (count) {
      const previous = this.store.get<number>(`recovery-event:${id}:${count}`)?.value;
      if (!Number.isSafeInteger(previous) || previous! < 1 || sequence <= previous!)
        throw new Error('Recovery event sequence must increase.');
    }
    this.store.put(`recovery-event:${id}:${count + 1}`, sequence, 0);
    this.store.put(key, { ...trace, eventCount: count + 1 }, record.version);
    return count + 1;
  }
  update(id: string, result: VerificationResult | null, error: string | null): void {
    const key = `recovery:${id}`;
    const record = this.store.get<RecoveryTrace>(key);
    if (!record) throw new Error('Recovery history not found.');
    this.count(record.value);
    this.store.put(key, { ...record.value, result, error }, record.version);
  }
  page(id: string, afterIndex: number, throughIndex?: number): RecoveryPage {
    const trace = this.read(id);
    const count = this.count(trace);
    const through = throughIndex ?? count;
    if (
      !Number.isSafeInteger(afterIndex) ||
      !Number.isSafeInteger(through) ||
      afterIndex < 0 ||
      afterIndex > through ||
      through > count
    )
      throw new Error('Invalid recovery page boundary.');
    const events: RecoveryEvent[] = [];
    let bytes = 0;
    let previous =
      afterIndex === 0
        ? 0
        : trace.eventCount === undefined
          ? trace.events[afterIndex - 1]?.sequence
          : this.store.get<number>(`recovery-event:${id}:${afterIndex}`)?.value;
    if (!Number.isSafeInteger(previous) || previous! < (afterIndex ? 1 : 0))
      throw new Error('Recovery references a missing event index.');
    for (let index = afterIndex + 1; index <= Math.min(through, afterIndex + 32); index++) {
      const sequence =
        trace.eventCount === undefined
          ? trace.events[index - 1]?.sequence
          : this.store.get<number>(`recovery-event:${id}:${index}`)?.value;
      if (!Number.isSafeInteger(sequence) || sequence! <= previous!)
        throw new Error('Recovery references an invalid event sequence.');
      const event =
        trace.eventCount === undefined
          ? trace.events[index - 1]!
          : this.event(trace.runId!, sequence!);
      const size = Buffer.byteLength(JSON.stringify(event));
      if (events.length && bytes + size > 64 * 1024) break;
      events.push(event);
      bytes += size;
      previous = sequence;
    }
    return {
      recoveryId: id,
      afterIndex,
      throughIndex: afterIndex + events.length,
      eventTotal: through,
      events,
    };
  }
  restore(id: string): RecoveryTrace {
    const trace = this.read(id);
    const count = this.count(trace);
    const result = { ...trace, events: [] as RecoveryEvent[] };
    while (result.events.length < count)
      result.events.push(...this.page(id, result.events.length, count).events);
    return result;
  }
}
