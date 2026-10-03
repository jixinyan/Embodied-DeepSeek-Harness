import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { createContext, runInContext } from 'node:vm';
import { build } from 'esbuild';

const args = parseArgs({ options: { jsc: { type: 'string' } } }).values;
if (!args.jsc) throw new Error('Provide the actual JavaScriptCore executable with --jsc.');
await mkdir('.local/work', { recursive: true });
const directory = await mkdtemp(resolve('.local/work/dsh-json-portability-'));
const bundle = resolve(directory, 'values.js');
await build({
  entryPoints: ['harness/agent-runtime/foundation/src/dsh/values/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'Values',
  outfile: bundle,
});
const context = createContext({});
runInContext(await readFile(bundle, 'utf8'), context);
const actualManifest = await readFile('docs/provenance/dsh-imports.json', 'utf8');
context.document = JSON.parse(actualManifest);
context.source = actualManifest;
assert.equal(runInContext('Values.isJsonValue(document)', context), true);
assert.equal(runInContext('Values.isJsonValue(JSON.parse(source))', context), true);
assert.equal(
  runInContext('JSON.stringify(Values.snapshotJsonValue(document))', context),
  JSON.stringify(JSON.parse(actualManifest)),
);
assert.equal(runInContext('Values.isJsonValue(new Date())', context), false);
assert.equal(
  runInContext(
    'class ManifestEnvelope { constructor() { this.document = document } }; Values.isJsonValue(new ManifestEnvelope())',
    context,
  ),
  false,
);
assert.equal(
  runInContext(
    'class ManifestArray extends Array {}; Values.isJsonValue(new ManifestArray(...document.files))',
    context,
  ),
  false,
);
const jsc = await promisify(execFile)(resolve(args.jsc), [
  'scripts/check-dsh-json-portability.js',
  '--',
  bundle,
  resolve('docs/provenance/dsh-imports.json'),
]);
const acceptance = {
  directory,
  node: { engine: process.versions.v8, crossRealm: true, customPrototypesRejected: true },
  javaScriptCore: JSON.parse(jsc.stdout),
};
await writeFile(resolve(directory, 'acceptance.json'), JSON.stringify(acceptance, null, 2));
process.stdout.write(`${JSON.stringify(acceptance)}\n`);
