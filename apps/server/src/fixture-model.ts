import { multiGoalChoice } from './multi-goal-fixture.js';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import {
  LlmAdapter,
  ToolCallId,
  type GenerateOptions,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm';
import type { InvocationBrief, PlanDocument, VerificationResult } from '@edh/contracts';

function readResult(
  message: GenerateOptions['messages'][number] | undefined,
): Record<string, unknown> {
  if (!message) return {};
  for (const block of message.content) {
    if (block.type === 'tool-result') {
      if (block.isError)
        throw new Error(`Fixture model received a tool error: ${JSON.stringify(block.content)}`);
      for (const content of block.content)
        if (content.type === 'text') {
          try {
            return JSON.parse(content.text) as Record<string, unknown>;
          } catch {
            return { message: content.text };
          }
        }
    }
  }
  return {};
}
/** Deterministic test model. It emits native model chunks; DSH owns all tool execution. */
export class FixtureModel extends LlmAdapter {
  readonly requests: { sessionId: string; toolNames: string[]; messageCount: number }[] = [];
  constructor(private readonly delayMs = 140) {
    super();
  }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (this.delayMs)
      await setTimeout(this.delayMs, undefined, options.signal ? { signal: options.signal } : {});
    options.signal?.throwIfAborted();
    this.requests.push({
      sessionId: options.sessionId ?? 'none',
      toolNames: options.tools?.map((t) => t.name) ?? [],
      messageCount: options.messages.length,
    });
    let cursor = options.messages.length - 1;
    while (
      cursor >= 0 &&
      options.messages[cursor]!.source.kind !== 'plugin' &&
      options.messages[cursor]!.source.kind !== 'user'
    )
      cursor--;
    const incoming = options.messages[cursor];
    const text = incoming?.content.find((c) => c.type === 'text');
    if (text?.type !== 'text') throw new Error('Missing explicit fixture invocation.');
    const { payload } = JSON.parse(text.text) as {
      payload: {
        kind: string;
        finalGoalId?: string;
        recoveryId?: string;
        events?: { sequence: number; type: string; detail: Record<string, unknown> }[];
        brief?: InvocationBrief;
        result?: VerificationResult;
        execution?: { state: string };
      };
    };
    const results = options.messages
      .slice(cursor + 1)
      .filter((m) => m.content.some((c) => c.type === 'tool-result'));
    const step = results.length;
    const previous = readResult(results.at(-1));
    const brief = payload.brief;
    let name: string | undefined;
    let args: Record<string, unknown> = {};
    const call = (tool: string, input: Record<string, unknown> = {}) => {
      name = tool.replaceAll('.', '__');
      args = input;
    };
    const todos = (active: number, recovery = false) =>
      call('todo_write', {
        todos: (recovery
          ? [
              'Inspect the scene and failure evidence',
              'Replan the failed subgoal',
              'Execute the revised placement',
              'Verify the original goal',
            ]
          : [
              'Inspect scene and retrieve experience',
              'Execute placement subgoal',
              'Verify the final cup-container relation',
            ]
        ).map((content, index) => ({
          content,
          status: index < active ? 'completed' : index === active ? 'in_progress' : 'pending',
        })),
      });
    const multi = multiGoalChoice(payload, step, previous);
    if (multi !== undefined) {
      if (multi) call(multi.tool, multi.input);
    } else if (payload.kind === 'initial') {
      if (step === 0) todos(0);
      if (step === 5) todos(1);
      if (step === 1) call('skills.search', { query: 'cup container access' });
      if (step === 2) call('perception.capture');
      if (step === 3) call('planning.read');
      if (step === 4) {
        const plan: PlanDocument = {
          schema_version: 'physical.plan.v1',
          task_id: String(previous.taskId),
          version: 1,
          owner_agent_id: String(previous.ownerAgentId),
          owner_assignment_id: String(previous.ownerAssignmentId),
          items: [
            {
              goal_id: 'place-cup',
              description: 'Place the cup inside the cabinet and verify the final relation.',
              status: 'active',
              dependencies: [],
              success_contract: brief!.success_contract,
            },
          ],
        };
        call('planning.update', { plan, expectedVersion: 0 });
      }
      if (step === 6) call('execution.start', { instruction: brief!.objective });
    } else if (payload.kind === 'formal-verification') {
      if (step === 0) call('verification.check');
      if (step === 1) {
        const facts = previous.facts as { value: boolean | null }[];
        const status = facts.some((f) => f.value === false)
          ? 'failed'
          : facts.some((f) => f.value === null)
            ? 'unknown'
            : 'passed';
        call('verification.submit', {
          status,
          explanation:
            status === 'passed'
              ? 'The requested predicates are true at the current stopped boundary.'
              : status === 'failed'
                ? 'At least one requested predicate is false at the current stopped boundary.'
                : 'The provider cannot establish the requested predicate.',
        });
      }
    } else if (payload.kind === 'monitor') {
      if (step === 0) call('perception.capture');
    } else if (payload.kind === 'verdict') {
      if (payload.result?.status === 'failed' && payload.execution?.state === 'ended') {
        if (step === 0) todos(1, true);
        if (step === 4) todos(2, true);
        const summary =
          'The first placement subgoal ran to its step budget; formal verification reports that the cup remains outside the cabinet.';
        const changes = [
          'Check cabinet access and request a placement subgoal with a clear final relation.',
        ];
        if (step === 1)
          call('tasks.replan', {
            reason: 'Placement failed verification.',
            changes,
            attemptSummary: summary,
          });
        if (step === 2) call('tasks.retry', { changes, attemptSummary: summary });
        if (step === 3) call('observation.turn_view', { direction: 'center' });
        if (step === 5)
          call('execution.start', {
            instruction: 'Ensure cabinet access, then place the cup inside the cabinet.',
          });
      } else if (payload.result?.status === 'passed') {
        if (step === 0) todos(4);
        if (step === 1) call('planning.read');
        if (step === 2) {
          const plan = previous.plan as PlanDocument;
          call('planning.update', {
            plan: {
              ...plan,
              version: plan.version + 1,
              items: plan.items.map((item) => ({
                ...item,
                status: 'done',
                last_verdict_ref: payload.result!.verdict_id,
              })),
            },
            expectedVersion: plan.version,
          });
        }
        if (step === 3) call('tasks.finish');
      } else if (payload.result?.status === 'unknown' && step === 0)
        call('tasks.abandon', {
          status: 'unknown',
          reason: 'Formal verification is unknown. The fixture cannot provide sufficient evidence.',
        });
      // A failed paused boundary waits for the user; no automatic retry or resume.
    } else if (payload.kind === 'resume-request') {
      if (step === 0) call('execution.query');
      if (step === 1 && (previous.execution as { state?: string } | null)?.state === 'paused')
        call('execution.resume');
    } else if (payload.kind === 'recovery-start') {
      if (step === 0)
        call('files.write', {
          path: 'recovery.md',
          content: `# Recovery observation\n\n${JSON.stringify(payload, null, 2)}`,
          expectedVersion: 0,
        });
    } else if (payload.kind === 'recovery-progress') {
      if (step === 0) call('files.read', { path: 'recovery.md' });
      if (step === 1)
        call('files.write', {
          path: 'recovery.md',
          content:
            String(previous.content) +
            '\n\n## Recovery progress\n' +
            JSON.stringify({
              recoveryId: payload.recoveryId,
              events: payload.events?.map((event) => ({
                sequence: event.sequence,
                type: event.type,
                summary: JSON.stringify(event.detail).slice(0, 240),
              })),
            }),
          expectedVersion: Number(previous.version),
        });
    } else if (payload.kind === 'recovery-success') {
      if (step === 0) call('files.read', { path: 'recovery.md' });
      if (step === 1)
        call('skills.save', {
          markdown:
            '# Verify access before repeating placement\n\n## When to use\nA placement subgoal has stopped and the object is still outside its target container.\n\n## Failure signals\nObserved: the first attempt exhausted its budget while the authoritative cup-inside predicate remained false.\n\n## Possible causes\nHypothesis: access or instruction grounding may need attention. No physical cause is established: this fixture deliberately fails the first attempt. The successful retry does not prove that access caused the failure.\n\n## Avoid\nDo not treat a policy stop as success or repeat an unchanged instruction without checking current evidence. Do not transfer this rule where the failed predicate or target relation differs.\n\n## Planning guidance\nRe-observe the access region and request a subgoal that states the final object-container relation. Do not repeat an unchanged attempt blindly.\n\n## Verification guidance\nAfter confirmed stopping, check the authoritative inside relation using fresh evidence. A policy stop is not proof of completion.\n\n## Limits\nThis is a deterministic CPU fixture recovery. The heuristic is a transfer candidate, not demonstrated performance across robots or environments.\n\n## Source\nThe attached metadata identifies the recovery and accepted original-goal verdict.',
        });
    } else if (
      payload.kind === 'delegated' &&
      step === 0 &&
      options.tools?.some((t) => t.name === 'perception__capture')
    )
      call('perception.capture');
    if (name) {
      if (!options.tools?.some((t) => t.name === name))
        throw new Error(`Fixture scenario requires unavailable tool: ${name}`);
      const notes: Record<string, string> = {
        todo_write: 'Update the work checklist so the next active step is visible.',
        skills__search:
          'Look for relevant failure and recovery knowledge before choosing the first subgoal.',
        perception__capture: 'Inspect a current observation before judging the scene.',
        execution__start:
          'Submit the language subgoal with a bounded execution budget; wait for formal verification.',
        tasks__replan:
          'The verifier reports the original subgoal failed. Open recovery and give the Evolver the failed attempt and proposed changes.',
        tasks__retry: 'Keep the original success criteria and authorize the next attempt.',
        verification__check:
          'The execution reached a stopped boundary. Read only the required ground-truth predicates using fresh evidence.',
        verification__submit:
          'Report the checked predicates, preserving uncertainty rather than assuming success.',
        skills__save:
          'Summarize observed failure signals, possible causes and the successful correction, without claiming causality or transfer.',
        tasks__finish: 'The current original-goal verdict passed. Mark the task successful.',
      };
      const note =
        notes[name] ?? `Use ${name.replaceAll('__', '.')} within the current assignment.`;
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'text-delta', index: 0, text: note };
      yield { type: 'block-end', index: 0, block: { type: 'text', text: note } };
      const id = ToolCallId(randomUUID());
      const argumentsJson = JSON.stringify(args);
      yield { type: 'block-start', index: 1, blockType: 'tool-call' };
      yield { type: 'tool-call-delta', index: 1, id, name, argumentsDelta: argumentsJson };
      yield {
        type: 'block-end',
        index: 1,
        block: { type: 'tool-call', id, name, arguments: argumentsJson },
      };
      yield { type: 'finish', reason: { kind: 'tool-calls' } };
    } else {
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield {
        type: 'text-delta',
        index: 0,
        text: 'Fixture role turn complete. Waiting for explicit context.',
      };
      yield {
        type: 'block-end',
        index: 0,
        block: { type: 'text', text: 'Fixture role turn complete. Waiting for explicit context.' },
      };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }
}
