import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
const ignored = new Set([
  '.git',
  'node_modules',
  '.venv',
  '__pycache__',
  'dist',
  '.cache',
  '.runs',
  '.local',
]);
async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(p);
    else yield p;
  }
}
const dshImports = JSON.parse(await readFile('docs/provenance/dsh-imports.json', 'utf8'));
const dshOwners = new Map(dshImports.packages.map((pkg) => [pkg.name, `@edh/${pkg.owner}`]));
const manifests = new Map();
let linkCount = 0;
for await (const file of files('.')) {
  if (file.endsWith('package.json') && (file.startsWith('harness/') || file.startsWith('apps/'))) {
    const p = JSON.parse(await readFile(file, 'utf8'));
    assert(!manifests.has(p.name), `Duplicate workspace ${p.name}`);
    assert.equal(p.private, true, `Bootstrap packages must be private: ${file}`);
    manifests.set(p.name, { file, data: p });
    await access(path.join(path.dirname(file), 'README.md'));
    await access(path.join(path.dirname(file), 'src/index.ts'));
  }
  if (/\.(?:md|svg|ya?ml|json|ts|mjs|py)$/.test(file)) {
    const publicText = await readFile(file, 'utf8');
    assert(!/\p{Script=Han}/u.test(publicText), `Public content must be English: ${file}`);
  }
  if (!file.endsWith('.md')) continue;
  const text = await readFile(file, 'utf8');
  assert(!text.includes('```mermaid'), `Use SVG diagrams: ${file}`);
  assert(!/\/Users\//.test(text), `Personal absolute path in ${file}`);
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z]+:|#)/i.test(raw)) continue;
    const target = decodeURIComponent(raw.split('#')[0]);
    if (!target) continue;
    await access(path.resolve(path.dirname(file), target)).catch(() => {
      throw new Error(`Broken link in ${file}: ${target}`);
    });
    linkCount++;
  }
}
for (const { file, data } of manifests.values()) {
  for (const [name, version] of Object.entries(data.dependencies ?? {})) {
    if (version.startsWith('workspace:'))
      assert(manifests.has(name), `Missing workspace ${name} in ${file}`);
  }
  const sourceRoot = path.join(path.dirname(file), 'src');
  for await (const sourceFile of files(sourceRoot)) {
    if (!sourceFile.endsWith('.ts')) continue;
    for (const match of (await readFile(sourceFile, 'utf8')).matchAll(
      /from ['"](@deepseek-ai\/[^'"/]+)(?:\/[^'"]+)?['"]/g,
    )) {
      const dependency = dshOwners.get(match[1]);
      assert(dependency, `Unmapped DSH module ${match[1]} in ${sourceFile}`);
      assert(
        dependency === data.name || Object.hasOwn(data.dependencies ?? {}, dependency),
        `Undeclared DSH owner dependency ${dependency} in ${sourceFile}`,
      );
    }
    for (const match of (await readFile(sourceFile, 'utf8')).matchAll(
      /from ['"](@edh\/[^'"]+)['"]/g,
    )) {
      assert(
        Object.hasOwn(data.dependencies ?? {}, match[1]),
        `Undeclared dependency ${match[1]} in ${sourceFile}`,
      );
    }
  }
}
console.log(
  `Checked ${manifests.size} private source workspaces and ${linkCount} local documentation links.`,
);
