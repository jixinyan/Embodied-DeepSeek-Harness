// Configure EDH_MODEL_BASE_URL and EDH_MODEL before starting. No model call occurs at startup.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContractValidator } from '@edh/contracts';
import { OpenAICompatibleAdapter } from '@edh/models';
import { startServer } from '../../apps/server/src/index.ts';
import { createDemoDeployment } from '../../apps/server/src/demo-deployment.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const baseURL = process.env.EDH_MODEL_BASE_URL;
const model = process.env.EDH_MODEL;
const apiKey = process.env.EDH_MODEL_API_KEY;
const contextWindow = process.env.EDH_MODEL_CONTEXT_WINDOW
  ? Number(process.env.EDH_MODEL_CONTEXT_WINDOW)
  : undefined;
if (!baseURL || !model)
  throw new Error('Set EDH_MODEL_BASE_URL and EDH_MODEL to your actual deployment.');
const validator = new ContractValidator(
  JSON.parse(
    await readFile(resolve(root, 'harness/contracts/schema/physical.schema.json'), 'utf8'),
  ),
);
const base = createDemoDeployment({ root }, validator);
const server = await startServer({
  root,
  port: 4319,
  dataDirectory: resolve(root, '.runs/http-model'),
  deployment: ({ images }) => ({
    ...base,
    id: 'http-model-workbench',
    version: '1',
    description: 'Configured HTTP model · CPU physical fixture only',
    defaultModel: 'brain',
    ...(contextWindow === undefined
      ? {}
      : {
          contextManagement: {
            compaction: { thresholdRatio: 0.7, retainRatio: 0.15 },
            visualHistory: { maxImages: 12 },
          },
        }),
    models: { brain: { provider: 'http-model', model } },
    adapters: [
      {
        providers: ['http-model'],
        adapter: new OpenAICompatibleAdapter({
          baseURL,
          models: [
            {
              id: model,
              inputModalities: ['text', 'image'],
              ...(contextWindow === undefined ? {} : { contextWindow }),
            },
          ],
          ...(apiKey ? { apiKey: () => apiKey } : {}),
          resolveImage: (ref, signal) =>
            images.readImageRequest(
              ref,
              { maxPixels: 1024 * 1024, maxBytes: 2 * 1024 * 1024 },
              signal,
            ),
        }),
      },
    ],
  }),
});
console.log(
  `HTTP model workbench: ${server.url}\nModel calls begin only when you start a task. The physical backend remains synthetic.`,
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void server.close().then(
      () => process.exit(0),
      (error) => {
        console.error(error);
        process.exit(1);
      },
    );
  });
