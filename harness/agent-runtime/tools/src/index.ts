// Architecture contract only. No runtime implementation.
import type { ToolCall, ToolDefinition, ToolResult } from '@edh/contracts';
export type { ToolCall } from '@edh/contracts';
export interface ToolRegistry {
  describe(toolId: string): Promise<ToolDefinition>;
  listForAssignment(assignmentId: string): Promise<readonly ToolDefinition[]>;
}
export interface ToolExecutor {
  invoke(call: ToolCall, signal: AbortSignal): Promise<ToolResult>;
}
