import assert from 'node:assert/strict';
import test from 'node:test';
import { parseModelConfiguration, readModelConfiguration } from '@edh/models';

const responses = await readModelConfiguration('examples/models/gpt6-astra.yaml');
const chat = await readModelConfiguration('examples/models/local-vllm.yaml');

test('Responses protocol admits native request defaults', () => {
  assert.deepEqual(parseModelConfiguration(responses), responses);
});

for (const [field, value] of [
  ['systemRole', 'developer'],
  ['maxTokensField', 'max_completion_tokens'],
  ['passReasoningContent', true],
  ['strictTools', true],
  ['toolChoice', 'required'],
  ['extraBody', { chat_template_kwargs: { enable_thinking: false } }],
] as const)
  test(`Model request options admit the configured protocol: ${field}`, () => {
    const invalid = structuredClone(responses);
    Object.assign(invalid.endpoints.openai!, { [field]: value });
    assert.throws(
      () => parseModelConfiguration(invalid),
      /Chat Completions request options require a Chat Completions endpoint/,
    );
    const admitted = structuredClone(chat);
    Object.assign(admitted.endpoints.local!, { [field]: value });
    const parsed = parseModelConfiguration(admitted);
    assert.deepEqual(parsed.endpoints.local![field], value);
  });

test('Published cloud and local model configurations retain their selected protocol', async () => {
  for (const [file, protocol, hosting] of [
    ['cloud-api.yaml', 'chat_completions', 'cloud_api'],
    ['local-vllm.yaml', 'chat_completions', 'vllm'],
    ['qwen38-vllm.yaml', 'chat_completions', 'vllm'],
    ['gpt6-astra.yaml', 'responses', 'cloud_api'],
  ]) {
    const configuration = await readModelConfiguration(`examples/models/${file}`);
    const model = configuration.models[configuration.defaultModel]!;
    const endpoint = configuration.endpoints[model.endpoint]!;
    assert.equal(endpoint.protocol, protocol);
    assert.equal(endpoint.hosting, hosting);
    assert(model.inputModalities.includes('image'));
  }
});
