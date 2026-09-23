import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AssignmentReports } from '@edh/communication';
import { isWireTimestamp, type ContractValidator } from '@edh/contracts';
import type { SensorSample } from '@edh/execution';
import { SensorSamples } from '@edh/perception';
import type { LocalStore } from '@edh/storage';
import {
  AssignmentHistory,
  RecoveryHistory,
  RunHistory,
  VerdictHistory,
  type RunEvent,
  type RunState,
  type TaskContextSummary,
} from '@edh/tasks';
import { VerificationContexts } from '@edh/verification';
import type { DomainRecordOwner } from './domain-retention.js';
import { readClarification } from './clarifications.js';
import { readSessionTasks, SessionTaskHistory, sessionTaskKey } from './session-task-history.js';
import type { UserSessionRecord } from './user-sessions.js';

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/);
const counter = z.number().int().nonnegative().safe();
const timestamp = z.string().refine(isWireTimestamp);
const source = z.enum(['test_fixture', 'simulation', 'hardware']);
const eventSchema = z
  .object({
    sequence: counter.positive(),
    at: timestamp,
    type: z.string().refine((value) => value.trim().length > 0),
    detail: z.record(z.string(), z.unknown()),
  })
  .strict();
const runSchema = z
  .object({
    id,
    instruction: z.string(),
    scenario: z.string().min(1),
    source,
    state: z.enum([
      'running',
      'paused',
      'verifying',
      'succeeded',
      'failed',
      'cancelled',
      'interrupted',
      'unknown',
    ]),
    createdAt: timestamp,
    updatedAt: timestamp,
    teamDigest: z.string().min(1),
    teamId: id,
    decisionAssignmentId: z.union([id, z.literal('')]),
    attempt: counter,
    activeGoalId: id.optional(),
    finalGoalId: id.optional(),
    activeRecoveryId: id.nullable().optional(),
    recoveryId: id.nullable(),
    retryChanges: z.array(z.string()),
    assignments: z.record(id, z.unknown()),
    events: z.array(eventSchema),
    eventCount: counter.optional(),
    executions: z.array(z.unknown()),
    requests: z.array(z.unknown()),
    verdicts: z.array(z.unknown()),
    latestSensor: z.object({ evidence: z.object({ id }) }).nullable(),
    agentSeen: z.record(id, z.unknown()),
    agentStreams: z.record(id, z.unknown()).optional(),
    skillIds: z.array(id),
    error: z.string().nullable(),
    taskContext: z.array(z.unknown()).max(4).optional(),
    clarification: z.unknown().optional(),
  })
  .strict();
const contextSchema = z
  .object({
    runId: id,
    userSessionId: id,
    recordVersion: counter.positive(),
    instruction: z.string(),
    outcome: z.enum(['succeeded', 'failed', 'cancelled', 'interrupted', 'unknown']),
    source,
    recordedAt: timestamp,
    finalVerification: z
      .object({
        verdictId: id,
        status: z.enum(['pending', 'running', 'passed', 'failed', 'unknown']),
        explanation: z.string(),
      })
      .strict()
      .nullable(),
    skillIds: z.array(id),
  })
  .strict();
const keyFor = (prefix: string, ...ids: string[]) => prefix + JSON.stringify(ids);

export interface RunRecordOwnerOptions {
  inlineEventReferences?: {
    version: string;
    inspect(event: RunEvent, runId: string): readonly string[];
  };
}

