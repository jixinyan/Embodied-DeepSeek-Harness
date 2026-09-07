// Architecture contract only. No runtime implementation.
import type { TaskScope, ToolDefinition, ToolResult } from '@edh/contracts';
export interface ToolCall {
  readonly callId: string;
  readonly toolId: string;
  readonly agentId: string;
  readonly assignmentId: string;
  readonly scope: TaskScope;
  readonly input: Readonly<Record<string, unknown>>;
}
export interface ToolRegistry {
  describe(toolId: string): Promise<ToolDefinition>;
  listForAssignment(assignmentId: string): Promise<readonly ToolDefinition[]>;
}
export interface ToolExecutor {
  invoke(call: ToolCall, signal: AbortSignal): Promise<ToolResult>;
}
