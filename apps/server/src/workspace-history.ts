import { z } from 'zod';
import type { LocalStore } from '@edh/storage';
import type { RunState } from '@edh/tasks';
import type { UserSessionRecord } from './user-sessions.js';
import { HttpError } from './local-http.js';

export const workspacePageLimits = Object.freeze({ records: 32, bytes: 256 * 1024 });
const identity = z.object({
  id: z.string().regex(/^[A-Za-z0-9-]{1,128}$/),
  createdAt: z.iso.datetime(),
});
type Identity = z.infer<typeof identity>;
const compare = (left: Identity, right: Identity) =>
  Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
  (right.id > left.id ? 1 : right.id < left.id ? -1 : 0);

function query(params: URLSearchParams, allowed: readonly string[]) {
  for (const key of params.keys())
    if (!allowed.includes(key) || params.getAll(key).length !== 1)
      throw new HttpError(400, 'Invalid workspace history query.');
  for (const value of params.values())
    if (!/^[A-Za-z0-9-]{1,128}$/.test(value))
      throw new HttpError(400, 'Invalid workspace history identifier.');
}

function page<T extends Identity>(rows: Iterable<T>, before?: Identity) {
  const selected: { row: T; size: number }[] = [];
  let hasMore = false;
  for (const row of rows) {
    identity.parse(row);
    if (before && compare(row, before) <= 0) continue;
    const entry = { row, size: Buffer.byteLength(JSON.stringify(row)) };
    const position = selected.findIndex((candidate) => compare(row, candidate.row) < 0);
    if (position < 0) selected.push(entry);
    else selected.splice(position, 0, entry);
    let bytes = 2;
    for (let index = 0; index < selected.length; index++) {
      const size = selected[index]!.size + (index ? 1 : 0);
      if (
        index === workspacePageLimits.records ||
        (index > 0 && bytes + size > workspacePageLimits.bytes)
      ) {
        selected.splice(index);
        hasMore = true;
        break;
      }
      bytes += size;
    }
  }
  return {
    records: selected.map((entry) => entry.row),
    nextBeforeId: hasMore ? selected.at(-1)!.row.id : null,
  };
}

export function runSummary(store: LocalStore, run: RunState) {
  identity.parse(run);
  return {
    id: run.id,
    state: run.state,
    scenario: run.scenario,
    createdAt: run.createdAt,
    instruction: run.instruction,
    userSessionId:
      store.get<{ sessionId: string }>(`run-user-session:${run.id}`)?.value.sessionId ?? null,
  };
}

function sessionSummary(record: UserSessionRecord) {
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
    runCount: record.runIds.length,
    environment: profile?.environment ?? null,
    embodiment: profile?.embodiment ?? null,
    checkpoint: profile?.checkpoint ?? null,
    source: profile?.source ?? null,
    error: record.error ?? null,
  };
}

export function readRunList(store: LocalStore, params: URLSearchParams, activeId: string | null) {
  query(params, ['before', 'session']);
  const sessionId = params.get('session');
  if (
    sessionId &&
    sessionId !== 'standalone' &&
    !store.get<UserSessionRecord>(`user-session:${sessionId}`)
  )
    throw new HttpError(404, 'History session not found.');
  const matches = (row: ReturnType<typeof runSummary>) =>
    !sessionId || row.userSessionId === (sessionId === 'standalone' ? null : sessionId);
  const read = (id: string) => {
    const row = store.get<RunState>(`run:${id}`)?.value;
    if (!row) throw new HttpError(404, 'History task not found.');
    if (row.id !== id) throw new Error('Stored task identity conflicts with its key.');
    return runSummary(store, row);
  };
  const before = params.has('before') ? read(params.get('before')!) : undefined;
  if (before && !matches(before))
    throw new HttpError(400, 'History cursor belongs to a different session.');
  function* rows() {
    for (const row of store.scan<RunState>('run:')) {
      if (row.key !== `run:${row.value.id}`)
        throw new Error('Stored task identity conflicts with its key.');
      const summary = runSummary(store, row.value);
      if (matches(summary)) yield summary;
    }
  }
  const result = page(rows(), before);
  return {
    runs: result.records,
    nextBeforeId: result.nextBeforeId,
    activeId,
    activeRun: activeId ? read(activeId) : null,
  };
}

export function readSessionList(
  store: LocalStore,
  params: URLSearchParams,
  activeId: string | null,
) {
  query(params, ['before']);
  const read = (id: string) => {
    const row = store.get<UserSessionRecord>(`user-session:${id}`)?.value;
    if (!row) throw new HttpError(404, 'History session not found.');
    if (row.id !== id) throw new Error('Stored session identity conflicts with its key.');
    identity.parse(row);
    return row;
  };
  const before = params.has('before') ? read(params.get('before')!) : undefined;
  function* rows() {
    for (const row of store.scan<UserSessionRecord>('user-session:')) {
      if (row.key !== `user-session:${row.value.id}`)
        throw new Error('Stored session identity conflicts with its key.');
      yield sessionSummary(row.value);
    }
  }
  const result = page(rows(), before);
  const active = activeId ? read(activeId) : null;
  return {
    sessions: result.records,
    nextBeforeId: result.nextBeforeId,
    activeId,
    activeSession: active
      ? { ...sessionSummary(active), configuration: active.configuration }
      : null,
  };
}
