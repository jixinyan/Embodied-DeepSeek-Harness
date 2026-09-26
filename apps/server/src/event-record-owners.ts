import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AssignmentReports } from '@edh/communication';
import { isWireTimestamp, type ContractValidator } from '@edh/contracts';
import { SensorSamples, validateImageAttachmentReference } from '@edh/perception';
import type { LocalStore } from '@edh/storage';
import {
  AssignmentHistory,
  RecoveryHistory,
  VerdictHistory,
  type RunEvent,
  type RunState,
} from '@edh/tasks';
import type { SkillBundle } from '@edh/memory';
import type { DomainRecordOwner } from './domain-retention.js';
import { readClarification } from './clarifications.js';

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/);
const count = z.number().int().nonnegative().safe();
const object = z.record(z.string(), z.unknown());
const eventSchema = z
  .object({
    sequence: count.positive(),
    at: z.string().refine(isWireTimestamp),
    type: z.string().min(1),
    detail: object,
  })
  .strict();
const actorEvents = new Set([
  'agent.deadline',
  'agent.status',
  'agent.context',
  'agent.context-capacity',
  'agent.todos',
  'agent.output',
  'agent.turn-ended',
  'agent.step-started',
  'agent.context-usage',
  'agent.retired',
  'agent.history-retained',
  'dsh.tool-call',
  'dsh.tool-result',
  'tool.started',
  'tool.completed',
  'tool.failed',
]);
const scalarEvents = new Set([
  'run.created',
  'run.failed',
  'run.cancelled',
  'run.abandoned',
  'run.interrupted',
  'goal.selected',
  'task.replan-requested',
]);
const messageKinds = new Set([
  'initial',
  'delegated',
  'team.send',
  'context.request',
  'context.respond',
  'agent-report',
  'verdict',
  'recovery-start',
  'recovery-progress',
  'recovery-success',
  'monitor',
  'formal-verification',
  'resume-request',
  'user-clarification',
]);
const keyFor = (prefix: string, ...ids: string[]) => prefix + JSON.stringify(ids);

export interface EventReferenceExtension {
  version: string;
  inspect(event: RunEvent, runId: string): readonly string[];
}

