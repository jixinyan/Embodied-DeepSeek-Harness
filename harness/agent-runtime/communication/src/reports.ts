import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ContractValidator, type AgentReport } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { validateJsonSchemaValue, type ObjectJsonSchema } from '@edh/tools';
import type { Assignment } from './sessions.js';

export interface ReportInput {
  status: AgentReport['status'];
  summary: string;
  result: Record<string, unknown> | null;
  evidenceRefs: string[];
  requestedContext: string[];
  expectedVersion: number;
}
export interface AcceptedReport {
  id: string;
  version: number;
  recipient: string;
  report: AgentReport;
}
export interface ReportDelivery {
  state: 'queued' | 'settled' | 'recorded' | 'failed';
  error?: string;
}
/** Assignment identity comes from the authenticated native tool scope, never model fields. */
export class AssignmentReports {
  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
  ) {}
  read(assignmentId: string): AcceptedReport | undefined {
    return this.store.get<AcceptedReport>(`report:${assignmentId}`)?.value;
  }
  delivery(reportId: string): ReportDelivery | undefined {
    return this.store.get<ReportDelivery>(`report-delivery:${reportId}`)?.value;
  }
  markDelivery(reportId: string, delivery: ReportDelivery): void {
    const key = `report-delivery:${reportId}`;
    this.store.put(key, delivery, this.store.get(key)?.version ?? 0);
  }
  submit(
    assignment: Assignment,
    input: ReportInput,
    schema?: ObjectJsonSchema,
  ): { record: AcceptedReport; replay: boolean } {
    if (input.status !== 'insufficient_context' && input.requestedContext.length)
      throw new Error('Requested context is only valid for insufficient_context reports.');
    if (new Set(input.evidenceRefs).size !== input.evidenceRefs.length)
      throw new Error('Duplicate report evidence reference.');
    if (input.status === 'completed' && schema) {
      const violations = validateJsonSchemaValue(schema, input.result, 'result');
      if (violations.length) throw new Error(`Invalid role result: ${violations.join('; ')}`);
    }
    const report = this.validator.parse('AgentReport', {
      schema_version: 'physical.agent_report.v1',
      agent_id: assignment.sessionId,
      assignment_id: assignment.id,
      team_run_id: assignment.brief.team_run_id,
      task_scope: structuredClone(assignment.brief.task_scope),
      status: input.status,
      summary: input.summary,
      evidence_refs: [...input.evidenceRefs],
      ...(input.status === 'insufficient_context'
        ? { requested_context: [...input.requestedContext] }
        : {}),
      ...(input.result === null ? {} : { result: structuredClone(input.result) }),
    });
    if (Buffer.byteLength(JSON.stringify(report)) > 64 * 1024)
      throw new Error('Report exceeds 64 KiB.');
    const previous = this.read(assignment.id);
    if (
      previous &&
      previous.version === input.expectedVersion + 1 &&
      isDeepStrictEqual(previous.report, report)
    )
      return { record: previous, replay: true };
    if (previous && previous.report.status !== 'insufficient_context')
      throw new Error('Assignment already has a final report. Delegate a fresh assignment.');
    const version = (previous?.version ?? 0) + 1;
    const record = {
      id: randomUUID(),
      version,
      recipient: assignment.brief.expected_output.recipient,
      report,
    };
    this.store.put(`report:${assignment.id}`, record, input.expectedVersion);
    return { record, replay: false };
  }
}
