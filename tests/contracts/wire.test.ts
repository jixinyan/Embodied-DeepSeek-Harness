import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { ContractValidator, type ContractName } from '@edh/contracts';

const root = new URL('../../', import.meta.url);
const schema = JSON.parse(
  await readFile(new URL('harness/contracts/schema/physical.schema.json', root), 'utf8'),
);
const fixtures = JSON.parse(
  await readFile(new URL('tests/contracts/wire-cases.json', root), 'utf8'),
);
const validator = new ContractValidator(schema);

interface Patch {
  op: 'remove' | 'replace';
  path: string;
  value?: unknown;
}
function patch(value: unknown, changes: Patch[]): unknown {
  const copy = structuredClone(value);
  for (const change of changes) {
    const keys = change.path
      .slice(1)
      .split('/')
      .map((key) => key.replaceAll('~1', '/').replaceAll('~0', '~'));
    const key = keys.pop()!;
    let parent = copy as Record<string, unknown>;
    for (const part of keys) parent = parent[part] as Record<string, unknown>;
    if (change.op === 'remove') {
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete parent[key];
    } else parent[key] = change.value;
  }
  return copy;
}
for (const scenario of fixtures.cases) {
  test(`wire: ${scenario.name}`, () => {
    const base = fixtures.bases[scenario.base];
    const value = patch(base.value, scenario.patches);
    const before = structuredClone(value);
    const issues = validator.issues(base.contract as ContractName, value);
    assert.equal(issues.length === 0, scenario.valid, JSON.stringify(issues));
    assert.deepEqual(value, before, 'Validation must not mutate input.');
  });
}
test('wire: reject values that cannot cross a JSON transport', () => {
  const base = structuredClone(fixtures.bases.message.value);
  for (const value of [NaN, Infinity, undefined, () => 1, new Date()]) {
    base.payload = { value };
    assert(validator.issues('MessageEnvelope', base).length > 0);
  }
  base.payload = base;
  assert(validator.issues('MessageEnvelope', base).length > 0);
  assert.throws(() => validator.parse('UnknownContract' as ContractName, {}), /Unknown contract/);
});
