import { z } from 'zod';
import type { ContractValidator } from '@edh/contracts';
import { SessionAudits, type LocalStore } from '@edh/storage';
import { AssignmentHistory, type RunState } from '@edh/tasks';
import type { ApplicationReferenceExtension } from './application-record-owners.js';
import type { DomainRecordOwner } from './domain-retention.js';

const id = z.string().regex(/^[A-Za-z0-9-]{1,128}$/);
const count = z.number().int().nonnegative().safe();
const indexSchema = z.discriminatedUnion('format', [
  z.object({ format: z.literal('edh.session-audit.v1'), count }).strict(),
  z.object({ format: z.literal('edh.session-audit.v2'), count, sessionId: id }).strict(),
]);
const eventSchema = z
  .object({
    type: z.string().min(1),
    seq: count,
    time: z.number().finite(),
    data: z.unknown(),
    ignorable: z.literal(true).optional(),
    sourceEventSeqs: z.array(count).optional(),
    surfaceOp: z.unknown().optional(),
  })
  .strict();

export function nativeAuditRecordOwners(
  store: LocalStore,
  validator: ContractValidator,
  extension: ApplicationReferenceExtension,
): DomainRecordOwner[] {
  z.string().min(1).max(128).parse(extension?.version);
  if (typeof extension.inspect !== 'function')
    throw new Error('Native audit payloads require explicit reference ownership.');
  const custom = Object.freeze({
    version: extension.version,
    inspect: extension.inspect.bind(extension),
  });
  const audits = new SessionAudits(store);
  const source = (runId: string, assignmentId: string) => {
    id.parse(runId);
    id.parse(assignmentId);
    const state = store.get<RunState>(`run:${runId}`)?.value;
    const current = state?.assignments[assignmentId];
    if (!state || state.id !== runId || !current || current.id !== assignmentId)
      throw new Error('Native audit run or assignment source is missing or conflicting.');
    const references = new Set([`run:${runId}`]);
    const archive = current.detailsStored
      ? new AssignmentHistory(store, validator).read(runId, assignmentId)
      : undefined;
    if (current.detailsStored && !archive)
      throw new Error('Native audit assignment archive is missing.');
    if (archive) references.add(`assignment-history:${JSON.stringify([runId, assignmentId])}`);
    const actor = archive?.assignment ?? current;
    const brief = validator.parse('InvocationBrief', actor.brief);
    if (
      actor.id !== assignmentId ||
      actor.sessionId !== current.sessionId ||
      brief.assignment_id !== assignmentId ||
      brief.task_scope.task_id !== runId
    )
      throw new Error('Native audit assignment identity or scope conflicts.');
    const key = `session-audit:${runId}:${assignmentId}`;
    const row = store.get(key);
    if (!row) throw new Error('Native audit published index is missing.');
    const index = Array.isArray(row.value) ? undefined : indexSchema.parse(row.value);
    if (index?.format === 'edh.session-audit.v2' && index.sessionId !== actor.sessionId)
      throw new Error('Native audit session identity conflicts with its assignment.');
    return {
      state,
      actor,
      references,
      key,
      total: index?.count ?? (row.value as unknown[]).length,
      legacy: Array.isArray(row.value),
    };
  };
  const inspectEvent = (
    key: string,
    value: unknown,
    runId: string,
    assignmentId: string,
    sequence: number,
    total: number,
    references: Set<string>,
    legacy: boolean,
  ) => {
    const event = eventSchema.parse(value);
    if (!Object.hasOwn(value as object, 'data') || event.seq !== sequence)
      throw new Error('Native audit event sequence or payload conflicts.');
    for (const prior of event.sourceEventSeqs ?? []) {
      if (prior >= sequence) throw new Error('Native audit event cites a nonpreceding source.');
      if (!legacy) references.add(`session-audit-event:${runId}:${assignmentId}:${prior}`);
    }
    for (const reference of z
      .array(z.string().min(1).max(512))
      .parse(custom.inspect(Object.freeze({ key, value, runId, assignmentId }))))
      references.add(reference);
  };
  const owner = (prefix: string, inspect: DomainRecordOwner['inspect']): DomainRecordOwner => ({
    id: prefix.slice(0, -1),
    prefix,
    version: JSON.stringify(['1', custom.version]),
    inspect,
  });
  return [
    owner('session-audit:', ({ key }) => {
      const parts = z.tuple([id, id]).parse(key.slice('session-audit:'.length).split(':'));
      const [runId, assignmentId] = parts;
      const { references, total, actor, legacy } = source(runId, assignmentId);
      let offset = 0;
      while (offset < total) {
        const page = audits.page(runId, assignmentId, offset, total);
        if (page.throughOffset <= offset) throw new Error('Native audit page made no progress.');
        for (const value of page.events) {
          const eventKey = `session-audit-event:${runId}:${assignmentId}:${offset}`;
          if (!legacy) {
            if (store.revision(eventKey)?.version !== 1)
              throw new Error('Native audit published event was rewritten.');
            references.add(eventKey);
          }
          inspectEvent(eventKey, value, runId, assignmentId, offset, total, references, legacy);
          offset++;
        }
      }
      return { references: [...references], retain: actor.status !== 'retired' };
    }),
    owner('session-audit-event:', ({ key, value, version }) => {
      const parts = z
        .tuple([id, id, z.string()])
        .parse(key.slice('session-audit-event:'.length).split(':'));
      const [runId, assignmentId, suffix] = parts;
      const sequence = count.parse(Number(suffix));
      if (key !== `session-audit-event:${runId}:${assignmentId}:${sequence}` || version !== 1)
        throw new Error('Native audit event key or immutable version conflicts.');
      const { references, total, actor, legacy, key: indexKey } = source(runId, assignmentId);
      inspectEvent(key, value, runId, assignmentId, sequence, total, references, legacy);
      if (sequence < total) references.add(indexKey);
      return { references: [...references], retain: actor.status !== 'retired' };
    }),
  ];
}
