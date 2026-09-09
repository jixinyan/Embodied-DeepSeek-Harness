import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { SessionId } from '@deepseek-ai/dsh-session';
import { ToolCallId, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm';
import { textResponse } from './scripted-model.js';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout } from 'node:timers/promises';
import { ContractValidator, type VerificationResult, type PlanDocument } from '@edh/contracts';
import { FileTeamLoader } from '@edh/teams';
import { LocalStore } from '@edh/storage';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { UpperRun, CORE_TOOLS, terminal } from '../../apps/server/src/application.js';
import { FixtureModel } from '../../apps/server/src/fixture-model.js';
import {
  FixtureBackend,
  FIXTURE_GOAL,
  MULTI_GOAL_FIXTURE,
  FIXTURE_SUBGOAL_CHECKS,
  type FixtureScenario,
} from '../../apps/server/src/fixture-backend.js';

async function setup(scenario: FixtureScenario, tickMs = 15, model = new FixtureModel(0)) {
  const directory = await mkdtemp(resolve(tmpdir(), 'edh-upper-'));
  const store = new LocalStore(directory);
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const team = await new FileTeamLoader({
    validator,
    builtinDirectory: resolve('harness/agent-runtime/agents/roles'),
    roleRoot: resolve('examples'),
    defaultModel: 'fixture',
    models: ['fixture'],
    tools: CORE_TOOLS,
    providers: [],
  }).inspect('examples/teams/console-demo.yaml');
  const host = await createDshHost([{ providers: ['fixture'], adapter: model }]);
  const backend = new FixtureBackend(validator, scenario, tickMs);
  const run = new UpperRun({
    host,
    goal: scenario === 'multi-goal-recovery' ? MULTI_GOAL_FIXTURE : FIXTURE_GOAL,
    allowedSubgoalChecks: FIXTURE_SUBGOAL_CHECKS,
    team,
    validator,
    store,
    backend,
    instruction: 'Place the cup inside the cabinet.',
    scenario,
    model: () => ({ provider: 'fixture', model: 'fixture' }),
    assignmentLifetimeMs: 8000,
  });
  return {
    run,
    host,
    backend,
    store,
    model,
    close: async () => {
      await run.close();
      await host.fiber.dispose();
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
async function until(predicate: () => boolean, run: UpperRun) {
  const end = Date.now() + 16000;
  while (!predicate()) {
    if (Date.now() > end) assert.fail(JSON.stringify(run.snapshot(), null, 2));
    await setTimeout(10);
  }
}

test(
  'DSH roles execute failure, formal verification, planner retry and provenance-bound SKILL publication',
  { timeout: 10000 },
  async () => {
    const app = await setup('retry-success');
    try {
      await app.run.start();
      await until(() => terminal(app.run.state.state), app.run);
      await app.run.settle();
      assert.equal(
        app.run.state.state,
        'succeeded',
        JSON.stringify(app.run.state.events.slice(-10)),
      );
      assert.equal(app.run.state.attempt, 2);
      assert.equal(app.run.state.skillIds.length, 1);
      assert.deepEqual(
        app.run.state.verdicts.map((v) => v.status),
        ['failed', 'passed'],
      );
      assert.equal(app.run.plan()?.items[0]?.status, 'done');
      const identities = Object.values(app.run.state.assignments);
      assert.equal(new Set(identities.map((a) => a.sessionId)).size, identities.length);
      const created = app.run.state.events.findIndex((e) => e.type === 'recovery.opened');
      const evolved = app.run.state.events.findIndex(
        (e) =>
          e.type === 'agent.created' &&
          (e.detail.assignment as { member: string }).member === 'evolver',
      );
      assert(created < evolved);
      const artifact = await readFile(
        resolve(app.store.directory, 'skills', app.run.state.skillIds[0]!, 'SKILL.md'),
        'utf8',
      );
      assert.match(artifact, /test_fixture/);
      assert.match(artifact, /Verification guidance/);
      assert.match(artifact, /Failure signals/);
      assert.match(artifact, /Hypothesis/);
      const progress = app.run.state.events.filter(
        (e) =>
          e.type === 'message.delivered' &&
          (e.detail.payload as { kind?: string }).kind === 'recovery-progress',
      );
      assert(progress.length > 0, 'Evolver must receive progress before success');
      const trace = app.store.get<{ events: { type: string }[] }>(
        `recovery:${app.run.state.recoveryId}`,
      )!.value;
      assert(trace.events.some((e) => e.type === 'execution.updated'));
      assert(app.model.requests.length > 15);
      const lead = app.run.state.assignments[app.run.state.decisionAssignmentId]!;
      assert(lead.todos?.every((todo) => todo.status === 'completed'));
      assert(
        app.run.state.events.some(
          (e) => e.type === 'agent.output' && JSON.stringify(e.detail).includes('Open recovery'),
        ),
      );
      assert(app.run.state.events.filter((e) => e.type === 'agent.todos').length >= 4);
      assert(
        app.run.state.events.some(
          (e) =>
            e.type === 'dsh.tool-call' && (e.detail.data as { name: string }).name === 'todo_write',
        ),
      );
    } finally {
      await app.close();
    }
  },
);

test(
  'first-pass success does not create a recovery skill; unknown is never success',
  { timeout: 15000 },
  async () => {
    for (const scenario of ['first-pass', 'unknown', 'backend-error'] as const) {
      const app = await setup(scenario);
      try {
        await app.run.start();
        await until(() => terminal(app.run.state.state), app.run);
        await app.run.settle();
        assert.equal(app.run.state.state, scenario === 'first-pass' ? 'succeeded' : 'unknown');
        assert.equal(app.run.state.skillIds.length, 0);
        assert.equal(
          app.run.state.events.filter((e) => e.type === 'verification.requested').length,
          1,
        );
      } finally {
        await app.close();
      }
    }
  },
);

test(
  'user stop cancels active work; pause requires formal verification and explicit planner resume',
  { timeout: 15000 },
  async () => {
    const app = await setup('first-pass', 50);
    try {
      await app.run.start();
      await until(() => app.backend.query()?.control_steps === 1, app.run);
      await app.run.pause();
      await until(() => app.run.state.verdicts.length === 1, app.run);
      await app.run.settle();
      assert.equal(app.backend.query()?.state, 'paused');
      assert.equal(app.run.state.attempt, 1);
      await app.run.requestResume();
      await until(() => app.backend.query()?.state === 'running', app.run);
      await app.run.stop();
      await app.run.settle();
      assert.equal(app.run.state.state, 'cancelled');
      assert.equal(app.backend.query()?.device_confirmed, true);
      assert.equal(app.run.state.skillIds.length, 0);
    } finally {
      await app.close();
    }
  },
);

test(
  'multi-goal DSH run keeps repair success separate from recovery and final task success',
  { timeout: 25000 },
  async () => {
    const app = await setup('multi-goal-recovery');
    try {
      await app.run.start();
      await until(() => terminal(app.run.state.state), app.run);
      await app.run.settle();
      const state = app.run.snapshot();
      assert.equal(state.state, 'succeeded', JSON.stringify(state.events.slice(-12)));
      assert.deepEqual(
        state.requests.map((r) => r.goal_id),
        ['place-cup', 'open-cabinet', 'place-cup', 'store-cup'],
      );
      assert.equal(new Set(state.requests.map((r) => r.attempt_id)).size, 4);
      assert.deepEqual(
        state.verdicts.map((v) => [v.task_scope.goal_id, v.status]),
        [
          ['place-cup', 'failed'],
          ['open-cabinet', 'passed'],
          ['place-cup', 'passed'],
          ['store-cup', 'passed'],
        ],
      );
      assert(app.run.plan()!.items.every((item) => item.status === 'done'));
      const resolved = state.events.filter((e) => e.type === 'recovery.resolved');
      assert.equal(resolved.length, 1);
      assert.equal(resolved[0]!.detail.goalId, 'place-cup');
      const placementSuccess = state.verdicts[2]!;
      assert.equal(resolved[0]!.detail.verdictId, placementSuccess.verdict_id);
      assert.equal(
        state.requests[3]!.recovery_id,
        undefined,
        'Final closure is outside the resolved recovery.',
      );
      assert.equal(state.activeRecoveryId, null);
      assert.equal(state.skillIds.length, 1);
      const artifact = await readFile(
        resolve(app.store.directory, 'skills', state.skillIds[0]!, 'SKILL.md'),
        'utf8',
      );
      assert.match(artifact, new RegExp(placementSuccess.verdict_id));
      const context = app.store.get<{
        context: { originalGoalId: string };
        events: { detail: unknown }[];
        result: VerificationResult;
      }>(`recovery:${state.recoveryId}`)!.value;
      assert.equal(context.context.originalGoalId, 'place-cup');
      assert.equal(context.result.verdict_id, placementSuccess.verdict_id);
      assert(JSON.stringify(context.events).includes('open-cabinet'));
      for (const verdict of state.verdicts) {
        const verifier = state.assignments[verdict.verifier_assignment_id]!;
        const request = state.requests.find((r) => r.attempt_id === verdict.task_scope.attempt_id)!;
        assert.deepEqual(verifier.brief.success_contract, request.success_contract);
        assert.equal(verifier.brief.task_scope.goal_id, request.goal_id);
      }
      const opened = state.events.find((e) => e.type === 'recovery.opened')!;
      const replan = state.events.find(
        (e) => e.type === 'tool.started' && e.detail.tool === 'tasks.replan',
      )!;
      assert(replan.sequence < opened.sequence);
      const lastSucceeded = state.events.find((e) => e.type === 'run.succeeded')!;
      assert(resolved[0]!.sequence < lastSucceeded.sequence);
    } finally {
      await app.close();
    }
  },
);

class ManualPlannerModel extends FixtureModel {
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.tools?.some((t) => t.name === 'tasks__select_goal')) {
      yield* textResponse('Waiting for an explicit test-controlled Planner decision.')(options);
    } else yield* super.stream(options);
  }
}

test(
  'native goal tools reject missing plans, premature switching, dependency bypass and stale verifier control',
  { timeout: 25000 },
  async () => {
    const app = await setup('multi-goal-recovery', 20, new ManualPlannerModel(0));
    try {
      await app.run.start();
      await app.run.settle();
      const run = app.run;
      const owner = run.state.assignments[run.state.decisionAssignmentId]!;
      const invoke = (name: string, args: object = {}, assignmentId = owner.id) =>
        app.host.tools.execute({
          agent: app.host.agents.get(SessionId(run.state.assignments[assignmentId]!.sessionId))!,
          callId: ToolCallId(randomUUID()),
          name: name.replaceAll('.', '__'),
          arguments: args,
          signal: new AbortController().signal,
        });
      const ok = async (name: string, args: object = {}, id?: string) => {
        const result = await invoke(name, args, id);
        assert(!result.isError, JSON.stringify(result));
      };
      const rejected = async (name: string, args: object = {}, id?: string) => {
        assert.equal((await invoke(name, args, id)).isError, true, name);
      };
      await rejected('execution.start', { instruction: 'Move without a plan.' });
      assert.equal(run.state.requests.length, 0);
      const source = { kind: 'user' as const, reference: 'planner-subgoals:store-cup' };
      let plan: PlanDocument = {
        schema_version: 'physical.plan.v1',
        task_id: run.state.id,
        version: 1,
        owner_agent_id: owner.sessionId,
        owner_assignment_id: owner.id,
        items: [
          {
            goal_id: 'place-cup',
            description: 'Place cup.',
            status: 'active',
            dependencies: [],
            success_contract: {
              id: 'placement',
              version: '1',
              source,
              all: [FIXTURE_SUBGOAL_CHECKS[0]!],
            },
          },
          {
            goal_id: 'open-cabinet',
            description: 'Open cabinet.',
            status: 'planned',
            dependencies: [],
            success_contract: {
              id: 'access',
              version: '1',
              source,
              all: [FIXTURE_SUBGOAL_CHECKS[1]!],
            },
          },
          {
            goal_id: 'store-cup',
            description: 'Store cup and close cabinet.',
            status: 'planned',
            dependencies: ['place-cup'],
            success_contract: MULTI_GOAL_FIXTURE.successContract,
          },
        ],
      };
      await ok('planning.update', { plan, expectedVersion: 0 });
      await rejected('execution.start', { instruction: 'Bypass placement dependency.' });
      await ok('tasks.select_goal', { goalId: 'place-cup' });
      await ok('execution.start', { instruction: 'Place cup.' });
      await rejected('tasks.select_goal', { goalId: 'open-cabinet' });
      await until(() => run.state.verdicts.length === 1, run);
      await run.settle();
      const oldVerifier = run.state.verdicts[0]!.verifier_assignment_id;
      await rejected('tasks.select_goal', { goalId: 'open-cabinet' });
      await ok('tasks.replan', {
        reason: 'Test access.',
        changes: ['Open cabinet first.'],
        attemptSummary: 'Cup remained outside.',
      });
      plan = {
        ...plan,
        version: 2,
        items: plan.items.map((item) =>
          item.goal_id === 'place-cup'
            ? { ...item, dependencies: ['open-cabinet'], status: 'waiting' }
            : item,
        ),
      };
      await ok('planning.update', { plan, expectedVersion: 1 });
      await ok('tasks.select_goal', { goalId: 'open-cabinet' });
      await ok('execution.start', { instruction: 'Open cabinet.' });
      await rejected('execution.pause', {}, oldVerifier);
      await rejected('verification.check', {}, oldVerifier);
      await rejected(
        'verification.submit',
        { status: 'passed', explanation: 'Stale result.' },
        oldVerifier,
      );
      await until(() => run.state.verdicts.length === 2, run);
      await run.settle();
      assert.equal(
        run.state.skillIds.length,
        0,
        'A prerequisite cannot authorize a recovery skill.',
      );
      const evolver = Object.values(run.state.assignments).find((a) => a.member === 'evolver')!;
      await rejected('skills.save', { markdown: '# Premature success' }, evolver.id);
      await rejected('tasks.finish');
      await rejected('tasks.select_goal', { goalId: 'place-cup' });
      plan = {
        ...plan,
        version: 3,
        items: plan.items.map((item) =>
          item.goal_id === 'open-cabinet'
            ? { ...item, status: 'done', last_verdict_ref: run.state.verdicts[1]!.verdict_id }
            : item,
        ),
      };
      await ok('planning.update', { plan, expectedVersion: 2 });
      await ok('tasks.select_goal', { goalId: 'place-cup' });
      await rejected('execution.start', { instruction: 'Bypass explicit retry.' });
      await ok('tasks.retry', {
        changes: ['Cabinet open; place cup.'],
        attemptSummary: 'First placement failed, prerequisite now verified.',
      });
      await ok('execution.start', { instruction: 'Place cup in open cabinet.' });
      await until(() => run.state.verdicts.length === 3, run);
      await run.settle();
      assert.equal(run.state.state, 'verifying');
      assert.equal(
        run.state.skillIds.length,
        1,
        'Original subgoal success permits SKILL while the final task is unfinished.',
      );
      await rejected('tasks.finish');
      assert.equal(run.state.requests.length, 3);
    } finally {
      await app.close();
    }
  },
);

class FailedEvolverModel extends FixtureModel {
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.tools?.some((t) => t.name === 'skills__save'))
      throw new Error('Synthetic Evolver provider failure.');
    yield* super.stream(options);
  }
}

