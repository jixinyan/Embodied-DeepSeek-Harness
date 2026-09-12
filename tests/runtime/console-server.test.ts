import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { AssignmentReports, type Assignment } from '@edh/communication';
import { ContractValidator, type InvocationBrief } from '@edh/contracts';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { startDemoServer } from '../../apps/server/src/http-server.js';
import { RunHistory, type RunState } from '@edh/tasks';

test(
  'console API runs DSH, rejects conflicting admission, replays request IDs, reconnects SSE and preserves history',
  { timeout: 25000 },
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
      assert(config.scenarios.includes('multi-goal-recovery'));
      assert.equal(config.scenarioGoals['multi-goal-recovery'].id, 'store-cup');
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
      const deadline = Date.now() + 15000;
      let state: RunState;
      do {
        state = await (await fetch(`${server.url}/api/runs/${runId}`)).json();
        if (state.skillIds.length && state.state === 'succeeded') break;
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
      const validator = new ContractValidator(
        JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
      );
      const brief = JSON.parse(await readFile('tests/fixtures/invocation.json', 'utf8'))
        .value as InvocationBrief;
      brief.task_scope.task_id = fixture.id;
      const assignment: Assignment = {
        id: brief.assignment_id,
        member: 'scene',
        sessionId: 'old-scene',
        brief,
      };
      fixture.assignments[assignment.id] = {
        ...assignment,
        status: 'idle',
        model: 'fixture',
        tools: [],
      };
      const reports = new AssignmentReports(server.store, validator);
      const accepted = reports.submit(assignment, {
        status: 'completed',
        summary: 'Stored before crash.',
        result: {},
        evidenceRefs: [],
        requestedContext: [],
        expectedVersion: 0,
      }).record;
      reports.markDelivery(accepted.id, { state: 'queued' });
      // The published history exceeds the journal's per-record limit in aggregate.
      fixture.eventCount = 9;
      for (let sequence = 1; sequence <= 9; sequence++)
        server.store.put(
          `event:${fixture.id}:${sequence}`,
          {
            sequence,
            at: fixture.createdAt,
            type: 'tool.completed',
            detail: { text: 'x'.repeat(1024 * 1024) },
          },
          0,
        );
      // A crash can leave one event durable before its run projection is published.
      const orphan = { sequence: 10, at: fixture.createdAt, type: 'run.succeeded', detail: {} };
      server.store.put(`event:${fixture.id}:10`, orphan, 0);
      server.store.put('run:interrupted-run', fixture, 0);
      assert.throws(
        () => new RunHistory(server.store).restore({ ...fixture, eventCount: 11 }),
        /Incomplete/,
      );
      const legacy: RunState = {
        ...fixture,
        id: 'legacy-run',
        assignments: {},
        events: [{ sequence: 1, at: fixture.createdAt, type: 'run.created', detail: {} }],
      };
      delete legacy.eventCount;
      server.store.put('run:legacy-run', legacy, 0);
      const annotation = {
        sequence: 2,
        at: fixture.createdAt,
        type: 'run.interrupted',
        detail: { reason: 'Previous shutdown' },
      };
      // Crash after storing a restart annotation but before publishing interrupted state.
      server.store.put('run-interruption:legacy-run', annotation, 0);

      await server.close();
      server = await startDemoServer(options);
      const record = await (await fetch(server.url + '/api/runs/interrupted-run')).json();
      const migrated = await (await fetch(server.url + '/api/runs/legacy-run')).json();
      assert.equal(migrated.state, 'interrupted');
      assert.deepEqual(migrated.events, [...legacy.events, annotation]);
      assert.equal(server.store.get('run-interruption:legacy-run')!.version, 1);
      assert.deepEqual(server.store.get<RunState>('run:legacy-run')!.value.events, []);
      assert.equal(record.state, 'interrupted');
      assert.equal(record.readOnly, true);
      assert.equal(record.executions.length, 0);
      assert.equal(record.events.length, 10);
      assert.equal(record.events.at(-1).type, 'run.interrupted');
      assert.equal(
        record.events.some((event: { type: string }) => event.type === 'run.succeeded'),
        false,
      );
      assert.deepEqual(server.store.get(`event:${fixture.id}:10`)!.value, orphan);
      const projection = server.store.get<RunState>(`run:${fixture.id}`)!.value;
      assert.deepEqual(projection.events, []);
      assert.equal(projection.eventCount, 9);
      assert.equal(record.roleReports[0].latestReport.id, accepted.id);
      assert.equal(record.roleReports[0].reportDelivery.state, 'interrupted');
      assert.equal(record.roleReports[0].reportAcknowledgement, null);
      await server.close();
      server = await startDemoServer(options);
      const reopened = await (await fetch(server.url + '/api/runs/interrupted-run')).json();
      assert.deepEqual(reopened.events, record.events);
      assert.equal(
        record.events.filter((event: { type: string }) => event.type === 'message.delivered')
          .length,
        0,
      );
    } finally {
      await server.close();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  },
);
