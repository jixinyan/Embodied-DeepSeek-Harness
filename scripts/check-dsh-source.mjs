import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const imported = JSON.parse(await readFile('docs/provenance/dsh-imports.json', 'utf8'));
const locked = JSON.parse(await readFile('docs/provenance/dsh-source-lock.json', 'utf8'));
assert.equal(imported.commit, locked.commit);
const files = new Set(imported.files.map((file) => file.destination));
assert.equal(files.size, imported.files.length, 'Duplicate import destinations');
const used = new Set();
for (const file of imported.files) {
  const contents = await readFile(file.destination);
  const digest = createHash('sha256').update(contents).digest('hex');
  assert.equal(digest, file.local_sha256, `Unrecorded source change: ${file.destination}`);
  if (file.source_sha256 !== digest)
    assert(file.modifications.length > 0, 'Missing patch explanation');
  const imports = ts.preProcessFile(contents.toString(), true, true).importedFiles;
  for (const { fileName: specifier } of imports) {
    if (specifier.startsWith('node:')) continue;
    let resolved;
    if (specifier.startsWith('.')) {
      resolved = path.normalize(path.join(path.dirname(file.destination), specifier));
    } else if (specifier.startsWith('@deepseek-ai/')) {
      const base = specifier.split('/').slice(0, 2).join('/');
      used.add(base);
      const target = imported.aliases[base]?.[0];
      assert(target, `Unmapped DSH source import: ${specifier}`);
      const subpath = specifier.slice(base.length + 1);
      resolved = subpath ? path.join(path.dirname(target), `${subpath}.ts`) : target;
    } else {
      assert(
        imported.external_imports.includes(specifier),
        `Unaudited external import ${specifier}`,
      );
      continue;
    }
    assert(
      files.has(resolved),
      `Import escaped the recorded closure: ${file.destination} -> ${resolved}`,
    );
  }
}
const runtime = JSON.parse(await readFile('tsconfig.runtime.json', 'utf8'));
for (const [name, locations] of Object.entries(imported.aliases)) {
  assert.deepEqual(runtime.compilerOptions.paths[name], locations, `Runtime alias drift: ${name}`);
}
for (const license of ['DSH', 'CORDIS', 'COSMOKIT', 'SCHEMASTERY']) {
  await access(`licenses/${license}-MIT.txt`);
}
console.log(
  `Verified ${files.size} pinned DSH source files, ${used.size} module bindings and source closure.`,
);
