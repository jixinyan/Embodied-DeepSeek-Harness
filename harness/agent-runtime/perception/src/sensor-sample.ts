import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { ContractValidator } from '@edh/contracts';
import type { SensorSample } from '@edh/execution';

const positive = (n: unknown, max: number) =>
  typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= max;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const opaque = (value: unknown) =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/.test(value);

export function validateImageAttachmentReference(ref: unknown): asserts ref is ImageAttachmentRef {
  if (
    !object(ref) ||
    Object.keys(ref).some(
      (key) =>
        ![
          'attachmentId',
          'mediaType',
          'bytes',
          'width',
          'height',
          'name',
          'originalDimensions',
        ].includes(key),
    ) ||
    !opaque(ref.attachmentId) ||
    typeof ref.mediaType !== 'string' ||
    !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(ref.mediaType) ||
    !positive(ref.bytes, 32 * 1024 * 1024) ||
    !positive(ref.width, 65536) ||
    !positive(ref.height, 65536) ||
    (ref.name !== undefined &&
      (typeof ref.name !== 'string' || ref.name.length > 256 || /[\\/\x00-\x1f]/.test(ref.name))) ||
    (ref.originalDimensions !== undefined &&
      (!object(ref.originalDimensions) ||
        Object.keys(ref.originalDimensions).some((key) => !['width', 'height'].includes(key)) ||
        !positive(ref.originalDimensions.width, 65536) ||
        !positive(ref.originalDimensions.height, 65536)))
  )
    throw new Error('Invalid immutable image attachment reference.');
}

/** Validate metadata only. The deployment's attachment store must verify image bytes. */
export function admitSensorSample(
  validator: ContractValidator,
  input: SensorSample,
  source: SensorSample['source'],
): SensorSample {
  const sample = structuredClone(input);
  if (
    !object(sample) ||
    Object.keys(sample).some(
      (key) =>
        !['evidence', 'sequence', 'source', 'description', 'visualization', 'images'].includes(key),
    ) ||
    !Number.isSafeInteger(sample.sequence) ||
    sample.sequence < 0 ||
    !['test_fixture', 'simulation', 'hardware'].includes(sample.source) ||
    sample.source !== source ||
    typeof sample.description !== 'string' ||
    sample.description.length > 65536 ||
    !object(sample.visualization) ||
    Object.values(sample.visualization).some(
      (value) =>
        !['string', 'boolean'].includes(typeof value) &&
        !(typeof value === 'number' && Number.isFinite(value)),
    )
  )
    throw new Error('Invalid sensor sample metadata or source.');
  validator.parse('EvidenceRef', sample.evidence);
  if (sample.images !== undefined) {
    if (!Array.isArray(sample.images) || sample.images.length > 16)
      throw new Error('Sensor sample exceeds the image reference bound.');
    for (const ref of sample.images) validateImageAttachmentReference(ref);
    if (new Set(sample.images.map((image) => image.attachmentId)).size !== sample.images.length)
      throw new Error('Duplicate image in sensor sample.');
  }
  if (Buffer.byteLength(JSON.stringify(sample)) > 1024 * 1024)
    throw new Error('Sensor metadata exceeds the admission byte bound.');
  return sample;
}

/** Explicitly supplied samples only; this never searches another assignment's evidence. */
export function sensorImages(samples: readonly SensorSample[]): ImageAttachmentRef[] {
  const images = new Map<string, ImageAttachmentRef>();
  for (const sample of samples) {
    if (sample.evidence.visibility !== 'agent')
      throw new Error('Sensor evidence is not agent-visible.');
    for (const image of sample.images ?? []) images.set(image.attachmentId, image);
  }
  if (images.size > 16) throw new Error('Explicit context exceeds the image reference bound.');
  return structuredClone([...images.values()]);
}
