import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { OpenAICompatibleAdapter } from '@edh/models';
import { defineTool } from '@edh/tools';
import { createDshHost } from '../apps/server/src/runtime.js';
import { createDshSession } from '../harness/agent-runtime/agents/src/runtime.js';

const baseURL = process.env.EDH_LIVE_VLM_URL;
const model = process.env.EDH_LIVE_VLM_MODEL;
if (!baseURL || !model) throw new Error('EDH_LIVE_VLM_URL and EDH_LIVE_VLM_MODEL are required.');

const host = await createDshHost([
  {
    providers: ['live-vllm'],
    adapter: new OpenAICompatibleAdapter({
      baseURL,
      models: [{ id: model, contextWindow: 32768 }],
      timeoutMs: 180000,
    }),
  },
]);
const handle = await createDshSession(host, {
  sessionId: `rc2-live-tools-${Date.now()}`,
  provider: 'live-vllm',
  model,
  instructions: 'Follow the user request. Use a named tool when the user requests it.',
  tools: [],
});
try {
  const session = handle.agent.session;
  const send = async (message: string) => {
    handle.agent.followup(
      createUserMessage({
        source: { kind: 'user' },
        content: [{ type: 'text', text: message }],
      }),
    );
    await handle.agent.whenIdle();
    const end = session.snapshotEvents().findLast((event) => event.type === 'turn/end');
    assert(end);
    assert.deepEqual(end.data.reason, { kind: 'completed' }, JSON.stringify(end.data));
  };
  await send('Reply with the word READY.');
  assert.equal(session.snapshotEvents().filter((event) => event.type === 'tool/result').length, 0);

  let executions = 0;
  const unregister = handle.agent.ctx.tools.register(
    defineTool({
      name: 'read_current_repository_name',
      description: 'Read the current repository name from the real local package.json file.',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute() {
        executions++;
        const packageFile = JSON.parse(await readFile('package.json', 'utf8')) as { name: string };
        assert.equal(typeof packageFile.name, 'string');
        return packageFile.name;
      },
    }),
  );
  assert.equal(handle.agent.session, session);
  assert(
    handle.agent.ctx.tools
      .schemas(handle.agent)
      .some((schema) => schema.name === 'read_current_repository_name'),
  );
  await send(
    'Use the read_current_repository_name tool to read the repository name. Then report the name.',
  );
  const events = session.snapshotEvents();
  assert.equal(executions, 1);
  assert(events.some((event) => event.type === 'tool/result'));
  const output = {
    model,
    baseURL,
    sessionId: session.id,
    repositoryName: (JSON.parse(await readFile('package.json', 'utf8')) as { name: string }).name,
    toolExecutions: executions,
    turnEnds: events.filter((event) => event.type === 'turn/end').map((event) => event.data),
    toolEvents: events.filter((event) => event.type.startsWith('tool/')),
  };
  await mkdir(resolve('.local/work'), { recursive: true });
  const evidencePath = resolve('.local/work/dsh-rc2-live-tools.json');
  await writeFile(evidencePath, JSON.stringify(output, null, 2), 'utf8');
  unregister();
  process.stdout.write(
    `${JSON.stringify({ evidencePath, toolExecutions: executions, turns: output.turnEnds.length })}\n`,
  );
} finally {
  await handle.dispose();
  await host.fiber.dispose();
}
