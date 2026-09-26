import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { createToolResultMessage, ToolCallId } from '@deepseek-ai/dsh-llm';
import { Session, SessionId } from '@deepseek-ai/dsh-session';
import { defineTool } from '@edh/tools';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { createDshSession } from '../../harness/agent-runtime/agents/src/runtime.js';

test('an ongoing native Session changes its scoped tool registry without changing its identity', async (t) => {
  const host = await createDshHost([]);
  t.after(() => host.fiber.dispose());
  const handle = await createDshSession(host, {
    sessionId: 'rc2-dynamic-tool-request',
    provider: 'unconfigured',
    model: 'unconfigured',
    instructions: 'Inspect available tools.',
    tools: [],
  });
  t.after(() => handle.dispose());
  const session = handle.agent.session;
  assert.deepEqual(handle.agent.ctx.tools.schemas(handle.agent), []);
  const unregister = handle.agent.ctx.tools.register(
    defineTool({
      name: 'read_current_scene',
      description: 'Read the current scene.',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute() {
        return 'No execution is needed for this request check.';
      },
    }),
  );
  assert.equal(handle.agent.session, session);
  assert.deepEqual(
    handle.agent.ctx.tools.schemas(handle.agent).map((tool) => tool.name),
    ['read_current_scene'],
  );
  unregister();
  assert.deepEqual(handle.agent.ctx.tools.schemas(handle.agent), []);
});

test('an actual Session log retains complete Unicode through tool-result pruning', async (t) => {
  const host = await createDshHost([], {
    compaction: { auto: false },
    pruneToolResults: { thresholdChars: 80, headChars: 20, tailChars: 20 },
  });
  t.after(() => host.fiber.dispose());
  const document = await readFile('README.md', 'utf8');
  const source = `${document.slice(0, 19)}🦆${document.slice(19)}`;
  const session = Session.create(SessionId('rc2-unicode-tool-output'));
  session.append(
    'tool/result',
    {
      turn: 0,
      step: 0,
      message: createToolResultMessage({
        callId: ToolCallId('read-project-document'),
        content: [{ type: 'text', text: source }],
        isError: false,
      }),
    },
    { surfaceOp: 'append' },
  );
  const result = host.toolResultPruner.pruneSession(session);
  assert.equal(result.pruned.length, 1);
  const current = session.deriveMessages()[0];
  assert(current);
  const resultBlock = current.content[0];
  assert(resultBlock?.type === 'tool-result');
  const text = resultBlock.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
  assert(text.startsWith(`${document.slice(0, 19)}🦆`));
  assert(text.isWellFormed());
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/edh-rc2-unicode-'));
  try {
    const path = resolve(directory, 'session.json');
    await writeFile(path, JSON.stringify(session.snapshotEvents()), 'utf8');
    const events = JSON.parse(await readFile(path, 'utf8'));
    const restored = Session.create(SessionId('rc2-unicode-restored'), events);
    assert.deepEqual(restored.deriveMessages(), session.deriveMessages());
  } finally {
    await rm(directory, { recursive: true });
  }
});
