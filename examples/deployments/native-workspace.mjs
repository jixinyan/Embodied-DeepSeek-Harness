import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { z } from 'zod';
import { startServer } from '../../apps/server/src/index.ts';
import {
  createNativeDeploymentFactory,
  isNativeDeploymentEntry,
  nativeDeploymentRoot,
  readNativeDeploymentConfiguration,
} from './native-live.mjs';

const identity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/);
const nonblank = z.string().trim().min(1);
const configurationSchema = z
  .object({
    version: z.literal(1),
    modelConfiguration: nonblank,
    dataDirectory: nonblank,
    consolePort: z.number().int().min(1).max(65535),
    deployments: z
      .record(
        identity,
        z
          .object({
            provider: z.enum(['robodojo', 'robotwin', 'robocasa', 'behavior']),
            configuration: nonblank,
          })
          .strict(),
      )
      .refine((value) => Object.keys(value).length > 0, 'Native workspace requires deployments.'),
  })
  .strict();
const variables = {
  robodojo: 'EDH_ROBODOJO_CONFIG',
  robotwin: 'EDH_ROBOTWIN_CONFIG',
  robocasa: 'EDH_NATIVE_WORKER_CONFIG',
  behavior: 'EDH_BEHAVIOR_CONFIG',
};

export async function readNativeWorkspaceConfiguration(environment = process.env) {
  const { EDH_NATIVE_WORKSPACE_CONFIG: file } = z
    .object({ EDH_NATIVE_WORKSPACE_CONFIG: nonblank })
    .parse(environment);
  const path = resolve(file);
  const directory = dirname(path);
  const configuration = configurationSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  const modelConfiguration = resolve(directory, configuration.modelConfiguration);
  const dataDirectory = resolve(directory, configuration.dataDirectory);
  const deployments = await Promise.all(
    Object.entries(configuration.deployments).map(async ([id, entry]) => {
      const settings = await readNativeDeploymentConfiguration(entry.provider, {
        ...environment,
        [variables[entry.provider]]: resolve(directory, entry.configuration),
        EDH_MODEL_CONFIG: modelConfiguration,
        EDH_DATA_DIRECTORY: dataDirectory,
      });
      settings.dataDirectory = dataDirectory;
      return { id, settings };
    }),
  );
  const shared = (settings) => ({
    models: settings.modelConfiguration,
    segmentation: settings.segmentationURL ?? null,
    depth: settings.config.depthURL ?? null,
    depthIntrinsicsByCamera: settings.config.depthIntrinsicsByCamera ?? {},
  });
  for (const entry of deployments)
    if (!isDeepStrictEqual(shared(entry.settings), shared(deployments[0].settings)))
      throw new Error(
        'Native workspace deployments require the same model and perception bindings.',
      );
  return { configuration, deployments, dataDirectory, port: configuration.consolePort };
}

export function createNativeWorkspaceFactory(settings) {
  return async (services) => {
    const deployments = await Promise.all(
      settings.deployments.map(async ({ id, settings }) => ({
        id,
        deployment: await createNativeDeploymentFactory(settings)(services),
      })),
    );
    const first = deployments[0].deployment;
    const launchProfiles = {};
    for (const { id, deployment } of deployments) {
      if (
        !isDeepStrictEqual(deployment.models, first.models) ||
        deployment.modelConfigurationDigest !== first.modelConfigurationDigest ||
        !isDeepStrictEqual(deployment.contextManagement, first.contextManagement)
      )
        throw new Error('Native workspace has conflicting model or context bindings.');
      for (const [profileId, profile] of Object.entries(deployment.launchProfiles)) {
        const key = `${id}.${profileId}`;
        if (key.length > 80)
          throw new Error('Namespaced native launch profile exceeds 80 characters.');
        if (Object.hasOwn(launchProfiles, key)) throw new Error('Duplicate native launch profile.');
        launchProfiles[key] = { ...profile, label: `${id} / ${profile.label}` };
      }
    }
    let closing;
    const serviceLifecycle = {
      inspect: () =>
        deployments.flatMap(({ id, deployment }) =>
          deployment.serviceLifecycle.inspect().map((status) => ({
            ...status,
            id: `${id}.${status.id}`,
          })),
        ),
      close: () =>
        (closing ??= (async () => {
          const results = await Promise.allSettled(
            deployments.map(({ deployment }) => deployment.serviceLifecycle.close()),
          );
          const errors = results
            .filter((result) => result.status === 'rejected')
            .map((result) => result.reason);
          if (errors.length)
            throw new AggregateError(errors, 'Native workspace service cleanup failed.');
        })()),
    };
    return {
      ...first,
      id: 'native-workspace',
      version: 'native-workspace-v1',
      description:
        'Configured native environments with independent profile Teams and shared model tools',
      providers: [...new Set(deployments.flatMap(({ deployment }) => deployment.providers))],
      launchProfiles,
      serviceLifecycle,
      serviceConfigurationDigest: createHash('sha256')
        .update(
          JSON.stringify(
            deployments.map(({ id, deployment }) => ({
              id,
              version: deployment.version,
              digest: deployment.serviceConfigurationDigest,
            })),
          ),
        )
        .digest('hex'),
    };
  };
}

export default async function createDeployment(services) {
  return createNativeWorkspaceFactory(await readNativeWorkspaceConfiguration())(services);
}

if (isNativeDeploymentEntry(import.meta.url)) {
  const settings = await readNativeWorkspaceConfiguration();
  const dispatcher = new EnvHttpProxyAgent();
  setGlobalDispatcher(dispatcher);
  let server;
  try {
    server = await startServer({
      root: nativeDeploymentRoot,
      dataDirectory: settings.dataDirectory,
      port: settings.port,
      deployment: createNativeWorkspaceFactory(settings),
    });
  } catch (error) {
    await dispatcher.close();
    throw error;
  }
  process.stdout.write(`${server.url}\n`);
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      void server
        .close()
        .then(() => dispatcher.close())
        .then(
          () => process.exit(0),
          (error) => {
            console.error(error);
            process.exit(1);
          },
        );
    });
}
