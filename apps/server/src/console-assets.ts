import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export const consoleContentSecurityPolicy =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

const publicFiles: Record<string, string> = {
  'index.html': 'text/html; charset=utf-8',
  'style.css': 'text/css; charset=utf-8',
  'ocean.css': 'text/css; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'launch-selection.js': 'text/javascript; charset=utf-8',
  'launch-controls.js': 'text/javascript; charset=utf-8',
  'coordination.js': 'text/javascript; charset=utf-8',
  'task-composer.js': 'text/javascript; charset=utf-8',
  'task-request.js': 'text/javascript; charset=utf-8',
  'run-update.js': 'text/javascript; charset=utf-8',
  'logo.png': 'image/png',
};

export async function readConsoleAsset(root: string, pathname: string) {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (Object.hasOwn(publicFiles, file))
    return {
      bytes: await readFile(resolve(root, 'apps/console/public', file)),
      contentType: publicFiles[file]!,
    };
  const prefix = '/vendor/mermaid/';
  if (!pathname.startsWith(prefix)) return undefined;
  const name = pathname.slice(prefix.length);
  if (
    !/^[A-Za-z0-9_-][A-Za-z0-9_./-]*\.mjs$/.test(name) ||
    name.split('/').some((part) => part === '..' || part === '.' || !part)
  )
    return undefined;
  const directory = await realpath(resolve(root, 'apps/console/node_modules/mermaid/dist'));
  const target = await realpath(resolve(directory, name));
  const path = relative(directory, target);
  if (path.startsWith('..') || isAbsolute(path)) return undefined;
  return {
    bytes: await readFile(target),
    contentType: 'text/javascript; charset=utf-8',
  };
}
