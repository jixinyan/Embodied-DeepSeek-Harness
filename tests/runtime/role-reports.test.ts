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

test('report acknowledgement binds published versions and restart reconciliation preserves uncertainty', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'edh-report-ack-'));
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
      sessionId: 'scene-session',
      brief,
    };
    let reports = new AssignmentReports(store, validator);
    const input: ReportInput = {
      status: 'insufficient_context',
      summary: 'Need frame.',
      result: null,
      evidenceRefs: [],
      requestedContext: ['frame'],
      expectedVersion: 0,
    };
    const first = reports.submit(assignment, input).record;
    reports.markDelivery(first.id, { state: 'queued' });
    assert.equal(
      reports.status(assignment.id).reportAcknowledgement,
      null,
      'Delivery is not caller acknowledgement.',
    );
    const final = reports.submit(assignment, {
      ...input,
      status: 'completed',
      requestedContext: [],
      result: { object: 'cup' },
      expectedVersion: 1,
    }).record;
    reports.markDelivery(final.id, { state: 'settled' });
    assert.deepEqual(
      reports.history(assignment.id).map((record) => record.id),
      [first.id, final.id],
    );
    const accept = {
      disposition: 'accepted' as const,
      summary: 'The requested context was provided.',
    };
    const confirmed = reports.acknowledge(assignment.id, first.id, first.recipient, accept);
    assert.equal(confirmed.replay, false);
    assert.equal(
      reports.acknowledge(assignment.id, first.id, first.recipient, accept).replay,
      true,
    );
    assert.throws(
      () => reports.acknowledge(assignment.id, first.id, 'foreign', accept),
      /designated/,
    );
    assert.throws(
      () =>
        reports.acknowledge(assignment.id, first.id, first.recipient, {
          ...accept,
          disposition: 'rejected',
        }),
      /immutable/,
    );
    // An uncommitted immutable record is not in the published version chain.
    store.put(
      'report-record:orphan',
      { ...final, id: 'orphan', version: 3, previousReportId: final.id },
      0,
    );
    assert.throws(
      () => reports.acknowledge(assignment.id, 'orphan', first.recipient, accept),
      /published/,
    );
    const missingDelivery = reports.submit(
      {
        ...assignment,
        id: 'missing-delivery',
        brief: { ...brief, assignment_id: 'missing-delivery' },
      },
      input,
    ).record;
    store.close();
    store = new LocalStore(directory);
    reports = new AssignmentReports(store, validator);
    assert.equal(reports.reconcileInterruptedDeliveries(), 2);
    assert.equal(reports.delivery(first.id)?.state, 'interrupted');
    assert.equal(reports.delivery(missingDelivery.id)?.state, 'interrupted');
    assert.equal(reports.delivery(final.id)?.state, 'settled');
    assert.deepEqual(reports.acknowledgement(first.id), confirmed.acknowledgement);
    assert.equal(
      reports.status(assignment.id).reportAcknowledgement,
      null,
      'A newer report needs its own acknowledgement.',
    );
    assert.equal(reports.reconcileInterruptedDeliveries(), 0);
    assert.equal(reports.read(assignment.id)?.id, final.id);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
