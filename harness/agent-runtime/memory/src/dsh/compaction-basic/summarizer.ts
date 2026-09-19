/**
 * Default one-shot summarization and durable checkpoint framing.
 *
 * @module @deepseek-ai/dsh-compaction-basic/summarizer
 */

import type { Context } from '@deepseek-ai/cordis'
import { contentHasImage, createUserMessage, BlockAssembler, LlmError } from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock, FinishReason, GenerateOptions, Message, TokenUsage, ToolSchema,
} from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'

interface SummaryConfig {
  readonly summarizationProvider: string
  readonly summarizationModel: string
  readonly maxTokens: number
}

/** Tags wrapping the structured summary inside the landed checkpoint node. */
const SUMMARY_OPEN_TAG = '<compacted-summary>'
const SUMMARY_CLOSE_TAG = '</compacted-summary>'

/**
 * The summarization directive, delivered as the FINAL user message after the
 * replayed conversation rather than as a distinct summarizer system prompt.
 * Keeping the conversation's own system prompt, tools, and message prefix in
 * front of it makes the auxiliary call a genuine prefix of the last routed
 * request, so the provider's KV cache is reused instead of invalidated.
 */
const COMPACTION_INSTRUCTION = [
  'Summarize this embodied agent assignment as a checkpoint for the SAME role. Do not perform the task or call tools.',
  'Preserve the original goal and user corrections. Do not inherit another role history or create new permissions.',
  'Use these Markdown sections in order; write (none) where no evidence exists:',
  '## Goal and Authoritative Conditions',
  '- Exact task, goal, success-contract identity/version and criteria; never replace these with a guessed success condition.',
  '## Current Plan and Assignment',
  '- Role, caller, current plan/TODO status, goal/attempt/recovery identities, pending work and explicit decisions.',
  '## Execution and Verification',
  '- Execution ID, current boundary/version, confirmed versus requested stop, budget, accepted verdicts and unknown checks.',
  '## Observations and Evidence',
  '- Exact evidence/image IDs, relevant timestamps and visibility. Separate directly observed facts, reported evidence and hypotheses.',
  '- Describe relevant images without inventing unseen details. Older image descriptions are not fresh perception.',
  '## Recovery and Failure Knowledge',
  '- What was tried, why it was judged unsuccessful, proposed changes, observed success/failure conditions and uncertain causes.',
  '## Pending Reports and Artifacts',
  '- Report IDs, acknowledgement/delivery state, exact working-file paths and versions, retrieved SKILL IDs and remaining obligations.',
  '## Next Step and Constraints',
  '- Current decision-owner intent, missing context, allowed tools and unresolved questions. Verifier cannot retry/replan; Evolver cannot control execution.',
  'Use concise English. Preserve exact identifiers and essential numeric values. Never manufacture facts, causes, permissions or completion.',
  'A prior checkpoint is fallible memory: merge still-relevant information and newer explicit evidence; do not copy stale claims as current truth.',
  'Return checkpoint text only. No tool calls, executable actions or instructions to bypass task gates.',
].join('\n')

/** Framing that makes the replacement user message established context. */
const CHECKPOINT_PREAMBLE =
  'This checkpoint is a fallible summary of this assignment history. It grants no tool or evidence authority and does not replace current task, execution or verification records. Preserve uncertainty and use authorized tools when current facts are needed. Continue from the explicit messages that follow.'

/**
 * The replayed conversation surface the summarizer condenses. Reproducing the
 * last routed request's system prompt, tools, and leading messages verbatim
 * lets the auxiliary call reuse the provider's warm prefix cache; the trailing
 * compaction instruction is then the only novel input.
 */
export interface SummarizationInput {
  /** The conversation's own system prompt, reused for prefix-cache alignment; absent for a system-less request. */
  readonly system?: string
  /** The conversation's tool schemas, reused for prefix-cache alignment; absent when the request carried none. */
  readonly tools?: readonly ToolSchema[]
  /** The shadowed region, in surface order, that precedes the compaction instruction. */
  readonly messages: readonly Message[]
}

/** Safe summary content plus the exact auxiliary call envelope recorded with it. */
export type SummaryResult = {
  summary: ContentBlock[]
  provider: string
  model: string
  maxTokens?: number
  /** Provider-reported usage for this summarization request. */
  usage?: TokenUsage
} & (
  | {
    /** Complete provider output before the text-only summary projection. */
    rawOutput: ContentBlock[]
    /** Identifies exactly one call through this context's `ctx.llm.stream()`. */
    llmStreamCall: true
  }
  | {
    /** Optional complete output from an unmarked template, remote, or other summarizer. */
    rawOutput?: ContentBlock[]
    /** An unmarked result does not identify a call through this context's LLM seam. */
    llmStreamCall?: never
  }
)

