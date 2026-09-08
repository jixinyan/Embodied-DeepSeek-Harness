import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ContractValidator, type InvocationBrief } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { AssignmentReports, type Assignment, type ReportInput } from '@edh/communication';

test('accepted role reports survive restart, preserve identity and replay without changing final results', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'edh-reports-'));
  let store = new LocalStore(directory);
  try {
    const validator = new ContractValidator(
      JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
    );
    const brief = JSON.parse(await readFile('tests/fixtures/invocation.json', 'utf8'))
      .value as InvocationBrief;
    const assignment: Assignment = {
      id: brief.assignment_id,
      member: 'scene',
      sessionId: 'session-scene',
      brief,
    };
    let reports = new AssignmentReports(store, validator);
    const missing: ReportInput = {
      status: 'insufficient_context',
      summary: 'Need a current frame.',
      result: null,
      evidenceRefs: [],
      requestedContext: ['Current frame'],
      expectedVersion: 0,
    };
    const first = reports.submit(assignment, missing).record;
    assert.equal(first.report.agent_id, assignment.sessionId);
    assert.deepEqual(first.report.task_scope, brief.task_scope);
    assert.equal(first.recipient, brief.expected_output.recipient);
    store.close();
    store = new LocalStore(directory);
    reports = new AssignmentReports(store, validator);
    assert.equal(reports.read(assignment.id)?.id, first.id);
    assert.equal(reports.submit(assignment, missing).replay, true);
    const finished: ReportInput = {
      ...missing,
      status: 'completed',
      summary: 'Analysis complete.',
      result: { target: 'cup' },
      requestedContext: [],
      expectedVersion: 1,
    };
    const final = reports.submit(assignment, finished).record;
    assert.equal(final.version, 2);
    assert.equal(reports.submit(assignment, finished).replay, true);
    assert.throws(
      () =>
        reports.submit(assignment, { ...finished, summary: 'Changed result.', expectedVersion: 2 }),
      /final report/,
    );
    assert.throws(
      () => reports.submit(assignment, { ...missing, expectedVersion: 2 }),
      /final report/,
    );
    store.close();
    store = new LocalStore(directory);
    assert.deepEqual(new AssignmentReports(store, validator).read(assignment.id), final);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
