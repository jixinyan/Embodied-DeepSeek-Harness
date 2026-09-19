import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { ContractValidator } from '@edh/contracts';
import { LocalStore, SessionAudits } from '@edh/storage';
import { FixtureBackend } from '../../apps/server/src/fixture-backend.js';
import { createDemoDeployment } from '../../apps/server/src/demo-deployment.js';
import { startServer } from '../../apps/server/src/http-server.js';
import { prepareDeployment, type ServerDeployment } from '../../apps/server/src/deployment.js';

async function inputs() {
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const dataDirectory = await mkdtemp(resolve(tmpdir(), 'edh-deployment-'));
  const deployment = createDemoDeployment(
    { root: process.cwd(), tickMs: 20, modelDelayMs: 0 },
    validator,
  );
  return { validator, dataDirectory, deployment, root: process.cwd(), port: 0 };
}
async function post(url: string, scenario: string, requestId = randomUUID()) {
  return fetch(url + '/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, requestId }),
  });
}
async function until(check: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 12000;
  while (!(await check())) {
    assert.ok(Date.now() < deadline, 'Condition did not settle.');
    await setTimeout(20);
  }
}

test(
  'deployment bindings drive HTTP, DSH model selection and immutable task admission',
  { timeout: 25000 },
  async () => {
    const input = await inputs();
    const models = { brain: { provider: 'fixture', model: 'fixture' } };
    const task = {
      ...input.deployment.tasks['first-pass']!,
      label: 'Custom placement',
      instruction: 'Complete the deployment-bound placement task.',
    };
    const deployment: ServerDeployment = {
      ...input.deployment,
      id: 'custom-deployment',
      defaultModel: 'brain',
      models,
      tasks: { 'placement-task': task },
    };
    let server = await startServer({ ...input, deployment });
    try {
      task.instruction = 'Changed after server startup';
      models.brain.model = 'changed-after-startup';
      const config = await (await fetch(server.url + '/api/config')).json();
      assert.deepEqual(config.scenarios, ['placement-task']);
      assert.equal(config.models.brain.model, 'fixture');
      assert.equal(
        config.taskPresets['placement-task'].instruction,
        'Complete the deployment-bound placement task.',
      );
      assert.equal(config.deploymentId, 'custom-deployment');
      assert.equal(JSON.stringify(config).includes('createBackend'), false);
      assert.equal(JSON.stringify(config).includes('adapters'), false);
      const requestId = randomUUID();
      const response = await post(server.url, 'placement-task', requestId);
      assert.equal(response.status, 201);
      const { runId } = await response.json();
      await until(
        async () =>
          (await (await fetch(`${server.url}/api/runs/${runId}`)).json()).state === 'succeeded',
      );
      const state = await (await fetch(`${server.url}/api/runs/${runId}`)).json();
      assert.equal(state.scenario, 'placement-task');
      assert.equal(state.instruction, 'Complete the deployment-bound placement task.');
      assert.equal(state.verdicts.at(-1).status, 'passed');
      assert.deepEqual(state.configuration, config);
      assert.equal((await post(server.url, 'placement-task', requestId)).status, 200);
      await server.close();
      server = await startServer({ ...input, deployment: { ...deployment, version: '2' } });
      assert.equal((await post(server.url, 'placement-task', requestId)).status, 409);
      const historical = await (await fetch(`${server.url}/api/runs/${runId}`)).json();
      assert.equal(historical.readOnly, true);
      assert.deepEqual(historical.configuration, config);
      assert.equal((await (await fetch(server.url + '/api/config')).json()).deploymentVersion, '2');
    } finally {
      await server.close();
      await rm(input.dataDirectory, { recursive: true, force: true });
    }
  },
);

test('invalid deployment and role bindings fail before locking or modifying the store', async () => {
  const input = await inputs();
  try {
    await assert.rejects(
      startServer({ ...input, deployment: { ...input.deployment, defaultModel: 'missing' } }),
      /default model/,
    );
    await assert.rejects(
      startServer({
        ...input,
        deployment: {
          ...input.deployment,
          adapters: [...input.deployment.adapters, ...input.deployment.adapters],
        },
      }),
      /Duplicate/,
    );
    await assert.rejects(
      startServer({
        ...input,
        deployment: {
          ...input.deployment,
          tasks: {
            bad: {
              ...input.deployment.tasks['first-pass']!,
              goal: {
                ...input.deployment.tasks['first-pass']!.goal,
                budget: { max_control_steps: 0, max_wall_time_s: 30 },
              },
            },
          },
        },
      }),
      /budget/,
    );
    await assert.rejects(
      startServer({
        ...input,
        deployment: {
          ...input.deployment,
          teamFile: resolve(input.dataDirectory, 'missing-team.yaml'),
        },
      }),
      /ENOENT/,
    );
    assert.deepEqual(await readdir(input.dataDirectory), []);
  } finally {
    await rm(input.dataDirectory, { recursive: true, force: true });
  }
});

