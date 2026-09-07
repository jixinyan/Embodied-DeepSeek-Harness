import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  ContractValidator,
  LifecycleValidator,
  type ExecutionStatus,
  type RecoveryRecord,
  type SubgoalRequest,
  type VerificationContext,
  type VerificationResult,
} from '@edh/contracts';

const root = new URL('../../', import.meta.url);
const validator = new LifecycleValidator(
  new ContractValidator(
    JSON.parse(
      await readFile(new URL('harness/contracts/schema/physical.schema.json', root), 'utf8'),
    ),
  ),
);
const fixtures = JSON.parse(
  await readFile(new URL('tests/contracts/lifecycle-cases.json', root), 'utf8'),
);
for (const scenario of fixtures.cases) {
  test(`lifecycle: ${scenario.name}`, () => {
    const input = structuredClone(fixtures.bases[scenario.base]);
    for (const change of scenario.patches) {
      const keys = change.path.slice(1).split('/');
      const last = keys.pop()!;
      let parent = input;
      for (const key of keys) parent = parent[key];
      parent[last] = structuredClone(change.value);
    }
    const before = structuredClone(input);
    const args: unknown[] = input.args;
    let result: boolean | string[];
    switch (input.operation) {
      case 'execution':
        result = validator.execution(
          args[0] as SubgoalRequest,
          args[1] as ExecutionStatus,
          args[2] as ExecutionStatus,
          args[3] as string | undefined,
        );
        break;
      case 'verification':
        result = validator.verification(
          args[0] as VerificationResult,
          args[1] as VerificationResult,
        );
        break;
      case 'verdict':
        result = validator.verdict(args[0] as VerificationResult, args[1] as VerificationContext);
        break;
      case 'recovery':
        result = validator.recovery(
          args[0] as RecoveryRecord,
          args[1] as RecoveryRecord,
          args[2] as VerificationResult | undefined,
        );
        break;
      case 'requiresVerification':
        result = validator.requiresVerification(args[0] as ExecutionStatus);
        break;
      default:
        throw new Error(`Unknown operation ${input.operation}`);
    }
    if ('expected' in scenario) assert.equal(result, scenario.expected);
    else if (scenario.error === null) assert.deepEqual(result, []);
    else assert(Array.isArray(result) && result.includes(scenario.error), JSON.stringify(result));
    assert.deepEqual(input, before, 'Contract gates must not mutate input.');
  });
}
