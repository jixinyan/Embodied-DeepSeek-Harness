import { admitDepthInput, type DepthInput } from './request-inputs.js';
import { readDepthResponse, type DepthOutput } from './model-responses.js';

export type { DepthInput, DepthCameraIntrinsics } from './request-inputs.js';

export type { DepthOutput } from './model-responses.js';

export interface DepthEngine {
  readonly timeoutMs?: number;
  estimate(input: DepthInput): Promise<DepthOutput>;
}

export class Yolo26HttpClient implements DepthEngine {
  private readonly endpoint: URL;
  readonly timeoutMs: number;

  constructor(address: string, timeoutMs = 600_000) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000)
      throw new Error('YOLO26 tool timeout must contain 1 to 600000 milliseconds.');
    this.timeoutMs = timeoutMs;
    const endpoint = new URL('/depth', address);
    if (
      endpoint.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      throw new Error('YOLO26 endpoint must use loopback HTTP.');
    this.endpoint = endpoint;
  }

  async estimate(input: DepthInput): Promise<DepthOutput> {
    input = admitDepthInput(input);
    const intrinsics = input.intrinsics;
    const signal = AbortSignal.any([input.signal, AbortSignal.timeout(this.timeoutMs)]);
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        image_base64: Buffer.from(input.image).toString('base64'),
        image_mime_type: input.mediaType,
        mask_png_base64: input.maskPng ? Buffer.from(input.maskPng).toString('base64') : null,
        roi_xyxy: input.roiXyxy ?? null,
        intrinsics: intrinsics
          ? {
              calibration_id: intrinsics.calibrationId,
              fx: intrinsics.fx,
              fy: intrinsics.fy,
              cx: intrinsics.cx,
              cy: intrinsics.cy,
            }
          : null,
      }),
      signal,
    });
    if (!response.ok) throw new Error(`YOLO26 service returned HTTP ${response.status}.`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('YOLO26 response has no body.');
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      received += part.value.byteLength;
      if (received > 64 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('YOLO26 response exceeds 64 MiB.');
      }
      chunks.push(part.value);
    }
    signal.throwIfAborted();
    return readDepthResponse(JSON.parse(Buffer.concat(chunks).toString('utf8')), input);
  }
}