test('backend source mismatch closes the allocated provider and never starts a run', async () => {
  const input = await inputs();
  let closed = 0;
  const backend = new FixtureBackend(input.validator, 'first-pass', 20);
  const originalClose = backend.close.bind(backend);
  backend.close = async () => {
    closed++;
    await originalClose();
  };
  const server = await startServer({
    ...input,
    deployment: {
      ...input.deployment,
      source: 'simulation',
      tasks: {
        mismatch: { ...input.deployment.tasks['first-pass']!, createBackend: () => backend },
      },
    },
  });
  try {
    assert.equal((await post(server.url, 'mismatch')).status, 400);
    assert.equal(closed, 1);
    assert.deepEqual((await (await fetch(server.url + '/api/runs')).json()).runs, []);
  } finally {
    await server.close();
    await rm(input.dataDirectory, { recursive: true, force: true });
  }
});

test(
  'shutdown cancels pending backend admission and drains the late allocation once',
  { timeout: 15000 },
  async () => {
    const input = await inputs();
    let release!: () => void;
    let signal: AbortSignal | undefined;
    let closed = 0;
    const pending = new Promise<void>((done) => {
      release = done;
    });
    const backend = new FixtureBackend(input.validator, 'first-pass', 20);
    const originalClose = backend.close.bind(backend);
    backend.close = async () => {
      closed++;
      await originalClose();
    };
    const server = await startServer({
      ...input,
      deployment: {
        ...input.deployment,
        tasks: {
          delayed: {
            ...input.deployment.tasks['first-pass']!,
            createBackend: async (options) => {
              signal = options.signal;
              await pending;
              return backend;
            },
          },
        },
      },
    });
    try {
      const request = post(server.url, 'delayed');
      await until(() => Boolean(signal));
      const closing = server.close();
      assert.equal(server.close(), closing);
      assert.equal(signal?.aborted, true);
      release();
      assert.equal((await request).status, 503);
      await closing;
      assert.equal(closed, 1);
      assert.equal(backend.query(), undefined);
    } finally {
      release();
      await server.close();
      await rm(input.dataDirectory, { recursive: true, force: true });
    }
  },
);

test(
  'server releases HTTP and storage after backend stop and close both fail',
  { timeout: 15000 },
  async () => {
    const input = await inputs();
    const backend = new FixtureBackend(input.validator, 'first-pass', 1000);
    let stops = 0,
      closes = 0;
    backend.stop = async () => {
      stops++;
      throw new Error('Device stop was not acknowledged');
    };
    const close = backend.close.bind(backend);
    backend.close = async () => {
      closes++;
      await close();
      throw new Error('Provider close failed');
    };
    const server = await startServer({
      ...input,
      deployment: {
        ...input.deployment,
        tasks: {
          faulty: { ...input.deployment.tasks['first-pass']!, createBackend: () => backend },
        },
      },
    });
    try {
      const response = await post(server.url, 'faulty');
      assert.equal(response.status, 201);
      const { runId } = await response.json();
      await until(() => backend.query()?.state === 'running');
      const closing = server.close();
      assert.equal(server.close(), closing);
      const messages = (error: unknown): string =>
        error instanceof AggregateError ? error.errors.map(messages).join(' | ') : String(error);
      await assert.rejects(closing, (error) => {
        assert.match(messages(error), /Device stop was not acknowledged/);
        assert.match(messages(error), /Provider close failed/);
        return true;
      });
      assert.equal(stops, 1);
      assert.equal(closes, 1);
      await assert.rejects(fetch(server.url));
      const reopened = new LocalStore(input.dataDirectory);
      try {
        assert.equal(reopened.get<{ state: string }>(`run:${runId}`)!.value.state, 'cancelled');
        assert(
          new SessionAudits(reopened).read(runId).length > 0,
          'Session auditing must still run after provider cleanup fails.',
        );
      } finally {
        reopened.close();
      }
    } finally {
      await server.close().catch(() => {});
      await rm(input.dataDirectory, { recursive: true, force: true });
    }
  },
);

test('context policy is frozen into deployment identity and native validation rejects invalid budgets', async () => {
  const input = await inputs();
  try {
    const policy = { compaction: { auto: false, thresholdRatio: 0.7 } };
    const original = prepareDeployment(input.deployment, input.validator);
    const prepared = prepareDeployment(
      { ...input.deployment, contextManagement: policy },
      input.validator,
    );
    policy.compaction.thresholdRatio = 0.9;
    assert.equal(prepared.contextManagement?.compaction?.thresholdRatio, 0.7);
    assert.notEqual(prepared.digest, original.digest);
    assert(Object.isFrozen(prepared.contextManagement));
    assert.throws(
      () =>
        prepareDeployment(
          {
            ...input.deployment,
            contextManagement: { compaction: { thresholdRatio: 0.1, retainRatio: 0.5 } },
          },
          input.validator,
        ),
      /retain|threshold/,
    );
  } finally {
    await rm(input.dataDirectory, { recursive: true, force: true });
  }
});

