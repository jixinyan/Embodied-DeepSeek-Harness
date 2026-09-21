import { createHash } from 'node:crypto';
import {
  taskContextSummary,
  VerdictHistory,
  type RunState,
  type TaskContextSummary,
} from '@edh/tasks';
import type { ContractValidator } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
import type { TaskPreset } from './deployment.js';
import type { UserSessionRecord } from './user-sessions.js';
import { SessionTaskHistory } from './session-task-history.js';

const ended = new Set(['succeeded', 'failed', 'cancelled', 'interrupted', 'unknown']);

export function admitSessionTask(
  input: Record<string, unknown>,
  options: {
    session: UserSessionRecord;
    allowedTasks: readonly string[];
    tasks: Readonly<
      Record<
        string,
        Pick<TaskPreset, 'instruction' | 'goal' | 'allowedSubgoalChecks' | 'predefinedGoals'>
      >
    >;
    store: LocalStore;
    validator: ContractValidator;
  },
) {
  if (
    Object.keys(input).some(
      (key) => !['scenario', 'requestId', 'instruction', 'contextRunIds'].includes(key),
    ) ||
    typeof input.scenario !== 'string' ||
    !options.allowedTasks.includes(input.scenario) ||
    !Object.hasOwn(options.tasks, input.scenario) ||
    typeof input.requestId !== 'string' ||
    !/^[A-Za-z0-9-]{8,80}$/.test(input.requestId)
  )
    throw new Error('Invalid task criteria or request ID for this session.');
  if (
    input.instruction !== undefined &&
    (typeof input.instruction !== 'string' ||
      !input.instruction.trim() ||
      input.instruction.length > 4000)
  )
    throw new Error('Task instruction must contain 1–4000 characters.');
  const contextRunIds = input.contextRunIds === undefined ? [] : input.contextRunIds;
  if (
    !Array.isArray(contextRunIds) ||
    contextRunIds.length > 4 ||
    contextRunIds.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(id)) ||
    new Set(contextRunIds).size !== contextRunIds.length
  )
    throw new Error('Select up to four distinct historical task IDs.');
  const context: TaskContextSummary[] = contextRunIds.map((runId: string) => {
    if (!new SessionTaskHistory(options.store).has(options.session, runId))
      throw new Error('Context must come from a task in this user session.');
    const owner = options.store.get<{ sessionId: string }>(`run-user-session:${runId}`);
    const record = options.store.get<RunState>(`run:${runId}`);
    if (owner?.value.sessionId !== options.session.id || !record || record.value.id !== runId)
      throw new Error('Historical task ownership or record is unavailable.');
    const run = record.value;
    if (!ended.has(run.state)) throw new Error('Selected task context is still active.');
    const summary = run.verdicts.findLast(
      (value) => value.task_scope.task_id === runId && value.task_scope.goal_id === run.finalGoalId,
    );
    const verdict = summary
      ? new VerdictHistory(options.store, options.validator).resolve(runId, summary)
      : undefined;
    return {
      runId,
      userSessionId: options.session.id,
      recordVersion: record.version,
      instruction: run.instruction,
      outcome: run.state as TaskContextSummary['outcome'],
      source: run.source,
      recordedAt: run.updatedAt,
      finalVerification: verdict
        ? {
            verdictId: verdict.verdict_id,
            status: verdict.status,
            explanation: verdict.explanation,
          }
        : null,
      skillIds: [...run.skillIds],
    };
  });
  taskContextSummary(context);
  const task = options.tasks[input.scenario]!;
  const instruction =
    input.instruction === undefined ? task.instruction : (input.instruction as string).trim();
  const identity =
    instruction === task.instruction && !contextRunIds.length
      ? input.scenario
      : `sha256:${createHash('sha256')
          .update(JSON.stringify([input.scenario, instruction, contextRunIds]))
          .digest('hex')}`;
  return {
    scenario: input.scenario,
    requestId: input.requestId,
    instruction,
    context,
    contextRunIds: [...contextRunIds] as string[],
    identity,
    goal: structuredClone(task.goal),
    allowedSubgoalChecks: structuredClone(task.allowedSubgoalChecks ?? []),
    predefinedGoals: structuredClone(task.predefinedGoals ?? []),
  };
}
