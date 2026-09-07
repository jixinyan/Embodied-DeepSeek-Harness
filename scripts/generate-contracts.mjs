import { readFile, writeFile } from 'node:fs/promises';
import { compile } from 'json-schema-to-typescript';
const source = 'harness/contracts/schema/physical.schema.json';
const target = 'harness/contracts/src/generated.ts';
const schema = JSON.parse(await readFile(source, 'utf8'));
// The generator flattens conditional allOf clauses to unknown index signatures.
// Project common static fields only; the unchanged source schema enforces every
// if/then/else condition at runtime in both languages.
function staticProjection(value) {
  if (Array.isArray(value)) return value.map(staticProjection);
  if (value === null || typeof value !== 'object') return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'allOf') {
      const unconditional = child.filter((clause) => !Object.hasOwn(clause, 'if'));
      if (unconditional.length) result[key] = staticProjection(unconditional);
    } else if (!['if', 'then', 'else'].includes(key)) result[key] = staticProjection(child);
  }
  return result;
}
const declarations = await compile(staticProjection(schema), 'PhysicalContract', {
  bannerComment: '/* Generated from harness/contracts/schema/physical.schema.json. Do not edit. */',
  unreachableDefinitions: true,
  additionalProperties: false,
  unknownAny: true,
});
const generated =
  declarations +
  '\nexport interface ContractTypes {\n' +
  Object.keys(schema.$defs)
    .map((name) => `  ${name}: ${name};`)
    .join('\n') +
  '\n}\n';
if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8');
  if (current !== generated)
    throw new Error('Generated contracts are stale; run pnpm generate:contracts');
  console.log('Generated TypeScript matches the authoritative schema.');
} else {
  await writeFile(target, generated);
  console.log(`Generated ${target}`);
}
