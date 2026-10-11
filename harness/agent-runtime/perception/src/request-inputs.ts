import { z } from 'zod';
import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';

export interface SegmentationInput {
  image: Uint8Array;
  mediaType: ImageMediaType;
  textPrompt: string;
  signal: AbortSignal;
}

export interface DepthCameraIntrinsics {
  calibrationId: string;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
}

export interface DepthInput {
  image: Uint8Array;
  mediaType: ImageMediaType;
  width: number;
  height: number;
  maskPng?: Uint8Array;
  roiXyxy?: readonly [number, number, number, number];
  intrinsics?: DepthCameraIntrinsics;
  signal: AbortSignal;
}

const image = z
  .instanceof(Uint8Array)
  .refine((value) => value.byteLength > 0 && value.byteLength <= 32 * 1024 * 1024);
const mediaType = z.enum(['image/png', 'image/jpeg', 'image/webp']);
const signal = z.instanceof(AbortSignal);
const prompt = z
  .string()
  .min(1)
  .max(2048)
  .refine((value) => Array.from(value).length <= 1024);
const calibrationId = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => Array.from(value).length <= 128);
const coordinate = z.number().int().nonnegative().safe();
const segmentationSchema = z.object({ image, mediaType, textPrompt: prompt, signal }).strict();
const depthSchema = z
  .object({
    image,
    mediaType,
    width: z.number().int().positive().safe(),
    height: z.number().int().positive().safe(),
    maskPng: image.optional(),
    roiXyxy: z.tuple([coordinate, coordinate, coordinate, coordinate]).readonly().optional(),
    intrinsics: z
      .object({
        calibrationId,
        fx: z.number().finite().positive(),
        fy: z.number().finite().positive(),
        cx: z.number().finite(),
        cy: z.number().finite(),
      })
      .strict()
      .readonly()
      .optional(),
    signal,
  })
  .strict();

export function admitSegmentationInput(input: SegmentationInput): SegmentationInput {
  const parsed = segmentationSchema.parse(input);
  parsed.signal.throwIfAborted();
  return Object.freeze({ ...parsed, image: Uint8Array.from(parsed.image) });
}

export function admitDepthInput(input: DepthInput): DepthInput {
  const parsed = depthSchema.parse(input);
  parsed.signal.throwIfAborted();
  if (parsed.width * parsed.height > 4_000_000)
    throw new Error('Depth source dimensions exceed the input limit.');
  if (parsed.roiXyxy) {
    const [left, top, right, bottom] = parsed.roiXyxy;
    if (!(left < right && right <= parsed.width && top < bottom && bottom <= parsed.height))
      throw new Error('Depth ROI must lie within the source image.');
  }
  const { maskPng, roiXyxy, intrinsics, ...required } = parsed;
  return Object.freeze({
    ...required,
    image: Uint8Array.from(parsed.image),
    ...(maskPng === undefined ? {} : { maskPng: Uint8Array.from(maskPng) }),
    ...(roiXyxy === undefined ? {} : { roiXyxy }),
    ...(intrinsics === undefined ? {} : { intrinsics }),
  });
}
