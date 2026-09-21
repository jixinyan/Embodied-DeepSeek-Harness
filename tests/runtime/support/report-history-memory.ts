import assert from 'node:assert/strict';
import { AssignmentReports } from '@edh/communication';
import { LocalStore } from '@edh/storage';
import { documentReports } from './report-documents.js';

const { validator, assignment, input } = await documentReports();
const store = new LocalStore(process.argv[2]!);
try {
  const reports = new AssignmentReports(store, validator);
  let versions = 0;
  let firstId: string | undefined;
  while (store.statistics().journalBytes <= 100 * 1024 * 1024) {
    const record = reports.submit(assignment, input(versions, true)).record;
    firstId ??= record.id;
    versions++;
  }
  let before: string | undefined;
  let visited = 0;
  do {
    const page = reports.status(assignment.id, before, true);
    visited += page.reportHistory.length;
    before = page.reportHistoryPage.nextBeforeReportId ?? undefined;
  } while (before);
  assert.equal(visited, versions);
  reports.acknowledge(assignment.id, firstId!, assignment.brief.expected_output.recipient, {
    disposition: 'accepted',
    summary: 'Documentation references received; deployment evidence remains required.',
  });
  const reconciled = reports.reconcileInterruptedDeliveries();
  assert.equal(reports.reconcileInterruptedDeliveries(), 0);
  console.log(
    JSON.stringify({
      versions,
      visited,
      reconciled,
      journalBytes: store.statistics().journalBytes,
      firstAcknowledged: Boolean(reports.acknowledgement(firstId!)),
    }),
  );
} finally {
  store.close();
}
