import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function buildConsoleVendor(root) {
  const directory = resolve(root, '.cache/console-vendor');
  const bundle = resolve(directory, 'mermaid.mjs');
  const legalNotices = `${bundle}.LEGAL.txt`;
  const manifest = resolve(directory, 'manifest.json');
  await mkdir(directory, { recursive: true });
  const result = await build({
    absWorkingDir: root,
    entryPoints: [resolve(root, 'apps/console/src/mermaid-vendor.js')],
    outfile: bundle,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    splitting: false,
    minify: true,
    metafile: true,
    legalComments: 'external',
    logLevel: 'warning',
    write: false,
  });
  const inputs = Object.keys(result.metafile.inputs).sort();
  const elkInputs = inputs.filter((path) => path.replaceAll('\\', '/').includes('/elkjs@'));
  if (
    !elkInputs.length ||
    elkInputs.some((path) => !path.replaceAll('\\', '/').includes('/elkjs@0.12.0/'))
  )
    throw new Error('Console Mermaid bundle must use only elkjs 0.12.0.');
  const inputManifest = await Promise.all(
    inputs.map(async (path) => ({
      path: path.replaceAll('\\', '/'),
      sha256: sha256(await readFile(resolve(root, path))),
    })),
  );
  const outputs = result.outputFiles ?? [];
  if (
    outputs.some((file) => {
      const inside = relative(directory, file.path);
      return inside.startsWith('..') || isAbsolute(inside);
    })
  )
    throw new Error('Invalid console vendor output path.');
  const bundled = outputs.find((file) => file.path === bundle);
  const legal = outputs.find((file) => file.path === legalNotices);
  if (!bundled || !legal || outputs.length !== 2)
    throw new Error('Mermaid build produced unexpected browser assets.');
  const fromMermaid = createRequire(
    await realpath(resolve(root, 'apps/console/node_modules/mermaid/package.json')),
  );
  const elkPackagePath = fromMermaid.resolve('elkjs/package.json');
  const elkPackage = JSON.parse(await readFile(elkPackagePath, 'utf8'));
  if (elkPackage.version !== '0.12.0' || elkPackage.license !== 'EPL-2.0 OR GPL-3.0-or-later')
    throw new Error('Installed elkjs license or version does not match the console build.');
  const elkSource = await readFile(fromMermaid.resolve('elkjs/lib/elk-api.js'), 'utf8');
  if (!elkSource.includes('SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later'))
    throw new Error('Installed elkjs source omits the secondary license notice.');
  const elkLicense = await readFile(resolve(elkPackagePath, '../LICENSE.md'), 'utf8');
  const bundleBytes = bundled.contents;
  const noticeBytes = Buffer.from(
    `${legal.text}\n\nelkjs 0.12.0 — EPL-2.0 OR GPL-3.0-or-later\n${elkLicense}`,
  );
  await Promise.all([writeFile(bundle, bundleBytes), writeFile(legalNotices, noticeBytes)]);
  await writeFile(
    manifest,
    JSON.stringify(
      {
        builder: `esbuild@${esbuildVersion}`,
        entry: 'apps/console/src/mermaid-vendor.js',
        bundle: { path: 'mermaid.mjs', sha256: sha256(bundleBytes) },
        legalNotices: { path: 'mermaid.mjs.LEGAL.txt', sha256: sha256(noticeBytes) },
        inputs: inputManifest,
        metafile: result.metafile,
      },
      null,
      2,
    ) + '\n',
  );
  return { bundle, legalNotices, manifest };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  await buildConsoleVendor(resolve(fileURLToPath(new URL('..', import.meta.url))));
