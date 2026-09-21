import type { ContractValidator } from '@edh/contracts';
import { isDeepStrictEqual } from 'node:util';
import { AssignmentHistory, type RunState } from '@edh/tasks';
import type { LocalStore } from '@edh/storage';
import { SensorSamples } from '@edh/perception';
import { VerificationContexts } from '@edh/verification';
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
        assignment.verificationContextStored !== row.verificationContextStored ||
        !isDeepStrictEqual(assignment.tools, row.tools) ||
        assignment.brief.caller_assignment_id !== row.callerAssignmentId ||
        archive.lastObservationId !== row.lastObservationId))
  )
    throw new Error('Assignment details conflict with the published run.');
  const observationId = archive?.lastObservationId ?? run.agentSeen[id]?.evidence.id;
  const samples = new SensorSamples(store, validator, runId, run.source);
  const observation = observationId ? samples.read(observationId) : undefined;
  if (observationId && !observation) throw new Error('Assignment observation is missing.');
  if (observation && observation.evidence.visibility !== 'agent')
    throw new HttpError(403, 'Assignment observation is restricted.');
  const context = new VerificationContexts(store, validator, samples, runId).inspect(id);
  if (assignment.verificationContextStored && !context)
    throw new Error('Published verification context is missing.');
  let verification = null;
  if (context) {
    if (!isDeepStrictEqual(context.scope, assignment.brief.task_scope))
      throw new Error('Verification context conflicts with the assignment scope.');
    const evidence = samples.read(context.evidenceId);
    if (!evidence) throw new Error('Verification observation is missing.');
    if (evidence.evidence.visibility !== 'agent')
      throw new HttpError(403, 'Verification observation is restricted.');
    if (!isDeepStrictEqual(evidence.evidence.task_scope, context.scope))
      throw new Error('Verification observation conflicts with the assignment scope.');
    const accepted = run.verdicts.filter(
      (value) =>
        value.verifier_assignment_id === id || value.verification_request_id === context.requestId,
    );
    if (accepted.length > 1) throw new Error('Assignment has multiple accepted formal verdicts.');
    const verdict = accepted.length ? validator.parse('VerificationResult', accepted[0]) : null;
    if (
      verdict &&
      (verdict.verifier_assignment_id !== id ||
        verdict.verification_request_id !== context.requestId ||
        verdict.execution_id !== context.executionId ||
        verdict.boundary_event_id !== context.boundaryId ||
        verdict.verifier_id !== assignment.sessionId ||
        !isDeepStrictEqual(verdict.task_scope, context.scope) ||
        !isDeepStrictEqual(verdict.checks, context.facts) ||
        !isDeepStrictEqual(verdict.evidence_refs, [context.evidenceId]) ||
        verdict.goal_contract_id !== assignment.brief.success_contract.id ||
        verdict.goal_contract_version !== assignment.brief.success_contract.version)
    )
      throw new Error('Accepted verdict conflicts with its verification context.');
    verification = {
      status: verdict ? 'settled' : context.facts.length ? 'checked' : 'awaiting_checks',
      context,
      observation: evidence,
      verdict,
    };
  }
  return {
    runId,
    assignment,
    observation: observation ?? null,
    stream: archive?.stream ?? run.agentStreams?.[id] ?? null,
    archived: row.detailsStored === true,
    verification,
  };
}
