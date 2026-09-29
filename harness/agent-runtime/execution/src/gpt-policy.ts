import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Context } from '@deepseek-ai/cordis';
import type { AgentHandle } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { deadline } from '@deepseek-ai/dsh-timeout';
import { createDshSession } from '@edh/agents';
import { defineTool, type ToolDefinition } from '@edh/tools';
import type { ActionChunk, ContractValidator, PolicyRequest } from '@edh/contracts';

export type GptControlMode = '0-shot' | 'textual-1-shot' | 'visual-1-shot';
export interface GptPolicyOptions {
  provider: string;
  model: string;
  mode: 'direct' | 'hybrid';
  controlMode?: GptControlMode;
  instructions?: string;
  demonstration?: { text: string; images?: readonly ImageAttachmentRef[] };
  /** Admitted images and text from the current request; no model-selected path/URL. */
  observation(
    request: PolicyRequest,
    signal: AbortSignal,
  ): Promise<{
    images: readonly ImageAttachmentRef[];
    context: Record<string, unknown>;
  }>;
  /** Hybrid inference returns a proposal only and has no device authority. */
  propose?(request: PolicyRequest, signal: AbortSignal): Promise<ActionChunk>;
  /** Provider-specific, read-only tools such as grounding, depth and FK preview. */
  observationTools?(request: () => PolicyRequest): readonly ToolDefinition[];
  /** Read-only EEF-to-canonical transform; it must not dispatch a control. */
  prepareEef?(
    request: PolicyRequest,
    targets: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<number[]>;
  audit?(record: Record<string, unknown>): void;
  timeoutMs?: number;
  maxModelSteps?: number;
}

type Review = {
  decision: 'allow' | 'intervene';
  reason: string;
  confidence: number;
  safeSteps: number;
};
export type GptPolicyResponse =
  | { mode: 'direct'; request_id: string; action: number[] }
  | {
      mode: 'hybrid';
      request_id: string;
      proposal: number[][];
      review: {
        decision: 'allow' | 'intervene';
        reason: string;
        confidence: number;
        safe_steps: number;
      };
      intervention?: number[];
    };

/** EDH-owned Litchi-style policy using the existing DSH loop and native tools.
 * It proposes actions only. The Python worker and ActionGate own every effect.
 */
export class DshGptPolicy {
  private handle: AgentHandle | undefined;
  private executionId: string | undefined;
  private current: PolicyRequest | undefined;
  private output: GptPolicyResponse | undefined;
  private proposal: { id: string; actions: number[][] } | undefined;
  private review: Review | undefined;
  private active = false;
  private closed = false;
  private steps = 0;
  private readonly mode: GptControlMode;

  constructor(
    private readonly host: Context,
    private readonly validator: ContractValidator,
    private readonly options: GptPolicyOptions,
  ) {
    this.mode = options.controlMode ?? '0-shot';
    if (!['0-shot', 'textual-1-shot', 'visual-1-shot'].includes(this.mode))
      throw new Error('Unknown GPT control mode.');
    if (options.mode === 'hybrid' && !options.propose)
      throw new Error('Hybrid GPT policy requires a lower-policy proposer.');
    if (this.mode !== '0-shot' && !options.demonstration?.text.trim())
      throw new Error('One-shot mode requires an explicit demonstration.');
    if (this.mode === 'visual-1-shot' && !options.demonstration?.images?.length)
      throw new Error('Visual one-shot mode requires admitted demonstration frames.');
    if (options.demonstration?.images && options.demonstration.images.length > 64)
      throw new Error('Demonstration exceeds 64 frames.');
  }

  private request(id?: string): PolicyRequest {
    const value = this.current;
    if (!value || this.output || (id !== undefined && id !== value.request_id))
      throw new Error('Use the current unused policy request identity.');
    if (Date.parse(value.valid_until) <= Date.now())
      throw new Error('Policy observation deadline expired.');
    return structuredClone(value);
  }

  private action(value: number[]): number[] {
    const request = this.request();
    if (
      value.length !== request.action_spec.channels.length ||
      value.some(
        (number, index) =>
          !Number.isFinite(number) ||
          number < request.action_spec.channels[index]!.minimum ||
          number > request.action_spec.channels[index]!.maximum,
      )
    )
      throw new Error('Action violates the admitted ActionSpec.');
    return [...value];
  }

