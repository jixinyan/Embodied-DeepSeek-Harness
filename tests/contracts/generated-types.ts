// Compile-time checks: code generation must preserve essential required fields.
import type { SuccessContract, InvocationBrief, ToolCall, ToolOperation } from '@edh/contracts';
const criterion: SuccessContract = {
  id: 'inside',
  version: '1',
  source: { kind: 'benchmark', reference: 'synthetic-check' },
  all: [{ check_id: 'inside_target', check: 'inside', args: ['cup', 'cabinet'] }],
};
const id: string = criterion.id;
// @ts-expect-error Missing a required criterion must not degenerate into an unknown dictionary.
const missingCriterion: SuccessContract = { id: 'inside', version: '1' };
// @ts-expect-error A fresh invocation cannot be an unstructured empty object.
const missingBrief: InvocationBrief = {};
export type SchemaTypeCheck = typeof id | typeof missingCriterion | typeof missingBrief;

// @ts-expect-error Tool calls require explicit identity and inputs.
const missingCall: ToolCall = {};
// @ts-expect-error Async operations require the initiating call and state.
const missingOperation: ToolOperation = {};
export type BoundaryTypeCheck = typeof missingCall | typeof missingOperation;
