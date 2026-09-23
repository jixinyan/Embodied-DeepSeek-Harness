import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AssignmentReports } from '@edh/communication';
import { isWireTimestamp, type ContractValidator, type VerificationResult } from '@edh/contracts';
import { SensorSamples } from '@edh/perception';
import type { LocalStore } from '@edh/storage';
import { AssignmentHistory, RecoveryHistory, VerdictHistory, type RunState } from '@edh/tasks';
import { VerificationContexts } from '@edh/verification';
import type { DomainRecordOwner } from './domain-retention.js';

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/);
const count = z.number().int().nonnegative().safe();
const eventSchema = z
  .object({
    sequence: count.positive(),
    type: z.string().refine((value) => value.trim().length > 0),
    detail: z.record(z.string(), z.unknown()),
  })
  .strict();
const traceSchema = z
  .object({
    runId: id,
    context: z.record(z.string(), z.unknown()),
    events: z.array(eventSchema),
    eventCount: count.optional(),
    result: z.unknown(),
    error: z.string().nullable(),
  })
  .strict();
const keyFor = (prefix: string, ...ids: string[]) => prefix + JSON.stringify(ids);

export function taskRecordOwners(
  store: LocalStore,
  validator: ContractValidator,
): DomainRecordOwner[] {
  const run = (runId: string) => {
    const state = store.get<RunState>(`run:${runId}`)?.value;
    if (!state || state.id !== runId)
      throw new Error('Task record source run is missing or conflicting.');
    z.enum(['test_fixture', 'simulation', 'hardware']).parse(state.source);
    return state;
  };
  const actor = (state: RunState, assignmentId: string, references: Set<string>) => {
    id.parse(assignmentId);
    if (!Object.hasOwn(state.assignments, assignmentId))
      throw new Error('Referenced task assignment is missing.');
    const published = state.assignments[assignmentId]!;
    const archive = published.detailsStored
      ? new AssignmentHistory(store, validator).read(state.id, assignmentId)
      : undefined;
    if (published.detailsStored && !archive)
      throw new Error('Referenced task assignment archive is missing.');
    if (archive) references.add(keyFor('assignment-history:', state.id, assignmentId));
    const value = archive?.assignment ?? published;
    const brief = validator.parse('InvocationBrief', value.brief);
    if (
      value.id !== assignmentId ||
      published.id !== assignmentId ||
      value.sessionId !== published.sessionId ||
      brief.assignment_id !== assignmentId ||
      brief.task_scope.task_id !== state.id
    )
      throw new Error('Task assignment source identity conflicts.');
    return { value, brief };
  };
  const evidence = (
    state: RunState,
    evidenceId: string,
    references: Set<string>,
    agentVisible = true,
  ) => {
    const sample = new SensorSamples(store, validator, state.id, state.source).read(evidenceId);
    if (
      !sample ||
      sample.evidence.task_scope.task_id !== state.id ||
      (agentVisible && sample.evidence.visibility !== 'agent')
    )
      throw new Error('Task evidence is missing, restricted or belongs to another run.');
    references.add(keyFor('sensor-sample:', state.id, evidenceId));
  };
  const sourceEvent = (state: RunState, sequence: number, references: Set<string>) => {
    const total = count.parse(state.eventCount ?? state.events.length);
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > total)
      throw new Error('Recovery event is outside published run history.');
    const name = `event:${state.id}:${sequence}`;
    const row = state.eventCount === undefined ? undefined : store.get(name);
    if (state.eventCount !== undefined && (!row || row.version !== 1))
      throw new Error('Recovery source event is missing or was rewritten.');
    const value = state.eventCount === undefined ? state.events[sequence - 1] : row!.value;
    const event = eventSchema
      .extend({ at: z.string().refine(isWireTimestamp) })
      .strict()
      .parse(value);
    if (event.sequence !== sequence) throw new Error('Recovery source event sequence conflicts.');
    if (row) references.add(name);
    const { at: _at, ...body } = event;
    return body;
  };
  const trace = (recoveryId: string) => {
    id.parse(recoveryId);
    const value = traceSchema.parse(new RecoveryHistory(store).read(recoveryId));
    if (value.eventCount !== undefined && value.events.length)
      throw new Error('Indexed recovery history contains inline events.');
    return value;
  };
  const verdict = (state: RunState, input: unknown, references: Set<string>) => {
    const expected = validator.parse('VerificationResult', input);
    const matches = state.verdicts.filter((item) => item.verdict_id === expected.verdict_id);
    if (matches.length !== 1)
      throw new Error('Recovery accepted verdict is missing or duplicated.');
    const source = matches[0]!;
    const resolved = new VerdictHistory(store, validator).resolve(state.id, source);
    if (!isDeepStrictEqual(resolved, expected))
      throw new Error('Recovery verdict conflicts with its accepted source.');
    if ('detailsStored' in source)
      references.add(keyFor('verdict-history:', state.id, source.verdict_id));
    const verifier = actor(state, expected.verifier_assignment_id, references);
    if (
      verifier.value.sessionId !== expected.verifier_id ||
      !isDeepStrictEqual(verifier.brief.task_scope, expected.task_scope) ||
      verifier.brief.success_contract.id !== expected.goal_contract_id ||
      verifier.brief.success_contract.version !== expected.goal_contract_version
    )
      throw new Error('Recovery verdict conflicts with its verifier.');
    if (expected.task_scope.recovery_id)
      references.add(`recovery:${expected.task_scope.recovery_id}`);
    for (const evidenceId of new Set([
      ...expected.evidence_refs,
      ...expected.checks.flatMap((check) => check.evidence_refs),
    ]))
      evidence(state, evidenceId, references);
    return expected;
  };
  const sameGoal = (result: VerificationResult, state: RunState, goalId: string) => {
    if (result.task_scope.task_id !== state.id || result.task_scope.goal_id !== goalId)
      throw new Error('Recovery verdict belongs to another run or original goal.');
  };
  const owner = (prefix: string, inspect: DomainRecordOwner['inspect']): DomainRecordOwner => ({
    id: prefix.slice(0, -1),
    prefix,
    version: '1',
    inspect,
  });
  return [
    owner('assignment-history:', ({ key }) => {
      const [runId, assignmentId] = z
        .tuple([id, id])
        .parse(JSON.parse(key.slice('assignment-history:'.length)));
      if (key !== keyFor('assignment-history:', runId, assignmentId))
        throw new Error('Assignment archive key is not canonical.');
      const archive = new AssignmentHistory(store, validator).read(runId, assignmentId);
      if (!archive) throw new Error('Assignment archive is missing.');
      const state = run(runId);
      const references = new Set([`run:${runId}`]);
      const current = actor(state, assignmentId, references);
      const { assignment, lastObservationId } = archive;
      const { brief } = assignment;
      const published = state.assignments[assignmentId]!;
      if (
        !isDeepStrictEqual(current.value, assignment) ||
        (published.detailsStored &&
          (published.member !== assignment.member ||
            published.status !== assignment.status ||
            published.model !== assignment.model ||
            !isDeepStrictEqual(published.tools, assignment.tools) ||
            published.callerAssignmentId !== brief.caller_assignment_id ||
            published.lastObservationId !== lastObservationId ||
            published.verificationContextStored !== assignment.verificationContextStored))
      )
        throw new Error('Assignment archive conflicts with its published source.');
      for (const otherId of new Set([
        brief.caller_assignment_id,
        brief.expected_output.recipient,
      ])) {
        if (otherId === 'user') continue;
        const other = actor(state, otherId, references);
        if (
          other.brief.team_run_id !== brief.team_run_id ||
          (otherId === brief.caller_assignment_id &&
            other.value.sessionId !== brief.caller_agent_id)
        )
          throw new Error('Assignment caller or recipient identity conflicts.');
      }
      if (brief.caller_assignment_id === 'user' && brief.caller_agent_id !== 'user')
        throw new Error('Assignment user caller identity conflicts.');
      if (brief.task_scope.recovery_id) references.add(`recovery:${brief.task_scope.recovery_id}`);
      for (const evidenceId of new Set([
        ...brief.evidence_refs,
        ...brief.known_facts.flatMap((fact) => fact.evidence_refs),
        ...(assignment.report?.evidence_refs ?? []),
        ...(lastObservationId ? [lastObservationId] : []),
      ]))
        evidence(state, evidenceId, references);
      const report = new AssignmentReports(store, validator).read(assignmentId);
      if (
        assignment.report &&
        (!report ||
          !isDeepStrictEqual(report.report, assignment.report) ||
          report.version !== assignment.reportVersion)
      )
        throw new Error('Archived assignment report conflicts with its published source.');
      if (report) references.add(`report:${assignmentId}`);
      const samples = new SensorSamples(store, validator, runId, state.source);
      const context = new VerificationContexts(store, validator, samples, runId).inspect(
        assignmentId,
      );
      if (assignment.verificationContextStored && !context)
        throw new Error('Assignment verification context is missing.');
      if (context) {
        if (!isDeepStrictEqual(context.scope, brief.task_scope))
          throw new Error('Assignment verification context scope conflicts.');
        references.add(keyFor('verification-context:', runId, assignmentId));
      }
      references.delete(key);
      return { references: [...references], retain: false };
    }),
    owner('recovery:', ({ key }) => {
      const recoveryId = id.parse(key.slice('recovery:'.length));
      const record = trace(recoveryId);
      const state = run(record.runId);
      const references = new Set([`run:${state.id}`]);
      const goalId = id.parse(record.context.originalGoalId);
      const failed = verdict(state, record.context.failedVerdict, references);
      sameGoal(failed, state, goalId);
      if (failed.status !== 'failed')
        throw new Error('Recovery requires an accepted failed verdict.');
      if (record.result !== null) {
        const passed = verdict(state, record.result, references);
        sameGoal(passed, state, goalId);
        if (
          passed.status !== 'passed' ||
          passed.task_scope.recovery_id !== recoveryId ||
          passed.task_scope.attempt_id === failed.task_scope.attempt_id ||
          passed.verdict_id === failed.verdict_id ||
          passed.goal_contract_id !== failed.goal_contract_id ||
          passed.goal_contract_version !== failed.goal_contract_version
        )
          throw new Error('Recovery result does not establish subsequent original-goal success.');
      }
      if (record.context.ownerAssignmentId !== undefined) {
        const ownerId = id.parse(record.context.ownerAssignmentId);
        actor(state, ownerId, references);
        if (ownerId !== state.decisionAssignmentId)
          throw new Error('Recovery owner is not the run decision owner.');
      }
      if (record.context.failedRequest !== undefined) {
        const request = validator.parse('SubgoalRequest', record.context.failedRequest);
        const matches = state.requests.filter(
          (item) => item.idempotency_key === request.idempotency_key,
        );
        if (
          matches.length !== 1 ||
          !isDeepStrictEqual(matches[0], request) ||
          request.task_id !== failed.task_scope.task_id ||
          request.goal_id !== failed.task_scope.goal_id ||
          request.attempt_id !== failed.task_scope.attempt_id ||
          request.recovery_id !== failed.task_scope.recovery_id
        )
          throw new Error('Recovery failed request conflicts with its run source.');
        const requestOwner = actor(state, request.owner_assignment_id, references);
        if (
          request.owner_assignment_id !== state.decisionAssignmentId ||
          request.decision_owner_id !== requestOwner.value.sessionId ||
          request.team_run_id !== requestOwner.brief.team_run_id ||
          request.success_contract.id !== failed.goal_contract_id ||
          request.success_contract.version !== failed.goal_contract_version
        )
          throw new Error('Recovery failed request decision owner or success criteria conflict.');
        for (const evidenceId of request.context_refs) evidence(state, evidenceId, references);
      }
      if (record.context.failedExecution !== undefined) {
        const execution = validator.parse('ExecutionStatus', record.context.failedExecution);
        const matches = state.executions.filter(
          (item) => item.execution_id === execution.execution_id,
        );
        if (
          matches.length !== 1 ||
          execution.execution_id !== failed.execution_id ||
          !isDeepStrictEqual(execution.task_scope, failed.task_scope) ||
          !isDeepStrictEqual(matches[0]!.task_scope, execution.task_scope)
        )
          throw new Error('Recovery failed execution conflicts with its run source.');
        for (const evidenceId of execution.observation_refs)
          evidence(state, evidenceId, references, false);
        if (execution.boundary_event_id)
          references.add(
            keyFor(
              'verification-boundary:',
              state.id,
              execution.execution_id,
              execution.boundary_event_id,
            ),
          );
      }
      const total = record.eventCount ?? record.events.length;
      let previous = 0;
      for (let index = 1; index <= total; index++) {
        const name = `recovery-event:${recoveryId}:${index}`;
        const row = record.eventCount === undefined ? undefined : store.get<number>(name);
        if (record.eventCount !== undefined && (!row || row.version !== 1))
          throw new Error('Recovery event index is missing or was rewritten.');
        const sequence = row ? row.value : record.events[index - 1]!.sequence;
        if (!Number.isSafeInteger(sequence) || sequence <= previous)
          throw new Error('Recovery event sequence is invalid or unordered.');
        const event = sourceEvent(state, sequence, references);
        if (record.eventCount === undefined && !isDeepStrictEqual(event, record.events[index - 1]))
          throw new Error('Inline recovery event conflicts with its run source.');
        if (row) references.add(name);
        previous = sequence;
      }
      references.delete(key);
      return { references: [...references], retain: false };
    }),
    owner('recovery-event:', ({ key, value, version }) => {
      const split = key.lastIndexOf(':');
      const recoveryId = id.parse(key.slice('recovery-event:'.length, split));
      const index = count.positive().parse(Number(key.slice(split + 1)));
      if (key !== `recovery-event:${recoveryId}:${index}` || version !== 1)
        throw new Error('Recovery event index identity or immutable version conflicts.');
      const record = trace(recoveryId);
      if (record.eventCount === undefined)
        throw new Error('Recovery event index has no indexed source history.');
      const state = run(record.runId);
      const references = new Set([`recovery:${recoveryId}`, `run:${state.id}`]);
      sourceEvent(state, count.positive().parse(value), references);
      return { references: [...references], retain: false };
    }),
  ];
}
