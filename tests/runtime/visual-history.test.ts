import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LlmAdapter,
  createUserMessage,
  type ContentBlock,
  type GenerateOptions,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { AttachmentId } from '@deepseek-ai/dsh-attachment';
import { createDshSession } from '@edh/agents';
import { contextManagementOptions, type ContextManagementOptions } from '@edh/memory';
import { defineTool } from '@edh/tools';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { imageReferences } from '../../harness/agent-runtime/memory/src/visual-history.js';
import { textResponse, toolResponse } from './scripted-model.js';

function frames(prefix: string, n = 3): ContentBlock[] {
  return Array.from({ length: n }, (_, i) => ({
    type: 'image',
    attachment: {
      attachmentId: AttachmentId(`${prefix}-${i}`),
      mediaType: 'image/png',
      bytes: 68,
      width: 1,
      height: 1,
    },
  }));
}
function ids(input: GenerateOptions): string[] {
  return input.messages.flatMap((m) => imageReferences(m.content));
}
class VisualModel extends LlmAdapter {
  requests: GenerateOptions[] = [];
  tools = false;
  override async resolveModel(provider: string, id: string) {
    return { provider, id, name: id, context: { contextWindow: 4000 } };
  }
  override async *stream(input: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(input);
    if (input.purpose === 'compaction') {
      yield* textResponse(
        'Historical observations only. Cup must be inside cabinet. Inspect current evidence before deciding.',
      )(input);
    } else if (
      this.tools &&
      !input.messages.at(-1)!.content.some((b) => b.type === 'tool-result')
    ) {
      yield* toolResponse('capture', {}, `capture-${this.requests.length}`)(input);
    } else yield* textResponse('Observation received; task remains unverified.')(input);
  }
}
async function fixture(policy: ContextManagementOptions | undefined, toolImages = 2) {
  const model = new VisualModel();
  let calls = 0;
  const host = await createDshHost([{ providers: ['fixture'], adapter: model }], policy);
  const handle = await createDshSession(host, {
    sessionId: 'visual-planner',
    provider: 'fixture',
    model: 'fixture',
    instructions: 'Planner private role.',
    tools: [
      defineTool({
        name: 'capture',
        description: 'Synthetic multi-view capture.',
        parameters: {},
        output: {
          schema: { type: 'number' },
          render: (_args, value) => [
            { type: 'text', text: `Observed batch ${value}.` },
            ...frames(`tool-${value}`, toolImages),
          ],
        },
        async execute() {
          return ++calls;
        },
      }),
    ],
  });
  const send = async (content: ContentBlock[]) => {
    handle.agent.followup(createUserMessage({ source: { kind: 'user' }, content }));
    await handle.agent.whenIdle();
    return handle.agent.session
      .snapshotEvents()
      .filter((e) => e.type === 'turn/end')
      .at(-1)!;
  };
  return { model, host, handle, send, calls: () => calls };
}

test('visual policy rejects malformed budgets and remains explicit opt-in', async () => {
  for (const visualHistory of [
    null,
    {},
    { maxImages: 0 },
    { maxImages: 1.5 },
    { maxImages: 1025 },
    { maxImages: 4, silentlyDrop: true },
  ])
    assert.throws(
      () => contextManagementOptions({ visualHistory } as ContextManagementOptions),
      /visualHistory/,
    );
  const f = await fixture(undefined);
  try {
    for (let i = 0; i < 3; i++) await f.send(frames(`unbounded-${i}`, 2));
    assert.equal(ids(f.model.requests.at(-1)!).length, 6);
    assert(!f.handle.agent.session.snapshotEvents().some((e) => e.type === 'edh/visual-history'));
  } finally {
    await f.host.fiber.dispose();
  }
});

