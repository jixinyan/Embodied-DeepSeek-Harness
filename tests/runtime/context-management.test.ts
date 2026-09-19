import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import {
  LlmAdapter,
  createUserMessage,
  type GenerateOptions,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { createDshSession } from '@edh/agents';
import { defineTool } from '@edh/tools';
import { textResponse, toolResponse } from './scripted-model.js';
import { type ContextManagementOptions } from '@edh/memory';

const summary =
  'Goal place-cup; criteria inside(cup,cabinet), contract-v1. Attempt-1 failed at boundary-A. Evidence frame-7 is historical. Planner must inspect current evidence; no new execution has been authorized.';
class ContextModel extends LlmAdapter {
  requests: GenerateOptions[] = [];
  failure: 'none' | 'empty' | 'large' | 'truncated' | 'blocked' = 'none';
  summaryStarted = false;
  override async resolveModel(provider: string, id: string) {
    return { provider, id, name: id, context: { contextWindow: 4000 } };
  }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options);
    if (options.purpose === 'compaction') {
      this.summaryStarted = true;
      assert.match(JSON.stringify(options.messages.at(-1)), /Goal and Authoritative Conditions/);
      if (this.failure === 'blocked')
        await setTimeout(10000, undefined, { signal: options.signal! });
      if (this.failure === 'truncated') {
        yield { type: 'finish', reason: { kind: 'max-tokens' } };
        return;
      }
      yield* textResponse(
        this.failure === 'empty' ? '' : this.failure === 'large' ? 'huge '.repeat(10000) : summary,
      )(options);
      return;
    }
    const last = options.messages.at(-1)!;
    if (last.content.some((block) => block.type === 'tool-result')) {
      yield* textResponse('Read accepted; wait for another explicit instruction.')(options);
    } else {
      yield* toolResponse('read_scene', {}, `read-${this.requests.length}`)(options);
    }
  }
}
async function setup(
  policy: ContextManagementOptions = { compaction: { auto: false } },
  runtimeContext?: () => string,
) {
  const model = new ContextModel();
  const host = await createDshHost([{ providers: ['fixture'], adapter: model }], policy);
  const agent = await createDshSession(host, {
    sessionId: 'context-planner',
    ...(runtimeContext ? { runtimeContext } : {}),
    provider: 'fixture',
    model: 'fixture',
    instructions:
      'PLANNER_ONLY. Task criteria stay authoritative. Do not invent motion permissions.',
    tools: [
      defineTool({
        name: 'read_scene',
        description: 'Read a synthetic historical scene.',
        parameters: {},
        output: {
          schema: { type: 'string' },
          render: (_args, value) => [{ type: 'text', text: value }],
        },
        async execute() {
          return 'Observed frame-7. ' + 'historical-text '.repeat(500);
        },
      }),
    ],
  });
  const send = async (text: string) => {
    agent.agent.followup(
      createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] }),
    );
    await agent.agent.whenIdle();
    const ends = agent.agent.session.snapshotEvents().filter((e) => e.type === 'turn/end');
    assert.notEqual(ends.at(-1)?.data.reason.kind, 'error', JSON.stringify(ends.at(-1)));
  };
  return { host, model, agent, send };
}

