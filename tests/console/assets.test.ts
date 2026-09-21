import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  readConsoleAsset,
  consoleContentSecurityPolicy,
} from '../../apps/server/src/console-assets.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('console assets and the installed Mermaid module load with correct MIME types', async () => {
  for (const [path, type] of [
    ['/', 'text/html'],
    ['/app.js', 'text/javascript'],
    ['/api.js', 'text/javascript'],
    ['/launch-selection.js', 'text/javascript'],
    ['/launch-controls.js', 'text/javascript'],
    ['/coordination.js', 'text/javascript'],
    ['/task-composer.js', 'text/javascript'],
    ['/clarification.js', 'text/javascript'],
    ['/task-request.js', 'text/javascript'],
    ['/run-update.js', 'text/javascript'],
    ['/sensor-images.js', 'text/javascript'],
    ['/storage-maintenance.js', 'text/javascript'],
    ['/ocean.css', 'text/css'],
    ['/logo.png', 'image/png'],
    ['/vendor/mermaid/mermaid.esm.min.mjs', 'text/javascript'],
  ]) {
    const asset = await readConsoleAsset(root, path!);
    assert.ok(asset);
    assert.ok(asset.contentType.startsWith(type!));
    assert.ok(asset.bytes.length > 0);
  }
});

test('static routes expose only public assets and Mermaid ESM files', async () => {
  for (const path of [
    '/package.json',
    '/../package.json',
    '/.env',
    '/vendor/mermaid/../../../package.json',
    '/vendor/mermaid/../../other.mjs',
    '/vendor/mermaid/config.type.d.ts',
    '/vendor/mermaid/mermaid.esm.min.mjs.map',
    '/vendor/mermaid/%2e%2e/other.mjs',
    '/vendor/mermaid//etc/other.mjs',
  ])
    assert.equal(await readConsoleAsset(root, path), undefined, path);
  assert.ok(consoleContentSecurityPolicy.includes("script-src 'self';"));
  assert.ok(consoleContentSecurityPolicy.includes("object-src 'none'"));
});
