import { admitSegmentationInput, type SegmentationInput } from './request-inputs.js';
import { readSegmentationResponse, type SegmentationOutput } from './model-responses.js';

export type { SegmentationInput } from './request-inputs.js';

export type { SegmentationInstance, SegmentationOutput } from './model-responses.js';

export interface SegmentationEngine {
  readonly timeoutMs?: number;
  segment(input: SegmentationInput): Promise<SegmentationOutput>;
}

export class Sam31HttpClient implements SegmentationEngine {
  private readonly endpoint: URL;
  readonly timeoutMs: number;

  constructor(address: string, timeoutMs = 600_000) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000)
      throw new Error('SAM 3.1 tool timeout must contain 1 to 600000 milliseconds.');
    this.timeoutMs = timeoutMs;
    const endpoint = new URL('/segment', address);
    if (
      endpoint.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      throw new Error('SAM 3.1 endpoint must use loopback HTTP.');
    this.endpoint = endpoint;
  }

  async segment(input: SegmentationInput): Promise<SegmentationOutput> {
    input = admitSegmentationInput(input);
    const signal = AbortSignal.any([input.signal, AbortSignal.timeout(this.timeoutMs)]);
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        image_base64: Buffer.from(input.image).toString('base64'),
        image_mime_type: input.mediaType,
        text_prompt: input.textPrompt,
      }),
      signal,
    });
    if (!response.ok) throw new Error(`SAM 3.1 service returned HTTP ${response.status}.`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('SAM 3.1 response has no body.');
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      received += part.value.byteLength;
      if (received > 64 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('SAM 3.1 response exceeds 64 MiB.');
      }
      chunks.push(part.value);
    }
    signal.throwIfAborted();
    return readSegmentationResponse(JSON.parse(Buffer.concat(chunks).toString('utf8')), input);
  }
}