test(
  'Evolver model failure is recorded without blocking verified task completion',
  { timeout: 15000 },
  async () => {
    const app = await setup('retry-success', 15, new FailedEvolverModel(0));
    try {
      await app.run.start();
      await until(() => terminal(app.run.state.state), app.run);
      await app.run.settle();
      assert.equal(app.run.state.state, 'succeeded');
      assert.equal(app.run.state.skillIds.length, 0);
      assert(app.run.state.events.some((e) => e.type === 'recovery.failed'));
      assert(app.store.get<{ error: string }>(`recovery:${app.run.state.recoveryId}`)!.value.error);
    } finally {
      await app.close();
    }
  },
);

test('retry budget counts actual attempts of the selected goal', { timeout: 15000 }, async () => {
  const app = await setup('multi-goal-recovery', 15, new ManualPlannerModel(0));
  try {
    await app.run.start();
    await app.run.settle();
    const owner = app.run.state.assignments[app.run.state.decisionAssignmentId]!;
    const invoke = (name: string, args: object = {}) =>
      app.host.tools.execute({
        agent: app.host.agents.get(SessionId(owner.sessionId))!,
        callId: ToolCallId(randomUUID()),
        name: name.replaceAll('.', '__'),
        arguments: args,
        signal: new AbortController().signal,
      });
    const plan: PlanDocument = {
      schema_version: 'physical.plan.v1',
      task_id: app.run.state.id,
      version: 1,
      owner_agent_id: owner.sessionId,
      owner_assignment_id: owner.id,
      items: [
        {
          goal_id: 'place-cup',
          description: 'Placement before access.',
          status: 'active',
          dependencies: [],
          success_contract: {
            id: 'placement',
            version: '1',
            source: { kind: 'user', reference: 'planner-subgoals:store-cup' },
            all: [FIXTURE_SUBGOAL_CHECKS[0]!],
          },
        },
        {
          goal_id: 'store-cup',
          description: 'Final task.',
          status: 'planned',
          dependencies: ['place-cup'],
          success_contract: MULTI_GOAL_FIXTURE.successContract,
        },
      ],
    };
    assert(!(await invoke('planning.update', { plan, expectedVersion: 0 })).isError);
    assert(!(await invoke('tasks.select_goal', { goalId: 'place-cup' })).isError);
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1)
        assert(
          !(
            await invoke('tasks.retry', {
              changes: [`Explicit test revision ${attempt}.`],
              attemptSummary: 'Cup still outside.',
            })
          ).isError,
        );
      assert(
        !(
          await invoke('execution.start', { instruction: 'Try placement without opening cabinet.' })
        ).isError,
      );
      await until(() => app.run.state.verdicts.length === attempt, app.run);
      await app.run.settle();
      assert.equal(app.run.state.verdicts.at(-1)!.status, 'failed');
    }
    assert.equal(
      (
        await invoke('tasks.retry', {
          changes: ['Fourth attempt.'],
          attemptSummary: 'Previous three failed.',
        })
      ).isError,
      true,
    );
    assert.equal(app.run.state.requests.length, 3);
    assert.equal(app.run.state.skillIds.length, 0);
  } finally {
    await app.close();
  }
});
