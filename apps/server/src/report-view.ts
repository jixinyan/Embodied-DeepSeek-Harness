import { AssignmentReports } from '@edh/communication';
import type { ContractValidator } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
import type { RunState } from '@edh/tasks';
import { HttpError } from './local-http.js';

export function readRoleReports(
  store: LocalStore,
  validator: ContractValidator,
  runId: string,
  params: URLSearchParams,
) {
  for (const key of params.keys())
    if (!['assignment', 'before'].includes(key) || params.getAll(key).length !== 1)
      throw new HttpError(400, 'Invalid report query.');
  const assignmentId = params.get('assignment');
  const before = params.get('before') ?? undefined;
  if (
    !assignmentId ||
    !/^[A-Za-z0-9-]{1,128}$/.test(assignmentId) ||
    (before !== undefined && !/^[A-Za-z0-9-]{1,128}$/.test(before))
  )
    throw new HttpError(400, 'Select a report assignment and a valid optional cursor.');
  const run = store.get<RunState>(`run:${runId}`)?.value;
  if (!run) throw new HttpError(404, 'Run not found.');
  if (!Object.hasOwn(run.assignments, assignmentId))
    throw new HttpError(404, 'Report assignment not found in this run.');
  const reports = new AssignmentReports(store, validator);
  const latest = reports.read(assignmentId);
  if (latest && latest.report.task_scope.task_id !== runId)
    throw new Error('Report task scope conflicts with the selected run.');
  return { runId, assignmentId, ...reports.status(assignmentId, before, true) };
}
