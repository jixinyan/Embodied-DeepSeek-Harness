import type { StoreStatistics } from '@edh/storage';
import { HttpError } from './local-http.js';

export function maintenanceBlocker(activity: {
  stopping: boolean;
  admitting: boolean;
  sessionBusy: boolean;
  sessionId: string | null;
  activeTask: boolean;
}): string | null {
  if (activity.stopping) return 'The server is stopping.';
  if (activity.admitting || activity.sessionBusy)
    return 'A session or task operation is in progress.';
  if (activity.sessionId) return 'End the user session before compacting storage.';
  if (activity.activeTask) return 'Finish or stop the current task before compacting storage.';
  return null;
}

export function admitStorageCompaction(
  input: Record<string, unknown>,
  statistics: StoreStatistics,
  blockedBy: string | null,
): void {
  if (
    Object.keys(input).length !== 1 ||
    !Object.hasOwn(input, 'expectedSequence') ||
    !Number.isSafeInteger(input.expectedSequence) ||
    (input.expectedSequence as number) < 0
  )
    throw new HttpError(400, 'Expected the inspected storage sequence.');
  if (blockedBy) throw new HttpError(409, blockedBy);
  if (input.expectedSequence !== statistics.sequence)
    throw new HttpError(409, 'Storage changed. Refresh storage information before compaction.');
}
