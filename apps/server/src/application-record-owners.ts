import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { ContractValidator } from '@edh/contracts';
import { AssignmentFiles } from '@edh/files';
import type { LocalStore } from '@edh/storage';
import {
  AssignmentHistory,
  TaskGoals,
  VerdictHistory,
  parseGoalBinding,
  RunHistory,
  type RunState,
} from '@edh/tasks';
import type { DomainRecordOwner } from './domain-retention.js';
import { readClarification } from './clarifications.js';
import { admitSessionTask } from './task-admission.js';
import { SessionTaskCatalogs } from './session-task-catalog.js';
import type { UserSessionRecord } from './user-sessions.js';

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/);
const submissionSchema = z
  .object({
    scenario: z.string().min(1),
    requestId: z.string().regex(/^[A-Za-z0-9-]{8,80}$/),
    instruction: z.string().trim().min(1).max(4000),
    context: z.array(z.unknown()).max(4),
    contextRunIds: z.array(id).max(4),
    identity: z.string().min(1),
    catalogRevision: z.string().min(1).optional(),
    goal: z.unknown(),
    allowedSubgoalChecks: z.array(z.unknown()),
    predefinedGoals: z.array(z.unknown()),
  })
  .strict();

export interface ApplicationReferenceExtension {
  version: string;
  inspect(record: {
    readonly key: string;
    readonly value: unknown;
    readonly runId: string;
    readonly assignmentId?: string;
  }): readonly string[];
}