export function runRecordOwners(
  store: LocalStore,
  validator: ContractValidator,
  options: RunRecordOwnerOptions = {},
): DomainRecordOwner[] {
  const inlineEvents = options.inlineEventReferences
    ? Object.freeze({ ...options.inlineEventReferences })
    : undefined;
  if (inlineEvents) {
    z.string().min(1).max(128).parse(inlineEvents.version);
    if (typeof inlineEvents.inspect !== 'function')
      throw new Error('Inline event references require an inspector.');
  }
  const read = (runId: string) => {
    id.parse(runId);
    const row = store.get<RunState>(`run:${runId}`);
    if (!row || runSchema.parse(row.value).id !== runId)
      throw new Error('Run source is missing or conflicts with its key.');
    if (row.value.eventCount !== undefined && row.value.events.length)
      throw new Error('Run projection contains inline events.');
    return row;
  };
  const membership = (runId: string, references: Set<string>, expectedSessionId?: string) => {
    const key = `run-user-session:${runId}`;
    const row = store.get(key);
    if (!row) {
      if (expectedSessionId) throw new Error('Historical task session ownership is missing.');
      return undefined;
    }
    const { sessionId } = z.object({ sessionId: id }).strict().parse(row.value);
    if (row.version !== 1 || (expectedSessionId && expectedSessionId !== sessionId))
      throw new Error('Task session ownership identity or version conflicts.');
    const session = store.get<UserSessionRecord>(`user-session:${sessionId}`)?.value;
    if (!session || session.id !== sessionId || !new SessionTaskHistory(store).has(session, runId))
      throw new Error('Task has no matching published session membership.');
    references.add(key);
    references.add(`user-session:${sessionId}`);
    if (readSessionTasks(session).taskHistory) references.add(sessionTaskKey(sessionId, runId));
    return session;
  };
  const evidence = (
    state: RunState,
    evidenceId: string,
    references: Set<string>,
    visible = false,
  ) => {
    const sample = new SensorSamples(store, validator, state.id, state.source).read(evidenceId);
    if (
      !sample ||
      sample.evidence.task_scope.task_id !== state.id ||
      (visible && sample.evidence.visibility !== 'agent')
    )
      throw new Error('Run evidence is missing, restricted or has conflicting scope.');
    references.add(keyFor('sensor-sample:', state.id, evidenceId));
    return sample;
  };
  const recovery = (state: RunState, recoveryId: string, references: Set<string>) => {
    const record = new RecoveryHistory(store).read(id.parse(recoveryId));
    if (record.runId !== state.id) throw new Error('Run recovery has a conflicting source run.');
    references.add(`recovery:${recoveryId}`);
  };
  const assignment = (state: RunState, assignmentId: string, references: Set<string>) => {
    const published = state.assignments[assignmentId];
    if (!published || published.id !== assignmentId)
      throw new Error('Run assignment is missing or conflicting.');
    const archive = published.detailsStored
      ? new AssignmentHistory(store, validator).read(state.id, assignmentId)
      : undefined;
    if (published.detailsStored && !archive) throw new Error('Run assignment archive is missing.');
    if (archive) references.add(keyFor('assignment-history:', state.id, assignmentId));
    const actor = archive?.assignment ?? published;
    const brief = validator.parse('InvocationBrief', actor.brief);
    if (
      actor.id !== assignmentId ||
      actor.sessionId !== published.sessionId ||
      brief.assignment_id !== assignmentId ||
      brief.task_scope.task_id !== state.id
    )
      throw new Error('Run assignment identity conflicts.');
    return { actor, brief, archive };
  };
  const context = (state: RunState, input: TaskContextSummary, references: Set<string>) => {
    const summary = contextSchema.parse(input);
    if (summary.runId === state.id)
      throw new Error('Historical task context cannot reference itself.');
    const prior = read(summary.runId);
    if (
      summary.recordVersion > prior.version ||
      summary.instruction !== prior.value.instruction ||
      summary.source !== prior.value.source
    )
      throw new Error('Historical task context conflicts with its source.');
    membership(state.id, references, summary.userSessionId);
    membership(summary.runId, references, summary.userSessionId);
    references.add(`run:${summary.runId}`);
    if (summary.finalVerification) {
      const expected = summary.finalVerification;
      const matches = prior.value.verdicts.filter(
        (value) => value.verdict_id === expected.verdictId,
      );
      if (matches.length !== 1)
        throw new Error('Historical task verdict source is missing or duplicated.');
      const verdict = new VerdictHistory(store, validator).resolve(summary.runId, matches[0]!);
      if (verdict.status !== expected.status || verdict.explanation !== expected.explanation)
        throw new Error('Historical task verdict content conflicts.');
      if ('detailsStored' in matches[0]!)
        references.add(keyFor('verdict-history:', summary.runId, verdict.verdict_id));
    }
    for (const skillId of summary.skillIds) {
      if (!prior.value.skillIds.includes(skillId))
        throw new Error('Historical task skill source conflicts.');
      references.add(`skill:${skillId}`);
    }
  };
  const configuration = (state: RunState, references: Set<string>) => {
    const key = `run-config:${state.id}`;
    const row = store.get(key);
    if (!row) return;
    const record = z
      .object({ mode: source, digest: z.string().min(1), team: z.unknown() })
      .parse(row.value);
    const team = validator.parse('TeamDefinition', record.team);
    if (
      row.version !== 1 ||
      record.mode !== state.source ||
      record.digest !== state.teamDigest ||
      team.team_id !== state.teamId
    )
      throw new Error('Run configuration identity or immutable version conflicts.');
    for (const actor of Object.values(state.assignments))
      if (!Object.hasOwn(team.members, actor.member))
        throw new Error('Run assignment member is absent from its configured Team.');
    if (
      state.decisionAssignmentId &&
      state.assignments[state.decisionAssignmentId]?.member !== team.bindings.decision_owner
    )
      throw new Error('Run decision owner conflicts with its configured Team.');
    const session = membership(state.id, references);
    if (session && !isDeepStrictEqual(session.configuration, row.value))
      throw new Error('Run configuration conflicts with its source session.');
    references.add(key);
  };
  const interruption = (state: RunState, references: Set<string>) => {
    const key = `run-interruption:${state.id}`;
    const row = store.get(key);
    if (!row) return;
    const event = eventSchema.parse(row.value);
    const total = state.eventCount ?? state.events.length;
    z.object({ reason: z.string().min(1) })
      .strict()
      .parse(event.detail);
    if (row.version !== 1 || event.sequence !== total + 1 || event.type !== 'run.interrupted')
      throw new Error('Run interruption identity or immutable version conflicts.');
    references.add(key);
  };
  const owner = (prefix: string, inspect: DomainRecordOwner['inspect']): DomainRecordOwner => ({
    id: prefix.slice(0, -1),
    prefix,
    version: prefix === 'run:' ? JSON.stringify(['1', inlineEvents?.version ?? null]) : '1',
    inspect,
  });
  return [
    owner('run:', ({ key }) => {
      const state = read(key.slice('run:'.length)).value;
      const references = new Set<string>();
      const samples = new SensorSamples(store, validator, state.id, state.source);
      membership(state.id, references);
      configuration(state, references);
      for (const prefix of ['run-submission:', 'plan:'])
        if (store.revision(prefix + state.id)) references.add(prefix + state.id);
      const total = state.eventCount ?? state.events.length;
      const history = new RunHistory(store);
      for (let offset = 0; offset < total; ) {
        const page = history.page(state, offset, total);
        for (const event of page.events) {
          eventSchema.parse(event);
          if (state.eventCount !== undefined) {
            const name = `event:${state.id}:${event.sequence}`;
            if (store.revision(name)?.version !== 1)
              throw new Error('Published run event was rewritten.');
            references.add(name);
          } else {
            if (!inlineEvents)
              throw new Error('Inline run events require explicit payload reference ownership.');
            const declared = z
              .array(z.string().min(1).max(512))
              .parse(inlineEvents.inspect(event, state.id));
            for (const reference of declared) references.add(reference);
          }
        }
        offset = page.throughSequence;
      }
      interruption(state, references);
      if (state.decisionAssignmentId) assignment(state, state.decisionAssignmentId, references);
      for (const assignmentId of Object.keys(state.assignments)) {
        const { actor, brief, archive } = assignment(state, assignmentId, references);
        for (const other of new Set([brief.caller_assignment_id, brief.expected_output.recipient]))
          if (other !== 'user') {
            const recipient = assignment(state, other, references);
            if (
              recipient.brief.team_run_id !== brief.team_run_id ||
              (other === brief.caller_assignment_id &&
                recipient.actor.sessionId !== brief.caller_agent_id)
            )
              throw new Error('Run assignment caller or recipient conflicts.');
          }
        if (brief.caller_assignment_id === 'user' && brief.caller_agent_id !== 'user')
          throw new Error('Run assignment user caller identity conflicts.');
        if (brief.task_scope.recovery_id) recovery(state, brief.task_scope.recovery_id, references);
        for (const ref of new Set([
          ...brief.evidence_refs,
          ...brief.known_facts.flatMap((fact) => fact.evidence_refs),
          ...(actor.report?.evidence_refs ?? []),
          ...(archive?.lastObservationId ? [archive.lastObservationId] : []),
        ]))
          evidence(state, ref, references, true);
        const report = new AssignmentReports(store, validator).read(assignmentId);
        if (
          actor.report &&
          (!report ||
            !isDeepStrictEqual(actor.report, report.report) ||
            actor.reportVersion !== report.version)
        )
          throw new Error('Run assignment report conflicts with its source.');
        if (report) references.add(`report:${assignmentId}`);
        const checked = new VerificationContexts(store, validator, samples, state.id).inspect(
          assignmentId,
        );
        if (actor.verificationContextStored && !checked)
          throw new Error('Run verification context is missing.');
        if (checked) {
          if (!isDeepStrictEqual(checked.scope, brief.task_scope))
            throw new Error('Run verification context scope conflicts.');
          references.add(keyFor('verification-context:', state.id, assignmentId));
        }
        if (store.revision(`session-audit:${state.id}:${assignmentId}`))
          references.add(`session-audit:${state.id}:${assignmentId}`);
      }
      const sampleSource = (sample: SensorSample, visible: boolean) => {
        if (!isDeepStrictEqual(sample, evidence(state, sample.evidence.id, references, visible)))
          throw new Error('Run sensor snapshot conflicts with its retained source.');
      };
      if (state.latestSensor) sampleSource(state.latestSensor, false);
      for (const [assignmentId, sample] of Object.entries(state.agentSeen)) {
        assignment(state, assignmentId, references);
        sampleSource(sample, true);
      }
      for (const recoveryId of new Set([state.recoveryId, state.activeRecoveryId]))
        if (recoveryId) recovery(state, recoveryId, references);
      for (const value of state.requests) {
        const request = validator.parse('SubgoalRequest', value);
        const owner = assignment(state, request.owner_assignment_id, references);
        if (
          request.task_id !== state.id ||
          request.owner_assignment_id !== state.decisionAssignmentId ||
          request.decision_owner_id !== owner.actor.sessionId ||
          request.team_run_id !== owner.brief.team_run_id
        )
          throw new Error('Run request decision owner or scope conflicts.');
        for (const ref of request.context_refs) evidence(state, ref, references, true);
        if (request.recovery_id) recovery(state, request.recovery_id, references);
      }
      for (const value of state.executions) {
        const execution = validator.parse('ExecutionStatus', value);
        if (execution.task_scope.task_id !== state.id)
          throw new Error('Execution belongs to another run.');
        const requests = state.requests.filter(
          (request) =>
            request.goal_id === execution.task_scope.goal_id &&
            request.attempt_id === execution.task_scope.attempt_id &&
            request.recovery_id === execution.task_scope.recovery_id,
        );
        if (requests.length !== 1) throw new Error('Run execution has no unique admitted request.');
        for (const ref of execution.observation_refs) evidence(state, ref, references);
        if (execution.task_scope.recovery_id)
          recovery(state, execution.task_scope.recovery_id, references);
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
      for (const value of state.verdicts) {
        const verdict = new VerdictHistory(store, validator).resolve(state.id, value);
        const verifier = assignment(state, verdict.verifier_assignment_id, references);
        const executions = state.executions.filter(
          (execution) => execution.execution_id === verdict.execution_id,
        );
        if (
          verdict.verifier_id !== verifier.actor.sessionId ||
          !isDeepStrictEqual(verdict.task_scope, verifier.brief.task_scope) ||
          executions.length !== 1 ||
          !isDeepStrictEqual(executions[0]!.task_scope, verdict.task_scope)
        )
          throw new Error('Run verdict verifier identity or scope conflicts.');
        if ('detailsStored' in value)
          references.add(keyFor('verdict-history:', state.id, verdict.verdict_id));
        for (const ref of new Set([
          ...verdict.evidence_refs,
          ...verdict.checks.flatMap((check) => check.evidence_refs),
        ]))
          evidence(state, ref, references, true);
        if (verdict.task_scope.recovery_id)
          recovery(state, verdict.task_scope.recovery_id, references);
      }
      if (state.clarification) {
        const record = readClarification(store, state.id, state.clarification.id);
        if (!record || !isDeepStrictEqual(record, state.clarification))
          throw new Error('Run clarification conflicts with its source.');
        assignment(state, record.assignmentId, references);
        references.add(`clarification:${state.id}:${record.id}`);
      }
      for (const skillId of state.skillIds) references.add(`skill:${skillId}`);
      for (const prior of state.taskContext ?? []) context(state, prior, references);
      return {
        references: [...references],
        retain: ['running', 'paused', 'verifying'].includes(state.state),
      };
    }),
    owner('run-config:', ({ key }) => {
      const state = read(key.slice('run-config:'.length)).value;
      const references = new Set([`run:${state.id}`]);
      configuration(state, references);
      references.delete(key);
      return { references: [...references], retain: false };
    }),
    owner('run-interruption:', ({ key }) => {
      const state = read(key.slice('run-interruption:'.length)).value;
      const references = new Set([`run:${state.id}`]);
      interruption(state, references);
      references.delete(key);
      return { references: [...references], retain: false };
    }),
  ];
}
