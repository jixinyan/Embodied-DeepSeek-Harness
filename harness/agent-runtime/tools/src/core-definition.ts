import {
  assertObjectJsonSchema,
  ToolArgsError,
  validateJsonSchemaValue,
  type ToolDefinition,
  type ToolRunContext,
} from '@deepseek-ai/dsh-tools';
import type { ExecutionStatus } from '@edh/contracts';
import { assertCoreInputLimits, CORE_TOOL_DESCRIPTIONS } from './core-inputs.js';
import { coreModelToolParameters, type CoreModelToolOptions } from './model-schema.js';

export interface CoreToolBinding extends CoreModelToolOptions {
  backendTimeoutMs?: number;
  segmentationTimeoutMs?: number;
  depthTimeoutMs?: number;
  output: ToolDefinition['output'];
  invoke(args: Record<string, unknown>, exec: ToolRunContext): Promise<unknown>;
}

const backendTools = new Set([
  'perception.capture',
  'perception.measure_object',
  'perception.inspect_simulator',
  'observation.turn_view',
  'observation.rotate',
  'execution.start',
  'execution.pause',
  'execution.end',
  'execution.resume',
  'verification.check',
  'tasks.abandon',
]);
const concludingTools = new Set([
  'user.ask',
  'agent.report',
  'verification.submit',
  'tasks.finish',
  'tasks.abandon',
  'execution.start',
  'execution.end',
]);

export function createCoreToolDefinition(
  logical: string,
  binding: CoreToolBinding,
): ToolDefinition {
  const description = CORE_TOOL_DESCRIPTIONS[logical];
  if (!description) throw new Error(`Tool description is unavailable: ${logical}`);
  const timeoutMs =
    logical === 'perception.segment_objects'
      ? binding.segmentationTimeoutMs
      : logical === 'perception.estimate_depth'
        ? binding.depthTimeoutMs
        : backendTools.has(logical)
          ? binding.backendTimeoutMs
          : undefined;
  const definition: ToolDefinition = {
    name: logical.replaceAll('.', '__'),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    description:
      logical === 'execution.query' && binding.executionTurnCompletion !== true
        ? 'Read the current published execution and formal-verification status using an empty argument object. This is an informational observation. Inspect the identified boundary, stop reason, device confirmation and authorized evidence; complete your assigned role workflow.'
        : description,
    parameters: coreModelToolParameters(logical, binding),
    output: binding.output,
    execute: async (args, exec) => {
      // 使用 DSH validator，在调用具有副作用的工具之前检查参数。
      const parameters = definition.parameters;
      assertObjectJsonSchema(parameters);
      const violations = validateJsonSchemaValue(parameters, args, 'arguments');
      if (violations.length) throw new ToolArgsError(violations);
      assertCoreInputLimits(args as Record<string, unknown>);
      const result = await binding.invoke(args as Record<string, unknown>, exec);
      if (
        concludingTools.has(logical) ||
        (logical === 'execution.query' &&
          (args as { completeTurn?: boolean }).completeTurn === true) ||
        (logical === 'execution.resume' &&
          (result as { execution: ExecutionStatus }).execution.state === 'running')
      )
        exec.concludeTurn();
      return result;
    },
  };
  return definition;
}
