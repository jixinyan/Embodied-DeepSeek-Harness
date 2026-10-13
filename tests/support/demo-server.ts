import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator } from '@edh/contracts';
import { startServer } from '../../apps/server/src/http-server.js';
import {
  createDemoDeployment,
  createDemoLaunchProfiles,
  type DemoDeploymentOptions,
} from './demo-deployment.js';

export interface DemoServerOptions extends DemoDeploymentOptions {
  dataDirectory: string;
  port?: number;
}

export async function startDemoServer(options: DemoServerOptions) {
  const validator = new ContractValidator(
    JSON.parse(
      await readFile(
        resolve(options.root, 'harness/contracts/schema/physical.schema.json'),
        'utf8',
      ),
    ),
  );
  return startServer({
    ...options,
    imageRetention: { version: 'journal-v1', sources: [] },
    deployment: {
      ...createDemoDeployment(options, validator),
      launchProfiles: createDemoLaunchProfiles(validator, options.tickMs),
    },
  });
}
