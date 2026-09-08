import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { startDemoServer } from './http-server.js';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const port = Number(process.env.EDH_PORT ?? 4317);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('EDH_PORT must be a valid port.');
const server = await startDemoServer({
  root,
  dataDirectory: resolve(process.env.EDH_DATA_DIR ?? resolve(root, '.runs/console-demo')),
  port,
  ...(process.env.EDH_TEAM_FILE ? { teamFile: resolve(process.env.EDH_TEAM_FILE) } : {}),
});
console.log(
  `Embodied DeepSeek Harness: ${server.url}\nSource: CPU test fixture; no live model, simulator or robot is connected.\nRuntime data: ${server.store.directory}`,
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void server.close().then(
      () => process.exit(0),
      (error) => {
        console.error(error);
        process.exit(1);
      },
    );
  });
