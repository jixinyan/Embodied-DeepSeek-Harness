import { z } from 'zod';
import type { RunState } from '@edh/tasks';
import type { UserSessionRecord } from './user-sessions.js';
import { HttpError } from './local-http.js';
import type { WorkspaceHistoryIndex } from './workspace-history-index.js';
import { sessionTaskCount } from './session-task-history.js';

export const workspacePageLimits = Object.freeze({ records: 32, bytes: 256 * 1024 });
const identity = z.object({
  id: z.string().regex(/^[A-Za-z0-9-]{1,128}$/),
  createdAt: z.iso.datetime(),
});

function query(params: URLSearchParams, allowed: readonly string[]) {
  for (const key of params.keys())
    if (!allowed.includes(key) || params.getAll(key).length !== 1)
      throw new HttpError(400, 'Invalid workspace history query.');
  for (const value of params.values())
    if (!/^[A-Za-z0-9-]{1,128}$/.test(value))
      throw new HttpError(400, 'Invalid workspace history identifier.');
}

export function runSummary(run: RunState, userSessionId: string | null) {
  identity.parse(run);
  return {
    id: run.id,
    state: run.state,
    scenario: run.scenario,
    createdAt: run.createdAt,
    instruction: run.instruction,
    userSessionId,
  };
}

export function sessionSummary(record: UserSessionRecord) {
  identity.parse(record);
  const profile = record.configuration.launchProfile as
    | { environment?: string; embodiment?: string; checkpoint?: string; source?: string }
    | undefined;
  return {
    id: record.id,
    profileId: record.profileId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    state: record.state,
    resources: record.resources,
    ...(record.taskCatalog ? { taskCatalog: structuredClone(record.taskCatalog) } : {}),
    runCount: sessionTaskCount(record),
    environment: profile?.environment ?? null,
    embodiment: profile?.embodiment ?? null,
    checkpoint: profile?.checkpoint ?? null,
    source: profile?.source ?? null,
    error: record.error ?? null,
  };
}

export function readRunList(
  index: WorkspaceHistoryIndex,
  params: URLSearchParams,
  activeId: string | null,
) {
  query(params, ['before', 'session']);
  const sessionId = params.get('session');
  if (sessionId && sessionId !== 'standalone' && !index.get('session', sessionId))
    throw new HttpError(404, 'History session not found.');
  const matches = (row: ReturnType<typeof runSummary>) =>
    !sessionId || row.userSessionId === (sessionId === 'standalone' ? null : sessionId);
  const read = (id: string) => {
    const row = index.get('run', id);
    if (!row) throw new HttpError(404, 'History task not found.');
    return row;
  };
  const before = params.has('before') ? read(params.get('before')!) : undefined;
  if (before && !matches(before))
    throw new HttpError(400, 'History cursor belongs to a different session.');
  const result = index.page(
    'run',
    before,
    sessionId === 'standalone' ? null : (sessionId ?? undefined),
  );
  return {
    runs: result.records,
    nextBeforeId: result.nextBeforeId,
    activeId,
    activeRun: activeId ? read(activeId) : null,
  };
}

export function readSessionList(
  index: WorkspaceHistoryIndex,
  params: URLSearchParams,
  activeId: string | null,
) {
  query(params, ['before']);
  const read = (id: string) => {
    const row = index.get('session', id);
    if (!row) throw new HttpError(404, 'History session not found.');
    return row;
  };
  const before = params.has('before') ? read(params.get('before')!) : undefined;
  const result = index.page('session', before);
  const active = activeId ? read(activeId) : null;
  return {
    sessions: result.records,
    nextBeforeId: result.nextBeforeId,
    activeId,
    activeSession: active ? { ...active, configuration: index.configuration(active.id) } : null,
  };
}
