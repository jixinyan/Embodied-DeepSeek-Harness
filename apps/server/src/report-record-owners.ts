import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AssignmentReports, type AcceptedReport } from '@edh/communication';
import type { ContractValidator } from '@edh/contracts';
import { SensorSamples } from '@edh/perception';
import type { LocalStore } from '@edh/storage';
import { AssignmentHistory, type RunState } from '@edh/tasks';
import type { DomainRecordOwner } from './domain-retention.js';

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/);
const assignmentIdentity = z.object({
  id: identifier,
  sessionId: identifier,
  detailsStored: z.boolean().optional(),
});

export function reportRecordOwners(
  store: LocalStore,
  validator: ContractValidator,
): DomainRecordOwner[] {
  const reports = new AssignmentReports(store, validator);
  const source = (reportId: string) => {
    const archived = reports.readRecord(reportId);
    if (archived) return { record: archived, key: `report-record:${reportId}` };
    let found: { record: AcceptedReport; key: string } | undefined;
    for (const row of store.revisions('report:')) {
      const assignmentId = identifier.parse(row.key.slice('report:'.length));
      const record = reports.read(assignmentId)!;
      if (record.id !== reportId) continue;
      if (found) throw new Error('Report identity has multiple published sources.');
      found = { record, key: row.key };
    }
    if (!found) throw new Error('Referenced report source is missing.');
    return found;
  };
  const dependencies = (record: AcceptedReport): string[] => {
    const { report } = record;
    const runId = report.task_scope.task_id;
    const row = store.get<RunState>(`run:${runId}`);
    const state = row?.value;
    if (!state || state.id !== runId)
      throw new Error('Report source run is missing or conflicting.');
    const assignments = z.record(z.string(), z.unknown()).parse(state.assignments);
    const references = new Set([`run:${runId}`]);
    const assignment = (assignmentId: string) => {
      const published = assignmentIdentity.parse(assignments[assignmentId]);
      if (published.id !== assignmentId) throw new Error('Report assignment identity conflicts.');
      const archive = published.detailsStored
        ? new AssignmentHistory(store, validator).read(runId, assignmentId)
        : undefined;
      if (published.detailsStored && !archive)
        throw new Error('Report assignment archive is missing.');
      if (archive) references.add(`assignment-history:${JSON.stringify([runId, assignmentId])}`);
      const actor = archive?.assignment ?? state.assignments[assignmentId]!;
      const brief = validator.parse('InvocationBrief', actor.brief);
      if (
        actor.sessionId !== published.sessionId ||
        brief.assignment_id !== assignmentId ||
        brief.task_scope.task_id !== runId
      )
        throw new Error('Report assignment source conflicts with its run.');
      return { actor, brief };
    };
    const sender = assignment(report.assignment_id);
    if (
      sender.actor.sessionId !== report.agent_id ||
      sender.brief.team_run_id !== report.team_run_id ||
      sender.brief.expected_output.recipient !== record.recipient ||
      !isDeepStrictEqual(sender.brief.task_scope, report.task_scope)
    )
      throw new Error('Report source conflicts with its sender or designated recipient.');
    if (record.recipient !== 'user') {
      const recipient = assignment(record.recipient);
      if (recipient.brief.team_run_id !== report.team_run_id)
        throw new Error('Report recipient belongs to another Team.');
    }
    if (report.task_scope.recovery_id) references.add(`recovery:${report.task_scope.recovery_id}`);
    const samples = new SensorSamples(store, validator, runId, state.source);
    for (const evidenceId of report.evidence_refs) {
      const sample = samples.read(evidenceId);
      if (
        !sample ||
        sample.evidence.task_scope.task_id !== runId ||
        sample.evidence.visibility !== 'agent'
      )
        throw new Error('Report evidence is missing, restricted or belongs to another run.');
      references.add(`sensor-sample:${JSON.stringify([runId, evidenceId])}`);
    }
    if (record.previousReportId) {
      reports.predecessor(record);
      references.add(`report-record:${record.previousReportId}`);
    }
    if (reports.delivery(record.id)) references.add(`report-delivery:${record.id}`);
    const receipt = reports.acknowledgement(record.id);
    if (receipt) {
      if (
        receipt.assignmentId !== report.assignment_id ||
        receipt.recipientAssignmentId !== record.recipient
      )
        throw new Error('Report acknowledgement conflicts with its sender or recipient.');
      references.add(`report-ack:${record.id}`);
    }
    return [...references];
  };
  const owner = (prefix: string, inspect: DomainRecordOwner['inspect']): DomainRecordOwner => ({
    id: prefix.slice(0, -1),
    prefix,
    version: '1',
    inspect,
  });
  return [
    owner('report:', ({ key }) => {
      const assignmentId = identifier.parse(key.slice('report:'.length));
      const record = reports.read(assignmentId);
      if (!record) throw new Error('Published report source is missing.');
      const references = dependencies(record);
      if (reports.readRecord(record.id)) references.push(`report-record:${record.id}`);
      return { references, retain: false };
    }),
    owner('report-record:', ({ key }) => {
      const record = reports.readRecord(identifier.parse(key.slice('report-record:'.length)));
      if (!record) throw new Error('Report archive is missing.');
      return { references: dependencies(record), retain: false };
    }),
    owner('report-delivery:', ({ key }) => {
      const reportId = identifier.parse(key.slice('report-delivery:'.length));
      const record = source(reportId);
      reports.delivery(reportId);
      dependencies(record.record);
      return { references: [record.key], retain: false };
    }),
    owner('report-ack:', ({ key }) => {
      const reportId = identifier.parse(key.slice('report-ack:'.length));
      const record = source(reportId);
      reports.acknowledgement(reportId);
      dependencies(record.record);
      return { references: [record.key], retain: false };
    }),
  ];
}