export class RunEventReferences {
  readonly version: string;
  private readonly extension: Readonly<EventReferenceExtension> | undefined;

  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
    extension?: EventReferenceExtension,
  ) {
    if (extension) {
      z.string().min(1).max(128).parse(extension.version);
      if (typeof extension.inspect !== 'function')
        throw new Error('Event references require an inspector.');
    }
    this.extension = extension
      ? Object.freeze({ version: extension.version, inspect: extension.inspect.bind(extension) })
      : undefined;
    this.version =
      '1:' +
      createHash('sha256')
        .update(JSON.stringify(extension?.version ?? null))
        .digest('hex');
  }

  inspect = (event: RunEvent, runId: string): readonly string[] => {
    return this.references(event, runId, true);
  };

  private references(input: RunEvent, runId: string, published: boolean): string[] {
    const event = eventSchema.parse(input);
    const state = this.store.get<RunState>(`run:${id.parse(runId)}`)?.value;
    if (!state || state.id !== runId)
      throw new Error('Event source run is missing or conflicting.');
    const references = new Set([`run:${runId}`]);
    const detail = event.detail;
    const assignment = (value: unknown) => {
      const assignmentId = id.parse(value);
      const actor = state.assignments[assignmentId];
      if (!actor || actor.id !== assignmentId)
        throw new Error('Event assignment source is missing or conflicting.');
      if (actor.detailsStored) {
        const archived = new AssignmentHistory(this.store, this.validator).read(
          runId,
          assignmentId,
        );
        if (!archived || archived.assignment.sessionId !== actor.sessionId)
          throw new Error('Event assignment archive is missing or conflicting.');
        references.add(keyFor('assignment-history:', runId, assignmentId));
      }
      return actor;
    };
    const scope = (value: unknown) => {
      const checked = this.validator.parse('TaskScope', value);
      if (checked.task_id !== runId) throw new Error('Event task scope belongs to another run.');
      if (checked.recovery_id) recovery(checked.recovery_id);
    };
    const recovery = (value: unknown) => {
      const recoveryId = id.parse(value);
      const trace = new RecoveryHistory(this.store).read(recoveryId);
      if (trace.runId !== runId) throw new Error('Event recovery belongs to another run.');
      references.add(`recovery:${recoveryId}`);
      return trace;
    };
    const evidence = (value: unknown) => {
      const evidenceId = id.parse(value);
      const sample = new SensorSamples(this.store, this.validator, runId, state.source).read(
        evidenceId,
      );
      if (!sample || sample.evidence.task_scope.task_id !== runId)
        throw new Error('Event evidence source is missing or conflicting.');
      references.add(keyFor('sensor-sample:', runId, evidenceId));
      return sample;
    };
    const observation = (value: unknown) => {
      const ref = this.validator.parse('EvidenceRef', value);
      if (!isDeepStrictEqual(evidence(ref.id).evidence, ref))
        throw new Error('Event evidence metadata conflicts with its source.');
    };
    const sample = (value: unknown) => {
      const fields = object.parse(value);
      const ref = this.validator.parse('EvidenceRef', fields.evidence);
      const stored = evidence(ref.id);
      if (!isDeepStrictEqual(stored, value))
        throw new Error('Event sensor snapshot conflicts with its source.');
      return stored;
    };
    const brief = (value: unknown) => {
      const valueBrief = this.validator.parse('InvocationBrief', value);
      scope(valueBrief.task_scope);
      for (const actor of new Set([
        valueBrief.caller_assignment_id,
        valueBrief.expected_output.recipient,
      ]))
        if (actor !== 'user') assignment(actor);
      for (const ref of new Set([
        ...valueBrief.evidence_refs,
        ...valueBrief.known_facts.flatMap((fact) => fact.evidence_refs),
      ]))
        evidence(ref);
    };
    const execution = (value: unknown) => {
      const status = this.validator.parse('ExecutionStatus', value);
      scope(status.task_scope);
      for (const ref of status.observation_refs) evidence(ref);
      if (status.boundary_event_id)
        references.add(
          keyFor('verification-boundary:', runId, status.execution_id, status.boundary_event_id),
        );
    };
    const verdict = (value: unknown) => {
      const result = this.validator.parse('VerificationResult', value);
      scope(result.task_scope);
      if (assignment(result.verifier_assignment_id).sessionId !== result.verifier_id)
        throw new Error('Event verdict verifier identity conflicts.');
      const archive = new VerdictHistory(this.store, this.validator).read(runId, result.verdict_id);
      if (archive) {
        if (!isDeepStrictEqual(archive, result))
          throw new Error('Event verdict content conflicts with its archive.');
        references.add(keyFor('verdict-history:', runId, result.verdict_id));
      } else if (
        published &&
        !state.verdicts.some((candidate) => isDeepStrictEqual(candidate, result))
      )
        throw new Error('Event accepted verdict source is missing.');
      for (const ref of new Set([
        ...result.evidence_refs,
        ...result.checks.flatMap((check) => check.evidence_refs),
      ]))
        evidence(ref);
    };
    const verdictId = (value: unknown) => {
      const verdictId = id.parse(value);
      const matches = state.verdicts.filter((item) => item.verdict_id === verdictId);
      if (matches.length !== 1)
        throw new Error('Event accepted verdict source is missing or duplicated.');
      verdict(new VerdictHistory(this.store, this.validator).resolve(runId, matches[0]!));
    };
    const report = (reportId: unknown, assignmentId?: unknown) => {
      const reports = new AssignmentReports(this.store, this.validator);
      const reportIdentity = id.parse(reportId);
      let value = reports.readRecord(reportIdentity);
      if (value) references.add(`report-record:${reportIdentity}`);
      else {
        if (assignmentId !== undefined) value = reports.read(id.parse(assignmentId));
        else {
          for (const row of this.store.revisions('report:')) {
            const candidate = reports.read(id.parse(row.key.slice('report:'.length)));
            if (candidate?.id !== reportIdentity) continue;
            if (value) throw new Error('Event report identity has multiple published sources.');
            value = candidate;
          }
        }
        if (!value || value.id !== reportIdentity)
          throw new Error('Event report source is missing.');
        references.add(`report:${value.report.assignment_id}`);
      }
      scope(value.report.task_scope);
      assignment(value.report.assignment_id);
      if (value.recipient !== 'user') assignment(value.recipient);
      return value;
    };
    const clarification = (value: unknown) => {
      const fields = object.parse(value);
      const record = readClarification(this.store, runId, id.parse(fields.id));
      if (!record) throw new Error('Event clarification source is missing.');
      for (const field of [
        'id',
        'runId',
        'assignmentId',
        'callId',
        'goalId',
        'attemptId',
        'question',
        'reason',
        'options',
        'createdAt',
      ] as const)
        if (!isDeepStrictEqual(fields[field], record[field]))
          throw new Error('Event clarification identity conflicts.');
      assignment(record.assignmentId);
      references.add(`clarification:${runId}:${record.id}`);
    };
    const boundary = (executionId: unknown, boundaryId: unknown) => {
      references.add(
        keyFor('verification-boundary:', runId, id.parse(executionId), id.parse(boundaryId)),
      );
    };
    if (actorEvents.has(event.type)) {
      const actor = assignment(detail.assignmentId);
      if (detail.sessionId !== undefined && detail.sessionId !== actor.sessionId)
        throw new Error('Event native session identity conflicts.');
    } else if (!scalarEvents.has(event.type))
      switch (event.type) {
        case 'agent.created': {
          const created = object.parse(detail.assignment);
          const assignmentId = id.parse(created.id);
          if (published || state.assignments[assignmentId]) {
            const actor = assignment(assignmentId);
            if (actor.sessionId !== created.sessionId || actor.member !== created.member)
              throw new Error('Created assignment event identity conflicts.');
          }
          brief(created.brief);
          break;
        }
        case 'observation.consumed':
        case 'verification.checked':
          assignment(detail.assignmentId);
          observation(detail.evidence);
          if (event.type === 'verification.checked')
            for (const fact of z.array(z.unknown()).parse(detail.facts))
              for (const ref of this.validator.parse('CheckResult', fact).evidence_refs)
                evidence(ref);
          break;
        case 'perception.generated': {
          assignment(detail.assignmentId);
          const source = evidence(detail.sourceEvidenceId);
          const overlay = evidence(detail.overlayEvidenceId);
          const masks = evidence(detail.maskEvidenceId);
          const sourceAttachmentId = id.parse(detail.sourceAttachmentId);
          if (
            !source.images?.some((image) => image.attachmentId === sourceAttachmentId) ||
            source.evidence.visibility !== 'agent' ||
            overlay.evidence.kind !== 'image' ||
            masks.evidence.kind !== 'mask' ||
            overlay.evidence.visibility !== 'agent' ||
            masks.evidence.visibility !== 'agent' ||
            !isDeepStrictEqual(source.evidence.task_scope, overlay.evidence.task_scope) ||
            !isDeepStrictEqual(source.evidence.task_scope, masks.evidence.task_scope) ||
            overlay.visualization.sourceEvidenceId !== source.evidence.id ||
            masks.visualization.sourceEvidenceId !== source.evidence.id ||
            overlay.visualization.sourceAttachmentId !== sourceAttachmentId ||
            masks.visualization.sourceAttachmentId !== sourceAttachmentId
          )
            throw new Error('Perception event has conflicting source or result evidence.');
          break;
        }
        case 'execution.requested': {
          const request = this.validator.parse('SubgoalRequest', detail.request);
          if (request.task_id !== runId)
            throw new Error('Event execution request belongs to another run.');
          assignment(request.owner_assignment_id);
          if (request.recovery_id) recovery(request.recovery_id);
          for (const ref of request.context_refs) evidence(ref);
          break;
        }
        case 'execution.updated':
          execution(detail.execution);
          break;
        case 'execution.pause-requested': {
          const executionId = id.parse(detail.executionId);
          const source = z.enum(['planner', 'operator']).parse(detail.source);
          const stateVersion = z.number().int().positive().parse(detail.stateVersion);
          if (
            !state.executions.some(
              (item) => item.execution_id === executionId && item.state_version >= stateVersion,
            )
          )
            throw new Error('Pause request has no admitted execution status.');
          if (source === 'planner') assignment(detail.assignmentId);
          else if (detail.assignmentId !== undefined)
            throw new Error('Operator pause request cannot claim a Planner assignment.');
          break;
        }
        case 'simulation.frame': {
          if (detail.runId !== runId) throw new Error('Simulation frame belongs to another run.');
          const executionId = id.parse(detail.executionId);
          const status = state.executions.find((item) => item.execution_id === executionId);
          if (!status) throw new Error('Simulation frame has no admitted execution source.');
          const policyRequestId = id.parse(detail.policyRequestId);
          const segmentId = id.parse(detail.segmentId);
          const nativeStepIndex = count.positive().parse(detail.nativeStepIndex);
          const simulationTimeS = z.number().finite().nonnegative().parse(detail.simulationTimeS);
          const frame = sample(detail.sample);
          if (
            !frame ||
            frame.evidence.visibility !== 'debug_only' ||
            !isDeepStrictEqual(frame.evidence.task_scope, status.task_scope) ||
            frame.visualization.executionId !== executionId ||
            frame.visualization.policyRequestId !== policyRequestId ||
            frame.visualization.segmentId !== segmentId ||
            frame.visualization.nativeStepIndex !== nativeStepIndex ||
            frame.visualization.simulationTimeS !== simulationTimeS
          )
            throw new Error('Simulation frame metadata conflicts with its execution.');
          for (const image of frame.images ?? [])
            references.add(keyFor('sensor-image:', runId, image.attachmentId));
          break;
        }
        case 'verification.completed':
          verdict(detail.result);
          break;
        case 'execution.resume-requested':
        case 'verification.requested':
          assignment(detail.assignmentId);
          boundary(detail.executionId, detail.boundaryId);
          break;
        case 'monitor.started':
          assignment(detail.assignmentId);
          break;
        case 'agent.report': {
          const accepted = report(detail.reportId, detail.assignmentId);
          if (
            !isDeepStrictEqual(accepted.report, detail.report) ||
            accepted.version !== detail.version ||
            accepted.recipient !== detail.recipient
          )
            throw new Error('Event report content conflicts with its source.');
          break;
        }
        case 'agent.report-delivery':
          report(detail.reportId);
          break;
        case 'agent.report-acknowledged': {
          assignment(detail.assignmentId);
          report(detail.reportId, detail.reportAssignmentId);
          const receipt = new AssignmentReports(this.store, this.validator).acknowledgement(
            id.parse(detail.reportId),
          );
          if (!receipt || !isDeepStrictEqual(receipt, detail.acknowledgement))
            throw new Error('Event acknowledgement conflicts with its source.');
          references.add(`report-ack:${receipt.reportId}`);
          break;
        }
        case 'plan.updated': {
          const plan = this.validator.parse('PlanDocument', detail.plan);
          if (plan.task_id !== runId) throw new Error('Event plan belongs to another run.');
          assignment(plan.owner_assignment_id);
          references.add(`plan:${runId}`);
          for (const item of plan.items)
            if (item.last_verdict_ref) verdictId(item.last_verdict_ref);
          break;
        }
        case 'retry.accepted':
          assignment(detail.ownerAssignmentId);
          verdict(detail.failedVerdict);
          recovery(detail.recoveryId);
          break;
        case 'recovery.opened':
          if (!isDeepStrictEqual(recovery(detail.recoveryId).context, detail.context))
            throw new Error('Recovery event context conflicts with its source.');
          break;
        case 'recovery.resolved':
          recovery(detail.recoveryId);
          verdictId(detail.verdictId);
          break;
        case 'recovery.failed':
          if (detail.recoveryId !== undefined) recovery(detail.recoveryId);
          break;
        case 'run.succeeded':
          verdictId(detail.verdictId);
          break;
        case 'skill.saved': {
          const metadata = this.validator.parse('SkillMetadata', detail.metadata);
          const saved = this.store.get<SkillBundle>(`skill:${metadata.skill_id}`)?.value;
          if (
            !saved ||
            saved.metadata.recovery_id !== metadata.recovery_id ||
            saved.metadata.verdict_ref !== metadata.verdict_ref
          )
            throw new Error('Event skill source identity conflicts.');
          references.add(`skill:${metadata.skill_id}`);
          recovery(metadata.recovery_id);
          verdictId(metadata.verdict_ref);
          for (const ref of metadata.evidence_refs) evidence(ref);
          break;
        }
        case 'user.clarification':
          clarification(detail.clarification);
          break;
        case 'message.delivered': {
          assignment(detail.recipient);
          if (!['user', 'execution-monitor', 'execution-boundary'].includes(String(detail.sender)))
            assignment(detail.sender);
          for (const image of z.array(z.unknown()).parse(detail.images ?? [])) {
            validateImageAttachmentReference(image);
            const name = keyFor('sensor-image:', runId, image.attachmentId);
            const row = this.store.get(name);
            if (row) {
              if (!isDeepStrictEqual(row.value, image))
                throw new Error('Message image metadata conflicts with its source.');
              references.add(name);
            }
          }
          const payload = object.parse(detail.payload);
          if (!messageKinds.has(String(payload.kind))) {
            if (!this.extension)
              throw new Error('Message kind requires explicit reference ownership.');
            break;
          }
          if (payload.brief !== undefined) brief(payload.brief);
          if (payload.execution !== undefined) execution(payload.execution);
          if (payload.sample !== undefined) sample(payload.sample);
          if (payload.evidence !== undefined)
            for (const value of z.array(z.unknown()).parse(payload.evidence)) sample(value);
          if (payload.kind === 'agent-report') {
            const body = this.validator.parse('AgentReport', payload.report);
            const accepted = report(payload.reportId, body.assignment_id);
            if (accepted.version !== payload.version || !isDeepStrictEqual(accepted.report, body))
              throw new Error('Message report conflicts with its source.');
          }
          if (payload.kind === 'verdict' || payload.kind === 'recovery-success')
            verdict(payload.result);
          if (payload.kind === 'recovery-start') {
            const startBrief = this.validator.parse('InvocationBrief', payload.brief);
            const trace = recovery(startBrief.task_scope.recovery_id);
            if (!isDeepStrictEqual(trace.context, payload.context))
              throw new Error('Recovery start message conflicts with its source.');
          }
          if (payload.kind === 'user-clarification') clarification(payload.clarification);
          if (payload.kind === 'recovery-progress') {
            const recoveryId = id.parse(payload.recoveryId);
            const trace = recovery(recoveryId);
            const after = count.parse(payload.afterIndex);
            const through = count.parse(payload.throughIndex);
            const page = new RecoveryHistory(this.store).page(recoveryId, after, through);
            if (page.throughIndex !== through || !isDeepStrictEqual(page.events, payload.events))
              throw new Error('Recovery progress message conflicts with its source.');
            if (trace.eventCount !== undefined) {
              if (after > 0) references.add(`recovery-event:${recoveryId}:${after}`);
              for (let index = after + 1; index <= through; index++)
                references.add(`recovery-event:${recoveryId}:${index}`);
            }
          }
          break;
        }
        default:
          if (!this.extension)
            throw new Error(`Event type requires explicit reference ownership: ${event.type}`);
      }
    if (this.extension)
      for (const reference of z
        .array(z.string().min(1).max(512))
        .parse(this.extension.inspect(event, runId)))
        references.add(reference);
    return [...references];
  }

  owner(): DomainRecordOwner {
    return {
      id: 'event',
      prefix: 'event:',
      version: this.version,
      inspect: ({ key, value, version }) => {
        const split = key.lastIndexOf(':');
        const runId = id.parse(key.slice('event:'.length, split));
        const sequence = count.positive().parse(Number(key.slice(split + 1)));
        const event = eventSchema.parse(value);
        if (key !== `event:${runId}:${sequence}` || version !== 1 || event.sequence !== sequence)
          throw new Error('Event key, sequence or immutable version conflicts.');
        const state = this.store.get<RunState>(`run:${runId}`)?.value;
        if (!state || state.id !== runId) throw new Error('Event source run is missing.');
        const total = count.parse(state.eventCount ?? state.events.length);
        const published = sequence <= total;
        if (
          published &&
          state.eventCount === undefined &&
          !isDeepStrictEqual(state.events[sequence - 1], event)
        )
          throw new Error('Event archive conflicts with published inline history.');
        return { references: this.references(event, runId, published), retain: false };
      },
    };
  }
}
