// Architecture contract only. No runtime implementation.
import type { AgentReport, InvocationBrief, RoleDefinition } from '@edh/contracts';
export interface AgentIdentity {
  readonly agentId: string;
  readonly sessionId: string;
  readonly assignmentId: string;
  readonly teamRunId: string;
}
export interface AgentHandle {
  readonly identity: AgentIdentity;
  cancel(reason: string): Promise<void>;
}
export interface AgentFactory {
  create(role: RoleDefinition, brief: InvocationBrief): Promise<AgentHandle>;
}
export interface AgentReports {
  receive(agentId: string): AsyncIterable<AgentReport>;
}
