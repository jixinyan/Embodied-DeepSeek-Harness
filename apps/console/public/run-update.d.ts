export const runUpdateProtocol: 'edh.run-update.v1';
export const maxEventBatch: 128;
export const maxEventBatchBytes: number;
export interface EventState {
  id: string;
  events: { sequence: number }[];
}
export interface RunUpdate<T extends EventState> {
  protocol: typeof runUpdateProtocol;
  runId: string;
  afterSequence: number;
  throughSequence: number;
  eventTotal: number;
  events: T['events'];
  projection: (Omit<T, 'events'> & { eventCount: number }) | null;
}
export function runEventCursor(value: string, total: number): number;
export function createRunUpdate<T extends EventState>(
  state: T,
  afterSequence: number,
): RunUpdate<T>;
export function mergeRunUpdate<T extends EventState>(current: T, update: RunUpdate<T>): T;
