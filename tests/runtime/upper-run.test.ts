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
import type { EmbodiedBackend, BackendUpdate } from '@edh/execution';
import { ContractValidator, type VerificationResult, type PlanDocument } from '@edh/contracts';
import { FileTeamLoader } from '@edh/teams';
import { LocalStore, SessionAudits } from '@edh/storage';
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

async function setup(
  scenario: FixtureScenario,
  tickMs = 15,
  model = new FixtureModel(0),
  wrapBackend: (backend: FixtureBackend) => EmbodiedBackend = (backend) => backend,
) {
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
    backend: wrapBackend(backend),
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
async function until(predicate: () => boolean, run: UpperRun, timeoutMs = 16000) {
  const end = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > end) assert.fail(JSON.stringify(run.snapshot(), null, 2));
    await setTimeout(10);
  }
}

test(
  'DSH roles execute failure, formal verification, planner retry and provenance-bound SKILL publication',
  { timeout: 20000 },
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

test(
  'normal demo pacing completes multi-goal recovery, SKILL publication and readable session audits',
  { timeout: 60000 },
  async () => {
    const app = await setup('multi-goal-recovery', 650, new FixtureModel(140));
    try {
      await app.run.start();
      await until(() => terminal(app.run.state.state), app.run, 45000);
      await app.run.settle();
      assert.equal(app.run.state.state, 'succeeded');
      assert.equal(app.run.state.skillIds.length, 1);
      assert(!app.run.state.events.some((event) => event.type === 'recovery.failed'));
      const evolver = Object.values(app.run.state.assignments).find(
        (assignment) => assignment.member === 'evolver',
      )!;
      const audit = new SessionAudits(app.store)
        .read(app.run.state.id)
        .find((record) => record.key.endsWith(evolver.id));
      assert(audit && Array.isArray(audit.value) && audit.value.length > 20);
    } finally {
      await app.close();
    }
  },
);

function backendPort(
  backend: FixtureBackend,
  overrides: Partial<EmbodiedBackend>,
): EmbodiedBackend {
  return {
    source: backend.source,
    start: backend.start.bind(backend),
    query: backend.query.bind(backend),
    capture: backend.capture.bind(backend),
    turnView: backend.turnView.bind(backend),
    pause: backend.pause.bind(backend),
    resume: backend.resume.bind(backend),
    stop: backend.stop.bind(backend),
    check: backend.check.bind(backend),
    subscribe: backend.subscribe.bind(backend),
    close: backend.close.bind(backend),
    ...overrides,
  };
}

test(
  'asynchronous provider reads run through native DSH with scoped boundary and cancellation',
  { timeout: 20000 },
  async () => {
    let captures = 0;
    let checks = 0;
    const app = await setup('retry-success', 15, new FixtureModel(0), (backend) =>
      backendPort(backend, {
        async capture(options) {
          assert.ok(options?.signal);
          await setTimeout(5, undefined, { signal: options.signal });
          captures++;
          return backend.capture();
        },
        async check(ids, options) {
          assert.ok(options?.signal);
          assert.equal(options.executionId, backend.query()?.execution_id);
          assert.equal(options.boundaryId, backend.query()?.boundary_event_id);
          await setTimeout(5, undefined, { signal: options.signal });
          checks++;
          return backend.check(ids);
        },
      }),
    );
    try {
      await app.run.start();
      await until(() => terminal(app.run.state.state), app.run);
      await app.run.settle();
      assert.equal(app.run.state.state, 'succeeded');
      assert.ok(captures > 0);
      assert.equal(checks, 2);
      assert.deepEqual(
        app.run.state.verdicts.map((v) => v.status),
        ['failed', 'passed'],
      );
      assert.equal(app.run.state.skillIds.length, 1);
    } finally {
      await app.close();
    }
  },
);

test(
  'late capture after cancellation cannot grant evidence or update agent observations',
  { timeout: 15000 },
  async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let signal: AbortSignal | undefined;
    let evidenceId: string | undefined;
    const app = await setup('first-pass', 15, new FixtureModel(0), (backend) =>
      backendPort(backend, {
        async capture(options) {
          signal = options?.signal;
          await pending; // Deliberately uncooperative remote completion.
          const sample = backend.capture();
          evidenceId = sample.evidence.id;
          return sample;
        },
      }),
    );
    try {
      await app.run.start();
      await until(() => Boolean(signal), app.run);
      await app.run.stop();
      assert.equal(signal?.aborted, true);
      release();
      await app.run.settle();
      assert.equal(app.run.state.state, 'cancelled');
      assert.ok(evidenceId);
      assert.ok(
        !app.run.state.events.some(
          (e) =>
            e.type === 'observation.consumed' &&
            (e.detail.evidence as { id?: string })?.id === evidenceId,
        ),
      );
      assert.equal(Object.keys(app.run.state.agentSeen).length, 0);
    } finally {
      release();
      await app.close();
    }
  },
);

