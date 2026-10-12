import assert from 'node:assert/strict';
import test from 'node:test';
import { parseModelConfiguration, readModelConfiguration } from '@edh/models';
import { OpenAICompatibleAdapter } from '../../harness/agent-runtime/models/src/openai-compatible.ts';
import { OpenAIResponsesAdapter } from '../../harness/agent-runtime/models/src/openai-responses.ts';
import { createDshHost } from '../../apps/server/src/runtime.ts';

const source = await readModelConfiguration('examples/models/local-vllm.yaml');
const configure = (policy: unknown) => {
  const input = structuredClone(source);
  Object.assign(input.endpoints.local!, { retryPolicy: policy });
  return parseModelConfiguration(input);
};

test('Native retry configuration retains bounded defaults and immutable route registration', async () => {
  for (const Adapter of [OpenAICompatibleAdapter, OpenAIResponsesAdapter]) {
    const adapter = new Adapter({ baseURL: 'http://127.0.0.1:1/v1', models: [] });
    const host = await createDshHost([{ providers: ['local'], adapter }]);
    try {
      const policy = host.llm.providerRetryPolicy('local');
      assert(policy.mode === 'normal');
      assert.equal(policy.maxRetries, 5);
      assert.equal(policy.initialDelayMs, 500);
      assert.equal(policy.maxDelayMs, 10_000);
      assert.equal(policy.jitterRatio, 0.1);
      assert.deepEqual(policy.retryableCodes, [
        'EMPTY_RESPONSE',
        'RATE_LIMIT',
        'SERVER',
        'TIMEOUT',
        'TRANSPORT',
      ]);
      assert(Object.isFrozen(policy) && Object.isFrozen(policy.retryableCodes));
      assert.equal(host.agents.list().length, 0);
    } finally {
      await host.fiber.dispose();
    }
  }
});

test('Endpoint retry policy detaches authored configuration before route capture', () => {
  const policy = {
    mode: 'normal' as const,
    maxRetries: 2,
    retryableCodes: ['TRANSPORT'],
    backoff: { initialDelayMs: 20, maxDelayMs: 80 },
  };
  const configuration = configure(policy);
  const selected = configuration.endpoints.local!.retryPolicy!;
  const adapter = new OpenAICompatibleAdapter({
    baseURL: 'http://127.0.0.1:1/v1',
    models: [],
    retryPolicy: selected,
  });
  policy.maxRetries = 8;
  policy.retryableCodes.push('AUTH');
  policy.backoff.initialDelayMs = 40;
  assert.deepEqual(selected, {
    mode: 'normal',
    maxRetries: 2,
    retryableCodes: ['TRANSPORT'],
    backoff: { initialDelayMs: 20, maxDelayMs: 80 },
  });
  if (selected.mode !== 'normal') throw new Error('Expected normal policy.');
  selected.retryableCodes!.push('QUOTA');
  assert.deepEqual(adapter.providerRetryPolicy(), {
    mode: 'normal',
    maxRetries: 2,
    retryableCodes: ['TRANSPORT'],
    initialDelayMs: 20,
    maxDelayMs: 80,
    jitterRatio: 0.1,
  });
});

test('Normal policy admits disabling retries and always mode retains native layered configuration', () => {
  assert.deepEqual(configure({ mode: 'normal', maxRetries: 0 }).endpoints.local!.retryPolicy, {
    mode: 'normal',
    maxRetries: 0,
  });
  const policy = configure({ mode: 'always', maxRetries: 0, retryableCodes: ['TRANSPORT'] })
    .endpoints.local!.retryPolicy!;
  const adapter = new OpenAIResponsesAdapter({
    baseURL: 'http://127.0.0.1:1/v1',
    models: [],
    retryPolicy: policy,
  });
  assert.deepEqual(adapter.providerRetryPolicy(), {
    mode: 'always',
    initialDelayMs: 500,
    maxDelayMs: 10_000,
    jitterRatio: 0.1,
  });
});

for (const [name, policy] of [
  ['unknown mode', { mode: 'invalid' }],
  ['unknown field', { mode: 'normal', attempts: 2 }],
  ['fractional count', { mode: 'normal', maxRetries: 1.5 }],
  ['negative count', { mode: 'normal', maxRetries: -1 }],
  ['duplicate codes', { mode: 'normal', retryableCodes: ['TRANSPORT', 'TRANSPORT'] }],
  ['empty codes', { mode: 'normal', retryableCodes: [] }],
  ['empty code', { mode: 'normal', retryableCodes: [''] }],
  ['zero delay', { mode: 'normal', backoff: { initialDelayMs: 0 } }],
  ['reversed delay bounds', { mode: 'normal', backoff: { initialDelayMs: 100, maxDelayMs: 50 } }],
  ['nonfinite delay', { mode: 'normal', backoff: { maxDelayMs: Infinity } }],
  ['excessive jitter', { mode: 'always', backoff: { jitterRatio: 1.1 } }],
  ['unknown backoff field', { mode: 'always', backoff: { seconds: 1 } }],
])
  test(`Endpoint reading rejects native retry configuration: ${name}`, () => {
    assert.throws(() => configure(policy));
  });
