import assert from 'node:assert/strict';
import { test } from 'node:test';
import z from '@deepseek-ai/schemastery';
import { redactSecrets } from '../../harness/agent-runtime/foundation/src/dsh/settings/redact.ts';

test('redacts nested secrets declared by real union, intersection and transform schemas', () => {
  const credential = z.object({
    token: z.string().role('secret'),
    endpoint: z.string(),
  });
  const schema = z.object({
    provider: z.union([credential, z.object({ endpoint: z.string() })]),
    fallback: z.intersect([credential, z.object({ label: z.string() })]),
    active: z.transform(credential, (value) => value),
  });
  const input = Object.freeze({
    provider: Object.freeze({ token: 'provider-value', endpoint: 'provider.example' }),
    fallback: Object.freeze({ token: 'fallback-value', endpoint: 'fallback.example', label: 'backup' }),
    active: Object.freeze({ token: 'active-value', endpoint: 'active.example' }),
  });

  const output = redactSecrets(schema as z<never>, input);
  assert.deepEqual(output.value, {
    provider: { endpoint: 'provider.example' },
    fallback: { endpoint: 'fallback.example', label: 'backup' },
    active: { endpoint: 'active.example' },
  });
  assert.deepEqual(output.secrets, [
    { path: ['provider', 'token'], set: true },
    { path: ['fallback', 'token'], set: true },
    { path: ['active', 'token'], set: true },
  ]);
  assert.equal(input.provider.token, 'provider-value');
  assert.equal(input.fallback.token, 'fallback-value');
  assert.equal(input.active.token, 'active-value');
});

test('merges a repeated secret path and retains its set state', () => {
  const schema = z.union([
    z.object({ token: z.string().role('secret') }),
    z.object({ token: z.string().role('secret') }),
  ]);
  assert.deepEqual(redactSecrets(schema as z<never>, { token: 'value' }), {
    value: {},
    secrets: [{ path: ['token'], set: true }],
  });
});
