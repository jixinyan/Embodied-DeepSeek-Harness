import type { Context } from '@deepseek-ai/cordis';
import TokenMeter from '@deepseek-ai/dsh-token-meter';
import BasicCompaction, { type BasicCompactionConfig } from '@deepseek-ai/dsh-compaction-basic';
import ToolResultPruner, {
  type ToolResultPruneConfig,
} from '@deepseek-ai/dsh-compaction-tool-result-pruner';
import { resolveConfig as resolveCompaction } from './dsh/compaction-basic/config.ts';
import {
  VisualHistory,
  visualHistoryOptions,
  type VisualHistoryOptions,
} from './visual-history.js';
import { resolveConfig as resolvePruning } from './dsh/tool-result-pruner/config.ts';

/** Explicit deployment policy; model context capacity remains adapter metadata. */
export interface ContextManagementOptions {
  compaction?: BasicCompactionConfig;
  visualHistory?: VisualHistoryOptions;
  /** Opt in to deterministic long-tool-text pruning; original audit events remain intact. */
  pruneToolResults?: ToolResultPruneConfig;
}
export function contextManagementOptions(
  input: ContextManagementOptions,
): ContextManagementOptions {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !['compaction', 'pruneToolResults', 'visualHistory'].includes(key),
    )
  )
    throw new Error('Invalid context management policy.');
  const result = structuredClone(input);
  resolveCompaction(result.compaction ?? {});
  if (result.pruneToolResults !== undefined) resolvePruning(result.pruneToolResults);
  if (result.visualHistory !== undefined)
    result.visualHistory = visualHistoryOptions(result.visualHistory);
  return result;
}
/** Mount the original services; no replacement message loop or transcript slicing. */
export async function installContextManagement(
  ctx: Context,
  input: ContextManagementOptions,
): Promise<void> {
  const policy = contextManagementOptions(input);
  await ctx.plugin(TokenMeter);
  if (policy.pruneToolResults) await ctx.plugin(ToolResultPruner, policy.pruneToolResults);
  await ctx.plugin(BasicCompaction, policy.compaction ?? {});
  if (policy.visualHistory) await ctx.plugin(VisualHistory, policy.visualHistory);
}
