import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';

export interface SegmentationInput {
  image: Uint8Array;
  mediaType: ImageMediaType;
  textPrompt: string;
  signal: AbortSignal;
}

export interface SegmentationInstance {
  objectId: number;
  score: number;
  bboxXyxy: readonly [number, number, number, number];
  areaPixels: number;
  maskPng: Uint8Array;
}

export interface SegmentationOutput {
  provider: string;
  sourceRevision: string;
  checkpointSha256: string;
  width: number;
  height: number;
  overlayPng: Uint8Array;
  instances: readonly SegmentationInstance[];
}

export interface SegmentationEngine {
  segment(input: SegmentationInput): Promise<SegmentationOutput>;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const boundedInt = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;

function imageBytes(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length > 44_739_244)
    throw new Error('Segmentation image encoding exceeds its limit.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value || bytes.byteLength > 32 * 1024 * 1024)
    throw new Error('Segmentation image encoding is invalid.');
  return bytes;
}

function parseOutput(value: unknown): SegmentationOutput {
  if (!object(value) || !object(value.model))
    throw new Error('Segmentation service returned invalid model metadata.');
  const model = value.model;
  if (
    model.provider !== 'sam3.1-object-multiplex' ||
    typeof model.source_revision !== 'string' ||
    !/^[a-f0-9]{40}$/.test(model.source_revision) ||
    !digest(model.checkpoint_sha256) ||
    !boundedInt(value.width, 65_536) ||
    !boundedInt(value.height, 65_536) ||
    value.width === 0 ||
    value.height === 0 ||
    !Array.isArray(value.instances) ||
    value.instances.length > 16
  )
    throw new Error('Segmentation service returned invalid metadata.');
  const width = value.width;
  const height = value.height;
  const instances = value.instances.map((raw: unknown): SegmentationInstance => {
    if (
      !object(raw) ||
      !boundedInt(raw.object_id, 1_000_000) ||
      typeof raw.score !== 'number' ||
      !Number.isFinite(raw.score) ||
      raw.score < 0 ||
      raw.score > 1 ||
      !Array.isArray(raw.bbox_xyxy) ||
      raw.bbox_xyxy.length !== 4 ||
      !raw.bbox_xyxy.every((coordinate) => boundedInt(coordinate, Math.max(width, height))) ||
      !boundedInt(raw.area_pixels, width * height)
    )
      throw new Error('Segmentation service returned an invalid instance.');
    const [left, top, right, bottom] = raw.bbox_xyxy as number[];
    if (left! >= right! || top! >= bottom! || right! > width || bottom! > height)
      throw new Error('Segmentation service returned an invalid bounding box.');
    return {
      objectId: raw.object_id,
      score: raw.score,
      bboxXyxy: [left!, top!, right!, bottom!],
      areaPixels: raw.area_pixels,
      maskPng: imageBytes(raw.mask_png_base64),
    };
  });
  return {
    provider: model.provider,
    sourceRevision: model.source_revision,
    checkpointSha256: model.checkpoint_sha256,
    width,
    height,
    overlayPng: imageBytes(value.overlay_png_base64),
    instances,
  };
}

export class Sam31HttpClient implements SegmentationEngine {
  private readonly endpoint: URL;

  constructor(address: string) {
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
    input.signal.throwIfAborted();
    if (input.image.byteLength > 32 * 1024 * 1024)
      throw new Error('Segmentation image exceeds 32 MiB.');
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        image_base64: Buffer.from(input.image).toString('base64'),
        image_mime_type: input.mediaType,
        text_prompt: input.textPrompt,
      }),
      signal: input.signal,
    });
    if (!response.ok) throw new Error(`SAM 3.1 service returned HTTP ${response.status}.`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 64 * 1024 * 1024) throw new Error('SAM 3.1 response exceeds 64 MiB.');
    return parseOutput(JSON.parse(Buffer.from(bytes).toString('utf8')));
  }
}