test('automatic compaction requires declared model capacity before opening run history', async () => {
  const input = await inputs();
  try {
    await assert.rejects(
      startServer({
        ...input,
        deployment: {
          ...input.deployment,
          contextManagement: {},
        },
      }),
      /requires contextWindow/,
    );
    assert.deepEqual(await readdir(input.dataDirectory), []);
    const server = await startServer({
      ...input,
      deployment: {
        ...input.deployment,
        contextManagement: { compaction: { auto: false } },
      },
    });
    try {
      const config = await (await fetch(server.url + '/api/config')).json();
      assert.equal(config.contextManagement.compaction.auto, false);
      const response = await post(server.url, 'first-pass');
      assert.equal(response.status, 201);
      const { runId } = await response.json();
      await until(
        async () =>
          (await (await fetch(`${server.url}/api/runs/${runId}`)).json()).state === 'succeeded',
      );
      await until(async () =>
        (await (await fetch(`${server.url}/api/runs/${runId}`)).json()).events.some(
          (event: { type: string }) => event.type === 'agent.context-usage',
        ),
      );
      const run = await (await fetch(`${server.url}/api/runs/${runId}`)).json();
      assert.equal(run.verdicts.at(-1).status, 'passed');
      const usage = run.events.find(
        (event: { type: string }) => event.type === 'agent.context-usage',
      );
      assert(usage.detail.estimatedTokens > 0);
      assert.equal(usage.detail.contextWindow, null);
    } finally {
      await server.close();
    }
  } finally {
    await rm(input.dataDirectory, { recursive: true, force: true });
  }
});

test(
  'physical profiles reach scoped prompts, backend factories and historical config without changing the Agent loop',
  { timeout: 20000 },
  async () => {
    const { fixtureProfile } = await import('./profile-fixture.js');
    const input = await inputs();
    let priorDigest: string | undefined;
    try {
      for (const id of ['fixture-arm', 'fixture-mobile']) {
        const profile = fixtureProfile(id);
        profile.rolePromptAdditions = { lead: 'Use fixture evidence only.' };
        let received: unknown;
        const physicalProviders = {
          simulations: { 'fixture-sim': () => {} },
          policies: { 'fixture-policy': () => {} },
        };
        const server = await startServer({
          ...input,
          deployment: {
            ...input.deployment,
            physicalProfile: profile,
            physicalProviders,
            tasks: {
              'first-pass': {
                ...input.deployment.tasks['first-pass']!,
                createBackend: (options) => {
                  received = options.profile;
                  assert(Object.isFrozen(options.profile));
                  return new FixtureBackend(input.validator, 'first-pass', 20);
                },
              },
            },
          },
        });
        try {
          profile.embodiment.promptContext = 'Mutated after startup';
          const config = await (await fetch(server.url + '/api/config')).json();
          assert.equal(config.physicalProfile.embodiment.id, id);
          assert.match(config.roles.lead.instructions, new RegExp(id));
          assert.doesNotMatch(config.roles.verifier.instructions, /Use fixture evidence only/);
          assert(!JSON.stringify(config).includes('physicalProviders'));
          if (priorDigest) assert.notEqual(config.deploymentDigest, priorDigest);
          priorDigest = config.deploymentDigest;
          const response = await post(server.url, 'first-pass');
          assert.equal(response.status, 201);
          const { runId } = await response.json();
          await until(
            async () =>
              (await (await fetch(`${server.url}/api/runs/${runId}`)).json()).state === 'succeeded',
          );
          const state = await (await fetch(`${server.url}/api/runs/${runId}`)).json();
          assert.deepEqual(received, config.physicalProfile);
          assert.deepEqual(state.configuration.physicalProfile, config.physicalProfile);
          assert.equal(state.verdicts.at(-1).status, 'passed');
        } finally {
          await server.close();
        }
      }
    } finally {
      await rm(input.dataDirectory, { recursive: true, force: true });
    }
  },
);

test('missing or incompatible physical provider bindings reject before opening history or allocating a backend', async () => {
  const { fixtureProfile } = await import('./profile-fixture.js');
  const input = await inputs();
  let created = false;
  const deployment = {
    ...input.deployment,
    physicalProfile: fixtureProfile(),
    tasks: {
      'first-pass': {
        ...input.deployment.tasks['first-pass']!,
        createBackend: () => {
          created = true;
          return new FixtureBackend(input.validator, 'first-pass');
        },
      },
    },
  };
  try {
    await assert.rejects(startServer({ ...input, deployment }), /registered simulation and policy/);
    await assert.rejects(
      startServer({
        ...input,
        deployment: {
          ...deployment,
          physicalProviders: {
            simulations: { 'fixture-sim': () => {} },
            policies: {
              'fixture-policy': () => {
                throw new Error('Unsupported checkpoint transform');
              },
            },
          },
        },
      }),
      /Unsupported checkpoint transform/,
    );
    assert.equal(created, false);
    assert.deepEqual(await readdir(input.dataDirectory), []);
  } finally {
    await rm(input.dataDirectory, { recursive: true, force: true });
  }
});
