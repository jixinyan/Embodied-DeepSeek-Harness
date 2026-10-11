import { z } from 'zod';

export type RotationAxis = 'yaw' | 'pitch';

const requestSchema = z
  .object({
    yawDeg: z.number().finite().min(-90).max(90),
    pitchDeg: z.number().finite().min(-45).max(45),
  })
  .strict()
  .readonly();

const position = z
  .tuple([z.number().finite(), z.number().finite(), z.number().finite()])
  .readonly();
const counter = z.number().int().nonnegative().safe();
const motionSchema = z
  .object({
    requested_yaw_deg: z.number().finite(),
    requested_pitch_deg: z.number().finite(),
    achieved_yaw_deg: z.number().finite(),
    achieved_pitch_deg: z.number().finite(),
    before_yaw_deg: z.number().finite(),
    after_yaw_deg: z.number().finite(),
    before_pitch_deg: z.number().finite(),
    after_pitch_deg: z.number().finite(),
    before_position: position,
    after_position: position,
    control_steps: counter,
    raw_sim_steps: counter,
    stop_reason: z.enum([
      'completed',
      'stalled',
      'budget_exhausted',
      'cancelled',
      'episode_terminated',
    ]),
  })
  .strict()
  .readonly();

export type RotationRequest = z.infer<typeof requestSchema>;
export type RotationMotion = z.infer<typeof motionSchema>;

export function admitRotationRequest(
  yawDeg: number,
  pitchDeg: number,
  axes: readonly RotationAxis[],
): RotationRequest {
  const request = requestSchema.parse({ yawDeg, pitchDeg });
  if (
    axes.length === 0 ||
    (!axes.includes('yaw') && request.yawDeg !== 0) ||
    (!axes.includes('pitch') && request.pitchDeg !== 0)
  )
    throw new Error('Requested rotation exceeds the device capability.');
  return request;
}

export function readRotationMotion(input: unknown, request: RotationRequest): RotationMotion {
  const motion = motionSchema.parse(input);
  if (
    motion.requested_yaw_deg !== request.yawDeg ||
    motion.requested_pitch_deg !== request.pitchDeg
  )
    throw new Error('Native rotation receipt differs from its request.');
  return motion;
}
