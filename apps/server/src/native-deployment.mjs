import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { createConfiguredModels, OpenAICompatibleAdapter } from '@edh/models';
import { Sam31HttpClient, Yolo26HttpClient } from '@edh/perception';
import { runConsoleProcess } from './console-process.ts';
import { ManagedServices, nativeWorkspaceRetention, startServer } from './index.ts';
import {
  contextManagement,
  nativeDeploymentRoot,
  readNativeDeploymentConfiguration,
} from './native-deployment-configuration.mjs';
import { openNativeEnvironment, readNativeGptPolicyInputs } from './native-policy-environment.mjs';

export { nativeDeploymentRoot, readNativeDeploymentConfiguration };

export function createNativeDeploymentFactory(settings) {
  return async (services) => {
    const models = settings.modelConfiguration
      ? createConfiguredModels(settings.modelConfiguration, services)
      : {
          defaultModel: 'brain',
          models: { brain: { provider: 'local-vlm', model: settings.model } },
          adapters: [
            {
              providers: ['local-vlm'],
              adapter: new OpenAICompatibleAdapter({
                baseURL: settings.baseURL,
                models: [
                  {
                    id: settings.model,
                    inputModalities: ['text', 'image'],
                    contextWindow: 32768,
                    maxTokens: 2048,
                  },
                ],
                timeoutMs: 180_000,
                connectionMode: 'close-after-response',
                resolveImage: (ref, signal) =>
                  services.images.readImageRequest(
                    ref,
                    { maxPixels: 1024 * 1024, maxBytes: 2 * 1024 * 1024 },
                    signal,
                  ),
              }),
            },
          ],
        };
    const serviceLifecycle = new ManagedServices(settings.managedServices);
    const launchProfiles = Object.fromEntries(
      Object.entries(settings.profiles).map(([id, profile]) => [
        id,
        {
          teamFile: settings.teamFile,
          roleRoot: settings.roleRoot,
          source: 'simulation',
          label: profile.label,
          plannerReview: profile.plannerReview,
          depthIntrinsicsByCamera: profile.depthIntrinsicsByCamera,
          environment: profile.environment,
          embodiment: settings.selected.embodiment,
          executionMode: profile.mode,
          policy: profile.worker.policyId,
          checkpoint: profile.checkpoint,
          ...(profile.checkpointSha256 === undefined
            ? {}
            : { checkpointSha256: profile.checkpointSha256 }),
          defaultModel: profile.plannerModel,
          tasks: [],
          taskSource: 'environment',
          createEnvironment: async ({ signal, services }) => {
            const policyInputs =
              settings.provider === 'robodojo' && profile.mode !== 'policy'
                ? await readNativeGptPolicyInputs(profile, services.images, signal)
                : undefined;
            signal.throwIfAborted();
            const lease = await serviceLifecycle.acquire(profile.serviceIds, signal);
            let environment;
            let closing;
            const close = () =>
              (closing ??= (async () => {
                lease.signal.removeEventListener('abort', interrupted);
                const errors = [];
                for (const action of [() => environment?.close(), () => lease.release()]) {
                  try {
                    await action();
                  } catch (error) {
                    errors.push(error);
                  }
                }
                if (errors.length)
                  throw new AggregateError(
                    errors,
                    'Native environment and managed service release failed.',
                  );
              })());
            const interrupted = () => {
              void close().catch(console.error);
            };
            try {
              environment = await openNativeEnvironment(
                settings,
                profile,
                models,
                services,
                AbortSignal.any([signal, lease.signal]),
                policyInputs,
              );
              lease.signal.addEventListener('abort', interrupted, { once: true });
              signal.throwIfAborted();
              lease.signal.throwIfAborted();
              return {
                describeTasks: (options) => {
                  lease.signal.throwIfAborted();
                  return environment.describeTasks(options);
                },
                createTaskBackend: (taskId, options) => {
                  lease.signal.throwIfAborted();
                  return environment.createTaskBackend(taskId, {
                    ...options,
                    signal: AbortSignal.any([options.signal, lease.signal]),
                  });
                },
                close,
              };
            } catch (error) {
              try {
                await close();
              } catch (cleanup) {
                throw new AggregateError(
                  [error, cleanup],
                  'Native allocation and service release failed.',
                );
              }
              throw error;
            }
          },
        },
      ]),
    );
    return {
      id: `${settings.provider}-live`,
      version: `${settings.selected.version}-factory-v6`,
      source: 'simulation',
      description: `Native ${settings.selected.title} with independent DSH role Sessions`,
      teamFile: settings.teamFile,
      roleRoot: settings.roleRoot,
      storageRetention: nativeWorkspaceRetention,
      serviceLifecycle,
      serviceConfigurationDigest: createHash('sha256')
        .update(
          JSON.stringify({
            definitions: settings.managedServices,
            bindings: Object.fromEntries(
              Object.entries(settings.profiles).map(([id, profile]) => [
                id,
                {
                  services: profile.serviceIds,
                  depthIntrinsicsByCamera: profile.depthIntrinsicsByCamera,
                },
              ]),
            ),
          }),
        )
        .digest('hex'),
      ...models,
      tasks: {},
      launchProfiles,
      assignmentLifetimeMs: 3_600_000,
      providers: [settings.provider],
      contextManagement,
      ...(settings.segmentationURL
        ? { segmentation: new Sam31HttpClient(settings.segmentationURL) }
        : {}),
      ...(settings.config.depthURL
        ? {
            depth: new Yolo26HttpClient(settings.config.depthURL),
            depthIntrinsicsByCamera: settings.depthIntrinsicsByCamera,
          }
        : {}),
      enableObjectMeasurement: Boolean(settings.segmentationURL),
    };
  };
}

export function isNativeDeploymentEntry(moduleUrl) {
  return Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(moduleUrl));
}

export async function runNativeDeployment(settings) {
  const dispatcher = new EnvHttpProxyAgent();
  setGlobalDispatcher(dispatcher);
  return runConsoleProcess({
    start: () =>
      startServer({
        root: nativeDeploymentRoot,
        dataDirectory: settings.dataDirectory,
        port: settings.port,
        deployment: createNativeDeploymentFactory(settings),
      }),
    dispose: () => dispatcher.close(),
  });
}
