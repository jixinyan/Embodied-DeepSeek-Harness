import { Context } from '@deepseek-ai/cordis';
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

/**
 * Assemble the pinned DSH services for the Step 00 host experiment.
 * The caller owns the returned context and must await ctx.fiber.dispose().
 * No default tools, role prompts, physical services or network server are mounted.
 * This context is a trusted host API, not an interface exposed to model tools.
 */
export async function createDshHost(bindings: readonly ModelBinding[]): Promise<Context> {
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
    return ctx;
  } catch (error) {
    await ctx.fiber.dispose();
    throw error;
  }
}
