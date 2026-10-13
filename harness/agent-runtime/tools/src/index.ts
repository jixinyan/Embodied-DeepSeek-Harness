// DSH 负责工具执行，EDH 提供具身参数和模型可见 Schema。
export {
  defineTool,
  assertObjectJsonSchema,
  ToolArgsError,
  validateJsonSchemaValue,
  type ObjectJsonSchema,
  type ToolDefinition,
  type ToolExecutionInput,
  type ToolExecutionResult,
  type ToolRunContext,
} from '@deepseek-ai/dsh-tools';

export type {
  ToolCall as PhysicalToolCall,
  ToolDefinition as PhysicalToolDefinition,
  ToolResult as PhysicalToolResult,
} from '@edh/contracts';

export {
  CORE_TOOLS,
  CORE_TOOL_PARAMETERS,
  CORE_TOOL_OPTIONAL_PARAMETERS,
  CORE_TOOL_DESCRIPTIONS,
  assertCoreInputLimits,
} from './core-inputs.js';
export {
  coreModelToolParameters,
  modelToolContractSchema,
  type CoreModelToolOptions,
} from './model-schema.js';
export { createCoreToolDefinition, type CoreToolBinding } from './core-definition.js';
export { coreToolEvidenceIds, renderCoreToolResult } from './core-output.js';
export { nativeToolName, assertToolBindings } from './tool-names.js';
export { createExtensionToolDefinition } from './extension-definition.js';
