import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { ContractValidator, isWireTimestamp, type AgentReport } from '@edh/contracts';
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
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/);
const acceptedSchema = z
  .object({
    id: identifier,
    version: z.number().int().positive().safe(),
    recipient: identifier,
    report: z.unknown(),
    previousReportId: identifier.optional(),
  })
  .strict();
const deliverySchema = z
  .object({
    state: z.enum(['queued', 'settled', 'recorded', 'failed', 'interrupted']),
    error: z.string().optional(),
  })
  .strict();
const acknowledgementSchema = z
  .object({
    reportId: identifier,
    assignmentId: identifier,
    recipientAssignmentId: identifier,
    disposition: z.enum(['accepted', 'rejected']),
    summary: z
      .string()
      .refine((value) => value.trim().length > 0 && Buffer.byteLength(value) <= 12000),
    acknowledgedAt: z.string().refine(isWireTimestamp),
  })
  .strict();
/** Assignment identity comes from the authenticated native tool scope, never model fields. */
export class AssignmentReports {
  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
  ) {}
  private validate(value: unknown): AcceptedReport {
    const record = acceptedSchema.parse(value);
    if (record.version === 1 && record.previousReportId !== undefined)
      throw new Error('Incomplete published report history: predecessor identity conflicts.');
    return {
      id: record.id,
      version: record.version,
      recipient: record.recipient,
      report: this.validator.parse('AgentReport', record.report),
      ...(record.previousReportId === undefined
        ? {}
        : { previousReportId: record.previousReportId }),
    };
  }
  read(assignmentId: string): AcceptedReport | undefined {
    identifier.parse(assignmentId);
    const row = this.store.get(`report:${assignmentId}`);
    if (!row) return undefined;
    const record = this.validate(row.value);
    if (record.report.assignment_id !== assignmentId || row.version !== record.version)
      throw new Error('Invalid published report identity or version.');
    const archived = this.readRecord(record.id);
    if (archived && !isDeepStrictEqual(archived, record))
      throw new Error('Incomplete published report history: current archive conflicts.');
    return record;
  }
  readRecord(reportId: string): AcceptedReport | undefined {
    identifier.parse(reportId);
    const row = this.store.get(`report-record:${reportId}`);
    if (!row) return undefined;
    const record = this.validate(row.value);
    if (row.version !== 1 || record.id !== reportId)
      throw new Error(
        'Incomplete published report history: archive identity or immutable version conflicts.',
      );
    return record;
  }
  delivery(reportId: string): ReportDelivery | undefined {
    identifier.parse(reportId);
    const row = this.store.get(`report-delivery:${reportId}`);
    if (!row) return undefined;
    const record = deliverySchema.parse(row.value);
    return { state: record.state, ...(record.error === undefined ? {} : { error: record.error }) };
  }
  markDelivery(reportId: string, delivery: ReportDelivery): void {
    identifier.parse(reportId);
    const checked = deliverySchema.parse(delivery);
    const key = `report-delivery:${reportId}`;
    this.store.put(key, checked, this.store.get(key)?.version ?? 0);
  }
  predecessor(value: AcceptedReport): AcceptedReport | undefined {
    const current = this.validate(value);
    if (!current.previousReportId) return undefined;
    const previous = this.readRecord(current.previousReportId);
    if (
      !previous ||
      previous.report.assignment_id !== current.report.assignment_id ||
      previous.version !== current.version - 1 ||
      previous.recipient !== current.recipient ||
      previous.report.agent_id !== current.report.agent_id ||
      previous.report.team_run_id !== current.report.team_run_id ||
      previous.report.status !== 'insufficient_context' ||
      !isDeepStrictEqual(previous.report.task_scope, current.report.task_scope)
    )
      throw new Error('Incomplete published report history.');
    return previous;
  }
  *iterate(assignmentId: string): Generator<AcceptedReport> {
    let current = this.read(assignmentId);
    while (current) {
      yield current;
      current = this.predecessor(current);
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
    identifier.parse(reportId);
    const row = this.store.get(`report-ack:${reportId}`);
    if (!row) return undefined;
    const record = acknowledgementSchema.parse(row.value);
    if (row.version !== 1 || record.reportId !== reportId)
      throw new Error('Report acknowledgement identity or immutable version conflicts.');
    return record;
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
