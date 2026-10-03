import { z } from 'zod';
import type { LocalStore } from '@edh/storage';
import type { RunState } from '@edh/tasks';
import { SessionTaskHistory } from './session-task-history.js';
import type { UserSessionRecord } from './user-sessions.js';
import { RequestIdentityArchives } from './request-identity-archives.js';
import { DomainRetentionConflict } from './domain-retention.js';

const id = z.string().regex(/^[A-Za-z0-9-]{1,128}$/);
const tuplePrefixes = new Set([
  'session-task-member:',
  'assignment-history:',
  'sensor-sample:',
  'sensor-image:',
  'verification-context:',
  'verification-boundary:',
  'verdict-history:',
]);

export function sessionRetirementSelection(store: LocalStore, sessionIds: readonly string[]) {
  const selected = z.array(id).min(1).parse(sessionIds);
  if (new Set(selected).size !== selected.length)
    throw new Error('Duplicate session retirement selection.');
  const sessions = new Set(selected);
  const runs = new Set<string>();
  const assignments = new Set<string>();
  const recoveries = new Set<string>();
  const reportIds = new Set<string>();
  const history = new SessionTaskHistory(store);
  for (const sessionId of sessions) {
    const session = store.get<UserSessionRecord>(`user-session:${sessionId}`)?.value;
    if (
      !session ||
      session.id !== sessionId ||
      session.state !== 'closed' ||
      session.resources !== 'released'
    )
      throw new DomainRetentionConflict(
        'Selected sessions must be closed with confirmed released resources.',
      );
    for (const member of history.members(session)) {
      const run = store.get<RunState>(`run:${member.runId}`)?.value;
      const ownership = store.get<{ sessionId: string }>(`run-user-session:${member.runId}`)?.value;
      if (
        !run ||
        run.id !== member.runId ||
        ownership?.sessionId !== sessionId ||
        !['succeeded', 'failed', 'cancelled', 'interrupted', 'unknown'].includes(run.state)
      )
        throw new DomainRetentionConflict(
          'Selected session tasks require retained terminal outcomes and matching ownership.',
        );
      runs.add(run.id);
      for (const assignmentId of Object.keys(run.assignments)) assignments.add(assignmentId);
    }
  }
  for (const record of store.scan<{ runId?: string }>('recovery:'))
    if (record.value.runId && runs.has(record.value.runId))
      recoveries.add(record.key.slice('recovery:'.length));
  for (const prefix of ['report:', 'report-record:'])
    for (const record of store.scan<{ id: string; report: { task_scope: { task_id: string } } }>(
      prefix,
    ))
      if (runs.has(record.value.report.task_scope.task_id)) reportIds.add(record.value.id);
  const keys: string[] = [];
  const requestKeys: string[] = [];
  for (const row of store.scan('')) {
    const split = row.key.indexOf(':');
    const prefix = row.key.slice(0, split + 1);
    const suffix = row.key.slice(split + 1);
    let included = false;
    if (tuplePrefixes.has(prefix)) {
      const tuple = z.array(z.string()).min(1).parse(JSON.parse(suffix));
      included = prefix === 'session-task-member:' ? sessions.has(tuple[0]!) : runs.has(tuple[0]!);
    } else if (
      [
        'run:',
        'run-config:',
        'run-submission:',
        'run-interruption:',
        'run-user-session:',
        'plan:',
      ].includes(prefix)
    )
      included = runs.has(suffix);
    else if (['user-session:', 'session-task-catalog:'].includes(prefix))
      included = sessions.has(suffix);
    else if (
      ['event:', 'session-audit:', 'session-audit-event:', 'clarification:'].includes(prefix)
    )
      included = runs.has(suffix.slice(0, suffix.indexOf(':')));
    else if (prefix === 'file:') included = assignments.has(suffix.slice(0, suffix.indexOf(':')));
    else if (prefix === 'recovery:') included = recoveries.has(suffix);
    else if (prefix === 'recovery-event:')
      included = recoveries.has(suffix.slice(0, suffix.lastIndexOf(':')));
    else if (['report:', 'report-record:'].includes(prefix))
      included = reportIds.has(z.object({ id: z.string() }).parse(row.value).id);
    else if (['report-delivery:', 'report-ack:'].includes(prefix)) included = reportIds.has(suffix);
    else if (prefix === 'session-open-request:')
      included = sessions.has(z.object({ sessionId: z.string() }).parse(row.value).sessionId);
    else if (prefix === 'session-task-request:')
      included = sessions.has(suffix.slice(0, suffix.indexOf(':')));
    else if (prefix === 'request:') {
      const value = z.object({ runId: z.string().nullable() }).parse(row.value);
      included = value.runId !== null && runs.has(value.runId);
    }
    if (!included) continue;
    keys.push(row.key);
    if (['request:', 'session-open-request:', 'session-task-request:'].includes(prefix))
      requestKeys.push(row.key);
  }
  return { sessionIds: [...sessions], runIds: [...runs], keys, requestKeys };
}

export function sessionRetentionCandidates(store: LocalStore) {
  const archives = new RequestIdentityArchives(store);
  return [...store.scan<UserSessionRecord>('user-session:')]
    .filter(({ value }) => value.state === 'closed' && value.resources === 'released')
    .map(({ value }) => {
      const selection = sessionRetirementSelection(store, [value.id]);
      return {
        sessionId: value.id,
        profileId: value.profileId,
        createdAt: value.createdAt,
        taskCount: selection.runIds.length,
        recordCount: selection.keys.length,
        unarchivedRequests: selection.requestKeys.filter((key) => !archives.read(key)).length,
      };
    });
}
