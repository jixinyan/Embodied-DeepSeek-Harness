import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export async function readLaunchConfig(file) {
  if (typeof file !== 'string' || !file.trim()) throw new Error('Select a launch configuration.');
  const configFile = await realpath(file);
  const value = JSON.parse(await readFile(configFile, 'utf8'));
  const keys = ['version', 'repository', 'deployment', 'dataDirectory', 'environmentFile', 'port'];
  if (!value || Array.isArray(value) || typeof value !== 'object' || value.version !== 1)
    throw new Error('Launch configuration requires version 1.');
  for (const key of Object.keys(value))
    if (!keys.includes(key)) throw new Error(`Unknown launch configuration field: ${key}`);
  for (const key of ['repository', 'deployment', 'dataDirectory'])
    if (typeof value[key] !== 'string' || !value[key].trim())
      throw new Error(`Launch configuration requires ${key}.`);
  if (
    value.environmentFile !== undefined &&
    (typeof value.environmentFile !== 'string' || !value.environmentFile.trim())
  )
    throw new Error('environmentFile must be a nonempty path.');
  const port = value.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('port must be an integer from 0 to 65535.');
  const repository = await realpath(resolve(dirname(configFile), value.repository));
  const manifest = JSON.parse(await readFile(resolve(repository, 'package.json'), 'utf8'));
  if (manifest.name !== 'embodied-deepseek-harness')
    throw new Error('repository must point to an EDH checkout.');
  const deployment = await realpath(resolve(dirname(configFile), value.deployment));
  if (!(await stat(deployment)).isFile()) throw new Error('deployment must be a module file.');
  const environmentFile =
    value.environmentFile === undefined
      ? undefined
      : await realpath(resolve(dirname(configFile), value.environmentFile));
  if (environmentFile && !(await stat(environmentFile)).isFile())
    throw new Error('environmentFile must be a file.');
  return {
    configFile,
    repository,
    deployment,
    dataDirectory: resolve(dirname(configFile), value.dataDirectory),
    port,
    ...(environmentFile ? { environmentFile } : {}),
  };
}
