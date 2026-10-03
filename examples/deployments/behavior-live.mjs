import {
  createNativeDeploymentFactory,
  isNativeDeploymentEntry,
  readNativeDeploymentConfiguration,
  runNativeDeployment,
} from './native-live.mjs';

export default async function createDeployment(services) {
  const settings = await readNativeDeploymentConfiguration('behavior');
  return createNativeDeploymentFactory(settings)(services);
}

if (isNativeDeploymentEntry(import.meta.url))
  await runNativeDeployment(await readNativeDeploymentConfiguration('behavior'));
