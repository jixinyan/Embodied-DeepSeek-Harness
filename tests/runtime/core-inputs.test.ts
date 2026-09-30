import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CORE_TOOL_PARAMETERS,
  CORE_TOOL_OPTIONAL_PARAMETERS,
  assertCoreInputLimits,
  assertObjectJsonSchema,
  validateJsonSchemaValue,
} from '@edh/tools';

test('every core tool input schema is accepted by native DSH', () => {
  for (const [name, properties] of Object.entries(CORE_TOOL_PARAMETERS)) {
    assert.doesNotThrow(
      () =>
        assertObjectJsonSchema({
          type: 'object',
          properties,
          required: Object.keys(properties).filter(
            (key) => !CORE_TOOL_OPTIONAL_PARAMETERS[name]?.includes(key),
          ),
          additionalProperties: false,
        }),
      name,
    );
  }
});

test('segmentation preserves native type checks and domain character limits', () => {
  const properties = CORE_TOOL_PARAMETERS['perception.segment_objects']!;
  const schema = {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
  assertObjectJsonSchema(schema);
  const args = {
    evidenceId: '3ed10d9f-5759-4556-bbdb-d73cad108be9',
    attachmentId: 'sha256:b46b25d0f6ddf6d9b9e6098c6e8504a834d5830400f2827fefd38ed210ee3202',
    textPrompt: 'cabinet',
  };
  assert.deepEqual(validateJsonSchemaValue(schema, args, 'arguments'), []);
  assertCoreInputLimits(args);
  for (const [key, maximum] of [
    ['evidenceId', 128],
    ['attachmentId', 128],
    ['textPrompt', 1024],
  ] as const) {
    assertCoreInputLimits({ ...args, [key]: 'x'.repeat(maximum) });
    assert.throws(() => assertCoreInputLimits({ ...args, [key]: '' }), /Invalid length/);
    assert.throws(
      () => assertCoreInputLimits({ ...args, [key]: 'x'.repeat(maximum + 1) }),
      /Invalid length/,
    );
    assert.notDeepEqual(validateJsonSchemaValue(schema, { ...args, [key]: 1 }, 'arguments'), []);
  }
});
