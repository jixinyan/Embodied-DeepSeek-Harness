import type { ContractValidator } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
import { VerdictHistory, type RunState } from '@edh/tasks';
import { HttpError } from './local-http.js';

export function readVerdictDetails(
  store: LocalStore,
  validator: ContractValidator,
  runId: string,
  params: URLSearchParams,
) {
  if ([...params.keys()].some((key) => key !== 'verdict') || params.getAll('verdict').length !== 1)
    throw new HttpError(400, 'Choose one accepted verdict.');
  const id = params.get('verdict')!;
  if (!/^[A-Za-z0-9-]{1,128}$/.test(id)) throw new HttpError(400, 'Invalid verdict identity.');
  const run = store.get<RunState>(`run:${runId}`)?.value;
  if (!run || run.id !== runId) throw new HttpError(404, 'Task not found.');
  const matches = run.verdicts.filter((value) => value.verdict_id === id);
  if (!matches.length) throw new HttpError(404, 'Accepted verdict not found in this task.');
  if (matches.length !== 1) throw new Error('Task contains duplicate accepted verdict identities.');
  return { runId, result: new VerdictHistory(store, validator).resolve(runId, matches[0]!) };
}