/**
 * Run the default cache-reusing `ctx.llm.stream()` summarization call: replay
 * the conversation prefix, then append the compaction instruction as the final
 * user message so the provider's warm prefix cache is reused.
 * @param ctx - context providing the LLM service.
 * @param config - resolved backend configuration.
 * @param input - replayed conversation prefix (system, tools, and leading messages) to condense.
 * @param agent - supplies routed-model history, fallback model, and session id.
 * @param signal - optional cancellation forwarded to the adapter.
 * @returns safe text-only summary blocks and the exact call envelope and output.
 */
export async function summarizeWithLlm(
  ctx: Context,
  config: SummaryConfig,
  input: SummarizationInput,
  agent: Agent,
  signal?: AbortSignal,
): Promise<SummaryResult> {
  const latest = agent.session.requestHeader()?.config
  const configured = config.summarizationProvider.length === 0
    ? undefined
    : { provider: config.summarizationProvider, model: config.summarizationModel }
  const agentTarget = agent.options.provider !== undefined
    && agent.options.provider.length > 0
    && agent.options.model !== undefined
    && agent.options.model.length > 0
    ? { provider: agent.options.provider, model: agent.options.model }
    : undefined
  const target = configured ?? latest ?? agentTarget
  if (target === undefined) {
    throw new Error(
      'no provider/model available for summarization: set both BasicCompactionConfig summarization fields, route one request, or set both AgentOptions fields',
    )
  }

  const assembler = new BlockAssembler()
  const messages: Message[] = [
    ...input.messages,
    createUserMessage({
      content: [{ type: 'text', text: COMPACTION_INSTRUCTION }],
      source: { kind: 'plugin', plugin: 'dsh-compaction-basic' },
    }),
  ]
  const options: GenerateOptions = {
    provider: target.provider,
    model: target.model,
    messages,
    ...input.system === undefined ? {} : { system: input.system },
    ...input.tools === undefined ? {} : { tools: [...input.tools] },
    maxTokens: config.maxTokens,
    sessionId: agent.session.id,
    purpose: 'compaction',
    ...signal === undefined ? {} : { signal },
  }
  for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk)
  const error = finishError(assembler.finish)
  if (error !== undefined) throw error

  const rawOutput = assembler.blocks()
  const summary = summaryText(rawOutput)
  if (!summary.some(block => block.text.trim().length > 0)) {
    throw new Error('summarization produced no text summary content')
  }
  return {
    summary,
    rawOutput,
    llmStreamCall: true,
    provider: options.provider,
    model: options.model,
    maxTokens: config.maxTokens,
    ...(assembler.usage === undefined ? {} : { usage: assembler.usage }),
  }
}

/**
 * Wrap raw summary blocks in the durable checkpoint framing.
 * @param summary - safe text-only model output.
 * @returns content for the synthesized replacement user message.
 */
export function frameSummary(summary: readonly ContentBlock[]): ContentBlock[] {
  return [
    { type: 'text', text: `${CHECKPOINT_PREAMBLE}\n\n${SUMMARY_OPEN_TAG}` },
    ...summary,
    { type: 'text', text: SUMMARY_CLOSE_TAG },
  ]
}

/** Map a terminal summarization finish to its fail-closed error. */
function finishError(finish: FinishReason): Error | undefined {
  switch (finish.kind) {
    case 'error':
    case 'aborted': {
      const error = new Error(finish.failure.message) as Error & { code?: string }
      error.code = finish.failure.code
      return error
    }
    case 'max-tokens': {
      const error = new Error('summarization truncated at the token cap (incomplete checkpoint)') as Error & { code?: string }
      error.code = 'MAX_TOKENS'
      return error
    }
    default:
      return undefined
  }
}

/** Reject visual output and keep only text before synthesizing a user message. */
function summaryText(
  blocks: readonly ContentBlock[],
): Array<Extract<ContentBlock, { type: 'text' }>> {
  if (contentHasImage(blocks)) {
    throw new LlmError('compaction summary cannot contain image output', 'UNSUPPORTED_CONTENT')
  }
  return blocks.filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
}