export function applicationRecordOwners(
  store: LocalStore,
  validator: ContractValidator,
  extension?: ApplicationReferenceExtension,
): DomainRecordOwner[] {
  if (extension) {
    z.string().min(1).max(128).parse(extension.version);
    if (typeof extension.inspect !== 'function')
      throw new Error('Application references require an inspector.');
  }
  const custom = extension
    ? Object.freeze({ version: extension.version, inspect: extension.inspect.bind(extension) })
    : undefined;
  const run = (runId: string) => {
    const state = store.get<RunState>(`run:${id.parse(runId)}`)?.value;
    if (!state || state.id !== runId)
      throw new Error('Application record source run is missing or conflicting.');
    return state;
  };
  const actor = (state: RunState, assignmentId: string, references: Set<string>) => {
    id.parse(assignmentId);
    const current = state.assignments[assignmentId];
    if (!current || current.id !== assignmentId)
      throw new Error('Application record assignment source is missing or conflicting.');
    const archived = current.detailsStored
      ? new AssignmentHistory(store, validator).read(state.id, assignmentId)
      : undefined;
    if (current.detailsStored && !archived)
      throw new Error('Application record assignment archive is missing.');
    if (archived) references.add(`assignment-history:${JSON.stringify([state.id, assignmentId])}`);
    const value = archived?.assignment ?? current;
    const brief = validator.parse('InvocationBrief', value.brief);
    if (
      value.id !== assignmentId ||
      value.sessionId !== current.sessionId ||
      brief.assignment_id !== assignmentId ||
      brief.task_scope.task_id !== state.id
    )
      throw new Error('Application record assignment scope conflicts.');
    return { ...value, brief };
  };
  const declaration = (
    key: string,
    value: unknown,
    state: RunState,
    references: Set<string>,
    assignmentId?: string,
  ) => {
    if (custom)
      for (const reference of z.array(z.string().min(1).max(512)).parse(
        custom.inspect(
          Object.freeze({
            key,
            value,
            runId: state.id,
            ...(assignmentId === undefined ? {} : { assignmentId }),
          }),
        ),
      ))
        references.add(reference);
    return { references: [...references], retain: false };
  };
  const owner = (prefix: string, inspect: DomainRecordOwner['inspect']): DomainRecordOwner => ({
    id: prefix.slice(0, -1),
    prefix,
    version: JSON.stringify(['1', custom?.version ?? null]),
    inspect,
  });
  return [
    owner('run-submission:', ({ key, value, version }) => {
      const state = run(key.slice('run-submission:'.length));
      const submission = submissionSchema.parse(value);
      if (
        version !== 1 ||
        submission.scenario !== state.scenario ||
        submission.instruction !== state.instruction
      )
        throw new Error('Task submission identity or immutable version conflicts.');
      const membership = store.get<{ sessionId: string }>(`run-user-session:${state.id}`);
      if (!membership || membership.version !== 1)
        throw new Error('Task submission requires retained session ownership.');
      const session = store.get<UserSessionRecord>(
        `user-session:${membership.value.sessionId}`,
      )?.value;
      if (!session || session.id !== membership.value.sessionId)
        throw new Error('Task submission source session is missing or conflicting.');
      const catalog = session.taskCatalog
        ? new SessionTaskCatalogs(store, validator).read(session)
        : undefined;
      if (!catalog)
        throw new Error('Task submission requires its retained task catalog for retention.');
      const admitted = admitSessionTask(
        {
          scenario: submission.scenario,
          requestId: submission.requestId,
          instruction: submission.instruction,
          contextRunIds: submission.contextRunIds,
          catalogRevision: submission.catalogRevision,
        },
        {
          session,
          allowedTasks: Object.keys(catalog.tasks),
          catalogRevision: catalog.descriptor.digest,
          tasks: catalog.tasks,
          store,
          validator,
        },
      );
      const { context: _current, ...admittedFields } = admitted;
      const { context: _historical, ...storedFields } = submission;
      if (
        !isDeepStrictEqual(admittedFields, storedFields) ||
        !isDeepStrictEqual(submission.context, state.taskContext ?? [])
      )
        throw new Error('Task submission conflicts with its admitted criteria or context.');
      const requestKey = `session-task-request:${session.id}:${submission.requestId}`;
      const request = store.get<{ runId: string; taskId: string; inputIdentity?: string }>(
        requestKey,
      );
      if (
        !request ||
        request.value.runId !== state.id ||
        request.value.taskId !== submission.scenario ||
        (request.value.inputIdentity ?? request.value.taskId) !== submission.identity
      )
        throw new Error('Task submission request source conflicts.');
      return declaration(
        key,
        value,
        state,
        new Set([
          `run:${state.id}`,
          `run-user-session:${state.id}`,
          `user-session:${session.id}`,
          `session-task-catalog:${session.id}`,
          requestKey,
          ...submission.contextRunIds.map((runId) => `run:${runId}`),
        ]),
      );
    }),
    owner('plan:', ({ key, value, version }) => {
      const state = run(key.slice('plan:'.length));
      const plan = validator.parse('PlanDocument', value);
      const references = new Set([`run:${state.id}`]);
      const decision = actor(state, plan.owner_assignment_id, references);
      if (
        plan.task_id !== state.id ||
        plan.version !== version ||
        plan.owner_assignment_id !== state.decisionAssignmentId ||
        plan.owner_agent_id !== decision.sessionId
      )
        throw new Error('Plan key, version or decision owner conflicts.');
      const submission = store.get(`run-submission:${state.id}`);
      if (submission) {
        const source = submissionSchema.parse(submission.value);
        const goals = new TaskGoals(
          validator,
          parseGoalBinding(source.goal, validator),
          source.allowedSubgoalChecks.map((check) => validator.parse('SuccessCheck', check)),
          source.predefinedGoals.map((goal) => parseGoalBinding(goal, validator)),
        );
        goals.prepare(plan);
        references.add(`run-submission:${state.id}`);
      }
      const items = new Map(plan.items.map((item) => [item.goal_id, item]));
      if (items.size !== plan.items.length || items.size > 64)
        throw new Error('Plan goal identities are duplicated or exceed the admitted limit.');
      const completed = new Set<string>();
      const visiting = new Set<string>();
      const visit = (goalId: string): void => {
        if (visiting.has(goalId)) throw new Error('Plan dependency cycle.');
        if (completed.has(goalId)) return;
        const item = items.get(goalId);
        if (!item) throw new Error('Plan dependency is missing.');
        visiting.add(goalId);
        for (const dependency of item.dependencies) visit(dependency);
        visiting.delete(goalId);
        completed.add(goalId);
        if (!item.last_verdict_ref) {
          if (item.status === 'done') throw new Error('Completed plan item requires a verdict.');
          return;
        }
        const accepted = state.verdicts.find(
          (result) => result.verdict_id === item.last_verdict_ref,
        );
        if (!accepted) throw new Error('Plan verdict source is missing.');
        const verdict = new VerdictHistory(store, validator).resolve(state.id, accepted);
        const latest = state.verdicts.findLast(
          (result) =>
            result.task_scope.task_id === state.id && result.task_scope.goal_id === goalId,
        );
        const request = state.requests.findLast((item) => item.goal_id === goalId);
        if (
          verdict.task_scope.task_id !== state.id ||
          verdict.task_scope.goal_id !== goalId ||
          verdict.goal_contract_id !== item.success_contract.id ||
          verdict.goal_contract_version !== item.success_contract.version ||
          (item.status === 'done' &&
            (verdict.status !== 'passed' ||
              latest?.verdict_id !== verdict.verdict_id ||
              (request && request.attempt_id !== verdict.task_scope.attempt_id)))
        )
          throw new Error('Plan verdict conflicts with its goal criteria or completion.');
        if ('detailsStored' in accepted)
          references.add(`verdict-history:${JSON.stringify([state.id, verdict.verdict_id])}`);
      };
      for (const goalId of items.keys()) visit(goalId);
      for (const request of state.requests) {
        const item = items.get(request.goal_id);
        if (!item || !isDeepStrictEqual(item.success_contract, request.success_contract))
          throw new Error('Plan does not preserve executed goal criteria.');
      }
      return declaration(key, value, state, references, plan.owner_assignment_id);
    }),
    owner('clarification:', ({ key }) => {
      const split = key.lastIndexOf(':');
      const runId = id.parse(key.slice('clarification:'.length, split));
      const question = readClarification(store, runId, key.slice(split + 1));
      if (!question) throw new Error('Clarification source is missing.');
      const state = run(runId);
      const references = new Set([`run:${runId}`]);
      const decision = actor(state, question.assignmentId, references);
      const attempt = /^attempt-([1-9][0-9]*)$/.exec(question.attemptId);
      if (
        question.assignmentId !== state.decisionAssignmentId ||
        !attempt ||
        !Number.isSafeInteger(Number(attempt[1])) ||
        Number(attempt[1]) > state.attempt
      )
        throw new Error('Clarification decision owner or task scope conflicts.');
      const history = new RunHistory(store);
      const total = history.total(state);
      let sourceFound = false;
      for (let offset = 0; offset < total; ) {
        const page = history.page(state, offset, total);
        for (const event of page.events) {
          if (event.type !== 'user.clarification') continue;
          const original = z.object({ id: z.string() }).parse(event.detail.clarification);
          if (original.id !== question.id) continue;
          const stable = (value: unknown) =>
            z
              .object({
                id: z.string(),
                runId: id,
                assignmentId: id,
                callId: z.string(),
                goalId: id,
                attemptId: id,
                question: z.string(),
                reason: z.string(),
                options: z.array(z.string()),
                createdAt: z.string(),
              })
              .parse(value);
          if (!isDeepStrictEqual(stable(event.detail.clarification), stable(question)))
            throw new Error('Clarification scope conflicts with its published question.');
          if (state.eventCount !== undefined) references.add(`event:${runId}:${event.sequence}`);
          sourceFound = true;
        }
        offset = page.throughSequence;
      }
      if (
        !sourceFound &&
        (question.goalId !== decision.brief.task_scope.goal_id ||
          question.attemptId !== decision.brief.task_scope.attempt_id)
      )
        throw new Error('Clarification historical goal requires a published source event.');
      const result = declaration(key, question, state, references, question.assignmentId);
      return { ...result, retain: question.state === 'pending' || question.delivery === 'queued' };
    }),
    owner('file:', ({ key, value, version }) => {
      const split = key.indexOf(':', 'file:'.length);
      const assignmentId = id.parse(key.slice('file:'.length, split));
      const path = key.slice(split + 1);
      const file = new AssignmentFiles(store).read(assignmentId, path);
      if (
        file.content !== z.string().parse(value) ||
        Number(file.version) !== version ||
        Buffer.byteLength(file.content) > 128 * 1024
      )
        throw new Error('Assignment file content or version conflicts.');
      const matches = [...store.scan<RunState>('run:')].filter(({ value: state }) =>
        Object.hasOwn(state.assignments, assignmentId),
      );
      if (matches.length !== 1) throw new Error('Assignment file requires exactly one source run.');
      const state = run(matches[0]!.value.id);
      const references = new Set([`run:${state.id}`]);
      actor(state, assignmentId, references);
      if (!custom)
        throw new Error('Assignment files require explicit content reference ownership.');
      return declaration(key, value, state, references, assignmentId);
    }),
  ];
}
