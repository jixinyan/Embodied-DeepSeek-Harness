import { z } from 'zod';
import { isAbsolute } from 'node:path';
import { deepFreeze } from '@deepseek-ai/dsh-util-values';
import type { ContractValidator } from '@edh/contracts';
import { parseTaskCatalog, type TaskCatalogDefinition } from '@edh/tasks';
import { nativeProfileCleanupSchema } from './native-profile-cleanup.js';

const nonblank = z.string().trim().min(1);
const seconds = z.number().finite().positive().max(300);
const lifecycle = z.number().int().min(1).max(1_800_000);
export const nativePolicyEndpointSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      ['ws:', 'wss:'].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  }, 'Native policy requires a ws(s) endpoint without embedded credentials or fragment.');

export const nativeWorkerConfigurationSchema = z
  .object({
    command: z.tuple([nonblank]).rest(nonblank).readonly(),
    transportFd: z.union([z.literal(1), z.literal(3)]).optional(),
    onProcessStarted: z
      .custom<(pid: number) => void>((value) => typeof value === 'function')
      .optional(),
    cwd: nonblank,
    env: z.record(z.string(), z.string()).readonly(),
    provider: z.enum(['robotwin', 'behavior', 'robocasa', 'robodojo']),
    nativeTaskId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/),
    sourceRoot: nonblank.optional(),
    sceneConfiguration: z.record(z.string(), z.json()).readonly(),
    schemaPath: nonblank,
    policyId: nonblank,
    policyUri: nativePolicyEndpointSchema.optional(),
    executionMode: z.enum(['policy', 'direct', 'hybrid']).optional(),
    policyMaxActionsPerInference: z.number().int().min(1).max(512).optional(),
    monitorEveryActions: z.number().int().min(1).max(512).optional(),
    publishRunningImages: z.boolean().optional(),
    enableSimulatorInspection: z.boolean().optional(),
    recordSimulationFrames: z.boolean().optional(),
    simulationVideoDirectory: nonblank
      .refine(isAbsolute, 'Native video directory must be an absolute worker-local path.')
      .optional(),
    observationTtlS: seconds.optional(),
    deviceTimeoutS: seconds.optional(),
    policyTimeoutS: seconds.optional(),
    toolTimeoutMs: z.number().int().min(60_001).max(1_800_000).optional(),
    transportWriteTimeoutS: z.number().finite().positive().max(60).optional(),
    initializeTimeoutMs: lifecycle.optional(),
    closeTimeoutMs: lifecycle.optional(),
    profileCleanup: nativeProfileCleanupSchema.optional(),
    catalog: z.unknown(),
  })
  .strict()
  .superRefine((configuration, context) => {
    if (configuration.enableSimulatorInspection && configuration.provider !== 'robodojo')
      context.addIssue({
        code: 'custom',
        path: ['enableSimulatorInspection'],
        message: 'Native simulator inspection requires RoboDojo.',
      });
    const sourceRequired = ['robotwin', 'behavior'].includes(configuration.provider);
    if (sourceRequired !== Boolean(configuration.sourceRoot))
      context.addIssue({
        code: 'custom',
        path: ['sourceRoot'],
        message: sourceRequired
          ? 'This native provider requires its installed sourceRoot.'
          : 'This native provider does not accept a worker sourceRoot.',
      });
    if (configuration.recordSimulationFrames && !configuration.simulationVideoDirectory)
      context.addIssue({
        code: 'custom',
        path: ['simulationVideoDirectory'],
        message: 'Native video recording requires its output directory.',
      });
  });

export type NativeWorkerConfiguration = Readonly<
  Omit<z.infer<typeof nativeWorkerConfigurationSchema>, 'catalog' | 'policyUri'>
> & { readonly catalog: TaskCatalogDefinition; readonly policyUri: string };

export function validateNativeWorkerConfiguration(
  configuration: NativeWorkerConfiguration,
  validator: ContractValidator,
): NativeWorkerConfiguration {
  const parsed = nativeWorkerConfigurationSchema.parse(configuration);
  const policyUri = nativePolicyEndpointSchema.parse(parsed.policyUri);
  const catalog = parseTaskCatalog(parsed.catalog, validator);
  if (Object.keys(catalog.tasks).length !== 1 || !Object.hasOwn(catalog.tasks, parsed.nativeTaskId))
    throw new Error('Native worker requires one catalog task matching nativeTaskId.');
  return deepFreeze({ ...parsed, policyUri, catalog });
}