test('native compaction shrinks balanced history, keeps audit and resumes the same isolated role', async () => {
  const f = await setup();
  try {
    await f.send('Place cup in cabinet. ' + 'original-context '.repeat(600));
    const before = f.host.tokenMeter.measure(f.agent.agent.session).totalTokens;
    const original = f.agent.agent.session.snapshotEvents();
    const result = await f.host.compaction.compactNow(f.agent.agent, new AbortController().signal);
    assert(result);
    assert(f.host.tokenMeter.measure(f.agent.agent.session).totalTokens < before);
    assert.deepEqual(f.agent.agent.session.snapshotEvents().slice(0, original.length), original);
    const sibling = await createDshSession(f.host, {
      sessionId: 'other-role',
      provider: 'fixture',
      model: 'fixture',
      instructions: 'SIBLING_ONLY',
      tools: [],
    });
    assert.equal(sibling.agent.session.snapshotEvents().length, 0);
    await f.send('Inspect the latest evidence before any new decision.');
    const input = f.model.requests.filter((r) => r.purpose !== 'compaction').at(-2)!;
    assert.match(JSON.stringify(input.messages), /contract-v1/);
    assert.match(JSON.stringify(input.messages), /latest evidence/);
    assert.doesNotMatch(JSON.stringify(input.messages), /original-context original-context/);
    assert.doesNotMatch(JSON.stringify(input), /SIBLING_ONLY/);
    assert.match(input.system!, /PLANNER_ONLY/);
    assert(
      f.agent.agent.session
        .snapshotEvents()
        .some((e) => e.type === 'compaction/end' && !e.data.error),
    );
  } finally {
    await f.host.fiber.dispose();
  }
});

test('automatic DSH pressure compaction runs between native steps', async () => {
  const f = await setup({
    compaction: { thresholdRatio: 0.6, retainTokens: 0, maxTokens: 512, compactionRetries: 0 },
  });
  try {
    await f.send('goal place-cup ' + 'pressure '.repeat(2000));
    assert(f.model.requests.some((r) => r.purpose === 'compaction'));
    assert(f.agent.agent.session.snapshotEvents().some((e) => e.type === 'compaction/summary'));
    assert.equal(f.agent.agent.status, 'idle');
  } finally {
    await f.host.fiber.dispose();
  }
});

test('rejected summaries preserve the original surface and cancellation releases the compaction lock', async () => {
  for (const failure of ['empty', 'large', 'truncated', 'blocked'] as const) {
    const f = await setup();
    try {
      await f.send('Keep original evidence. ' + 'unchanged-history '.repeat(600));
      const original = [...f.agent.agent.session.surface.nodes];
      f.model.failure = failure;
      const controller = new AbortController();
      const attempt = f.host.compaction.compactNow(f.agent.agent, controller.signal);
      const rejected = assert.rejects(attempt);
      if (failure === 'blocked') {
        while (!f.model.summaryStarted) await setTimeout(5);
        assert.throws(
          () => f.host.compaction.compactNow(f.agent.agent, new AbortController().signal),
          /idle|busy|active/,
        );
        controller.abort(new Error('Cancelled summary.'));
      }
      await rejected;
      assert.deepEqual([...f.agent.agent.session.surface.nodes], original);
      assert(
        f.agent.agent.session
          .snapshotEvents()
          .some((e) => e.type === 'compaction/end' && e.data.error),
      );
      f.model.failure = 'none';
      assert(await f.host.compaction.compactNow(f.agent.agent, new AbortController().signal));
    } finally {
      await f.host.fiber.dispose();
    }
  }
});

test('native context refresh restores authoritative scoped facts after a lossy checkpoint', async () => {
  let state = { criterion: 'cup inside cabinet AND door closed', boundary: 'B-1', version: 1 };
  const f = await setup(undefined, () => JSON.stringify(state));
  try {
    await f.send('Long prior work ' + 'historical-detail '.repeat(600));
    await f.host.compaction.compactNow(f.agent.agent, new AbortController().signal);
    state = { ...state, boundary: 'B-2', version: 2 };
    await f.send('Check the current authoritative boundary before deciding.');
    const current = f.model.requests.filter((r) => r.purpose !== 'compaction').at(-1)!;
    const serialized = JSON.stringify(current.messages);
    assert.match(serialized, /cup inside cabinet AND door closed/);
    assert.match(serialized, /B-2/);
    assert.doesNotMatch(serialized, /B-1/);
    assert.match(serialized, /snapshot supersedes/);
    assert.match(current.system!, /PLANNER_ONLY/);
    assert(
      f.agent.agent.session
        .snapshotEvents()
        .some(
          (event) => event.type === 'user/message' && JSON.stringify(event.data).includes('B-2'),
        ),
    );
  } finally {
    await f.host.fiber.dispose();
  }
});
