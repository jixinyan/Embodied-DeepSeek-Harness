import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AssignmentReports } from '@edh/communication';
import { LocalStore } from '@edh/storage';
import { AssignmentHistory } from '@edh/tasks';
import { SensorSamples } from '@edh/perception';
import { VerificationContexts } from '@edh/verification';
import { readAssignmentDetails } from '../../apps/server/src/assignment-view.js';
import { readRoleReports } from '../../apps/server/src/report-view.js';
import { HttpError } from '../../apps/server/src/local-http.js';
import { assignmentDocuments } from './support/assignment-documents.js';

async function withHistory(
  action: (
    value: Awaited<ReturnType<typeof assignmentDocuments>> & {
      store: LocalStore;
      history: AssignmentHistory;
      directory: string;
    },
  ) => Promise<void>,
) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/edh-assignment-history-'));
  const store = new LocalStore(directory);
  try {
    const source = await assignmentDocuments();
    await action({
      ...source,
      directory,
      store,
      history: new AssignmentHistory(store, source.validator),
    });
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('retired details preserve brief, TODO, report and final stream while releasing projection bodies', async () => {
  await withHistory(async ({ store, history, state, assignment, validator, input, directory }) => {
    assignment.brief.history_summary = await readFile('README.md', 'utf8');
    const report = new AssignmentReports(store, validator).submit(assignment, input(0)).record;
    state.assignments[assignment.id]!.report = report.report;
    state.assignments[assignment.id]!.reportVersion = report.version;
    state.agentStreams = {
      [assignment.id]: {
        attemptId: 'document-review',
        revision: 1,
        text: 'The project specification was supplied for review.',
        reasoning: '',
        status: 'cancelled',
      },
    };
    const original = structuredClone(state.assignments[assignment.id]!);
    const stream = structuredClone(state.agentStreams[assignment.id]);
    history.retain(state, assignment.id);
    assert.equal(state.assignments[assignment.id]!.detailsStored, true);
    assert.equal(state.assignments[assignment.id]!.brief, undefined);
    assert.equal(state.assignments[assignment.id]!.todos, undefined);
    assert.equal(state.assignments[assignment.id]!.report, undefined);
    assert.equal(state.assignments[assignment.id]!.todoCount, 1);
    assert.equal(
      state.assignments[assignment.id]!.callerAssignmentId,
      assignment.brief.caller_assignment_id,
    );
    assert.equal(state.agentStreams[assignment.id], undefined);
    const record = history.read(state.id, assignment.id)!;
    assert.deepEqual(record.assignment, original);
    assert.deepEqual(record.stream, stream);
    store.put(`run:${state.id}`, state, 0);
    const reports = readRoleReports(
      store,
      validator,
      state.id,
      new URLSearchParams({ assignment: assignment.id }),
    );
    assert.deepEqual(reports.latestReport, report);
    record.assignment.brief.objective = 'Caller-owned edit';
    assert.deepEqual(history.read(state.id, assignment.id)!.assignment, original);
    const sequence = store.statistics().sequence;
    history.retain(state, assignment.id);
    assert.equal(store.statistics().sequence, sequence);
    store.compact();
    store.close();
    const reopened = new LocalStore(directory);
    try {
      assert.deepEqual(
        new AssignmentHistory(reopened, validator).read(state.id, assignment.id)!.assignment,
        original,
      );
    } finally {
      reopened.close();
    }
  });
});

test('write exclusion and invalid scope preserve full resident details', async () => {
  await withHistory(async ({ store, history, state, assignment }) => {
    const original = structuredClone(state);
    const hold = store.holdWrites();
    try {
      assert.throws(() => history.retain(state, assignment.id), /writes are suspended/);
      assert.deepEqual(state, original);
    } finally {
      hold.release();
    }
    state.assignments[assignment.id]!.status = 'running';
    assert.throws(() => history.retain(state, assignment.id));
    assert(state.assignments[assignment.id]!.brief);
    state.assignments[assignment.id]!.status = 'retired';
    state.assignments[assignment.id]!.brief!.task_scope.task_id = 'different-task';
    assert.throws(() => history.retain(state, assignment.id), /scope is inconsistent/);
    assert.equal(history.read(state.id, assignment.id), undefined);
  });
});

test('archived records reject source conflicts and rewritten storage', async () => {
  await withHistory(async ({ history, state, assignment, store }) => {
    const original = structuredClone(state);
    history.retain(state, assignment.id);
    original.assignments[assignment.id]!.brief!.objective = 'Changed source';
    assert.throws(() => history.retain(original, assignment.id), /immutable/);
    const record = history.read(state.id, assignment.id)!;
    store.put(`assignment-history:${JSON.stringify([state.id, assignment.id])}`, record, 1);
    assert.throws(() => history.read(state.id, assignment.id), /rewritten/);
    assert.throws(() => history.retain(state, assignment.id), /rewritten/);
  });
});

test('task and report identities are checked before archival publication', async () => {
  await withHistory(async ({ state, assignment, store, history, validator, input }) => {
    const report = new AssignmentReports(store, validator).submit(assignment, input(0)).record;
    state.assignments[assignment.id]!.report = { ...report.report, agent_id: 'another-agent' };
    assert.throws(() => history.retain(state, assignment.id), /different assignment/);
    delete state.assignments[assignment.id]!.report;
    state.assignments[assignment.id]!.brief!.assignment_id = 'another-assignment';
    assert.throws(() => history.retain(state, assignment.id), /identity or task scope/);
    assert.equal(history.read(state.id, assignment.id), undefined);
  });
});

test('assignment detail HTTP reads preserve archived observation references and enforce task ownership', async () => {
  await withHistory(async ({ store, validator, history, state, assignment }) => {
    const sample = new SensorSamples(store, validator, state.id, state.source).retain({
      evidence: {
        id: 'review-document',
        kind: 'event',
        source: 'authored-document-record',
        created_at: state.createdAt,
        observed_at: state.createdAt,
        clock_id: 'document-clock',
        visibility: 'agent',
        task_scope: { task_id: state.id },
      },
      sequence: 0,
      source: state.source,
      description: 'Actual project document metadata supplied for history inspection.',
      visualization: {},
    });
    state.agentSeen[assignment.id] = sample;
    store.put(`run:${state.id}`, state, 0);
    const query = new URLSearchParams({ assignment: assignment.id });
    const initial = readAssignmentDetails(store, validator, state.id, query);
    history.retain(state, assignment.id);
    store.put(`run:${state.id}`, state, 1);
    assert.equal(state.agentSeen[assignment.id], undefined);
    assert.equal(state.assignments[assignment.id]!.lastObservationId, sample.evidence.id);
    const server = createServer((req, res) => {
      try {
        const result = readAssignmentDetails(
          store,
          validator,
          state.id,
          new URL(req.url!, 'http://localhost').searchParams,
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(error instanceof HttpError ? error.status : 500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
    await new Promise<void>((accept) => server.listen(0, '127.0.0.1', accept));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const response = await fetch(`${url}/?${query}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ...initial, archived: true });
      assert.equal((await fetch(`${url}/?assignment=foreign`)).status, 404);
      assert.equal((await fetch(`${url}/?assignment=__proto__`)).status, 400);
      assert.equal((await fetch(`${url}/?${query}&unknown=field`)).status, 400);
      assert.equal((await fetch(`${url}/?${query}&${query}`)).status, 400);
      store.put(`run:foreign-run`, { ...state, id: 'foreign-run' }, 0);
      assert.throws(() => readAssignmentDetails(store, validator, 'foreign-run', query), /missing/);
    } finally {
      await new Promise<void>((accept, reject) =>
        server.close((error) => (error ? reject(error) : accept())),
      );
    }
  });
});

test('archived HTTP reads reject conflicting published summaries', async () => {
  await withHistory(async ({ store, validator, history, state, assignment }) => {
    history.retain(state, assignment.id);
    const summary = state.assignments[assignment.id]!;
    const query = new URLSearchParams({ assignment: assignment.id });
    let version = 0;
    for (const change of [
      { sessionId: 'another-session' },
      { member: 'another-role' },
      { status: 'running' },
      { model: 'another-model' },
      { tools: ['another-tool'] },
      { callerAssignmentId: 'another-caller' },
      { lastObservationId: 'another-observation' },
      { verificationContextStored: true },
    ]) {
      store.put(
        `run:${state.id}`,
        { ...state, assignments: { [assignment.id]: { ...summary, ...change } } },
        version++,
      );
      assert.throws(
        () => readAssignmentDetails(store, validator, state.id, query),
        /conflict with the published run/,
      );
    }
  });
});

test('assignment inspection distinguishes saved checks from a submitted unknown verdict', async () => {
  await withHistory(async ({ store, validator, history, state, assignment }) => {
    const samples = new SensorSamples(store, validator, state.id, state.source);
    const sample = samples.retain({
      evidence: {
        id: 'verification-document',
        kind: 'event',
        source: 'authored-project-document',
        created_at: state.createdAt,
        observed_at: state.createdAt,
        clock_id: 'document-clock',
        visibility: 'agent',
        task_scope: assignment.brief.task_scope,
      },
      sequence: 0,
      source: state.source,
      description: await readFile('README.md', 'utf8'),
      visualization: {},
    });
    const contexts = new VerificationContexts(store, validator, samples, state.id);
    contexts.open(assignment.id, {
      requestId: 'document-request',
      executionId: 'document-execution-reference',
      boundaryId: 'document-boundary-reference',
      scope: assignment.brief.task_scope,
      evidenceId: sample.evidence.id,
    });
    state.assignments[assignment.id]!.verificationContextStored = true;
    store.put(`run:${state.id}`, state, 0);
    const params = new URLSearchParams({ assignment: assignment.id });
    let detail = readAssignmentDetails(store, validator, state.id, params);
    assert.equal(detail.verification!.status, 'awaiting_checks');
    assert.equal(detail.verification!.verdict, null);
    const facts = [
      {
        check_id: 'review',
        value: null,
        reason: 'Physical provider evidence is unavailable in this authored document.',
        evidence_refs: [sample.evidence.id],
      },
    ];
    contexts.update(assignment.id, facts, sample.evidence.id);
    detail = readAssignmentDetails(store, validator, state.id, params);
    assert.equal(detail.verification!.status, 'checked');
    assert.deepEqual(detail.verification!.context.facts, facts);
    assert.equal(detail.verification!.verdict, null);
    const verdict = validator.parse('VerificationResult', {
      schema_version: 'physical.verification.v1',
      verdict_id: 'document-unknown-verdict',
      verification_request_id: 'document-request',
      execution_id: 'document-execution-reference',
      boundary_event_id: 'document-boundary-reference',
      verifier_id: assignment.sessionId,
      verifier_assignment_id: assignment.id,
      task_scope: assignment.brief.task_scope,
      status: 'unknown',
      goal_contract_id: assignment.brief.success_contract.id,
      goal_contract_version: assignment.brief.success_contract.version,
      checks: facts,
      evidence_refs: [sample.evidence.id],
      explanation: 'An authored unknown-result document; no model or device was executed.',
      observed_at: state.createdAt,
      clock_id: 'document-clock',
    });
    state.verdicts.push(verdict);
    history.retain(state, assignment.id);
    contexts.release(assignment.id);
    store.put(`run:${state.id}`, state, 1);
    detail = readAssignmentDetails(store, validator, state.id, params);
    assert.equal(detail.archived, true);
    assert.equal(detail.assignment.verificationContextStored, true);
    assert.equal(detail.verification!.status, 'settled');
    assert.equal(detail.verification!.verdict!.status, 'unknown');
    assert.deepEqual(detail.verification!.observation, sample);
    for (const change of [
      { verification_request_id: 'foreign' },
      { execution_id: 'foreign' },
      { boundary_event_id: 'foreign' },
      { verifier_id: 'foreign' },
      { verifier_assignment_id: 'foreign' },
      { task_scope: { ...assignment.brief.task_scope, attempt_id: 'foreign' } },
      { goal_contract_id: 'foreign' },
      { goal_contract_version: '2' },
      { checks: [{ ...facts[0], reason: 'Unrelated recorded reason' }] },
      { evidence_refs: ['foreign'] },
    ]) {
      const current = store.get(`run:${state.id}`)!;
      store.put(
        `run:${state.id}`,
        { ...state, verdicts: [{ ...verdict, ...change }] },
        current.version,
      );
      assert.throws(() => readAssignmentDetails(store, validator, state.id, params), /conflicts/);
    }
    const current = store.get(`run:${state.id}`)!;
    store.put(`run:${state.id}`, { ...state, verdicts: [verdict, verdict] }, current.version);
    assert.throws(
      () => readAssignmentDetails(store, validator, state.id, params),
      /multiple accepted formal verdicts/,
    );
    contexts.close();
  });
});

test('assignment inspection rejects missing published contexts and restricted verification evidence', async () => {
  await withHistory(async ({ store, validator, state, assignment }) => {
    state.assignments[assignment.id]!.verificationContextStored = true;
    store.put(`run:${state.id}`, state, 0);
    const params = new URLSearchParams({ assignment: assignment.id });
    assert.throws(
      () => readAssignmentDetails(store, validator, state.id, params),
      /context is missing/,
    );
    const samples = new SensorSamples(store, validator, state.id, state.source);
    samples.retain({
      evidence: {
        id: 'private-document',
        kind: 'event',
        source: 'authored-private-document',
        created_at: state.createdAt,
        observed_at: state.createdAt,
        clock_id: 'document-clock',
        visibility: 'debug_only',
        task_scope: assignment.brief.task_scope,
      },
      sequence: 0,
      source: state.source,
      description: 'Restricted document metadata.',
      visualization: {},
    });
    const contexts = new VerificationContexts(store, validator, samples, state.id);
    contexts.open(assignment.id, {
      requestId: 'document-request',
      executionId: 'document-execution-reference',
      boundaryId: 'document-boundary-reference',
      scope: assignment.brief.task_scope,
      evidenceId: 'private-document',
    });
    assert.throws(
      () => readAssignmentDetails(store, validator, state.id, params),
      (error: unknown) => error instanceof HttpError && error.status === 403,
    );
    const key = `verification-context:${JSON.stringify([state.id, assignment.id])}`;
    const context = contexts.inspect(assignment.id)!;
    contexts.close();
    store.put(key, { ...context, scope: { ...context.scope, attempt_id: 'other-attempt' } }, 1);
    assert.throws(
      () => readAssignmentDetails(store, validator, state.id, params),
      /context conflicts/,
    );
  });
});

test(
  'retired assignment documents exceed 100 MiB with compact projections under a constrained heap',
  { timeout: 90000 },
  async () => {
    await withHistory(async ({ store, directory }) => {
      store.close();
      const result = await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=64',
          '--import',
          'tsx',
          'tests/runtime/support/assignment-history-memory.ts',
          directory,
        ],
        { env: { ...process.env, TMPDIR: resolve('.local/work') } },
      );
      const output = JSON.parse(result.stdout);
      assert(output.documentBytes > 100 * 1024 * 1024);
      assert(output.projectionBytes < 2 * 1024 * 1024);
      assert(output.assignments > 500);
      assert.equal(output.fullBriefs, 0);
    });
  },
);
