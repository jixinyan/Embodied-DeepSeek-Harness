// Architecture contract only. No runtime implementation.
import type { InvocationBrief, MessageEnvelope } from '@edh/contracts';
export interface MessageReceipt {
  readonly messageId: string;
  readonly acceptedAt: string;
}
export interface TeamRouter {
  delegate(member: string, brief: InvocationBrief): Promise<MessageReceipt>;
  send(message: MessageEnvelope): Promise<MessageReceipt>;
  subscribe(taskId: string, afterSequence?: number): AsyncIterable<MessageEnvelope>;
}

export { TeamSessions, type Assignment, type SessionHooks } from './sessions.js';
