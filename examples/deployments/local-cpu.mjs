// Run from the repository root. This example uses synthetic CPU providers only.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContractValidator } from '@edh/contracts';
import { startServer } from '../../apps/server/src/index.ts';
import { createDemoDeployment } from '../../apps/server/src/demo-deployment.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const validator = new ContractValidator(
  JSON.parse(
    await readFile(resolve(root, 'harness/contracts/schema/physical.schema.json'), 'utf8'),
  ),
);
const base = createDemoDeployment({ root }, validator);
const server = await startServer({
  root,
  port: 4318,
  dataDirectory: resolve(root, '.runs/custom-deployment'),
  deployment: {
    ...base,
    id: 'placement-workbench',
    version: '1',
    description: 'Custom task configuration · CPU fixture only',
    defaultModel: 'brain',
    models: { brain: { provider: 'fixture', model: 'fixture' } },
    tasks: {
      'placement-task': {
        ...base.tasks['first-pass'],
        label: 'Place the cup',
        instruction: 'Place the cup inside the cabinet.',
      },
    },
  },
});
console.log(`Custom CPU deployment: ${server.url}`);
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
