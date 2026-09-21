import type { IncomingMessage, ServerResponse } from 'node:http';
import { isDeepStrictEqual } from 'node:util';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { ContractValidator } from '@edh/contracts';
import { ImageMaintenanceConflict, type LocalStore } from '@edh/storage';
import type { RunState } from '@edh/tasks';
import { SensorSamples } from '@edh/perception';
import { HttpError } from './local-http.js';

export interface EvidenceImageServices {
  store: LocalStore;
  images: AttachmentStore;
  validator: ContractValidator;
}

export async function serveEvidenceImage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  services: EvidenceImageServices,
  shutdown?: AbortSignal,
): Promise<boolean> {
  const route = /^\/api\/runs\/([A-Za-z0-9-]+)\/evidence\/([^/]+)\/images\/([^/]+)$/.exec(
    url.pathname,
  );
  if (!route) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    throw new HttpError(405, 'Image reads require GET or HEAD.');
  }
  const runId = route[1]!;
  let evidenceId: string;
  let imageId: string;
  try {
    evidenceId = decodeURIComponent(route[2]!);
    imageId = decodeURIComponent(route[3]!);
  } catch {
    throw new HttpError(400, 'Invalid image route encoding.');
  }
  for (const id of [evidenceId, imageId])
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/.test(id))
      throw new HttpError(400, 'Invalid evidence or image identity.');
  const run = services.store.get<RunState>(`run:${runId}`)?.value;
  if (!run || run.id !== runId) throw new HttpError(404, 'Run not found.');
  const sample = new SensorSamples(services.store, services.validator, runId, run.source).read(
    evidenceId,
  );
  if (!sample) throw new HttpError(404, 'Evidence not found in this run.');
  if (sample.evidence.visibility !== 'agent')
    throw new HttpError(403, 'Evidence is not available to the observation viewer.');
  const ref = sample.images?.find((image) => image.attachmentId === imageId);
  if (!ref) throw new HttpError(404, 'Image not associated with this evidence.');
  const controller = new AbortController();
  const closed = () => {
    if (!res.writableFinished) controller.abort(new Error('Image reader disconnected.'));
  };
  res.once('close', closed);
  const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(15_000),
    ...(shutdown ? [shutdown] : []),
  ]);
  try {
    const image = await services.images.readImage(ref, signal);
    signal.throwIfAborted();
    if (!isDeepStrictEqual(image.ref, ref) || image.data.byteLength !== ref.bytes)
      throw new Error('Image provider returned inconsistent evidence.');
    res.writeHead(200, {
      'Content-Type': ref.mediaType,
      'Content-Length': image.data.byteLength,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Disposition': 'inline',
    });
    res.end(req.method === 'HEAD' ? undefined : image.data);
    return true;
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof ImageMaintenanceConflict)
      throw new HttpError(409, 'Image maintenance is in progress. Retry the image read afterward.');
    if (error instanceof Error && 'code' in error && error.code === 'ATTACHMENT_NOT_FOUND')
      throw new HttpError(410, 'The image object is unavailable.');
    throw new HttpError(500, 'Image integrity or storage read failed.');
  } finally {
    res.removeListener('close', closed);
  }
}
