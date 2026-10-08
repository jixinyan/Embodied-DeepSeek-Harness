import * as Todo from '@deepseek-ai/dsh-tool-todo';
import type { Context } from '@deepseek-ai/cordis';
import type { AgentHandle as DshAgentHandle } from '@deepseek-ai/dsh-agent';
import { SessionId } from '@deepseek-ai/dsh-session';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { ReasoningEffortId } from '@deepseek-ai/dsh-llm';

export interface DshSessionDefinition {
  readonly sessionId: string;
  readonly provider: string;
  readonly model: string;
  readonly reasoningEffort?: ReasoningEffortId;
  readonly instructions: string;
  readonly tools: readonly ToolDefinition[];
  readonly signal?: AbortSignal;
  readonly todo?: boolean;
  /** Scoped host facts, refreshed by the native DSH context contributor. */
  readonly runtimeContext?: () => string;
}

// 使用独立 host 创建原始 DSH Session，并注册明确提供的 prompt 和 tools。
// TeamSessions 负责 assignment、InvocationBrief 和授权上下文的生命周期。
export function createDshSession(
  host: Context,
  definition: DshSessionDefinition,
): Promise<DshAgentHandle> {
  if (host.agent !== undefined) {
    throw new Error('Create EDH sessions from the neutral host, not a caller-agent context.');
  }
  return host.agents.create({
    sessionId: SessionId(definition.sessionId),
    agentOptions: {
      provider: definition.provider,
      model: definition.model,
      ...(definition.reasoningEffort === undefined
        ? {}
        : { reasoningEffort: definition.reasoningEffort }),
    },
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
