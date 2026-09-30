import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Context } from '@deepseek-ai/cordis';
import type { AgentHandle } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { deadline } from '@deepseek-ai/dsh-timeout';
import { createDshSession } from '@edh/agents';
import { defineTool, type ToolDefinition } from '@edh/tools';
import type { ActionChunk, ContractValidator, PolicyRequest } from '@edh/contracts';
import { validatePolicyPlan, validatePolicyIntent, type PolicySubtask } from './policy-plan.js';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { BackendPolicyEvent } from './backend-port.js';
import { readPolicyEvent } from './policy-events.js';

export interface GptMotion {
  mode: 'eef' | 'joint';
  targets: Record<string, unknown>;
  steps: number;
  stop_on_reach: boolean;
}

export type GptControlMode = '0-shot' | 'textual-1-shot' | 'visual-1-shot';
export interface GptPolicyOptions {
  provider: string;
  model: string;
  mode: 'direct' | 'hybrid';
  controlMode?: GptControlMode;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
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
  event?(record: BackendPolicyEvent): void;
  timeoutMs?: number;
  maxModelSteps?: number;
  requirePlan?: boolean;
  providerTool?(
    request: PolicyRequest,
    operation: string,
    argumentsValue: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<Record<string, JsonValue>>;
}

type Review = {
  decision: 'allow' | 'intervene';
  reason: string;
  confidence: number;
  safeSteps: number;
  intent?: Record<string, JsonValue>;
};
export type GptPolicyResponse =
  | { mode: 'direct' | 'hybrid'; request_id: string; stop: true; reason: string }
  | { mode: 'direct'; request_id: string; action: number[]; motion?: GptMotion }
  | { mode: 'hybrid'; request_id: string; correction: number[]; motion?: GptMotion }
  | {
      mode: 'hybrid';
      request_id: string;
      proposal: number[][];
      review: {
        decision: 'allow' | 'intervene';
        reason: string;
        confidence: number;
        safe_steps: number;
        intent?: Record<string, JsonValue>;
      };
      intervention?: number[];
      motion?: GptMotion;
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
  private plan: PolicySubtask[] = [];
  private planCurrent = false;
  private planRevision = 0;
  private readonly groundingIds = new Set<string>();
  private auditCount = 0;
  private eventSequence = 0;

  private publish(type: string, data: Record<string, unknown>): void {
    const request = this.current;
    if (!request || !this.handle || this.executionId !== request.execution_id) return;
    const record: BackendPolicyEvent = {
      requestId: request.request_id,
      executionId: request.execution_id,
      taskScope: structuredClone(request.task_scope),
      generation: request.generation,
      observationId: request.observation_id,
      sessionId: this.handle.agent.session.id,
      sequence: ++this.eventSequence,
      at: new Date().toISOString(),
      type,
      data: JSON.parse(JSON.stringify(data)) as Record<string, unknown>,
    };
    readPolicyEvent(record, this.validator);
    this.options.audit?.({ kind: 'policy_event', ...record });
    this.options.event?.(record);
  }

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
    const planningCurrent = () => {
      if (this.options.requirePlan && !this.planCurrent)
        throw new Error('Update the complete execution plan for the current observation.');
    };
    const terminal = (action: number[], conclude: () => void, motion?: GptMotion) => {
      const request = this.request();
      planningCurrent();
      const admitted = this.action(action);
      if (this.options.mode === 'hybrid') {
        if (this.proposal && this.review?.decision !== 'intervene')
          throw new Error('Hybrid direct correction requires an intervened proposal.');
        this.output = this.proposal
          ? {
              mode: 'hybrid',
              request_id: request.request_id,
              proposal: this.proposal.actions,
              review: { ...this.review!, safe_steps: this.review!.safeSteps },
              intervention: admitted,
              ...(motion ? { motion } : {}),
            }
          : {
              mode: 'hybrid',
              request_id: request.request_id,
              correction: admitted,
              ...(motion ? { motion } : {}),
            };
        if ('review' in this.output)
          delete (this.output.review as Record<string, unknown>).safeSteps;
      } else
        this.output = {
          mode: 'direct',
          request_id: request.request_id,
          action: admitted,
          ...(motion ? { motion } : {}),
        };
      conclude();
      return { accepted: true, requestId: request.request_id, physicalSteps: 0 };
    };
    const tools: ToolDefinition[] = [
      defineTool({
        name: 'policy__stop',
        description:
          'End this policy execution for independent verification, citing the current observed subgoal outcome. No further controls are issued. This is not a formal success verdict.',
        parameters: {
          requestId: { type: 'string', required: true },
          reason: { type: 'string', required: true },
        },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        execute: async (args, exec) => {
          const request = this.request(args.requestId);
          planningCurrent();
          if (!args.reason.trim())
            throw new Error('Policy stop requires current observed evidence.');
          this.output = {
            mode: this.options.mode,
            request_id: request.request_id,
            stop: true,
            reason: args.reason,
          };
          exec.concludeTurn();
          return { accepted: true, physicalSteps: 0 };
        },
      }),
      defineTool({
        name: 'policy__update_plan',
        description:
          'Replace the complete local execution plan for this subgoal using current images. Record both arm assignments, reachability, prerequisites and observed evidence. No physical steps. A plan revision invalidates its proposal review.',
        parameters: {
          requestId: { type: 'string', required: true },
          subtasks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                status: {
                  type: 'string',
                  enum: ['pending', 'ready', 'in_progress', 'blocked', 'done'],
                  required: true,
                },
                src: { type: 'string', required: true },
                dst: { type: 'string', required: true },
                cond: { type: 'string', required: true },
                next_action: { type: 'string', required: true },
                evidence: { type: 'string', required: true },
                arm_plan: {
                  type: 'string',
                  enum: ['single', 'handoff', 'coordinated_dual'],
                  required: true,
                },
                arms_used: {
                  type: 'array',
                  items: { type: 'string', enum: ['left', 'right'] },
                  required: true,
                },
                simultaneous_arms: { type: 'integer', enum: [1, 2], required: true },
                reachability: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    'left.src': { type: 'string', enum: ['yes', 'no', 'unknown'], required: true },
                    'left.dst': { type: 'string', enum: ['yes', 'no', 'unknown'], required: true },
                    'right.src': { type: 'string', enum: ['yes', 'no', 'unknown'], required: true },
                    'right.dst': { type: 'string', enum: ['yes', 'no', 'unknown'], required: true },
                  },
                  required: true,
                },
                depends_on: { type: 'array', items: { type: 'string' }, required: true },
              },
            },
            required: true,
          },
          reason: { type: 'string', required: true },
        },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        execute: async (args) => {
          const request = this.request(args.requestId);
          if (!args.reason.trim()) throw new Error('Plan revision requires observed evidence.');
          this.plan = validatePolicyPlan(args.subtasks);
          this.planCurrent = true;
          this.review = undefined;
          const record = {
            requestId: request.request_id,
            revision: ++this.planRevision,
            subtasks: this.plan,
            reason: args.reason,
            physicalSteps: 0,
          };
          this.options.audit?.({
            kind: 'policy_plan',
            executionId: request.execution_id,
            ...record,
          });
          this.publish('plan', record);
          return structuredClone(record);
        },
      }),
      ...(!this.options.providerTool
        ? [
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
                if (!args.reason.trim()) throw new Error('An action reason is required.');
                exec.signal.throwIfAborted();
                return terminal(args.action, () => exec.concludeTurn());
              },
            }),
          ]
        : []),
    ];
    if (this.options.providerTool) {
      const output = {
        schema: { type: 'object', additionalProperties: true } as const,
        render: (_args: unknown, value: unknown) => [
          { type: 'text' as const, text: JSON.stringify(value) },
        ],
      };
      for (const [name, operation, parameters] of [
        [
          'policy__grounding',
          'grounding',
          { x: { type: 'integer', required: true }, y: { type: 'integer', required: true } },
        ],
        [
          'policy__get_depth',
          'get_depth',
          {
            arm: { type: 'string', enum: ['left', 'right'], required: true },
            x: { type: 'integer', required: true },
            y: { type: 'integer', required: true },
          },
        ],
      ] as const)
        tools.push(
          defineTool({
            name,
            description:
              operation === 'grounding'
                ? 'Read a head RGB-D pixel surface point in environment_origin. Original pixel coordinates; no motion.'
                : 'Read a wrist pixel depth along the camera optical axis in metres. No motion.',
            parameters: { requestId: { type: 'string', required: true }, ...parameters },
            output,
            execute: async (args, exec) => {
              const request = this.request(args.requestId);
              const { requestId: _id, ...inputs } = args;
              const result = await this.options.providerTool!(
                request,
                operation,
                inputs,
                exec.signal,
              );
              this.request(args.requestId);
              if (result.ok === false) throw new Error(String(result.error));
              if (operation === 'grounding') {
                if (typeof result.grounding_id !== 'string')
                  throw new Error('Grounding returned no evidence identity.');
                this.groundingIds.add(result.grounding_id);
              }
              return result;
            },
          }),
        );
      for (const mode of ['eef', 'joint'] as const) {
        const armTarget = {
          type: 'object',
          additionalProperties: false,
          properties: {
            ...(mode === 'eef'
              ? ({
                  position: {
                    type: 'array',
                    items: { type: 'number' },
                    required: true,
                    description:
                      'Exactly three link6 coordinates [x,y,z] in environment_origin, metres.',
                  },
                  quaternion_wxyz: {
                    type: 'array',
                    items: { type: 'number' },
                    required: true,
                    description: 'Exactly four normalized quaternion values [w,x,y,z].',
                  },
                } as const)
              : ({
                  qpos: {
                    type: 'array',
                    items: { type: 'number' },
                    required: true,
                    description:
                      'Exactly six joint values in radians, interpreted using coordinateMode.',
                  },
                } as const)),
            gripper_closed: { type: 'boolean', required: true },
          },
        } as const;
        tools.push(
          defineTool({
            name: mode === 'eef' ? 'policy__eef_target' : 'policy__joint_target',
            description:
              mode === 'eef'
                ? 'Prepare absolute link6 poses for both arms in environment_origin using measured-state numerical IK. Use previewOnly to inspect FK without motion. Submit a bounded velocity-limited tracking intent through ActionGate.'
                : 'Prepare absolute/delta six-joint targets in radians and explicit grippers for both arms. Delta is anchored once to current measured qpos. Preview FK before recovery; every actual command passes ActionGate.',
            parameters: {
              requestId: { type: 'string', required: true },
              targets: {
                type: 'object',
                additionalProperties: false,
                required: true,
                properties: {
                  left: { ...armTarget, required: true },
                  right: { ...armTarget, required: true },
                },
              },
              coordinateMode: { type: 'string', enum: ['absolute', 'delta'] },
              previewOnly: { type: 'boolean', required: true },
              steps: { type: 'integer', required: true },
              stopOnReach: { type: 'boolean', required: true },
              reason: {
                type: 'string',
                required: true,
                description:
                  'Use exactly "left: <observed intent>, right: <observed intent>" with a comma before right. Describe active motion and the other arm hold.',
                examples: [
                  'left: hold measured pose open, right: approach grounded target with open gripper',
                ],
              },
            },
            output,
            execute: async (args, exec) => {
              const request = this.request(args.requestId);
              planningCurrent();
              if (!Number.isSafeInteger(args.steps) || args.steps < 1 || args.steps > 150)
                throw new Error('Direct motion requires 1..150 integer control steps.');
              if (!/^left: .+, right: .+$/.test(args.reason))
                throw new Error(
                  'Motion reason must use "left: <intent>, right: <intent>" with a comma separator.',
                );
              if (mode === 'joint' && !args.coordinateMode)
                throw new Error('Joint targets require absolute/delta coordinateMode.');
              const prepared = await this.options.providerTool!(
                request,
                mode === 'eef' ? 'prepare_targets' : 'prepare_joints',
                {
                  targets: args.targets,
                  ...(mode === 'joint' ? { coordinate_mode: args.coordinateMode } : {}),
                },
                exec.signal,
              );
              this.request(args.requestId);
              if (prepared.ok !== true)
                throw new Error(`Motion preparation failed: ${String(prepared.error)}`);
              if (args.previewOnly) return prepared;
              const proposal = await this.options.providerTool!(
                request,
                'eef_joint_target',
                { targets: args.targets },
                exec.signal,
              );
              exec.signal.throwIfAborted();
              this.request(args.requestId);
              if (!Array.isArray(proposal.action))
                throw new Error('Motion preparation returned no action.');
              return terminal(proposal.action as number[], () => exec.concludeTurn(), {
                mode,
                targets: args.targets,
                steps: args.steps,
                stop_on_reach: args.stopOnReach,
              });
            },
          }),
        );
      }
    }
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
            planningCurrent();
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
            planningCurrent();
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
            const fk = this.options.providerTool
              ? await this.options.providerTool(
                  request,
                  'fk_preview',
                  { actions: this.proposal.actions },
                  exec.signal,
                )
              : undefined;
            this.request(args.requestId);
            if (
              fk &&
              (!(fk.measured_fk_check as { passed?: boolean } | undefined)?.passed ||
                !Array.isArray(fk.trajectory) ||
                fk.trajectory.length !== this.proposal.actions.length)
            )
              throw new Error('FK preview failed measured robot validation.');
            return structuredClone({
              predictionId: this.proposal.id,
              actions: this.proposal.actions,
              physicalSteps: 0,
              ...(fk ? { fk } : {}),
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
            intent: { type: 'object', additionalProperties: true },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
          },
          execute: async (args) => {
            this.request(args.requestId);
            planningCurrent();
            if (!this.proposal || this.proposal.id !== args.predictionId || this.review)
              throw new Error('Review requires the current unreviewed prediction.');
            if (
              !args.reason.trim() ||
              !Number.isFinite(args.confidence) ||
              args.confidence < 0 ||
              args.confidence > 1 ||
              !Number.isSafeInteger(args.safeSteps) ||
              args.safeSteps < 0 ||
              args.safeSteps > 15 ||
              args.safeSteps > this.proposal.actions.length
            )
              throw new Error('Review reason, confidence or prefix is invalid.');
            if (
              (args.decision === 'allow' && args.safeSteps === 0) ||
              (args.decision === 'intervene' && args.safeSteps !== 0)
            )
              throw new Error(
                'Allow requires a positive prefix; intervention requires zero steps.',
              );
            const intent = this.options.requirePlan
              ? validatePolicyIntent(
                  args.intent,
                  args.decision as Review['decision'],
                  this.plan,
                  this.groundingIds,
                )
              : undefined;
            this.review = {
              decision: args.decision as Review['decision'],
              reason: args.reason,
              confidence: args.confidence,
              safeSteps: args.safeSteps,
              ...(intent ? { intent } : {}),
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
            planningCurrent();
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
                ...(this.review.intent ? { intent: this.review.intent } : {}),
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
      this.planCurrent = false;
      this.groundingIds.clear();
      if (this.executionId !== request.execution_id) {
        await this.handle?.dispose();
        this.plan = [];
        this.planRevision = 0;
        this.auditCount = 0;
        this.eventSequence = 0;
        this.handle = await createDshSession(this.host, {
          sessionId: randomUUID(),
          provider: this.options.provider,
          model: this.options.model,
          ...(this.options.reasoningEffort
            ? { reasoningEffort: ReasoningEffortId(this.options.reasoningEffort) }
            : {}),
          instructions: `You are the execution policy for the Planner's explicit subgoal. High-level retry/replan and formal verification belong to their independent roles. Every tool proposes or reads; ActionGate commits controls. Use fresh images and the exact requestId. ${this.options.requirePlan ? 'Before inference or motion, call policy__update_plan with the complete observed local plan. Subtasks require id/status/src/dst/cond/next_action/evidence, arm_plan(single/handoff/coordinated_dual), arms_used, simultaneous_arms, reachability(left.src/left.dst/right.src/right.dst: yes/no/unknown), depends_on. Update after every motion; preserve prerequisites. ' : ''}${this.options.mode === 'hybrid' ? 'Infer, inspect all FK trajectories and grippers, revise the plan if needed, review intent for both arms, then execute 1..15 allowed actions (near contact 1..5). Unknown intent or failure requires intervention with safeSteps=0. The entire remaining proposal is discarded after execution. Direct correction can be selected before inference, or after an intervened proposal.' : 'Inspect head/wrist images, state, limits and grounding, then propose a bounded EEF/joint motion.'} ${this.options.instructions ?? ''}`,
          tools: this.tools(),
        });
        this.executionId = request.execution_id;
        let turn = 0;
        this.handle.agent.ctx.on('session/event', (_session, event) => {
          if (event.type === 'turn/start') turn = event.data.turn;
          if (
            [
              'turn/start',
              'turn/end',
              'step/start',
              'step/end',
              'assistant/message',
              'tool/call',
              'tool/result',
              'request/context',
            ].includes(event.type) &&
            (event.type !== 'tool/result' || event.surfaceOp === 'append')
          )
            this.publish(event.type, { turn, sessionSequence: event.seq, ...event.data });
        });
        this.handle.agent.ctx.on('agent/status', ({ status }) =>
          this.publish('status', { status }),
        );
        let latestStream:
          | { attemptId: string; revision: number; text: string; reasoning: string; status: string }
          | undefined;
        let publishedAt = 0;
        this.handle.agent.ctx.on('agent/assistant-stream', ({ frame }) => {
          if (frame.type === 'start')
            latestStream = {
              attemptId: frame.attemptId,
              revision: frame.revision,
              text: '',
              reasoning: '',
              status: 'streaming',
            };
          if (!latestStream || latestStream.attemptId !== frame.attemptId) return;
          latestStream.revision = frame.revision;
          if (frame.type === 'chunk') {
            if (!['text-delta', 'reasoning-delta'].includes(frame.chunk.type)) return;
            if (frame.chunk.type === 'text-delta')
              latestStream.text = (latestStream.text + frame.chunk.text).slice(-16000);
            if (frame.chunk.type === 'reasoning-delta')
              latestStream.reasoning = (latestStream.reasoning + frame.chunk.text).slice(-16000);
          }
          if (frame.type === 'end') latestStream.status = frame.outcome.kind;
          if (frame.type !== 'chunk' || Date.now() - publishedAt >= 100) {
            publishedAt = Date.now();
            this.publish('stream', latestStream);
          }
        });
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
                currentPlan: this.plan,
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
      this.publish('decision', { response: this.output, mode: this.options.mode });
      this.options.audit?.({
        requestId: request.request_id,
        executionId: request.execution_id,
        mode: this.options.mode,
        controlMode: this.mode,
        response: this.output,
        events: this.handle!.agent.session.snapshotEvents().slice(this.auditCount),
      });
      this.auditCount = this.handle!.agent.session.snapshotEvents().length;
      return structuredClone(this.output);
    } catch (error) {
      this.publish('failure', { message: error instanceof Error ? error.message : String(error) });
      throw error;
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