  private tools(): ToolDefinition[] {
    const terminal = (action: number[], conclude: () => void) => {
      const request = this.request();
      const admitted = this.action(action);
      if (this.options.mode === 'hybrid') {
        if (!this.proposal || this.review?.decision !== 'intervene')
          throw new Error('Hybrid direct correction requires an intervened proposal.');
        this.output = {
          mode: 'hybrid',
          request_id: request.request_id,
          proposal: this.proposal.actions,
          review: { ...this.review, safe_steps: this.review.safeSteps },
          intervention: admitted,
        };
        delete (this.output.review as Record<string, unknown>).safeSteps;
      } else this.output = { mode: 'direct', request_id: request.request_id, action: admitted };
      conclude();
      return { accepted: true, requestId: request.request_id, physicalSteps: 0 };
    };
    const tools: ToolDefinition[] = [
      defineTool({
        name: 'policy__joint_command',
        description:
          'Propose one canonical joint/control action from the fresh images and ActionSpec. This does not move the device.',
        parameters: {
          requestId: { type: 'string', required: true },
          action: { type: 'array', items: { type: 'number' }, required: true },
          reason: { type: 'string', required: true },
        },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        execute: async (args, exec) => {
          this.request(args.requestId);
          exec.signal.throwIfAborted();
          return terminal(args.action, () => exec.concludeTurn());
        },
      }),
    ];
    if (this.options.prepareEef)
      tools.push(
        defineTool({
          name: 'policy__eef_command',
          description:
            'Prepare one grounded absolute EEF target as canonical actions. The transform has no motion authority.',
          parameters: {
            requestId: { type: 'string', required: true },
            targets: { type: 'object', additionalProperties: true, required: true },
            reason: { type: 'string', required: true },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
          },
          execute: async (args, exec) => {
            const request = this.request(args.requestId);
            const action = await this.options.prepareEef!(request, args.targets, exec.signal);
            exec.signal.throwIfAborted();
            this.request(args.requestId);
            return terminal(action, () => exec.concludeTurn());
          },
        }),
      );
    if (this.options.mode === 'hybrid')
      tools.push(
        defineTool({
          name: 'policy__infer',
          description:
            'Request a lower-policy proposal for the current observation. No actions are executed.',
          parameters: { requestId: { type: 'string', required: true } },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
          },
          execute: async (args, exec) => {
            const request = this.request(args.requestId);
            if (this.proposal) throw new Error('The current request already has a proposal.');
            const proposed = await this.options.propose!(request, exec.signal);
            exec.signal.throwIfAborted();
            this.request(args.requestId);
            this.validator.parse('ActionChunk', proposed);
            for (const key of [
              'request_id',
              'execution_id',
              'task_scope',
              'generation',
              'observation_id',
              'valid_until',
              'action_spec',
            ] as const)
              if (!isDeepStrictEqual(proposed[key], request[key]))
                throw new Error(`Lower proposal changed ${key}.`);
            if (proposed.actions.length > request.max_actions)
              throw new Error('Proposal exceeds the current action budget.');
            this.proposal = {
              id: randomUUID(),
              actions: proposed.actions.map((action) => this.action(action)),
            };
            return structuredClone({
              predictionId: this.proposal.id,
              actions: this.proposal.actions,
              physicalSteps: 0,
            });
          },
        }),
        defineTool({
          name: 'policy__review',
          description:
            'Review the exact lower-policy prediction. Allow at most 15 actions or intervene before issuing a direct correction.',
          parameters: {
            requestId: { type: 'string', required: true },
            predictionId: { type: 'string', required: true },
            decision: { type: 'string', enum: ['allow', 'intervene'], required: true },
            reason: { type: 'string', required: true },
            confidence: { type: 'number', required: true },
            safeSteps: { type: 'integer', required: true },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
          },
          execute: async (args) => {
            this.request(args.requestId);
            if (!this.proposal || this.proposal.id !== args.predictionId || this.review)
              throw new Error('Review requires the current unreviewed prediction.');
            if (
              !args.reason.trim() ||
              !Number.isFinite(args.confidence) ||
              args.confidence < 0 ||
              args.confidence > 1 ||
              !Number.isSafeInteger(args.safeSteps) ||
              args.safeSteps < 1 ||
              args.safeSteps > 15 ||
              args.safeSteps > this.proposal.actions.length
            )
              throw new Error('Review reason, confidence or prefix is invalid.');
            this.review = {
              decision: args.decision as Review['decision'],
              reason: args.reason,
              confidence: args.confidence,
              safeSteps: args.safeSteps,
            };
            return { predictionId: args.predictionId, ...this.review, physicalSteps: 0 };
          },
        }),
        defineTool({
          name: 'policy__execute',
          description:
            'Return only the approved prefix of the reviewed prediction to ActionGate. This tool does not dispatch device controls.',
          parameters: {
            requestId: { type: 'string', required: true },
            predictionId: { type: 'string', required: true },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
          },
          execute: async (args, exec) => {
            const request = this.request(args.requestId);
            if (
              !this.proposal ||
              this.proposal.id !== args.predictionId ||
              this.review?.decision !== 'allow'
            )
              throw new Error('Only a matching allowed review can authorize a prefix.');
            this.output = {
              mode: 'hybrid',
              request_id: request.request_id,
              proposal: this.proposal.actions,
              review: {
                decision: 'allow',
                reason: this.review.reason,
                confidence: this.review.confidence,
                safe_steps: this.review.safeSteps,
              },
            };
            exec.concludeTurn();
            return { accepted: true, safeSteps: this.review.safeSteps, physicalSteps: 0 };
          },
        }),
      );
    tools.push(...(this.options.observationTools?.(() => this.request()) ?? []));
    return tools;
  }

