import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildConsoleVendor } from '../../../scripts/build-console-vendor.mjs';

export const consoleContentSecurityPolicy =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

const vendorBuilds = new Map<string, ReturnType<typeof buildConsoleVendor>>();

export function ensureConsoleVendor(root: string) {
  const directory = resolve(root);
  let built = vendorBuilds.get(directory);
  if (!built) {
    built = buildConsoleVendor(directory);
    vendorBuilds.set(directory, built);
  }
  return built;
}

const publicFiles: Record<string, string> = {
  'index.html': 'text/html; charset=utf-8',
  'style.css': 'text/css; charset=utf-8',
  'ocean.css': 'text/css; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'api.js': 'text/javascript; charset=utf-8',
  'launch-selection.js': 'text/javascript; charset=utf-8',
  'launch-controls.js': 'text/javascript; charset=utf-8',
  'coordination.js': 'text/javascript; charset=utf-8',
  'task-composer.js': 'text/javascript; charset=utf-8',
  'task-catalog.js': 'text/javascript; charset=utf-8',
  'clarification.js': 'text/javascript; charset=utf-8',
  'task-request.js': 'text/javascript; charset=utf-8',
  'run-update.js': 'text/javascript; charset=utf-8',
  'sensor-images.js': 'text/javascript; charset=utf-8',
  'storage-maintenance.js': 'text/javascript; charset=utf-8',
  'service-status.js': 'text/javascript; charset=utf-8',
  'session-audit.js': 'text/javascript; charset=utf-8',
  'report-history.js': 'text/javascript; charset=utf-8',
  'assignment-details.js': 'text/javascript; charset=utf-8',
  'verdict-details.js': 'text/javascript; charset=utf-8',
  'workspace-history.js': 'text/javascript; charset=utf-8',
  'logo.png': 'image/png',
};

export async function readConsoleAsset(root: string, pathname: string) {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  const legalFiles = {
    '/LICENSE': 'LICENSE',
    '/THIRD_PARTY_NOTICES.md': 'THIRD_PARTY_NOTICES.md',
  } as const;
  if (Object.hasOwn(legalFiles, pathname))
    return {
      bytes: await readFile(resolve(root, legalFiles[pathname as keyof typeof legalFiles])),
      contentType: 'text/plain; charset=utf-8',
    };
  if (Object.hasOwn(publicFiles, file))
    return {
      bytes: await readFile(resolve(root, 'apps/console/public', file)),
      contentType: publicFiles[file]!,
    };
  const vendor = {
    '/vendor/mermaid.mjs': ['bundle', 'text/javascript; charset=utf-8'],
    '/vendor/mermaid.mjs.LEGAL.txt': ['legalNotices', 'text/plain; charset=utf-8'],
    '/vendor/mermaid.manifest.json': ['manifest', 'application/json; charset=utf-8'],
  } as const;
  if (!Object.hasOwn(vendor, pathname)) return undefined;
  const [name, contentType] = vendor[pathname as keyof typeof vendor];
  const paths = await ensureConsoleVendor(root);
  return {
    bytes: await readFile(paths[name]),
    contentType,
  };
}
