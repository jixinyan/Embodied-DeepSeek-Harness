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
  previousReportId?: string;
}
export interface ReportDelivery {
  state: 'queued' | 'settled' | 'recorded' | 'failed' | 'interrupted';
  error?: string;
}
export interface ReportAcknowledgement {
  reportId: string;
  assignmentId: string;
  recipientAssignmentId: string;
  disposition: 'accepted' | 'rejected';
  summary: string;
  acknowledgedAt: string;
}
export const reportPageLimits = Object.freeze({ reports: 16, bytes: 256 * 1024 });
export interface ReportPage {
  latestReport: AcceptedReport | null;
  reports: AcceptedReport[];
  beforeReportId: string | null;
  nextBeforeReportId: string | null;
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
  *iterate(assignmentId: string): Generator<AcceptedReport> {
    let current = this.read(assignmentId);
    while (current) {
      if (
        current.report.assignment_id !== assignmentId ||
        !Number.isSafeInteger(current.version) ||
        current.version < 1
      )
        throw new Error('Invalid published report identity or version.');
      yield current;
      if (!current.previousReportId) break;
      const previous = this.store.get<AcceptedReport>(
        `report-record:${current.previousReportId}`,
      )?.value;
      if (
        !previous ||
        previous.id !== current.previousReportId ||
        previous.report.assignment_id !== assignmentId ||
        previous.version !== current.version - 1 ||
        previous.recipient !== current.recipient ||
        previous.report.agent_id !== current.report.agent_id ||
        previous.report.team_run_id !== current.report.team_run_id ||
        !isDeepStrictEqual(previous.report.task_scope, current.report.task_scope)
      )
        throw new Error('Incomplete published report history.');
      current = previous;
    }
  }
  history(assignmentId: string): AcceptedReport[] {
    return [...this.iterate(assignmentId)].reverse();
  }
  page(assignmentId: string, beforeReportId?: string): ReportPage {
    if (beforeReportId !== undefined && !/^[A-Za-z0-9-]{1,128}$/.test(beforeReportId))
      throw new Error('Invalid report cursor.');
    const records: AcceptedReport[] = [];
    let latestReport: AcceptedReport | null = null;
    let reached = beforeReportId === undefined;
    let bytes = 2;
    let nextBeforeReportId: string | null = null;
    for (const record of this.iterate(assignmentId)) {
      latestReport ??= record;
      if (!reached) {
        reached = record.id === beforeReportId;
        continue;
      }
      const size =
        Buffer.byteLength(JSON.stringify(this.receipt(record, true))) + (records.length ? 1 : 0);
      if (
        records.length >= reportPageLimits.reports ||
        (records.length > 0 && bytes + size > reportPageLimits.bytes)
      ) {
        nextBeforeReportId = records.at(-1)!.id;
        break;
      }
      records.push(record);
      bytes += size;
    }
    if (!reached) throw new Error('Report cursor is not in the published assignment history.');
    return {
      latestReport,
      reports: records.reverse(),
      beforeReportId: beforeReportId ?? null,
      nextBeforeReportId,
    };
  }
  private published(assignmentId: string, reportId: string): AcceptedReport | undefined {
    for (const record of this.iterate(assignmentId)) if (record.id === reportId) return record;
    return undefined;
  }
  private receipt(record: AcceptedReport, includeBody: boolean) {
    return {
      reportId: record.id,
      version: record.version,
      status: record.report.status,
      delivery: this.delivery(record.id) ?? { state: 'unconfirmed' },
      acknowledgement: this.acknowledgement(record.id) ?? null,
      ...(includeBody ? { record } : {}),
    };
  }
  acknowledgement(reportId: string): ReportAcknowledgement | undefined {
    return this.store.get<ReportAcknowledgement>(`report-ack:${reportId}`)?.value;
  }
  acknowledge(
    assignmentId: string,
    reportId: string,
    recipientAssignmentId: string,
    input: Pick<ReportAcknowledgement, 'disposition' | 'summary'>,
  ): { acknowledgement: ReportAcknowledgement; replay: boolean } {
    const report = this.published(assignmentId, reportId);
    if (!report || report.recipient !== recipientAssignmentId)
      throw new Error('Only the designated report recipient may acknowledge a published report.');
    if (
      !['accepted', 'rejected'].includes(input.disposition) ||
      !input.summary.trim() ||
      Buffer.byteLength(input.summary) > 12000
    )
      throw new Error('Acknowledgement requires a disposition and bounded summary.');
    const value = {
      reportId,
      assignmentId,
      recipientAssignmentId,
      disposition: input.disposition,
      summary: input.summary,
    };
    const previous = this.acknowledgement(reportId);
    if (previous) {
      const { acknowledgedAt: _at, ...body } = previous;
      if (!isDeepStrictEqual(body, value)) throw new Error('Report acknowledgement is immutable.');
      return { acknowledgement: previous, replay: true };
    }
    const acknowledgement = { ...value, acknowledgedAt: new Date().toISOString() };
    this.store.put(`report-ack:${reportId}`, acknowledgement, 0);
    return { acknowledgement, replay: false };
  }
  status(assignmentId: string, beforeReportId?: string, includeBodies = false) {
    const page = this.page(assignmentId, beforeReportId);
    const { latestReport } = page;
    return {
      latestReport,
      reportDelivery: latestReport
        ? (this.delivery(latestReport.id) ?? { state: 'unconfirmed' })
        : null,
      reportAcknowledgement: latestReport ? (this.acknowledgement(latestReport.id) ?? null) : null,
      reportHistoryPage: {
        beforeReportId: page.beforeReportId,
        nextBeforeReportId: page.nextBeforeReportId,
        latestVersion: latestReport?.version ?? 0,
      },
      reportHistory: page.reports.map((record) => this.receipt(record, includeBodies)),
    };
  }
  /** Startup-only reconciliation: preserve uncertainty without replaying a caller turn. */
  reconcileInterruptedDeliveries(): number {
    let changed = 0;
    for (const entry of this.store.scan<AcceptedReport>('report:')) {
      if (entry.key !== `report:${entry.value.report.assignment_id}`)
        throw new Error('Published report key does not match its assignment.');
      for (const report of this.iterate(entry.value.report.assignment_id)) {
        const delivery = this.delivery(report.id);
        if (delivery && delivery.state !== 'queued') continue;
        this.markDelivery(
          report.id,
          report.recipient === 'user'
            ? { state: 'recorded' }
            : {
                state: 'interrupted',
                error:
                  'The previous host stopped before delivery settled. The recipient may have acted; inspect acknowledgement and audit before a new delegation.',
              },
        );
        changed++;
      }
    }
    return changed;
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
    if ((previous?.version ?? 0) !== input.expectedVersion)
      throw new Error('Report version conflict.');
    const version = (previous?.version ?? 0) + 1;
    const record = {
      id: randomUUID(),
      version,
      recipient: assignment.brief.expected_output.recipient,
      report,
      ...(previous ? { previousReportId: previous.id } : {}),
    };
    if (previous && !this.store.get(`report-record:${previous.id}`))
      this.store.put(`report-record:${previous.id}`, previous, 0);
    this.store.put(`report-record:${record.id}`, record, 0);
    this.store.put(`report:${assignment.id}`, record, input.expectedVersion);
    return { record, replay: false };
  }
}
