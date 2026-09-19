import * as Todo from '@deepseek-ai/dsh-tool-todo';
import type { Context } from '@deepseek-ai/cordis';
import type { AgentHandle as DshAgentHandle } from '@deepseek-ai/dsh-agent';
import { SessionId } from '@deepseek-ai/dsh-session';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';

export interface DshSessionDefinition {
  readonly sessionId: string;
  readonly provider: string;
  readonly model: string;
  readonly instructions: string;
  readonly tools: readonly ToolDefinition[];
  readonly signal?: AbortSignal;
  readonly todo?: boolean;
  /** Scoped host facts, refreshed by the native DSH context contributor. */
  readonly runtimeContext?: () => string;
}

/**
 * Create a fresh DSH session and register only its explicit prompt and tools.
 * Use the neutral host returned by createDshHost, never a caller-agent context.
 * This proves the runtime seam; Team loading and InvocationBrief validation are
 * later steps, and host-level contributors are outside this trusted seam's scope.
 */
export function createDshSession(
  host: Context,
  definition: DshSessionDefinition,
): Promise<DshAgentHandle> {
  if (host.agent !== undefined) {
    throw new Error('Create EDH sessions from the neutral host, not a caller-agent context.');
  }
  return host.agents.create({
    sessionId: SessionId(definition.sessionId),
    agentOptions: { provider: definition.provider, model: definition.model },
    ...(definition.signal === undefined ? {} : { signal: definition.signal }),
    async setup(agentCtx) {
      if (definition.todo) await agentCtx.plugin(Todo, { allowParallelInProgress: true });
      agentCtx.systemPrompt.section({
        name: 'edh:role',
        order: 0,
        text: definition.instructions,
      });
      if (definition.runtimeContext)
        agentCtx.systemPrompt.context({
          name: 'edh:assignment-state',
          order: 0,
          text: definition.runtimeContext,
        });
      for (const tool of definition.tools) agentCtx.tools.register(tool);
    },
  });
}
