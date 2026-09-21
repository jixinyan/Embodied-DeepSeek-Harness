import type { IncomingMessage } from 'node:http';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function readJsonBody(
  req: IncomingMessage,
  maxBytes = 16384,
): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json'))
    throw new HttpError(415, 'Expected application/json.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new HttpError(413, `Request exceeds ${maxBytes / 1024} KiB.`);
    chunks.push(buffer);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Expected a JSON object.');
  }
}

export function assertLocalRequest(req: IncomingMessage, port: number): void {
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host ?? ''))
    throw new HttpError(403, 'Unrecognized local host.');
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
    throw new HttpError(403, 'Cross-origin access is disabled.');
  const site = req.headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none')
    throw new HttpError(403, 'Cross-origin browser requests are disabled.');
}
