import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Preserve the three upstream foundation libraries' own compiler boundaries.
const imported = JSON.parse(await readFile('docs/provenance/dsh-imports.json', 'utf8'));
const output = path.resolve('.cache/dsh-types');
await mkdir(output, { recursive: true });
await writeFile(`${output}/package.json`, JSON.stringify({ type: 'module' }) + '\n');
const libraries = ['cosmokit', 'cordis', 'schemastery'];
for (const name of libraries) {
  const source = path.resolve(`harness/agent-runtime/foundation/src/dsh/${name}`);
  const aliases = Object.fromEntries(
    libraries.map((library) => [
      `@deepseek-ai/${library}`,
      [library === name ? `${source}/index.ts` : `${output}/${library}/index.d.ts`],
    ]),
  );
  const config = {
    compilerOptions: {
      target: 'ES2024',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      noImplicitAny: name !== 'cordis',
      noImplicitThis: name !== 'cordis',
      strictFunctionTypes: name !== 'cordis',
      declaration: true,
      emitDeclarationOnly: true,
      allowImportingTsExtensions: true,
      skipLibCheck: false,
      rootDir: source,
      outDir: `${output}/${name}`,
      paths: aliases,
    },
    files: imported.files
      .filter((file) => file.destination.startsWith(`${path.relative('.', source)}/`))
      .map((file) => path.resolve(file.destination)),
  };
  const configPath = `${output}/${name}.json`;
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  const checked = spawnSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-p', configPath],
    { stdio: 'inherit' },
  );
  if (checked.status !== 0) process.exit(checked.status ?? 1);
}
console.log('Checked and generated declarations for the three pinned DSH foundation libraries.');
