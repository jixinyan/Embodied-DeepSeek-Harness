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
const commitId = /^[0-9a-f]{40}$/;
const adaptedDestinations = new Set();
for (const adaptation of imported.release_adaptations ?? []) {
  assert.equal(adaptation.tag, 'dsh-v0.1.7-rc.1', 'Unexpected DSH release tag');
  assert.equal(
    adaptation.release_commit,
    '46a7f68b0922371ce7144b668b90e377d8e799f4',
    'Unexpected DSH release commit',
  );
  assert(commitId.test(adaptation.release_commit), 'Invalid DSH release commit');
  assert(Array.isArray(adaptation.upstream_commits) && adaptation.upstream_commits.length > 0);
  assert.equal(new Set(adaptation.upstream_commits).size, adaptation.upstream_commits.length);
  for (const commit of adaptation.upstream_commits) {
    assert(commitId.test(commit), `Invalid upstream commit: ${commit}`);
  }
  assert(Array.isArray(adaptation.destinations) && adaptation.destinations.length > 0);
  assert.equal(typeof adaptation.patch, 'string');
  assert(adaptation.patch.trim().length > 0, 'Missing release patch explanation');
  for (const destination of adaptation.destinations) {
    assert(files.has(destination), `Unrecorded release destination: ${destination}`);
    assert(!adaptedDestinations.has(destination), `Duplicate release destination: ${destination}`);
    adaptedDestinations.add(destination);
    const file = imported.files.find((item) => item.destination === destination);
    assert.notEqual(
      file.source_sha256,
      file.local_sha256,
      `Unmodified release destination: ${destination}`,
    );
    assert(file.modifications.length > 0, `Missing patch explanation: ${destination}`);
  }
}
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
for (const asset of imported.runtime_assets ?? []) {
  assert.equal(
    path.normalize(path.join(path.dirname(asset.requester), asset.relative_path)),
    asset.destination,
    'Runtime metadata path drift',
  );
  await access(asset.destination);
}