test(
  'formal checks returning after a boundary change cannot publish checked facts or a verdict',
  { timeout: 15000 },
  async () => {
    let changed = false;
    let rejectedEvidenceId: string | undefined;
    const app = await setup('first-pass', 15, new FixtureModel(0), (backend) =>
      backendPort(backend, {
        query() {
          const status = backend.query();
          return status && changed
            ? { ...status, boundary_event_id: 'replacement-boundary' }
            : status;
        },
        async check(ids) {
          const result = backend.check(ids);
          rejectedEvidenceId = result.sample.evidence.id;
          await setTimeout(5);
          changed = true;
          return result;
        },
      }),
    );
    try {
      await app.run.start();
      await until(() => terminal(app.run.state.state), app.run);
      await app.run.settle();
      assert.equal(app.run.state.state, 'failed');
      assert.equal(app.run.state.verdicts.length, 0);
      assert.ok(
        app.run.state.events.some(
          (e) => e.type === 'tool.failed' && String(e.detail.error).includes('boundary changed'),
        ),
      );
      assert.ok(!app.run.state.events.some((e) => e.type === 'verification.checked'));
      assert.ok(
        !Object.values(app.run.state.agentSeen).some(
          (sample) => sample.evidence.id === rejectedEvidenceId,
        ),
      );
    } finally {
      await app.close();
    }
  },
);

async function nativeResume(app: Awaited<ReturnType<typeof setup>>) {
  const owner = app.run.state.assignments[app.run.state.decisionAssignmentId]!;
  return app.host.tools.execute({
    agent: app.host.agents.get(SessionId(owner.sessionId))!,
    callId: ToolCallId(randomUUID()),
    name: 'execution__resume',
    arguments: {},
    signal: new AbortController().signal,
  });
}

test(
  'resume cannot reach the provider before the current paused boundary is formally checked',
  { timeout: 15000 },
  async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let checking = false;
    let resumeCalls = 0;
    const app = await setup('first-pass', 100, new FixtureModel(0), (backend) =>
      backendPort(backend, {
        async check(ids, options) {
          if (backend.query()?.state === 'paused') {
            checking = true;
            await blocked;
            options?.signal?.throwIfAborted();
          }
          return backend.check(ids);
        },
        async resume(owner, options) {
          resumeCalls++;
          assert.equal(options.executionId, backend.query()?.execution_id);
          assert.equal(options.boundaryId, backend.query()?.boundary_event_id);
          assert.equal(options.stateVersion, backend.query()?.state_version);
          await backend.resume(owner, options);
        },
      }),
    );
    try {
      await app.run.start();
      await until(() => app.backend.query()?.control_steps === 1, app.run);
      await app.run.pause();
      await until(() => checking, app.run);
      assert.equal((await nativeResume(app)).isError, true);
      assert.equal(resumeCalls, 0);
      assert.equal(app.backend.query()?.state, 'paused');
      release();
      await until(() => app.run.state.verdicts.length === 1, app.run);
      await app.run.settle();
      assert.equal((await nativeResume(app)).isError, false);
      assert.equal(resumeCalls, 1);
      assert.equal(app.backend.query()?.state, 'running');
      assert.equal(
        app.run.state.events.filter((e) => e.type === 'execution.resume-requested').length,
        1,
      );
      await app.run.stop();
    } finally {
      release();
      await app.close();
    }
  },
);

test(
  'an unsolicited backend resume cannot borrow Planner identity from the subgoal request',
  { timeout: 15000 },
  async () => {
    const app = await setup('first-pass', 100);
    try {
      await app.run.start();
      await until(() => app.backend.query()?.control_steps === 1, app.run);
      await app.run.pause();
      await until(() => app.run.state.verdicts.length === 1, app.run);
      await app.run.settle();
      const pausedIndex = app.run.state.events.length;
      // A provider knows the owner ID from the request; this is not a new Planner decision.
      await app.backend.resume(app.run.state.requests[0]!.decision_owner_id);
      await app.run.settle();
      assert.equal(app.run.state.state, 'failed');
      assert.match(app.run.state.error!, /resume_requires_owner/);
      assert.equal(app.backend.query()?.state, 'ended');
      assert.equal(
        app.run.state.events
          .slice(pausedIndex)
          .some(
            (e) =>
              e.type === 'execution.updated' &&
              (e.detail.execution as { state: string }).state === 'running',
          ),
        false,
      );
    } finally {
      await app.close();
    }
  },
);

