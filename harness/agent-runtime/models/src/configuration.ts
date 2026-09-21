import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'yaml';
import { z } from 'zod';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { LlmError } from '@deepseek-ai/dsh-llm';
import { OpenAICompatibleAdapter, type OpenAICompatibleModel } from './openai-compatible.js';

const identifier = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  .refine((value) => value.trim() === value);
const bounded = z.number().int().positive().max(2_147_483_647);
const nonempty = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value);
const authentication = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }).strict(),
  z
    .object({
      type: z.literal('environment'),
      variable: nonempty.regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
    })
    .strict(),
]);
const endpoint = z
  .object({
    hosting: z.enum(['cloud_api', 'vllm']),
    baseURL: nonempty.refine((value) => {
      const url = URL.parse(value);
      return Boolean(
        url &&
          ['http:', 'https:'].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash,
      );
    }, 'Expected an HTTP(S) API root without URL credentials, query or fragment.'),
    authentication,
    timeoutMs: bounded.default(120_000),
    maxRequestBytes: bounded.default(32 * 1024 * 1024),
    maxResponseBytes: bounded.default(32 * 1024 * 1024),
    maxImagesPerRequest: bounded.default(16),
    systemRole: z.enum(['system', 'developer']).default('system'),
    maxTokensField: z.enum(['max_tokens', 'max_completion_tokens']).default('max_tokens'),
    passReasoningContent: z.boolean().default(false),
    extraBody: z.record(z.string(), z.json()).default({}),
    imageRequest: z
      .object({ maxPixels: bounded, maxBytes: bounded })
      .strict()
      .default({ maxPixels: 1024 * 1024, maxBytes: 2 * 1024 * 1024 }),
  })
  .strict();
const model = z
  .object({
    endpoint: identifier,
    model: nonempty,
    name: nonempty.optional(),
    inputModalities: z
      .array(z.enum(['text', 'image']))
      .min(1)
      .max(2)
      .refine((values) => values.includes('text') && new Set(values).size === values.length),
    contextWindow: bounded.optional(),
    maxTokens: bounded.optional(),
  })
  .strict();
const configuration = z
  .object({
    version: z.literal(1),
    defaultModel: identifier,
    endpoints: z.record(identifier, endpoint).refine((values) => Object.keys(values).length > 0),
    models: z.record(identifier, model).refine((values) => Object.keys(values).length > 0),
  })
  .strict();

export type ModelConfiguration = z.infer<typeof configuration>;

export function parseModelConfiguration(input: unknown): ModelConfiguration {
  const result = configuration.parse(input);
  if (!Object.hasOwn(result.models, result.defaultModel))
    throw new Error('Unknown default model alias.');
  for (const value of Object.values(result.models))
    if (!Object.hasOwn(result.endpoints, value.endpoint))
      throw new Error(`Unknown model endpoint: ${value.endpoint}`);
  for (const name of Object.keys(result.endpoints))
    if (!Object.values(result.models).some((value) => value.endpoint === name))
      throw new Error(`Model endpoint has no model bindings: ${name}`);
  return result;
}

export async function readModelConfiguration(file: string): Promise<ModelConfiguration> {
  return parseModelConfiguration(parse(await readFile(file, 'utf8')));
}

function credential(variable: string): string {
  const value = process.env[variable];
  if (!value || /[\u0000-\u0020\u007f]/.test(value))
    throw new LlmError(
      `Model credential environment variable is missing or invalid: ${variable}`,
      'MISSING_CREDENTIAL',
    );
  return value;
}

export function createConfiguredModels(
  input: unknown,
  services: { images?: AttachmentStore } = {},
) {
  const config = parseModelConfiguration(input);
  const models: Record<string, { provider: string; model: string }> = Object.create(null);
  const adapters: { providers: string[]; adapter: OpenAICompatibleAdapter }[] = [];
  for (const [provider, value] of Object.entries(config.endpoints)) {
    const registered = new Map<string, OpenAICompatibleModel>();
    for (const [alias, entry] of Object.entries(config.models)) {
      if (entry.endpoint !== provider) continue;
      const info: OpenAICompatibleModel = {
        id: entry.model,
        inputModalities: entry.inputModalities,
        ...(entry.name === undefined ? {} : { name: entry.name }),
        ...(entry.contextWindow === undefined ? {} : { contextWindow: entry.contextWindow }),
        ...(entry.maxTokens === undefined ? {} : { maxTokens: entry.maxTokens }),
      };
      const previous = registered.get(info.id);
      if (previous && !isDeepStrictEqual(previous, info))
        throw new Error(`Conflicting capabilities for model ${provider}/${info.id}.`);
      registered.set(info.id, info);
      models[alias] = { provider, model: entry.model };
    }
    const images = services.images;
    if (
      [...registered.values()].some((entry) => entry.inputModalities!.includes('image')) &&
      !images
    )
      throw new Error(`Image-capable endpoint requires the application image service: ${provider}`);
    const { hosting, authentication: auth, imageRequest, ...options } = value;
    void hosting;
    if (auth.type === 'environment') credential(auth.variable);
    adapters.push({
      providers: [provider],
      adapter: new OpenAICompatibleAdapter({
        ...options,
        models: [...registered.values()],
        ...(auth.type === 'environment'
          ? {
              apiKey: (signal: AbortSignal) => {
                signal.throwIfAborted();
                return credential(auth.variable);
              },
            }
          : {}),
        ...(images
          ? { resolveImage: (ref, signal) => images.readImageRequest(ref, imageRequest, signal) }
          : {}),
      }),
    });
  }
  return {
    defaultModel: config.defaultModel,
    models,
    adapters,
    modelConfigurationDigest: createHash('sha256').update(JSON.stringify(config)).digest('hex'),
  };
}
