import { z } from 'zod';
import type { ContractValidator } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
import type { DomainRecordOwner } from './domain-retention.js';
import { readSessionTasks, SessionTaskHistory, sessionTaskKey } from './session-task-history.js';
import { SessionTaskCatalogs } from './session-task-catalog.js';
import { sessionRequestSchema, type UserSessionRecord } from './user-sessions.js';
import { RequestIdentityArchives } from './request-identity-archives.js';

const id = z.string().regex(/^[A-Za-z0-9-]{1,128}$/);
const sessionIdentity = z.object({ id, requestId: id });
const taskRequest = z
  .object({ taskId: z.string().min(1), inputIdentity: z.string().optional(), runId: id.nullable() })
  .strict();
const legacyRequest = z
  .object({
    scenario: z.string().min(1),
    runId: id.nullable(),
    deploymentDigest: z.string().optional(),
  })
  .strict();

export function sessionRecordOwners(
  store: LocalStore,
  validator: ContractValidator,
): DomainRecordOwner[] {
  const history = new SessionTaskHistory(store);
  const catalogs = new SessionTaskCatalogs(store, validator);
  const archives = new RequestIdentityArchives(store);
  const session = (sessionId: string) => {
    const row = store.get<UserSessionRecord>(`user-session:${id.parse(sessionId)}`);
    if (!row || sessionIdentity.parse(row.value).id !== sessionId)
      throw new Error('Session reference source is missing or conflicting.');
    history.validate(row.value);
    return row.value;
  };
  const membership = (sessionId: string, runId: string) => {
    const source = session(sessionId);
    if (!history.has(source, runId))
      throw new Error('Session does not publish the referenced task.');
    const ownership = store.get(`run-user-session:${runId}`);
    if (
      !ownership ||
      ownership.version !== 1 ||
      z.object({ sessionId: id }).strict().parse(ownership.value).sessionId !== sessionId
    )
      throw new Error('Task ownership conflicts with its published session.');
    return [
      `user-session:${sessionId}`,
      `run:${runId}`,
      ...(readSessionTasks(source).taskHistory ? [sessionTaskKey(sessionId, runId)] : []),
    ];
  };
  const owner = (prefix: string, inspect: DomainRecordOwner['inspect']): DomainRecordOwner => ({
    id: prefix.slice(0, -1),
    prefix,
    version: '1',
    inspect,
  });
  return [
    owner('user-session:', ({ key, value }) => {
      const source = sessionIdentity.parse(value);
      if (key !== `user-session:${source.id}`)
        throw new Error('User session identity conflicts with its record key.');
      const record = session(source.id);
      const references = [`session-open-request:${source.requestId}`];
      const request = store.get(references[0]!);
      if (
        !request ||
        request.version !== 1 ||
        sessionRequestSchema.parse(request.value).sessionId !== source.id ||
        sessionRequestSchema.parse(request.value).requestId !== source.requestId
      )
        throw new Error('Session open request does not preserve the source identity.');
      const compact = Boolean(readSessionTasks(record).taskHistory);
      for (const member of history.members(record)) {
        membership(source.id, member.runId);
        references.push(`run:${member.runId}`, `run-user-session:${member.runId}`);
        if (compact) references.push(sessionTaskKey(source.id, member.runId));
      }
      if (record.taskCatalog) {
        catalogs.read(record);
        references.push(`session-task-catalog:${source.id}`);
      }
      return { references, retain: false };
    }),
    owner('session-open-request:', ({ key, value, version }) => {
      const request = sessionRequestSchema.parse(value);
      if (version !== 1 || key !== `session-open-request:${request.requestId}`)
        throw new Error('Session request record identity or version conflicts.');
      if (session(request.sessionId).requestId !== request.requestId)
        throw new Error('Session request source has a conflicting request identity.');
      return { references: [`user-session:${request.sessionId}`], retain: !archives.read(key) };
    }),
    owner('session-task-member:', ({ key }) => {
      const [sessionId, runId] = z
        .tuple([id, id])
        .parse(JSON.parse(key.slice('session-task-member:'.length)));
      const member = history.readMember(sessionId, runId);
      if (!member || key !== sessionTaskKey(sessionId, runId))
        throw new Error('Session membership key does not match its record.');
      const source = readSessionTasks(session(sessionId));
      const published = source.runIds
        ? source.runIds.includes(runId)
        : member.position <= source.taskHistory!.count;
      if (published) membership(sessionId, runId);
      return {
        references: [
          `user-session:${sessionId}`,
          `run:${runId}`,
          ...(published ? [`run-user-session:${runId}`] : []),
        ],
        retain: false,
      };
    }),
    owner('run-user-session:', ({ key, value, version }) => {
      const runId = id.parse(key.slice('run-user-session:'.length));
      const { sessionId } = z.object({ sessionId: id }).strict().parse(value);
      if (version !== 1) throw new Error('Task session ownership was rewritten.');
      return { references: membership(sessionId, runId), retain: false };
    }),
    owner('session-task-request:', ({ key, value, version }) => {
      const match = /^session-task-request:([A-Za-z0-9-]{1,128}):([A-Za-z0-9-]{1,128})$/.exec(key);
      if (!match) throw new Error('Invalid session task request identity.');
      const sessionId = match[1]!;
      session(sessionId);
      const request = taskRequest.parse(value);
      if (version > 2 || (request.runId === null && version !== 1))
        throw new Error('Session task request publication version conflicts.');
      return {
        references: request.runId
          ? [...membership(sessionId, request.runId), `run-user-session:${request.runId}`]
          : [`user-session:${sessionId}`],
        retain: !archives.read(key),
      };
    }),
    owner('session-task-catalog:', ({ key }) => {
      const sessionId = id.parse(key.slice('session-task-catalog:'.length));
      catalogs.read(session(sessionId));
      return { references: [`user-session:${sessionId}`], retain: false };
    }),
    owner('request:', ({ key, value, version }) => {
      id.parse(key.slice('request:'.length));
      const request = legacyRequest.parse(value);
      if (version > 2 || (request.runId === null && version !== 1))
        throw new Error('Run request publication version conflicts.');
      return {
        references: request.runId ? [`run:${request.runId}`] : [],
        retain: !archives.read(key),
      };
    }),
  ];
}
