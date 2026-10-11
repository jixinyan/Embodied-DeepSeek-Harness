import { isDeepStrictEqual } from 'node:util';
import type { ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment';
import { LlmError } from '@deepseek-ai/dsh-llm';
import { z } from 'zod';

export type ModelImageResolver = (
  ref: ImageAttachmentRef,
  signal: AbortSignal,
) => RequestImageAttachment | Promise<RequestImageAttachment>;

const positive = z.number().int().positive().safe();
const mediaType = z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const referenceSchema = z
  .object({
    attachmentId: z.string().min(1),
    mediaType,
    bytes: positive,
    width: positive,
    height: positive,
    name: z.string().optional(),
    originalDimensions: z.object({ width: positive, height: positive }).strict().optional(),
  })
  .strict();
const identitySchema = referenceSchema
  .pick({
    attachmentId: true,
    mediaType: true,
    bytes: true,
    width: true,
    height: true,
  })
  .strip();
const requestSchema = z
  .object({
    variantId: z.string().min(1),
    attachment: referenceSchema,
    data: z.instanceof(Uint8Array),
    mediaType,
    bytes: positive,
    width: positive,
    height: positive,
    depth: z.literal('uchar'),
    space: z.literal('srgb'),
    hasAlpha: z.boolean(),
  })
  .strict();

export function assertSameModelImageReference(
  actual: ImageAttachmentRef,
  expected: ImageAttachmentRef,
): void {
  if (
    !referenceSchema.safeParse(actual).success ||
    !referenceSchema.safeParse(expected).success ||
    !isDeepStrictEqual(identitySchema.parse(actual), identitySchema.parse(expected))
  )
    throw new LlmError(
      'Image resolver returned inconsistent attachment identity.',
      'INVALID_REQUEST',
    );
}

export async function resolveModelImage(
  reference: ImageAttachmentRef,
  resolver: ModelImageResolver | undefined,
  signal: AbortSignal,
  maxRepresentedBytes: number,
): Promise<RequestImageAttachment> {
  signal.throwIfAborted();
  if (
    !referenceSchema.safeParse(reference).success ||
    !Number.isSafeInteger(maxRepresentedBytes) ||
    maxRepresentedBytes < 0
  )
    throw new LlmError('Model image input is invalid.', 'INVALID_REQUEST');
  if (!resolver) throw new LlmError('No image resolver is configured.', 'UNSUPPORTED_CONTENT');
  if (maxRepresentedBytes === 0)
    throw new LlmError('Request image bytes exceeded.', 'INVALID_REQUEST');
  const expected = structuredClone(reference);
  const image = await resolver(structuredClone(expected), signal);
  signal.throwIfAborted();
  if (!requestSchema.safeParse(image).success || image.bytes !== image.data.byteLength)
    throw new LlmError('Image resolver returned inconsistent image data.', 'INVALID_REQUEST');
  assertSameModelImageReference(image.attachment, expected);
  if (Math.ceil(image.bytes / 3) * 4 > maxRepresentedBytes)
    throw new LlmError('Request image bytes exceeded.', 'INVALID_REQUEST');
  const { data, ...metadata } = image;
  const snapshot = { ...structuredClone(metadata), data: new Uint8Array(data) };
  if (snapshot.attachment.originalDimensions) Object.freeze(snapshot.attachment.originalDimensions);
  Object.freeze(snapshot.attachment);
  return Object.freeze(snapshot);
}