  async infer(input: unknown, signal?: AbortSignal): Promise<GptPolicyResponse> {
    if (this.closed || this.active) throw new Error('GPT policy is closed or already inferring.');
    const request = structuredClone(this.validator.parse('PolicyRequest', input));
    const remaining = Date.parse(request.valid_until) - Date.now();
    if (remaining <= 0) throw new Error('Policy request expired before inference.');
    this.active = true;
    using limit = deadline(
      signal,
      Math.min(remaining, this.options.timeoutMs ?? 120_000),
      'GPT_POLICY_TIMEOUT',
    );
    let abort: (() => void) | undefined;
    try {
      this.current = request;
      this.output = undefined;
      this.proposal = undefined;
      this.review = undefined;
      this.steps = 0;
      if (this.executionId !== request.execution_id) {
        await this.handle?.dispose();
        this.handle = await createDshSession(this.host, {
          sessionId: randomUUID(),
          provider: this.options.provider,
          model: this.options.model,
          instructions: `You are an action policy, not the Planner or Verifier. Use the explicit subgoal and current observation. Every tool proposes or reads; the EDH ActionGate alone commits controls. Never claim physical success. Use the exact requestId. ${this.options.mode === 'hybrid' ? 'Use policy__infer, inspect its action horizon, policy__review, then policy__execute for an allowed prefix or policy__joint_command/policy__eef_command for an intervention.' : 'Inspect the images, state, ActionSpec and optional grounding tools, then use policy__joint_command or policy__eef_command once.'} ${this.options.instructions ?? ''}`,
          tools: this.tools(),
        });
        this.executionId = request.execution_id;
        this.handle.agent.ctx.on('agent/pre-step', (_event, next) => {
          if (++this.steps > (this.options.maxModelSteps ?? 12))
            throw new Error('GPT policy model-step budget exhausted.');
          return next();
        });
      }
      limit.signal.throwIfAborted();
      abort = () => this.handle?.agent.cancel({ kind: 'user' });
      limit.signal.addEventListener('abort', abort, { once: true });
      const observed = await this.options.observation(request, limit.signal);
      limit.signal.throwIfAborted();
      const demonstration = this.options.demonstration;
      this.handle!.agent.followup(
        createUserMessage({
          source: { kind: 'plugin', plugin: 'edh-gpt-policy' },
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                kind: 'policy_invocation',
                requestId: request.request_id,
                taskScope: request.task_scope,
                instruction: request.instruction,
                actionSpec: request.action_spec,
                maxActions: request.max_actions,
                controlMode: this.mode,
                observation: observed.context,
                demonstration: this.mode === '0-shot' ? null : demonstration!.text,
              }),
            },
            ...observed.images.map((attachment) => ({ type: 'image' as const, attachment })),
            ...(this.mode === 'visual-1-shot'
              ? demonstration!.images!.map((attachment) => ({ type: 'image' as const, attachment }))
              : []),
          ],
        }),
      );
      await this.handle!.agent.whenIdle();
      limit.signal.throwIfAborted();
      if (!this.output)
        throw new Error('GPT policy turn ended without an admitted action decision.');
      this.options.audit?.({
        requestId: request.request_id,
        executionId: request.execution_id,
        mode: this.options.mode,
        controlMode: this.mode,
        response: this.output,
        events: this.handle!.agent.session.snapshotEvents(),
      });
      return structuredClone(this.output);
    } finally {
      if (abort) limit.signal.removeEventListener('abort', abort);
      this.current = undefined;
      this.active = false;
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.handle?.agent.cancel({ kind: 'user' });
    await this.handle?.dispose();
    this.handle = undefined;
  }
}
