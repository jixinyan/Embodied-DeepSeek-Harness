// Native tools execute through DSH. EDH adds only physical/provider metadata.
export {
  defineTool,
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
import type { ToolCall, ToolDefinition, ToolResult } from '@edh/contracts';

/** Future provider metadata lookup; not another model-facing tool registry. */
export interface PhysicalToolCatalog {
  describe(toolId: string): Promise<ToolDefinition>;
  listForAssignment(assignmentId: string): Promise<readonly ToolDefinition[]>;
}

/** Future wire/provider port called from a DSH tool body, not a second dispatcher. */
export interface PhysicalToolProvider {
  invoke(call: ToolCall, signal: AbortSignal): Promise<ToolResult>;
}

export { CORE_TOOLS, CORE_TOOL_PARAMETERS } from './core-inputs.js';
