import assert from 'node:assert/strict';
import test from 'node:test';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { DshGptPolicy } from '@edh/execution';
import {
  ContractValidator,
  type ActionChunk,
  type ActionSpec,
  type PolicyRequest,
} from '@edh/contracts';
import {
  LlmAdapter,
  ToolCallId,
  type GenerateOptions,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm';
import schema from '../../harness/contracts/schema/physical.schema.json' with { type: 'json' };

const validator = new ContractValidator(schema);
const actionSpec: ActionSpec = {
  schema_version: 'physical.action_spec.v1' as const,
  embodiment_id: 'fixture.dual-arm',
  version: 'fixture-v1',
  coordinate_frame: 'fixture.environment',
  control_mode: 'joint_position' as const,
  frequency_hz: 10,
  channels: [
    {
      name: 'left_joint',
      quantity: 'angular' as const,
      unit: 'radian' as const,
      minimum: -1,
      maximum: 1,
    },
    {
      name: 'left_gripper',
      quantity: 'normalized' as const,
      unit: 'dimensionless' as const,
      minimum: 0,
      maximum: 1,
    },
  ],
};
const request: PolicyRequest = {
  schema_version: 'physical.policy_request.v1',
  request_id: 'policy-request-1',
  execution_id: 'execution-1',
  task_scope: { task_id: 'task-1', goal_id: 'goal-1', attempt_id: 'attempt-1' },
  generation: 0,
  observation_id: 'observation-1',
  valid_until: '2099-01-01T00:00:00.000Z',
  action_spec: actionSpec,
  instruction: 'Move the arm.',
  observation: { execution_mode: 'direct', control_mode: '0-shot' },
  max_actions: 4,
};

function toolStep(
  name: string,
  argumentsValue: Record<string, unknown>,
  id: string,
): StreamChunk[] {
  const argumentsText = JSON.stringify(argumentsValue);
  return [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'tool-call-delta', index: 0, id: ToolCallId(id), name, argumentsDelta: argumentsText },
    {
      type: 'block-end',
      index: 0,
      block: { type: 'tool-call', id: ToolCallId(id), name, arguments: argumentsText },
    },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ];
}

class ToolScript extends LlmAdapter {
  calls = 0;
  constructor(private readonly mode: 'direct' | 'hybrid') {
    super();
  }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.calls++;
    const body =
      options.messages
        .at(-1)
        ?.content.flatMap((block) =>
          block.type === 'text'
            ? [block.text]
            : block.type === 'tool-result'
              ? block.content.flatMap((child) => (child.type === 'text' ? [child.text] : []))
              : [],
        )
        .join('') ?? '';
    const requestId = /requestId["']?\s*:\s*["']([^"']+)/.exec(body)?.[1] ?? request.request_id;
    if (this.mode === 'direct') {
      for (const chunk of toolStep(
        'policy__joint_command',
        { requestId, action: [0.2, 0.5], reason: 'fixture grounded' },
        'direct-call',
      ))
        yield chunk;
      return;
    }
    if (this.calls === 1)
      for (const chunk of toolStep('policy__infer', { requestId }, 'infer-call')) yield chunk;
    else if (this.calls === 2) {
      const predictionId = /predictionId["']?\s*:\s*["']([^"']+)/.exec(body)?.[1];
      for (const chunk of toolStep(
        'policy__review',
        {
          requestId,
          predictionId,
          decision: 'allow',
          reason: 'fixture grounded',
          confidence: 0.9,
          safeSteps: 2,
        },
        'review-call',
      ))
        yield chunk;
    } else {
      const predictionId = /predictionId["']?\s*:\s*["']([^"']+)/.exec(body)?.[1];
      for (const chunk of toolStep('policy__execute', { requestId, predictionId }, 'execute-call'))
        yield chunk;
    }
  }
}

function proposal(): ActionChunk {
  return {
    schema_version: 'physical.action_chunk.v1',
    request_id: request.request_id,
    execution_id: request.execution_id,
    task_scope: request.task_scope,
    generation: request.generation,
    observation_id: request.observation_id,
    valid_until: request.valid_until,
    action_spec: request.action_spec,
    actions: [
      [0.1, 0.2],
      [0.2, 0.3],
      [0.3, 0.4],
    ],
  };
}

test('DshGptPolicy direct mode uses DSH tools and returns a non-dispatching proposal', async (t) => {
  const model = new ToolScript('direct');
  const host = await createDshHost([{ providers: ['fixture'], adapter: model }]);
  t.after(() => host.fiber.dispose());
  const policy = new DshGptPolicy(host, validator, {
    provider: 'fixture',
    model: 'fixture',
    mode: 'direct',
    observation: async () => ({ images: [], context: { fixture: true } }),
  });
  t.after(() => policy.close());
  const result = await policy.infer(request);
  assert.deepEqual(result, { mode: 'direct', request_id: request.request_id, action: [0.2, 0.5] });
  assert.equal(model.calls, 1);
});

test('DshGptPolicy hybrid mode reviews a lower proposal and returns only the safe prefix', async (t) => {
  const model = new ToolScript('hybrid');
  const host = await createDshHost([{ providers: ['fixture'], adapter: model }]);
  t.after(() => host.fiber.dispose());
  const policy = new DshGptPolicy(host, validator, {
    provider: 'fixture',
    model: 'fixture',
    mode: 'hybrid',
    observation: async () => ({ images: [], context: { fixture: true } }),
    propose: async () => proposal(),
  });
  t.after(() => policy.close());
  const result = await policy.infer({
    ...request,
    observation: { execution_mode: 'hybrid', control_mode: 'visual-1-shot' },
  });
  assert.equal(result.mode, 'hybrid');
  if (result.mode === 'hybrid' && 'review' in result) {
    assert.equal(result.review.safe_steps, 2);
    assert.deepEqual(result.proposal, [
      [0.1, 0.2],
      [0.2, 0.3],
      [0.3, 0.4],
    ]);
  }
  assert.equal(model.calls, 3);
});
