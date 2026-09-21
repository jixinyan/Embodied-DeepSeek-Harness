import type { IncomingMessage } from 'node:http';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
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
