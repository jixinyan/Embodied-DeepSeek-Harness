import { Context } from '@deepseek-ai/cordis';
import { installContextManagement, type ContextManagementOptions } from '@edh/memory';
import AgentRegistry from '@deepseek-ai/dsh-agent';
import AgentLoop from '@deepseek-ai/dsh-agent-loop';
import LlmRuntime, { type LlmAdapter } from '@deepseek-ai/dsh-llm';
import SessionStore from '@deepseek-ai/dsh-session';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import ToolRuntime from '@deepseek-ai/dsh-tools';
import * as TimeoutPolicy from '@deepseek-ai/dsh-tool-call-timeout-policy';

export interface ModelBinding {
  readonly providers: string[];
  readonly adapter: LlmAdapter;
}

// 组装原始 DSH 服务；调用方通过 ctx.fiber.dispose() 释放 host。
// 部署服务负责提供模型、role、tools 和 physical provider。
export async function createDshHost(
  bindings: readonly ModelBinding[],
  contextManagement?: ContextManagementOptions,
): Promise<Context> {
  const ctx = new Context();
  try {
    await ctx.plugin(LlmRuntime);
    await ctx.plugin(SessionStore);
    await ctx.plugin(SessionProjectionRegistry);
    await ctx.plugin(SystemPrompt);
    await ctx.plugin(ToolRuntime);
    await ctx.plugin(TimeoutPolicy);
    await ctx.plugin(AgentRegistry);
    await ctx.plugin(AgentLoop, { agents: [] });
    for (const binding of bindings) ctx.llm.registerAdapter(binding.providers, binding.adapter);
    if (contextManagement) await installContextManagement(ctx, contextManagement);
    return ctx;
  } catch (error) {
    await ctx.fiber.dispose();
    throw error;
  }
}
