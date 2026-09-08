import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { BoundaryValidator, type BoundaryExtensions } from '@edh/contracts';

const root = new URL('../../', import.meta.url);
const source = JSON.parse(
  await readFile(new URL('harness/contracts/schema/physical.schema.json', root), 'utf8'),
);
const fixtures = JSON.parse(
  await readFile(new URL('tests/contracts/boundary-cases.json', root), 'utf8'),
);
const shared = new BoundaryValidator(source, fixtures.extensions);
type Method = 'message' | 'definition' | 'call' | 'result' | 'operation' | 'replay';
for (const scenario of fixtures.cases) {
  test(`boundary: ${scenario.name}`, () => {
    const input = structuredClone(fixtures.bases[scenario.base]);
    for (const change of scenario.patches) {
      const keys = change.path
        .slice(1)
        .split('/')
        .map((x: string) => x.replaceAll('~1', '/').replaceAll('~0', '~'));
      const last = keys.pop()!;
      let parent = input;
      for (const key of keys) parent = parent[key];
      parent[last] = structuredClone(change.value);
    }
    const before = structuredClone(input);
    const invoke = () =>
      input.method === 'construct'
        ? new BoundaryValidator(source, input.extensions)
        : (shared[input.method as Method] as (...args: unknown[]) => unknown).apply(
            shared,
            input.args,
          );
    if (scenario.throws) assert.throws(invoke);
    else {
      const result = invoke();
      if (input.method !== 'construct' && input.method !== 'definition') {
        if (scenario.error === null) assert.deepEqual(result, []);
        else
          assert(Array.isArray(result) && result.includes(scenario.error), JSON.stringify(result));
      }
    }
    assert.deepEqual(input, before, 'Boundary validation must not mutate input.');
  });
}
test('boundary: registrations are isolated from later caller mutation', () => {
  const extensions = structuredClone(fixtures.extensions) as BoundaryExtensions;
  const schema = structuredClone(source);
  const validator = new BoundaryValidator(schema, extensions);
  schema['x-edh-message-types']['tool.invoke'].version = 'changed';
  (extensions.messages![0] as { version: string }).version = 'changed';
  assert.deepEqual(validator.message(fixtures.bases.message.args[0]), []);
  assert.deepEqual(validator.message(fixtures.bases.custom_message.args[0]), []);
});
