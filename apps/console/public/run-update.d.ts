export const runUpdateProtocol: 'edh.run-update.v1';
export const maxEventBatch: 128;
export const maxEventBatchBytes: number;
export const maxRetainedEvents: 500;
export const maxRetainedEventBytes: number;
export interface EventState {
  id: string;
  events: { sequence: number }[];
  eventOffset?: number;
  eventCount?: number;
}
export interface RunUpdate<T extends EventState> {
  protocol: typeof runUpdateProtocol;
  runId: string;
  afterSequence: number;
  throughSequence: number;
  eventTotal: number;
  events: T['events'];
  projection: (Omit<T, 'events' | 'eventOffset'> & { eventCount: number }) | null;
}
export function runEventCursor(value: string, total: number): number;
export function receivedRunSequence(state: EventState): number;
export function retainRunEvents<T extends EventState>(state: T): T & { eventOffset: number };
export function createRunUpdate<T extends EventState>(
  state: T,
  afterSequence: number,
): RunUpdate<T>;
export function mergeRunUpdate<T extends EventState>(current: T, update: RunUpdate<T>): T;
export function appendRunHistory<T extends EventState>(
  current: T,
  page: Omit<RunUpdate<T>, 'protocol' | 'projection'>,
): T;