test(
  'missing resume acknowledgement stops the run and a concurrent resume is not sent twice',
  { timeout: 15000 },
  async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const app = await setup('first-pass', 100, new FixtureModel(0), (backend) =>
      backendPort(backend, {
        async resume() {
          calls++;
          await blocked; /* Deliberately return without a state acknowledgement. */
        },
      }),
    );
    try {
      await app.run.start();
      await until(() => app.backend.query()?.control_steps === 1, app.run);
      await app.run.pause();
      await until(() => app.run.state.verdicts.length === 1, app.run);
      await app.run.settle();
      const first = nativeResume(app);
      await until(() => calls === 1, app.run);
      assert.equal((await nativeResume(app)).isError, true);
      assert.equal(calls, 1);
      release();
      assert.equal((await first).isError, true);
      await app.run.settle();
      assert.equal(app.run.state.state, 'failed');
      assert.match(app.run.state.error!, /without an admitted matching state update/);
      assert.equal(app.backend.query()?.state, 'ended');
    } finally {
      release();
      await app.close();
    }
  },
);

test(
  'a pause arriving during resume acknowledgement remains paused and needs its own formal result',
  { timeout: 15000 },
  async () => {
    const app = await setup('first-pass', 100, new FixtureModel(0), (backend) =>
      backendPort(backend, {
        async resume(owner, options) {
          await backend.resume(owner, options);
          await backend.pause();
        },
      }),
    );
    try {
      await app.run.start();
      await until(() => app.backend.query()?.control_steps === 1, app.run);
      await app.run.pause();
      await until(() => app.run.state.verdicts.length === 1, app.run);
      await app.run.settle();
      assert.equal((await nativeResume(app)).isError, false);
      await until(() => app.run.state.verdicts.length === 2, app.run);
      await app.run.settle();
      assert.equal(app.backend.query()?.state, 'paused');
      assert.equal(app.run.state.state, 'paused');
      assert.notEqual(
        app.run.state.verdicts[0]!.boundary_event_id,
        app.run.state.verdicts[1]!.boundary_event_id,
      );
    } finally {
      await app.close();
    }
  },
);

test(
  'backend updates cannot replace an attempt execution or pair it with another task image',
  { timeout: 15000 },
  async () => {
    for (const variant of ['execution', 'observation'] as const) {
      let emit!: (update: BackendUpdate) => void;
      let latest!: BackendUpdate;
      const app = await setup('first-pass', 100, new FixtureModel(0), (backend) =>
        backendPort(backend, {
          subscribe(listener) {
            emit = listener;
            return backend.subscribe((update) => {
              latest = structuredClone(update);
              listener(update);
            });
          },
        }),
      );
      try {
        await app.run.start();
        await until(() => app.backend.query()?.control_steps === 1, app.run);
        await app.run.pause();
        await until(() => app.run.state.verdicts.length === 1, app.run);
        await app.run.settle();
        const forged = structuredClone(latest);
        if (variant === 'execution') forged.status.execution_id = randomUUID();
        else forged.sample.evidence.task_scope.task_id = 'another-task';
        emit(forged);
        await app.run.settle();
        assert.equal(app.run.state.state, 'failed');
        assert.match(
          app.run.state.error!,
          variant === 'execution' ? /another execution ID/ : /observation does not belong/,
        );
        assert.equal(app.run.state.executions.length, 1);
        assert.equal(app.backend.query()?.state, 'ended');
      } finally {
        await app.close();
      }
    }
  },
);

test(
  'the first backend status is budget-checked before it can become an accepted projection',
  { timeout: 10000 },
  async () => {
    let first = true;
    const app = await setup('first-pass', 100, new FixtureModel(0), (backend) =>
      backendPort(backend, {
        subscribe(listener) {
          return backend.subscribe((update) => {
            if (first) {
              first = false;
              listener({
                ...update,
                status: {
                  ...update.status,
                  control_steps: FIXTURE_GOAL.budget.max_control_steps + 1,
                },
              });
            } else listener(update);
          });
        },
      }),
    );
    try {
      await app.run.start();
      await until(() => terminal(app.run.state.state), app.run);
      await app.run.settle();
      assert.equal(app.run.state.state, 'failed');
      assert.match(app.run.state.error!, /Initial backend state violates/);
      assert(
        app.run.state.executions.every(
          (status) => status.control_steps <= FIXTURE_GOAL.budget.max_control_steps,
        ),
      );
      assert.equal(app.backend.query()?.state, 'ended');
    } finally {
      await app.close();
    }
  },
);
