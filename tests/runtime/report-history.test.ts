import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { LocalStore } from '@edh/storage';
import { AssignmentReports, reportPageLimits, type AcceptedReport } from '@edh/communication';
import { readRoleReports } from '../../apps/server/src/report-view.js';
import { HttpError } from '../../apps/server/src/local-http.js';
import { documentReports } from './support/report-documents.js';

async function withReports(
  action: (
    context: Awaited<ReturnType<typeof documentReports>> & {
      directory: string;
      store: LocalStore;
      reports: AssignmentReports;
    },
  ) => Promise<void>,
) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/edh-report-history-'));
  const store = new LocalStore(directory);
  try {
    const documents = await documentReports();
    await action({
      ...documents,
      directory,
      store,
      reports: new AssignmentReports(store, documents.validator),
    });
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('report pages retain published versions across append, compaction and reopening', async () => {
  await withReports(async ({ store, directory, validator, reports, assignment, input }) => {
    const records = Array.from(
      { length: 39 },
      (_, index) => reports.submit(assignment, input(index)).record,
    );
    const first = reports.status(assignment.id);
    assert.equal(first.latestReport?.id, records.at(-1)!.id);
    assert.equal(first.reportHistory.length, reportPageLimits.reports);
    assert(first.reportHistory.every((row) => !Object.hasOwn(row, 'record')));
    assert.deepEqual(
      first.reportHistory.map((row) => row.version),
      records.slice(-16).map((record) => record.version),
    );
    const cursor = first.reportHistoryPage.nextBeforeReportId!;
    assert.equal(cursor, records[23]!.id);
    reports.submit(assignment, input(39));
    const second = reports.page(assignment.id, cursor);
    assert.deepEqual(second.reports, records.slice(7, 23));
    const last = reports.page(assignment.id, second.nextBeforeReportId!);
    assert.deepEqual(last.reports, records.slice(0, 7));
    assert.equal(last.nextBeforeReportId, null);
    assert.deepEqual(reports.page(assignment.id, records[0]!.id).reports, []);
    second.reports[0]!.report.summary = 'Caller-owned modification';
    assert.deepEqual(reports.page(assignment.id, cursor).reports, records.slice(7, 23));
    store.compact();
    store.close();
    const reopened = new LocalStore(directory);
    try {
      assert.deepEqual(
        new AssignmentReports(reopened, validator).page(assignment.id, cursor).reports,
        records.slice(7, 23),
      );
    } finally {
      reopened.close();
    }
  });
});

test('report page bytes include document bodies and caller receipts', async () => {
  await withReports(async ({ reports, assignment, input }) => {
    for (let index = 0; index < 20; index++) {
      const record = reports.submit(assignment, input(index, true)).record;
      reports.acknowledge(assignment.id, record.id, record.recipient, {
        disposition: 'accepted',
        summary: 'The document reference and request for deployment evidence were received.',
      });
      reports.markDelivery(record.id, { state: 'settled' });
    }
    const versions: number[] = [];
    let cursor: string | undefined;
    do {
      const state = reports.status(assignment.id, cursor, true);
      assert(state.reportHistory.length < reportPageLimits.reports);
      assert(Buffer.byteLength(JSON.stringify(state.reportHistory)) <= reportPageLimits.bytes);
      for (const row of state.reportHistory) {
        assert(row.record?.report.result);
        assert.equal(row.acknowledgement?.disposition, 'accepted');
        assert.equal(row.delivery.state, 'settled');
        versions.push(row.version);
      }
      cursor = state.reportHistoryPage.nextBeforeReportId ?? undefined;
    } while (cursor);
    assert.deepEqual(
      versions.sort((a, b) => a - b),
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });
});

test('empty histories, foreign cursors and unpublished report records remain distinct', async () => {
  await withReports(async ({ reports, assignment, input, store }) => {
    assert.equal(reports.status(assignment.id).latestReport, null);
    assert.deepEqual(reports.status(assignment.id).reportHistory, []);
    assert.throws(() => reports.page(assignment.id, 'unknown'), /published/);
    assert.throws(() => reports.page(assignment.id, ''), /Invalid report cursor/);
    const first = reports.submit(assignment, input(0)).record;
    store.put(
      'report-record:unpublished',
      { ...first, id: 'unpublished', version: 2, previousReportId: first.id },
      0,
    );
    assert.throws(() => reports.page(assignment.id, 'unpublished'), /published/);
    assert.throws(
      () =>
        reports.acknowledge(assignment.id, 'unpublished', first.recipient, {
          disposition: 'accepted',
          summary: 'Received.',
        }),
      /published/,
    );
    const other = {
      ...assignment,
      id: 'other-assignment',
      brief: { ...assignment.brief, assignment_id: 'other-assignment' },
    };
    const foreign = reports.submit(other, input(0)).record;
    assert.throws(() => reports.page(assignment.id, foreign.id), /published/);
    assert.throws(
      () =>
        reports.acknowledge(assignment.id, first.id, 'foreign-caller', {
          disposition: 'accepted',
          summary: 'Received.',
        }),
      /designated/,
    );
  });
});

test('published report traversal rejects changed predecessor identity, version and scope', async () => {
  for (const change of [
    { id: 'changed' },
    { version: 2 },
    { recipient: 'different-recipient' },
    { reportField: 'assignment_id', value: 'different-assignment' },
    { reportField: 'agent_id', value: 'different-session' },
    { reportField: 'team_run_id', value: 'different-team' },
    {
      reportField: 'task_scope',
      value: { task_id: 'different-task', goal_id: 'review', attempt_id: 'attempt-1' },
    },
  ]) {
    await withReports(async ({ store, reports, assignment, input }) => {
      const first = reports.submit(assignment, input(0)).record;
      reports.submit(assignment, input(1));
      const changed =
        'reportField' in change
          ? { ...first, report: { ...first.report, [change.reportField!]: change.value } }
          : { ...first, ...change };
      store.put(`report-record:${first.id}`, changed, 1);
      assert.throws(() => reports.page(assignment.id), /Incomplete published/);
      assert.throws(() => reports.history(assignment.id), /Incomplete published/);
    });
  }
});

test('report acknowledgement and interrupted delivery reconciliation preserve durable state', async () => {
  await withReports(async ({ reports, assignment, input, store }) => {
    const records: AcceptedReport[] = [];
    for (let i = 0; i < 35; i++) records.push(reports.submit(assignment, input(i)).record);
    const first = records[0]!;
    const accepted = {
      disposition: 'accepted' as const,
      summary: 'The requested deployment evidence is being collected.',
    };
    const receipt = reports.acknowledge(assignment.id, first.id, first.recipient, accepted);
    assert.equal(receipt.replay, false);
    assert.deepEqual(reports.acknowledge(assignment.id, first.id, first.recipient, accepted), {
      ...receipt,
      replay: true,
    });
    assert.throws(
      () =>
        reports.acknowledge(assignment.id, first.id, first.recipient, {
          ...accepted,
          disposition: 'rejected',
        }),
      /immutable/,
    );
    reports.markDelivery(first.id, { state: 'settled' });
    const hold = store.holdWrites();
    try {
      assert.throws(() => reports.reconcileInterruptedDeliveries(), /writes are suspended/);
      assert.equal(reports.delivery(first.id)?.state, 'settled');
    } finally {
      hold.release();
    }
    assert.equal(reports.reconcileInterruptedDeliveries(), 34);
    assert.equal(reports.reconcileInterruptedDeliveries(), 0);
    assert.equal(reports.delivery(first.id)?.state, 'settled');
    assert.deepEqual(reports.acknowledgement(first.id), receipt.acknowledgement);
    assert.equal(reports.delivery(records[10]!.id)?.state, 'interrupted');
  });
});

test('real HTTP report inspection enforces run ownership and query boundaries', async () => {
  await withReports(async ({ store, validator, reports, assignment, input, runId }) => {
    store.put(`run:${runId}`, { id: runId, assignments: { [assignment.id]: assignment } }, 0);
    for (let index = 0; index < 20; index++) reports.submit(assignment, input(index));
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url!, 'http://localhost');
        const result = readRoleReports(store, validator, runId, url.searchParams);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(error instanceof HttpError ? error.status : 400, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
    await new Promise<void>((accept) => server.listen(0, '127.0.0.1', accept));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const response = await fetch(`${url}/?assignment=${assignment.id}`);
      assert.equal(response.status, 200);
      const first = await response.json();
      assert.equal(first.reportHistory.length, 16);
      assert(first.reportHistory[0].record.report.summary);
      const older = await fetch(
        `${url}/?assignment=${assignment.id}&before=${first.reportHistoryPage.nextBeforeReportId}`,
      );
      assert.equal((await older.json()).reportHistory.length, 4);
      for (const query of [
        '',
        `assignment=${assignment.id}&unknown=x`,
        `assignment=${assignment.id}&before=`,
        `assignment=${assignment.id}&assignment=${assignment.id}`,
      ])
        assert.equal((await fetch(`${url}/?${query}`)).status, 400);
      assert.equal((await fetch(`${url}/?assignment=foreign`)).status, 404);
      assert.equal(
        (await fetch(`${url}/?assignment=${assignment.id}&before=unpublished`)).status,
        400,
      );
    } finally {
      await new Promise<void>((accept, reject) =>
        server.close((error) => (error ? reject(error) : accept())),
      );
    }
  });
});

test(
  'report history, acknowledgement and startup reconciliation work under a constrained heap',
  { timeout: 90000 },
  async () => {
    await withReports(async ({ store, directory }) => {
      store.close();
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=64',
          '--import',
          'tsx',
          'tests/runtime/support/report-history-memory.ts',
          directory,
        ],
        { env: { ...process.env, TMPDIR: resolve('.local/work') } },
      );
      const result = JSON.parse(stdout);
      assert(result.journalBytes > 100 * 1024 * 1024);
      assert(result.versions > 500);
      assert.equal(result.visited, result.versions);
      assert.equal(result.reconciled, result.versions);
      assert.equal(result.firstAcknowledged, true);
    });
  },
);
