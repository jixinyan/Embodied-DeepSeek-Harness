import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readLaunchConfig } from './config.mjs';

let server;
let stopping = false;
let closing;
const send = (value) => {
  if (process.connected) process.send(value);
  else if (value.type === 'ready') console.log(`EDH console: ${value.url}`);
};
async function close() {
  if (closing) return closing;
  stopping = true;
  send({ type: 'stopping' });
  if (!server) return;
  closing = (async () => {
    await server.close();
    send({ type: 'closed' });
    if (process.connected) process.disconnect();
  })();
  return closing;
}
function fail(error) {
  send({ type: 'failure', message: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
  if (process.connected) process.disconnect();
}
process.on('message', (message) => {
  if (message?.type !== 'stop') throw new Error('Unknown launcher service command.');
  void close().catch(fail);
});
process.once('disconnect', () => void close().catch(fail));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void close().catch(fail));

try {
  const config = await readLaunchConfig(process.argv[2]);
  process.chdir(config.repository);
  if (config.environmentFile) loadEnvFile(config.environmentFile);
  const require = createRequire(resolve(config.repository, 'package.json'));
  const { register } = await import(pathToFileURL(require.resolve('tsx/esm/api')).href);
  register({ tsconfig: resolve(config.repository, 'tsconfig.runtime.json') });
  if (stopping) {
    send({ type: 'closed' });
    if (process.connected) process.disconnect();
  } else {
    const deployment = await import(pathToFileURL(config.deployment).href);
    if (typeof deployment.default !== 'function')
      throw new Error('Deployment module must default-export a deployment factory.');
    const { startServer } = await import(
      pathToFileURL(resolve(config.repository, 'apps/server/src/index.ts')).href
    );
    if (!stopping) {
      server = await startServer({
        root: config.repository,
        dataDirectory: config.dataDirectory,
        port: config.port,
        deployment: deployment.default,
      });
      if (!stopping) send({ type: 'ready', url: server.url });
    }
    if (stopping) {
      if (server) await close();
      else {
        send({ type: 'closed' });
        if (process.connected) process.disconnect();
      }
    }
  }
} catch (error) {
  fail(error);
}
