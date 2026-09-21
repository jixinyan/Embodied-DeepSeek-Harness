import type { ContractValidator } from '@edh/contracts';
import { isDeepStrictEqual } from 'node:util';
import { AssignmentHistory, type RunState } from '@edh/tasks';
import type { LocalStore } from '@edh/storage';
import { SensorSamples } from '@edh/perception';
import { HttpError } from './local-http.js';

export function readAssignmentDetails(
  store: LocalStore,
  validator: ContractValidator,
  runId: string,
  params: URLSearchParams,
) {
  if (
    [...params.keys()].some((key) => key !== 'assignment') ||
    params.getAll('assignment').length !== 1
  )
    throw new HttpError(400, 'Select exactly one assignment.');
  const id = params.get('assignment')!;
  if (!/^[A-Za-z0-9-]{1,128}$/.test(id)) throw new HttpError(400, 'Invalid assignment identifier.');
  const run = store.get<RunState>(`run:${runId}`)?.value;
  if (!run || run.id !== runId) throw new HttpError(404, 'Run not found.');
  if (!Object.hasOwn(run.assignments, id))
    throw new HttpError(404, 'Assignment not found in this run.');
  const row = run.assignments[id]!;
  const archive = row.detailsStored
    ? new AssignmentHistory(store, validator).read(runId, id)
    : undefined;
  if (row.detailsStored && !archive) throw new Error('Published assignment details are missing.');
  const assignment = archive?.assignment ?? row;
  if (
    assignment.id !== id ||
    !assignment.brief ||
    assignment.brief.task_scope.task_id !== runId ||
    assignment.sessionId !== row.sessionId ||
    assignment.member !== row.member ||
    (archive &&
      (assignment.status !== row.status ||
        assignment.model !== row.model ||
        !isDeepStrictEqual(assignment.tools, row.tools) ||
        assignment.brief.caller_assignment_id !== row.callerAssignmentId ||
        archive.lastObservationId !== row.lastObservationId))
  )
    throw new Error('Assignment details conflict with the published run.');
  const observationId = archive?.lastObservationId ?? run.agentSeen[id]?.evidence.id;
  const observation = observationId
    ? new SensorSamples(store, validator, runId, run.source).read(observationId)
    : undefined;
  if (observationId && !observation) throw new Error('Assignment observation is missing.');
  if (observation && observation.evidence.visibility !== 'agent')
    throw new HttpError(403, 'Assignment observation is restricted.');
  return {
    runId,
    assignment,
    observation: observation ?? null,
    stream: archive?.stream ?? run.agentStreams?.[id] ?? null,
    archived: row.detailsStored === true,
  };
}
