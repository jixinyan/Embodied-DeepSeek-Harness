import { readFile, writeFile } from 'node:fs/promises';
import { compile } from 'json-schema-to-typescript';
const source = 'packages/contracts/schema/physical.schema.json';
const target = 'packages/contracts/src/generated.ts';
const schema = JSON.parse(await readFile(source, 'utf8'));
const generated = await compile(schema, 'PhysicalContract', {
  bannerComment:
    '/* Generated from packages/contracts/schema/physical.schema.json. Do not edit. */',
  unreachableDefinitions: true,
  additionalProperties: false,
  unknownAny: true,
});
if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8');
  if (current !== generated)
    throw new Error('Generated contracts are stale; run pnpm generate:contracts');
  console.log('Generated TypeScript matches the authoritative schema.');
} else {
  await writeFile(target, generated);
  console.log(`Generated ${target}`);
}
