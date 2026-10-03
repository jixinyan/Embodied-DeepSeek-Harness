import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createUserMessage, type GenerateOptions } from '@deepseek-ai/dsh-llm';
import {
  Session,
  SessionId,
  type SessionEvent,
  TOOL_OUTCOME_UNKNOWN,
  TOOL_NOT_STARTED,
} from '@deepseek-ai/dsh-session';
import { OpenAICompatibleAdapter } from '@edh/models';
import { defineTool } from '@edh/tools';
import { createDshHost } from '../apps/server/src/runtime.js';
import { createDshSession } from '../harness/agent-runtime/agents/src/runtime.js';

const baseURL = process.env.EDH_LIVE_VLM_URL;
const model = process.env.EDH_LIVE_VLM_MODEL;
if (!baseURL || !model) throw new Error('EDH_LIVE_VLM_URL and EDH_LIVE_VLM_MODEL are required.');
await mkdir('.local/work', { recursive: true });
const directory = await mkdtemp(resolve('.local/work/dsh-tool-recovery-live-'));
const files = {
  read_repository_metadata: 'package.json',
  read_repository_guidance: 'AGENTS.md',
  read_repository_deployment: 'examples/deployments/README.md',
};
const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(
      async ([name, path]) =>
        [
          name,
          {
            path: resolve(path),
            digest: createHash('sha256')
              .update(await readFile(path))
              .digest('hex'),
          },
        ] as const,
    ),
  ),
);
const dispatches: { sessionId: string; tool: string }[] = [];
const host = await createDshHost([
  {
    providers: ['live-vllm'],
    adapter: new OpenAICompatibleAdapter({
      baseURL,
      models: [{ id: model, contextWindow: 131072 }],
      timeoutMs: 180000,
      extraBody: { chat_template_kwargs: { enable_thinking: false } },
    }),
  },
]);
const requests: { sessionId: string; messages: GenerateOptions['messages'] }[] = [];
host.on('llm/stream', (options, next) => {
  requests.push({
    sessionId: String(options.sessionId),
    messages: structuredClone(options.messages),
  });
  return next();
});
const checks: Record<string, unknown>[] = [];
try {
  for (const aggregate of [false, true]) {
    const phase = aggregate ? 'recovery-publication-failure' : 'live-recovery';
    const collision = resolve(directory, `${phase}-existing-guidance`);
    await copyFile('AGENTS.md', collision);
    const errors: unknown[] = [];
    const handles = [];
    const handle = await createDshSession(host, {
      sessionId: `${phase}-${Date.now()}`,
      provider: 'live-vllm',
      model,
      instructions:
        'Follow explicit tool instructions. Perform read-only repository inspection. Never repeat a call after a failed turn unless explicitly requested.',
      tools: Object.entries(files).map(([name, path]) =>
        defineTool({
          name,
          description: `Read the actual repository file ${path}.`,
          parameters: {},
          output: {
            schema: { type: 'string' },
            render: (_args, value) => [{ type: 'text', text: value }],
          },
          async execute(_args, execution) {
            dispatches.push({ sessionId: String(execution.agent?.id), tool: name });
            return readFile(path, 'utf8');
          },
        }),
      ),
    });
    handles.push(handle);
    try {
      handle.agent.ctx.on('agent/error', ({ error }) => {
        errors.push(error);
      });
      const calls = new Map<string, string>();
      const stopPublisher = host.on('internal/dispatch', (_mode, name, args) => {
        if (name !== 'session/event' || args[0] !== handle.agent.session) return;
        const event = args[1] as SessionEvent;
        if (event.type === 'tool/call') calls.set(event.data.callId, event.data.name);
        if (
          event.type !== 'tool/result' ||
          calls.get(event.data.message.source.callId) !== 'read_repository_guidance'
        )
          return;
        const target =
          event.data.error?.code === TOOL_OUTCOME_UNKNOWN && !aggregate
            ? resolve(directory, `${phase}-recovered-guidance.json`)
            : collision;
        // 使用真实文件的排他写入，验证结果发布失败与错误结果发布的边界。
        writeFileSync(target, JSON.stringify(event), { flag: 'wx' });
      });
      try {
        handle.agent.followup(
          createUserMessage({
            source: { kind: 'user' },
            content: [
              {
                type: 'text',
                text: 'In one assistant message call all three tools exactly once in this order: read_repository_metadata, read_repository_guidance, read_repository_deployment. They read the actual metadata, guidance and native deployment documentation. Do not call any other tool.',
              },
            ],
          }),
        );
        await handle.agent.whenIdle();
      } finally {
        stopPublisher();
      }
      const failed = handle.agent.session.snapshotEvents();
      assert.equal(errors.length, 1);
      const callEvents = failed.filter((event) => event.type === 'tool/call');
      const results = failed.filter((event) => event.type === 'tool/result');
      assert.equal(callEvents.length, 2);
      assert.equal(callEvents[0]?.data.name, 'read_repository_metadata');
      assert.equal(callEvents[1]?.data.name, 'read_repository_guidance');
      assert.equal(results[0]?.data.message.content[0]?.type, 'tool-result');
      assert.equal(results[0]?.data.message.content[0]?.isError, false);
      const originalError = aggregate ? (errors[0] as AggregateError).cause : errors[0];
      assert.equal((originalError as NodeJS.ErrnoException).code, 'EEXIST');
      if (aggregate) {
        assert(errors[0] instanceof AggregateError);
        assert.equal((errors[0].errors[1] as NodeJS.ErrnoException).code, 'EEXIST');
        assert.equal(results.length, 1);
      } else {
        assert.deepEqual(
          results.map((event) => event.data.error?.code),
          [undefined, TOOL_OUTCOME_UNKNOWN, TOOL_NOT_STARTED],
        );
        assert.deepEqual(results[1]?.sourceEventSeqs, [callEvents[1]?.seq]);
        assert.equal(results[2]?.sourceEventSeqs, undefined);
        assert.deepEqual(
          failed.slice(-3).map((event) => event.type),
          ['tool/result', 'step/end', 'turn/end'],
        );
        const nativePath = resolve(directory, `${phase}-session.json`);
        await writeFile(nativePath, JSON.stringify(failed));
        const restored = Session.create(
          SessionId(`${phase}-restored`),
          JSON.parse(await readFile(nativePath, 'utf8')),
        );
        assert.deepEqual(restored.deriveMessages(), handle.agent.session.deriveMessages());
        handle.agent.followup(
          createUserMessage({
            source: { kind: 'user' },
            content: [
              {
                type: 'text',
                text: 'Do not call tools. Explain which repository read completed and which outcomes remain unknown or were not started. Preserve the reported publication failure.',
              },
            ],
          }),
        );
        await handle.agent.whenIdle();
        const subsequent = requests
          .filter((request) => request.sessionId === handle.agent.id)
          .at(-1);
        assert(subsequent);
        assert.deepEqual(
          subsequent.messages.flatMap((message) =>
            message.content
              .filter((block) => block.type === 'tool-result')
              .map((block) => block.toolCallId),
          ),
          results.map((event) => event.data.message.source.callId),
        );
        assert.equal(
          handle.agent.session.snapshotEvents().findLast((event) => event.type === 'turn/end')?.data
            .reason.kind,
          'completed',
        );
        const independent = await createDshSession(host, {
          sessionId: `independent-${Date.now()}`,
          provider: 'live-vllm',
          model,
          instructions: 'Reply to the user request without tools.',
          tools: [],
        });
        handles.push(independent);
        independent.agent.followup(
          createUserMessage({
            source: { kind: 'user' },
            content: [{ type: 'text', text: 'Reply with READY.' }],
          }),
        );
        await independent.agent.whenIdle();
        const independentRequest = requests.find(
          (request) => request.sessionId === independent.agent.id,
        );
        assert(independentRequest);
        assert(
          !independentRequest.messages.some((message) =>
            message.content.some((block) => block.type === 'tool-result'),
          ),
        );
        assert.equal(
          handle.agent.session.snapshotEvents().filter((event) => event.type === 'tool/result')
            .length,
          3,
        );
      }
      checks.push({
        phase,
        sessionId: handle.agent.id,
        recordedCalls: callEvents.map((event) => event.data),
        results: results.map((event) => event.data),
        originalError: String(originalError),
        turnEnd: failed.findLast((event) => event.type === 'turn/end')?.data,
      });
      await writeFile(
        resolve(directory, `${phase}-final-session.json`),
        JSON.stringify(handle.agent.session.snapshotEvents(), null, 2),
      );
    } finally {
      for (const owned of handles.reverse()) await owned.dispose();
    }
  }
  assert.deepEqual(
    dispatches.map((dispatch) => dispatch.tool),
    [
      'read_repository_metadata',
      'read_repository_guidance',
      'read_repository_metadata',
      'read_repository_guidance',
    ],
  );
  for (const source of Object.values(sources))
    assert.equal(
      createHash('sha256')
        .update(await readFile(source.path))
        .digest('hex'),
      source.digest,
    );
  const acceptance = {
    model,
    baseURL,
    directory,
    sources,
    dispatches,
    requests,
    checks,
    modelRequests: requests.length,
    sourceFilesUnchanged: true,
    physicalDispatches: 0,
  };
  await writeFile(resolve(directory, 'acceptance.json'), JSON.stringify(acceptance, null, 2));
  process.stdout.write(
    `${JSON.stringify({ directory, checks: checks.length, dispatches: dispatches.length, modelRequests: requests.length })}\n`,
  );
} finally {
  await host.fiber.dispose();
}
