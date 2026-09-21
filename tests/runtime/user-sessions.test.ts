import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { ContractValidator } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { startDemoServer, startServer } from '../../apps/server/src/http-server.js';
import {
  createDemoDeployment,
  createDemoLaunchProfiles,
} from '../../apps/server/src/demo-deployment.js';
import { UserSessions } from '../../apps/server/src/user-sessions.js';

async function post(url: string, path: string, data: unknown) {
  const response = await fetch(url + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return { status: response.status, body: await response.json() };
}
async function until(check: () => Promise<boolean>) {
  const deadline = Date.now() + 15000;
  while (!(await check())) {
    assert.ok(Date.now() < deadline, 'Condition did not settle.');
    await setTimeout(20);
  }
}

async function readAudit(url: string, runId: string): Promise<unknown[]> {
  const events: unknown[] = [];
  let nextAfter: string | null = null;
  do {
    const suffix: string = nextAfter ? `?afterAssignment=${encodeURIComponent(nextAfter)}` : '';
    const index = await (await fetch(`${url}/api/runs/${runId}/audit${suffix}`)).json();
    for (const session of index.sessions) {
      let after = 0;
      while (after < session.eventTotal) {
        const query = new URLSearchParams({
          assignment: session.assignmentId,
          after: String(after),
          through: String(session.eventTotal),
        });
        const response = await fetch(`${url}/api/runs/${runId}/audit?${query}`);
        assert.equal(response.status, 200);
        const page = await response.json();
        assert.ok(page.throughOffset > after);
        events.push(...page.events);
        after = page.throughOffset;
      }
    }
    nextAfter = index.nextAfter;
  } while (nextAfter);
  return events;
}

test(
  'one user session retains its world across independent tasks and preserves recovery experience after close',
  { timeout: 45000 },
  async () => {
    const dataDirectory = await mkdtemp(resolve(tmpdir(), 'edh-user-session-'));
    const options = { root: process.cwd(), dataDirectory, port: 0, tickMs: 20, modelDelayMs: 0 };
    let server = await startDemoServer(options);
    try {
      const selection = { profileId: 'persistent-cup-fixture', requestId: randomUUID() };
      const opened = await post(server.url, '/api/sessions', selection);
      assert.equal(opened.status, 201);
      const id = opened.body.id;
      assert.equal(opened.body.resources, 'held');
      assert.equal((await post(server.url, '/api/sessions', selection)).body.id, id);
      assert.equal(
        (await post(server.url, '/api/sessions', { ...selection, requestId: randomUUID() })).status,
        409,
      );
      assert.equal(
        (await post(server.url, '/api/runs', { scenario: 'first-pass', requestId: randomUUID() }))
          .status,
        409,
      );
      const firstInput = { scenario: 'retry-success', requestId: randomUUID() };
      const first = await post(server.url, `/api/sessions/${id}/tasks`, firstInput);
      assert.equal(first.status, 201);
      assert.equal(
        (await post(server.url, `/api/sessions/${id}/tasks`, firstInput)).body.runId,
        first.body.runId,
      );
      const getSession = async () => (await fetch(`${server.url}/api/sessions/${id}`)).json();
      await until(async () => (await getSession()).state === 'ready');
      const firstRun = await (await fetch(`${server.url}/api/runs/${first.body.runId}`)).json();
      assert.equal(firstRun.state, 'succeeded');
      assert.equal(firstRun.skillIds.length, 1, 'Terminal cleanup must drain Evolver publication.');
      assert.equal(firstRun.userSessionId, id);
      assert.equal((await getSession()).resources, 'held');
      const second = await post(server.url, `/api/sessions/${id}/tasks`, {
        scenario: 'first-pass',
        requestId: randomUUID(),
      });
      assert.equal(second.status, 201);
      await until(async () => (await getSession()).state === 'ready');
      const secondRun = await (await fetch(`${server.url}/api/runs/${second.body.runId}`)).json();
      assert.equal(secondRun.state, 'succeeded');
      assert.notEqual(secondRun.decisionAssignmentId, firstRun.decisionAssignmentId);
      const audit = await readAudit(server.url, second.body.runId);
      const native = JSON.stringify(audit);
      assert.ok(
        native.includes('Cup inside cabinet'),
        'The next task must observe the retained world before acting.',
      );
      assert.ok(
        native.includes(firstRun.skillIds[0]),
        'Cross-task skill search must use the shared workspace library.',
      );
      assert.deepEqual((await getSession()).runIds, [first.body.runId, second.body.runId]);
      const ended = await post(server.url, `/api/sessions/${id}/close`, {});
      assert.equal(ended.body.resources, 'released');
      assert.equal((await post(server.url, `/api/sessions/${id}/close`, {})).status, 200);
      const next = await post(server.url, '/api/sessions', {
        ...selection,
        requestId: randomUUID(),
      });
      assert.equal(next.status, 201);
      assert.notEqual(next.body.id, id);
      assert.ok(server.store.get(`skill:${firstRun.skillIds[0]}`));
      const third = await post(server.url, `/api/sessions/${next.body.id}/tasks`, {
        scenario: 'first-pass',
        requestId: randomUUID(),
      });
      assert.equal(third.status, 201);
      await until(
        async () =>
          (await (await fetch(`${server.url}/api/sessions/${next.body.id}`)).json()).state ===
          'ready',
      );
      const thirdAudit = JSON.stringify(await readAudit(server.url, third.body.runId));
      assert.ok(
        thirdAudit.includes(firstRun.skillIds[0]),
        'A new user session can explicitly retrieve prior-session experience.',
      );
      assert.ok(
        thirdAudit.includes('Cup on counter'),
        'A new synthetic environment has a fresh initial world.',
      );
      const library = await (await fetch(server.url + '/api/skills')).json();
      assert.equal(library.skills[0].userSessionId, id);
      assert.equal(library.skills[0].metadata.origin, 'test_fixture');
      await server.close();
      server = await startDemoServer(options);
      assert.equal(
        (await (await fetch(`${server.url}/api/sessions/${id}`)).json()).state,
        'closed',
      );
      assert.equal(
        (await post(server.url, `/api/sessions/${id}/tasks`, firstInput)).body.runId,
        first.body.runId,
      );
      assert.ok(server.store.get(`skill:${firstRun.skillIds[0]}`));
    } finally {
      await server.close();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  },
);

test('session shutdown cancels a pending environment allocation and closes its late return once', async () => {
  const dataDirectory = await mkdtemp(resolve(tmpdir(), 'edh-session-late-'));
  const store = new LocalStore(dataDirectory);
  const sessions = new UserSessions(store);
  let entered!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  let release!: () => void;
  const late = new Promise<void>((r) => {
    release = r;
  });
  let closed = 0;
  let signal: AbortSignal | undefined;
  try {
    const opening = sessions.open(
      { profileId: 'cpu', requestId: randomUUID(), deploymentDigest: 'test', configuration: {} },
      async (s) => {
        signal = s;
        entered();
        await late;
        return {
          createTaskBackend: () => {
            throw new Error('Must not create a task.');
          },
          close: async () => {
            closed++;
          },
        };
      },
    );
    const rejected = assert.rejects(opening, /stopping/);
    await started;
    const closing = sessions.close();
    assert.ok(signal?.aborted);
    release();
    await rejected;
    await closing;
    assert.equal(closed, 1);
    assert.equal(sessions.list()[0]!.resources, 'released');
  } finally {
    await sessions.close();
    store.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});

test('failed environment release stays unknown and blocks new allocation; restart never claims release', async () => {
  const dataDirectory = await mkdtemp(resolve(tmpdir(), 'edh-session-failed-'));
  const store = new LocalStore(dataDirectory);
  const sessions = new UserSessions(store);
  try {
    const input = {
      profileId: 'cpu',
      requestId: randomUUID(),
      deploymentDigest: 'test',
      configuration: {},
    };
    const record = await sessions.open(input, () => ({
      createTaskBackend: () => {
        throw new Error('unused');
      },
      close: async () => {
        throw new Error('device disconnected');
      },
    }));
    await assert.rejects(sessions.end(record.id), /cleanup failed/);
    assert.equal(sessions.get(record.id).resources, 'unknown');
    await assert.rejects(
      sessions.open({ ...input, requestId: randomUUID() }, () => {
        throw new Error('must not allocate');
      }),
      /End the current/,
    );
    await assert.rejects(sessions.close(), /cleanup failed/);
    const restarted = new UserSessions(store);
    assert.equal(restarted.get(record.id).state, 'interrupted');
    assert.equal(restarted.get(record.id).resources, 'unknown');
    await assert.rejects(restarted.end(record.id), /read-only/);
    await restarted.close();
  } finally {
    store.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});

test('launcher preflights all profiles, rejects forged selections, and snapshots configuration before admission', async () => {
  const dataDirectory = await mkdtemp(resolve(tmpdir(), 'edh-launch-preflight-'));
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const base = createDemoDeployment(
    { root: process.cwd(), tickMs: 20, modelDelayMs: 0 },
    validator,
  );
  const profiles = createDemoLaunchProfiles(validator, 20);
  const profile = profiles['persistent-cup-fixture']!;
  const options = { root: process.cwd(), dataDirectory, port: 0 };
  await assert.rejects(
    startServer({
      ...options,
      deployment: { ...base, launchProfiles: { bad: { ...profile, defaultModel: 'missing' } } },
    }),
    /Invalid launch/,
  );
  const server = await startServer({
    ...options,
    deployment: { ...base, launchProfiles: profiles },
  });
  try {
    profiles['persistent-cup-fixture'] = { ...profile, checkpoint: 'changed after startup' };
    const config = await (await fetch(server.url + '/api/config')).json();
    assert.equal(config.launchProfiles['persistent-cup-fixture'].checkpoint, 'none (test fixture)');
    assert.equal(JSON.stringify(config).includes('createEnvironment'), false);
    assert.equal(
      (await post(server.url, '/api/sessions', { profileId: '__proto__', requestId: randomUUID() }))
        .status,
      400,
    );
    assert.equal(
      (
        await post(server.url, '/api/sessions', {
          profileId: 'persistent-cup-fixture',
          requestId: randomUUID(),
          checkpoint: 'untrusted',
        })
      ).status,
      400,
    );
  } finally {
    await server.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});

test(
  'ending a running session cancels its task before releasing the environment and permits a fresh session',
  { timeout: 20000 },
  async () => {
    const dataDirectory = await mkdtemp(resolve(tmpdir(), 'edh-session-stop-'));
    const server = await startDemoServer({
      root: process.cwd(),
      dataDirectory,
      port: 0,
      tickMs: 300,
      modelDelayMs: 0,
    });
    try {
      const opened = await post(server.url, '/api/sessions', {
        profileId: 'persistent-cup-fixture',
        requestId: randomUUID(),
      });
      const id = opened.body.id;
      const started = await post(server.url, `/api/sessions/${id}/tasks`, {
        scenario: 'retry-success',
        requestId: randomUUID(),
      });
      assert.equal(started.status, 201);
      const runUrl = `${server.url}/api/runs/${started.body.runId}`;
      await until(
        async () => (await (await fetch(runUrl)).json()).executions.at(-1)?.state === 'running',
      );
      const closed = await post(server.url, `/api/sessions/${id}/close`, {});
      assert.equal(closed.status, 200);
      assert.equal(closed.body.resources, 'released');
      const run = await (await fetch(runUrl)).json();
      assert.equal(run.state, 'cancelled');
      assert.equal(run.skillIds.length, 0);
      const next = await post(server.url, '/api/sessions', {
        profileId: 'persistent-cup-fixture',
        requestId: randomUUID(),
      });
      assert.equal(next.status, 201);
      assert.notEqual(next.body.id, id);
    } finally {
      await server.close();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  },
);

test(
  'a rejected second task port is closed without reusing the previous retired run',
  { timeout: 20000 },
  async () => {
    const dataDirectory = await mkdtemp(resolve(tmpdir(), 'edh-session-port-reject-'));
    const validator = new ContractValidator(
      JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
    );
    const base = createDemoDeployment(
      { root: process.cwd(), tickMs: 20, modelDelayMs: 0 },
      validator,
    );
    const profile = createDemoLaunchProfiles(validator, 20)['persistent-cup-fixture']!;
    let allocations = 0;
    let closes = 0;
    const server = await startServer({
      root: process.cwd(),
      dataDirectory,
      port: 0,
      deployment: {
        ...base,
        launchProfiles: {
          cpu: {
            ...profile,
            createEnvironment: async (options) => {
              const environment = await profile.createEnvironment(options);
              return {
                ...environment,
                createTaskBackend: async (taskId, options) => {
                  const backend = await environment.createTaskBackend(taskId, options);
                  const close = backend.close.bind(backend);
                  backend.close = async () => {
                    closes++;
                    await close();
                  };
                  if (++allocations === 2)
                    Object.defineProperty(backend, 'source', { value: 'hardware' });
                  return backend;
                },
              };
            },
          },
        },
      },
    });
    try {
      const opened = await post(server.url, '/api/sessions', {
        profileId: 'cpu',
        requestId: randomUUID(),
      });
      const id = opened.body.id;
      assert.equal(
        (
          await post(server.url, `/api/sessions/${id}/tasks`, {
            scenario: 'first-pass',
            requestId: randomUUID(),
          })
        ).status,
        201,
      );
      await until(
        async () =>
          (await (await fetch(`${server.url}/api/sessions/${id}`)).json()).state === 'ready',
      );
      assert.equal(closes, 1);
      const rejected = await post(server.url, `/api/sessions/${id}/tasks`, {
        scenario: 'first-pass',
        requestId: randomUUID(),
      });
      assert.equal(rejected.status, 400);
      assert.match(rejected.body.error, /source differs/);
      assert.equal(closes, 2, 'The rejected new port must be closed exactly once.');
      assert.equal(
        (await post(server.url, `/api/sessions/${id}/close`, {})).body.resources,
        'released',
      );
    } finally {
      await server.close();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  },
);
