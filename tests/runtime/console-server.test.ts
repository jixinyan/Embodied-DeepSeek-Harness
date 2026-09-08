import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { startDemoServer } from '../../apps/server/src/http-server.js';
import type { RunState } from '@edh/tasks';

test(
  'console API runs DSH, rejects conflicting admission, replays request IDs, reconnects SSE and preserves history',
  { timeout: 15000 },
  async () => {
    const dataDirectory = await mkdtemp(resolve(tmpdir(), 'edh-http-'));
    const options = { root: process.cwd(), dataDirectory, port: 0, tickMs: 20, modelDelayMs: 0 };
    let server = await startDemoServer(options);
    const post = (path: string, data: unknown, headers: Record<string, string> = {}) =>
      fetch(server.url + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(data),
      });
    try {
      assert.equal((await fetch(server.url)).status, 200);
      const config = await (await fetch(server.url + '/api/config')).json();
      assert.equal(config.physicalRuntime, 'not_connected');
      assert.equal(
        (
          await post(
            '/api/runs',
            { scenario: 'retry-success', requestId: randomUUID() },
            { Origin: 'http://foreign.invalid' },
          )
        ).status,
        403,
      );
      const requestId = randomUUID();
      let result = await post('/api/runs', { scenario: 'retry-success', requestId });
      assert.equal(result.status, 201);
      const { runId } = await result.json();
      const replay = await (
        await post('/api/runs', { scenario: 'retry-success', requestId })
      ).json();
      assert.equal(replay.runId, runId);
      assert.equal((await post('/api/runs', { scenario: 'unknown', requestId })).status, 409);
      assert.equal(
        (await post('/api/runs', { scenario: 'first-pass', requestId: randomUUID() })).status,
        409,
      );
      const events = await fetch(`${server.url}/api/runs/${runId}/events`, {
        headers: { 'Last-Event-ID': '1' },
      });
      const reader = events.body!.getReader();
      const first = await reader.read();
      assert.match(new TextDecoder().decode(first.value), /event: snapshot/);
      await reader.cancel();
      const deadline = Date.now() + 7000;
      let state: RunState;
      do {
        state = await (await fetch(`${server.url}/api/runs/${runId}`)).json();
        if (state.skillIds.length) break;
        assert(Date.now() < deadline, JSON.stringify(state.events.slice(-8)));
        await setTimeout(20);
      } while (true);
      assert.equal(state.state, 'succeeded');
      const trace = await (await fetch(`${server.url}/api/runs/${runId}/recovery`)).json();
      assert(trace.recovery.events.length > 0);
      assert.equal((await post(`/api/runs/${runId}/resume`, {})).status, 409);
      await server.close();
      server = await startDemoServer(options);
      const history = await (await fetch(`${server.url}/api/runs/${runId}`)).json();
      assert.equal(history.readOnly, true);
      assert.equal(history.skills.length, 1);
      const second = await (
        await post('/api/runs', { scenario: 'first-pass', requestId: randomUUID() })
      ).json();
      assert.notEqual(second.runId, runId);
      const old = await (await fetch(`${server.url}/api/runs/${runId}`)).json();
      assert.equal(old.state, 'succeeded');
    } finally {
      await server.close();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  },
);

test(
  'startup marks unfinished domain history interrupted without replaying physical work',
  { timeout: 10000 },
  async () => {
    const dataDirectory = await mkdtemp(resolve(tmpdir(), 'edh-restart-'));
    const options = { root: process.cwd(), dataDirectory, port: 0, modelDelayMs: 0, tickMs: 20 };
    let server = await startDemoServer(options);
    try {
      // Seed an interrupted domain record through the trusted store, not a resumed session.
      const fixture: RunState = {
        id: 'interrupted-run',
        instruction: 'Fixture task',
        scenario: 'retry-success',
        source: 'test_fixture',
        state: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        teamDigest: 'test',
        teamId: 'console-demo',
        decisionAssignmentId: 'old',
        attempt: 1,
        recoveryId: null,
        retryChanges: [],
        assignments: {},
        events: [],
        executions: [],
        requests: [],
        verdicts: [],
        latestSensor: null,
        agentSeen: {},
        skillIds: [],
        error: null,
      };
      server.store.put('run:interrupted-run', fixture, 0);
      await server.close();
      server = await startDemoServer(options);
      const record = await (await fetch(server.url + '/api/runs/interrupted-run')).json();
      assert.equal(record.state, 'interrupted');
      assert.equal(record.readOnly, true);
      assert.equal(record.executions.length, 0);
    } finally {
      await server.close();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  },
);