test('forty observation batches retain complete recent views with original audits and isolated roles', async () => {
  const f = await fixture({ compaction: { auto: false }, visualHistory: { maxImages: 6 } });
  try {
    const sibling = await createDshSession(f.host, {
      sessionId: 'visual-sibling',
      provider: 'fixture',
      model: 'fixture',
      instructions: 'Independent role.',
      tools: [],
    });
    let original: unknown;
    for (let i = 0; i < 40; i++) {
      const end = await f.send([
        { type: 'text', text: `Task condition unchanged. Batch ${i}.` },
        ...frames(`view-${i}`),
      ]);
      assert.notEqual(end.data.reason.kind, 'error', JSON.stringify(end));
      const input = f.model.requests.at(-1)!;
      assert.deepEqual(
        ids(input),
        (i ? [i - 1, i] : [i]).flatMap((k) => imageReferences(frames(`view-${k}`))),
      );
      if (i === 0) original = f.handle.agent.session.snapshotEvents()[2];
    }
    const events = f.handle.agent.session.snapshotEvents();
    assert.deepEqual(events[2], original);
    assert.equal(
      events.filter(
        (e) =>
          e.type === 'user/message' &&
          e.surfaceOp === 'append' &&
          imageReferences(e.data.content).length,
      ).length,
      40,
    );
    assert.equal(events.filter((e) => e.type === 'edh/visual-history').length, 38);
    assert(
      events
        .filter((e) => e.type === 'edh/visual-history')
        .every((e) => e.data.retainedImages === 6),
    );
    assert.match(
      JSON.stringify(f.model.requests.at(-1)!.messages),
      /Historical image omitted.*view-0/,
    );
    assert.equal(sibling.agent.session.snapshotEvents().length, 0);
    const replay = f.host.sessions.create(SessionId('audit-replay'), { seed: events });
    assert.deepEqual(replay.deriveMessages(), f.handle.agent.session.deriveMessages());
    assert.equal(
      f.host.tokenMeter.measure(replay).surfaceTokens,
      f.host.tokenMeter.measure(f.handle.agent.session).surfaceTokens,
    );
    const generation = f.handle.agent.session.surface.replaceGeneration;
    await f.send([{ type: 'text', text: 'Continue without a new observation.' }]);
    assert.equal(f.handle.agent.session.surface.replaceGeneration, generation);
    assert.equal(
      f.host.tokenMeter.measure(f.handle.agent.session).nodes.length,
      f.handle.agent.session.surface.nodes.length,
    );
  } finally {
    await f.host.fiber.dispose();
  }
});

test('native tool images are kept before decisions without repeating executions or breaking tool pairs', async () => {
  const f = await fixture({ compaction: { auto: false }, visualHistory: { maxImages: 4 } });
  f.model.tools = true;
  try {
    for (let i = 0; i < 10; i++) {
      const end = await f.send([{ type: 'text', text: `Capture iteration ${i}.` }]);
      assert.notEqual(end.data.reason.kind, 'error', JSON.stringify(end));
      const input = f.model.requests.at(-1)!;
      assert(ids(input).includes(`tool-${i + 1}-0`));
      assert(ids(input).includes(`tool-${i + 1}-1`));
      assert(ids(input).length <= 4);
      assert.equal(f.calls(), i + 1);
      for (const message of input.messages)
        for (const block of message.content)
          if (block.type === 'tool-result')
            assert(
              input.messages.some((m) =>
                m.content.some((c) => c.type === 'tool-call' && c.id === block.toolCallId),
              ),
            );
    }
    const originals = f.handle.agent.session
      .snapshotEvents()
      .filter((e) => e.type === 'tool/result');
    assert.equal(originals.filter((e) => e.surfaceOp === 'append').length, 10);
    assert(
      originals
        .filter((e) => e.surfaceOp === 'append')
        .every((e) => imageReferences(e.data.message.content).length === 2),
    );
  } finally {
    await f.host.fiber.dispose();
  }
});

test('oversized fresh observations fail before inference without silently dropping camera views', async () => {
  for (const tool of [false, true]) {
    const f = await fixture({ compaction: { auto: false }, visualHistory: { maxImages: 2 } }, 3);
    f.model.tools = tool;
    try {
      const end = await f.send(
        tool ? [{ type: 'text', text: 'Capture three views.' }] : frames('fresh', 3),
      );
      assert.equal(end.data.reason.kind, 'error');
      assert.match(JSON.stringify(end), /Fresh observation batch requires 3/);
      assert.equal(f.model.requests.length, tool ? 1 : 0);
      assert(!f.handle.agent.session.snapshotEvents().some((e) => e.type === 'edh/visual-history'));
      if (tool)
        assert.equal(
          imageReferences(f.handle.agent.session.deriveMessages().at(-1)!.content).length,
          3,
        );
    } finally {
      await f.host.fiber.dispose();
    }
  }
});

test('visual retention and native pressure compaction compose while fresh input stays visible', async () => {
  const f = await fixture({
    compaction: {
      thresholdRatio: 0.6,
      headroomTokens: 512,
      retainTokens: 0,
      maxTokens: 512,
      compactionRetries: 0,
    },
    visualHistory: { maxImages: 4 },
  });
  f.model.tools = true;
  try {
    for (let i = 0; i < 4; i++) {
      const end = await f.send([
        { type: 'text', text: 'Cup inside cabinet. ' + 'old-description '.repeat(1000) },
        ...frames(`input-${i}`, 1),
      ]);
      assert.notEqual(end.data.reason.kind, 'error', JSON.stringify(end));
      const normal = f.model.requests.filter((r) => r.purpose !== 'compaction');
      assert(ids(normal.at(-2)!).includes(`input-${i}-0`));
      assert(ids(normal.at(-1)!).includes(`tool-${i + 1}-0`));
      assert(f.model.requests.every((r) => ids(r).length <= 4));
    }
    assert(f.model.requests.some((r) => r.purpose === 'compaction'));
    assert.equal(f.calls(), 4);
  } finally {
    await f.host.fiber.dispose();
  }
});
