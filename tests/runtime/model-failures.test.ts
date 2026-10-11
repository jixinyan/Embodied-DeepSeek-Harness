import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTEXT_WINDOW_EXCEEDED_CODE, QUOTA_EXCEEDED_CODE } from '@deepseek-ai/dsh-llm';
import {
  modelHttpFailureCode,
  modelHttpFailure,
  modelProviderFailureCode,
  modelRetryAfterMs,
} from '../../harness/agent-runtime/models/src/model-failures.js';
import { resolveRetryPolicy } from '../../harness/agent-runtime/models/src/dsh/llm/retry-policy.ts';

test('Model context overflow requires its exact structured code and HTTP status', () => {
  const overflow = { code: 'context_length_exceeded' };
  assert.equal(modelProviderFailureCode(overflow), CONTEXT_WINDOW_EXCEEDED_CODE);
  for (const status of [400, 413])
    assert.equal(modelHttpFailureCode(status, overflow), CONTEXT_WINDOW_EXCEEDED_CODE);
  for (const value of [undefined, null, {}, { message: 'context_length_exceeded' }]) {
    assert.equal(modelHttpFailureCode(400, value), 'HTTP_ERROR');
    assert.equal(modelHttpFailureCode(413, value), 'HTTP_ERROR');
  }
  assert.equal(modelHttpFailureCode(422, overflow), 'HTTP_ERROR');
});

test('Model authentication status retains authority over provider fields', () => {
  for (const status of [401, 403])
    for (const code of ['context_length_exceeded', 'insufficient_quota', 'server_error'])
      assert.equal(modelHttpFailureCode(status, { code }), 'AUTH');
});

for (const code of [
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
])
  test(`Model quota classification retains its terminal condition: ${code}`, () => {
    assert.equal(modelProviderFailureCode({ code }), QUOTA_EXCEEDED_CODE);
    assert.equal(modelHttpFailureCode(429, { code }), QUOTA_EXCEEDED_CODE);
    assert.equal(modelHttpFailureCode(400, { code }), 'HTTP_ERROR');
    const retry = resolveRetryPolicy(undefined, 'model failure admission');
    assert(retry.mode === 'normal');
    assert(!retry.retryableCodes.includes(QUOTA_EXCEEDED_CODE));
  });

test('Model transient failures retain native DSH retry classifications', () => {
  const retry = resolveRetryPolicy(undefined, 'model failure admission');
  assert(retry.mode === 'normal');
  for (const code of ['rate_limit_exceeded', 'slow_down']) {
    assert.equal(modelProviderFailureCode({ code }), 'RATE_LIMIT');
    assert.equal(modelHttpFailureCode(429, { code }), 'RATE_LIMIT');
  }
  assert.equal(modelProviderFailureCode({ type: 'insufficient_quota' }), QUOTA_EXCEEDED_CODE);
  assert.equal(modelProviderFailureCode({ type: 'rate_limit_error' }), 'RATE_LIMIT');
  assert.equal(modelProviderFailureCode({ type: 'service_unavailable_error' }), 'SERVER');
  for (const code of ['server_error', 'server_is_overloaded'])
    assert.equal(modelProviderFailureCode({ code }), 'SERVER');
  for (let status = 500; status <= 599; status++)
    assert.equal(modelHttpFailureCode(status, undefined), 'SERVER');
  assert.equal(modelHttpFailureCode(408, undefined), 'TIMEOUT');
  assert.equal(modelHttpFailureCode(429, undefined), 'RATE_LIMIT');
  for (const code of ['SERVER', 'TIMEOUT', 'RATE_LIMIT'])
    assert(retry.retryableCodes.includes(code));
});

test('Model failure classification preserves input and excludes provider prose', () => {
  const source = Object.freeze({ code: 'invalid_prompt', message: 'private input' });
  assert.equal(modelProviderFailureCode(source), 'PROVIDER_ERROR');
  assert.deepEqual(source, { code: 'invalid_prompt', message: 'private input' });
  for (const value of [undefined, null, [], 'context_length_exceeded', { code: 1 }, { type: [] }])
    assert.equal(modelProviderFailureCode(value), 'PROVIDER_ERROR');
});

test('Model HTTP failure status admission rejects successful and invalid values', () => {
  for (const status of [200, 302, 399, 600, 429.5, NaN, Infinity])
    assert.throws(() => modelHttpFailureCode(status, undefined), /status from 400 through 599/);
});

test('Model retry timing admits positive seconds and future HTTP dates', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  assert.equal(modelRetryAfterMs('2', now), 2000);
  assert.equal(modelRetryAfterMs('0.25', now), 250);
  assert.equal(modelRetryAfterMs('Sun, 11 Oct 2026 12:00:05 GMT', now), 5000);
  for (const value of [
    null,
    '',
    ' ',
    '0',
    '-1',
    '1e309',
    'invalid',
    'Sun, 11 Oct 2026 11:59:59 GMT',
  ])
    assert.equal(modelRetryAfterMs(value, now), undefined);
});

test('Model HTTP cancellation preserves its reason before inspecting response metadata', async () => {
  const reason = new Error('Admission cancelled by owner.');
  const signal = AbortSignal.abort(reason);
  await assert.rejects(
    modelHttpFailure(undefined as unknown as Response, 1024, signal),
    (error) => {
      assert.equal(error, reason);
      return true;
    },
  );
});

test('Model HTTP error limits reject before inspecting response metadata', async () => {
  for (const limit of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(
      modelHttpFailure(undefined as unknown as Response, limit, new AbortController().signal),
      /byte limit must be a positive safe integer/,
    );
});
