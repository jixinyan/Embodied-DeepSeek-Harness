import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serveGptPolicy, requestPolicyProposal } from '@edh/execution';
import { createDshHost, createNativeWorkerEnvironment } from './index.ts';
import { contextManagement, nativeDeploymentRoot } from './native-deployment-configuration.mjs';

export async function readNativeGptPolicyInputs(profile, images, signal) {
  signal.throwIfAborted();
  const controlMode = profile.worker.sceneConfiguration.control_mode ?? '0-shot';
  const instructions = await readFile(
    resolve(nativeDeploymentRoot, 'examples/policies/robodojo-astra.md'),
    { encoding: 'utf8', signal },
  );
  let demonstration;
  if (controlMode !== '0-shot') {
    const declared = profile.entry.demonstration;
    const text = await readFile(resolve(declared.textFile), { encoding: 'utf8', signal });
    if (!text.trim()) throw new Error('One-shot mode requires an explicit demonstration.');
    const inputs = await Promise.all(
      (declared.imageFiles ?? []).map(async (file) => ({
        mediaType: 'image/png',
        data: new Uint8Array(await readFile(resolve(file), { signal })),
      })),
    );
    signal.throwIfAborted();
    demonstration = { text, images: await images.saveImages(inputs) };
  }
  signal.throwIfAborted();
  return { controlMode, instructions, ...(demonstration ? { demonstration } : {}) };
}

export async function openNativeEnvironment(
  settings,
  profile,
  models,
  services,
  signal,
  policyInputs,
) {
  signal.throwIfAborted();
  if (settings.provider !== 'robodojo' || profile.mode === 'policy')
    return createNativeWorkerEnvironment(profile.worker, services, settings.validator);
  if (
    !policyInputs ||
    policyInputs.controlMode !== (profile.worker.sceneConfiguration.control_mode ?? '0-shot')
  )
    throw new Error('Native GPT policy inputs must match the selected profile.');
  let host;
  let gateway;
  let environment;
  let closing;
  let auditWrites = Promise.resolve();
  let auditFailure;
  const close = () => {
    if (closing) return closing;
    closing = (async () => {
      const errors = [];
      for (const action of [
        () => environment?.close(),
        () => gateway?.close(),
        () => host?.fiber.dispose(),
        () => auditWrites,
      ]) {
        try {
          await action();
        } catch (error) {
          errors.push(error);
        }
      }
      if (auditFailure && !errors.includes(auditFailure)) errors.push(auditFailure);
      if (errors.length)
        throw new AggregateError(errors, 'Native policy/environment cleanup failed.');
    })();
    return closing;
  };
  try {
    const auditDirectory = resolve(settings.dataDirectory, 'policy-audits');
    await mkdir(auditDirectory, { recursive: true });
    const audit = (record) => {
      if (auditFailure) throw auditFailure;
      auditWrites = auditWrites.then(() =>
        appendFile(resolve(auditDirectory, 'events.jsonl'), `${JSON.stringify(record)}\n`),
      );
      auditWrites.catch((error) => {
        auditFailure = error;
        void close().catch(console.error);
      });
    };
    host = await createDshHost(models.adapters, contextManagement);
    signal.throwIfAborted();
    const binding = models.models[profile.entry.policyModel ?? models.defaultModel];
    gateway = await serveGptPolicy(host, settings.validator, {
      port: profile.entry.policyGatewayPort ?? 0,
      images: services.images,
      modes: [profile.mode],
      onError: (error) => console.error(error),
      policy: {
        provider: binding.provider,
        model: binding.model,
        ...policyInputs,
        reasoningEffort: binding.reasoningEffort ?? 'xhigh',
        timeoutMs: 300_000,
        maxModelSteps: 24,
        audit,
        ...(profile.mode === 'hybrid'
          ? {
              propose: (request, signal) =>
                requestPolicyProposal(
                  profile.entry.lowerPolicyUri,
                  profile.checkpointSha256 === undefined
                    ? request
                    : { ...request, checkpoint_sha256: profile.checkpointSha256 },
                  settings.validator,
                  signal,
                ),
            }
          : {}),
      },
    });
    signal.throwIfAborted();
    environment = await createNativeWorkerEnvironment(
      {
        ...profile.worker,
        policyUri: profile.entry.workerPolicyUri ?? `ws://127.0.0.1:${gateway.port}`,
      },
      services,
      settings.validator,
    );
    signal.throwIfAborted();
    return {
      describeTasks: (options) => environment.describeTasks(options),
      createTaskBackend: (taskId, options) => environment.createTaskBackend(taskId, options),
      close,
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        'Native environment allocation and cleanup failed.',
      );
    }
    throw error;
  }
}
