import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { ContractValidator, TaskScope } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
import { SensorSamples, validateImageAttachmentReference } from '@edh/perception';
import { AssignmentHistory, VerdictHistory, type RunState } from '@edh/tasks';
import { VerificationBoundaries, VerificationContexts } from '@edh/verification';
import type { DomainRecordOwner } from './domain-retention.js';

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/);
const runIdentity = z.object({
  id,
  source: z.enum(['test_fixture', 'simulation', 'hardware']),
});
const assignmentIdentity = z.object({
  id,
  sessionId: id,
  detailsStored: z.boolean().optional(),
});
const scopeReferences = (scope: TaskScope) => [
  `run:${scope.task_id}`,
  ...(scope.recovery_id ? [`recovery:${scope.recovery_id}`] : []),
];
const tupleKey = (prefix: string, ids: readonly string[]) => prefix + JSON.stringify(ids);
const pair = (key: string, prefix: string) => {
  const ids = z.tuple([id, id]).parse(JSON.parse(key.slice(prefix.length)));
  if (key !== tupleKey(prefix, ids)) throw new Error('Record identity is not canonical.');
  return ids;
};

export function evidenceRecordOwners(
  store: LocalStore,
  validator: ContractValidator,
): DomainRecordOwner[] {
  const run = (runId: string) => {
    const record = store.get<RunState>(`run:${runId}`);
    if (!record || runIdentity.parse(record.value).id !== runId)
      throw new Error('Evidence source run is missing or conflicting.');
    return record.value;
  };
  const samples = (runId: string) => new SensorSamples(store, validator, runId, run(runId).source);
  const evidence = (runId: string, evidenceId: string) => {
    const sample = samples(runId).read(evidenceId);
    if (!sample || sample.evidence.task_scope.task_id !== runId)
      throw new Error('Referenced evidence is missing or belongs to another run.');
    return sample;
  };
  const boundary = (runId: string, executionId: string, boundaryId: string) => {
    const record = new VerificationBoundaries(store, validator, runId).read(
      executionId,
      boundaryId,
    );
    if (!record) throw new Error('Referenced verification boundary is missing.');
    return record;
  };
  const assignment = (runId: string, assignmentId: string) => {
    const state = run(runId);
    const records = z.record(z.string(), z.unknown()).parse(state.assignments);
    const published = assignmentIdentity.parse(records[assignmentId]);
    if (published.id !== assignmentId)
      throw new Error('Verification assignment identity conflicts.');
    const archived = published.detailsStored
      ? new AssignmentHistory(store, validator).read(runId, assignmentId)
      : undefined;
    if (published.detailsStored && !archived)
      throw new Error('Referenced assignment archive is missing.');
    const source = archived?.assignment ?? state.assignments[assignmentId]!;
    const brief = validator.parse('InvocationBrief', source.brief);
    if (
      source.sessionId !== published.sessionId ||
      brief.assignment_id !== assignmentId ||
      brief.task_scope.task_id !== runId
    )
      throw new Error('Verification assignment source conflicts with its run.');
    return {
      source,
      brief,
      references: [
        `run:${runId}`,
        ...(archived ? [tupleKey('assignment-history:', [runId, assignmentId])] : []),
      ],
    };
  };
  const context = (runId: string, assignmentId: string) => {
    const record = new VerificationContexts(store, validator, samples(runId), runId).inspect(
      assignmentId,
    );
    if (!record) throw new Error('Referenced verification context is missing.');
    const actor = assignment(runId, assignmentId);
    const stopped = boundary(runId, record.executionId, record.boundaryId);
    const sample = evidence(runId, record.evidenceId);
    if (
      !isDeepStrictEqual(record.scope, actor.brief.task_scope) ||
      !isDeepStrictEqual(record.scope, stopped.task_scope) ||
      !isDeepStrictEqual(record.scope, sample.evidence.task_scope) ||
      (record.facts.length > 0 && sample.evidence.visibility !== 'agent')
    )
      throw new Error('Verification context sources have conflicting scope or visibility.');
    return {
      record,
      actor,
      references: [
        ...actor.references,
        ...scopeReferences(record.scope),
        tupleKey('verification-boundary:', [runId, record.executionId, record.boundaryId]),
        tupleKey('sensor-sample:', [runId, record.evidenceId]),
      ],
    };
  };
  const owner = (prefix: string, inspect: DomainRecordOwner['inspect']): DomainRecordOwner => ({
    id: prefix.slice(0, -1),
    prefix,
    version: '1',
    inspect,
  });
  return [
    owner('sensor-sample:', ({ key }) => {
      const [runId, evidenceId] = pair(key, 'sensor-sample:');
      const sample = evidence(runId, evidenceId);
      return {
        references: [
          ...scopeReferences(sample.evidence.task_scope),
          ...(sample.images ?? []).map((image) =>
            tupleKey('sensor-image:', [runId, image.attachmentId]),
          ),
        ],
        retain: false,
      };
    }),
    owner('sensor-image:', ({ key, value, version }) => {
      const [runId, imageId] = pair(key, 'sensor-image:');
      run(runId);
      validateImageAttachmentReference(value);
      if (version !== 1 || value.attachmentId !== imageId)
        throw new Error('Sensor image metadata identity or version conflicts.');
      return { references: [`run:${runId}`], retain: false };
    }),
    owner('verification-boundary:', ({ key }) => {
      const ids = z
        .tuple([id, id, id])
        .parse(JSON.parse(key.slice('verification-boundary:'.length)));
      if (key !== tupleKey('verification-boundary:', ids))
        throw new Error('Verification boundary key is not canonical.');
      const [runId, executionId, boundaryId] = ids;
      const status = boundary(runId, executionId, boundaryId);
      run(runId);
      for (const evidenceId of status.observation_refs) evidence(runId, evidenceId);
      return {
        references: [
          ...scopeReferences(status.task_scope),
          ...status.observation_refs.map((evidenceId) =>
            tupleKey('sensor-sample:', [runId, evidenceId]),
          ),
        ],
        retain: false,
      };
    }),
    owner('verification-context:', ({ key }) => {
      const [runId, assignmentId] = pair(key, 'verification-context:');
      return { references: [...new Set(context(runId, assignmentId).references)], retain: false };
    }),
    owner('verdict-history:', ({ key }) => {
      const [runId, verdictId] = pair(key, 'verdict-history:');
      const verdict = new VerdictHistory(store, validator).read(runId, verdictId);
      if (!verdict) throw new Error('Accepted verdict archive is missing.');
      const checked = context(runId, verdict.verifier_assignment_id);
      const { record, actor } = checked;
      if (
        verdict.verifier_id !== actor.source.sessionId ||
        verdict.verification_request_id !== record.requestId ||
        verdict.execution_id !== record.executionId ||
        verdict.boundary_event_id !== record.boundaryId ||
        !isDeepStrictEqual(verdict.task_scope, record.scope) ||
        !isDeepStrictEqual(verdict.checks, record.facts) ||
        !isDeepStrictEqual(verdict.evidence_refs, [record.evidenceId]) ||
        verdict.goal_contract_id !== actor.brief.success_contract.id ||
        verdict.goal_contract_version !== actor.brief.success_contract.version
      )
        throw new Error('Accepted verdict conflicts with its verification sources.');
      return {
        references: [
          ...new Set([
            ...checked.references,
            tupleKey('verification-context:', [runId, verdict.verifier_assignment_id]),
          ]),
        ],
        retain: false,
      };
    }),
  ];
}
