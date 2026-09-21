import { type LocalStore, SessionAudits } from '@edh/storage';
import { HttpError } from './local-http.js';

export function readSessionAudit(store: LocalStore, runId: string, params: URLSearchParams) {
  const allowed = new Set(['assignment', 'afterAssignment', 'after', 'before', 'through']);
  for (const key of params.keys())
    if (!allowed.has(key) || params.getAll(key).length !== 1)
      throw new HttpError(400, 'Invalid audit query.');
  const identifier = (key: string) => {
    const value = params.get(key);
    if (value === null) return undefined;
    if (!/^[A-Za-z0-9-]{1,128}$/.test(value))
      throw new HttpError(400, 'Invalid audit assignment identifier.');
    return value;
  };
  const offset = (key: string) => {
    const value = params.get(key);
    if (value === null) return undefined;
    if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value)))
      throw new HttpError(400, 'Invalid audit offset.');
    return Number(value);
  };
  const assignment = identifier('assignment');
  const afterAssignment = identifier('afterAssignment');
  const after = offset('after');
  const before = offset('before');
  const through = offset('through');
  if (!assignment && (after !== undefined || before !== undefined || through !== undefined))
    throw new HttpError(400, 'Select an audit assignment before selecting events.');
  if (
    assignment &&
    (afterAssignment !== undefined || (after !== undefined && before !== undefined))
  )
    throw new HttpError(400, 'Choose one audit page range.');
  if (!store.get(`run:${runId}`)) throw new HttpError(404, 'Run not found.');
  const audits = new SessionAudits(store);
  const selected = assignment ?? afterAssignment;
  const record = selected ? store.get(`session-audit:${runId}:${selected}`) : undefined;
  if (selected && !record) throw new HttpError(404, 'Audit assignment not found.');
  if (!assignment) return audits.index(runId, afterAssignment);
  const latest = audits.before(runId, assignment, 0);
  if (
    (through ?? latest.eventTotal) > latest.eventTotal ||
    (after ?? before ?? 0) > (through ?? latest.eventTotal)
  )
    throw new HttpError(400, 'Audit offset exceeds the published boundary.');
  return after !== undefined
    ? audits.page(runId, assignment, after, through)
    : audits.before(runId, assignment, before, through);
}
