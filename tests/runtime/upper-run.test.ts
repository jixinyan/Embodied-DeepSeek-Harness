import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout } from 'node:timers/promises';
import { ContractValidator } from '@edh/contracts';
import { FileTeamLoader } from '@edh/teams';
import { LocalStore } from '@edh/storage';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { UpperRun, CORE_TOOLS, terminal } from '../../apps/server/src/application.js';
import { FixtureModel } from '../../apps/server/src/fixture-model.js';
import {
  FixtureBackend,
  FIXTURE_GOAL,
  type FixtureScenario,
} from '../../apps/server/src/fixture-backend.js';

async function setup(scenario: FixtureScenario, tickMs = 15) {
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
  const model = new FixtureModel(0);
  const host = await createDshHost([{ providers: ['fixture'], adapter: model }]);
  const backend = new FixtureBackend(validator, scenario, tickMs);
  const run = new UpperRun({
    host,
    goal: FIXTURE_GOAL,
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
  const end = Date.now() + 6000;
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
