import { z } from 'zod';
import { isWireTimestamp, type ContractValidator } from '@edh/contracts';
import type { BackendPolicyEvent } from './backend-port.js';
import { validatePolicyPlan } from './policy-plan.js';

const id = z.string().min(1).max(128);
const object = z.record(z.string(), z.json());
const block = z.object({ type: z.string().min(1) }).catchall(z.json());
const message = z.object({ content: z.array(block).max(1024) }).catchall(z.json());
const schema = z
  .object({
    requestId: id,
    executionId: id,
    taskScope: object,
    generation: z.number().int().nonnegative().safe(),
    observationId: id,
    sessionId: id,
    sequence: z.number().int().positive().safe(),
    at: z.string().refine(isWireTimestamp),
    type: z.enum([
      'plan',
      'status',
      'stream',
      'decision',
      'failure',
      'turn/start',
      'turn/end',
      'step/start',
      'step/end',
      'assistant/message',
      'tool/call',
      'tool/result',
      'request/context',
    ]),
    data: object,
  })
  .strict();

export function readPolicyEvent(input: unknown, validator: ContractValidator): BackendPolicyEvent {
  const event = schema.parse(input);
  if (Buffer.byteLength(JSON.stringify(event)) > 2 * 1024 * 1024)
    throw new Error('Policy event exceeds its publication bound.');
  const taskScope = validator.parse('TaskScope', event.taskScope);
  if (event.type === 'plan') {
    const plan = z
      .object({
        requestId: id,
        revision: z.number().int().positive().safe(),
        subtasks: z.array(object),
        reason: z.string().min(1),
        physicalSteps: z.literal(0),
      })
      .strict()
      .parse(event.data);
    if (plan.requestId !== event.requestId)
      throw new Error('Policy plan belongs to another request.');
    validatePolicyPlan(plan.subtasks);
  }
  if (event.type === 'assistant/message') message.parse(event.data.message);
  if (event.type === 'tool/call')
    z.object({
      callId: id,
      name: id,
      arguments: z.string().max(256 * 1024),
    })
      .passthrough()
      .parse(event.data);
  if (event.type === 'tool/result') {
    const result = message
      .extend({ source: z.object({ callId: id }).passthrough() })
      .parse(event.data.message);
    for (const content of result.content) {
      if (content.type === 'tool-result')
        z.object({ isError: z.boolean() }).passthrough().parse(content);
    }
  }
  if (event.type === 'stream')
    z.object({
      attemptId: id,
      revision: z.number().int().nonnegative().safe(),
      text: z.string().max(16000),
      reasoning: z.string().max(16000),
      status: z.string().min(1).max(80),
    })
      .strict()
      .parse(event.data);
  return { ...event, taskScope };
}
