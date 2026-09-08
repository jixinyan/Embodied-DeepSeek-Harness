import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm';
import { defineTool as upstreamDefineTool } from '@deepseek-ai/dsh-tools';
import { defineTool, type ToolDefinition } from '@edh/tools';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { createDshSession } from '../../harness/agent-runtime/agents/src/runtime.js';
import { ScriptedModel, textResponse, toolResponse } from './scripted-model.js';

const definition = { provider: 'scripted', model: 'fixture', instructions: 'Use explicit tools.' };

test('EDH exposes the original DSH tool authoring function without a wrapper', () => {
  assert.equal(defineTool, upstreamDefineTool);
});

test(
  'ordinary tools run in DSH with scalar output and no physical envelope',
  { timeout: 10000 },
  async (t) => {
    const adapter = new ScriptedModel([
      toolResponse('add_one', { value: 6 }),
      textResponse('Result received.'),
    ]);
    const host = await createDshHost([{ providers: ['scripted'], adapter }]);
    t.after(() => host.fiber.dispose());
    let calls = 0;
    const tool = defineTool({
      name: 'add_one',
      description: 'An ordinary nonphysical tool.',
      parameters: { value: { type: 'number', required: true } },
      output: {
        schema: { type: 'number' },
        render: (_args, value) => [{ type: 'text', text: `VALUE=${value}` }],
      },
      async execute(args) {
        calls++;
        return args.value + 1;
      },
    });
    const handle = await createDshSession(host, {
      ...definition,
      sessionId: 'native-scalar',
      tools: [tool],
    });
    handle.agent.followup(
      createUserMessage({
        content: [{ type: 'text', text: 'Add one to six.' }],
        source: { kind: 'user' },
      }),
    );
    await handle.agent.whenIdle();
    assert.equal(calls, 1);
    assert.equal(adapter.requests.length, 2);
    assert.match(JSON.stringify(adapter.requests[1]?.messages), /VALUE=7/);
    const toolResult = handle.agent.session
      .snapshotEvents()
      .find((event) => event.type === 'tool/result');
    assert(toolResult);
    assert.doesNotMatch(
      JSON.stringify(toolResult),
      /physical\.tool_result|operation_id|team_run_id/,
    );
  },
);

test(
  'DSH itself rejects bad arguments before execution and invalid output before rendering',
  { timeout: 10000 },
  async (t) => {
    const host = await createDshHost([{ providers: ['scripted'], adapter: new ScriptedModel([]) }]);
    t.after(() => host.fiber.dispose());
    let calls = 0,
      renders = 0;
    const valid = defineTool({
      name: 'native_validation',
      description: 'Native DSH validation probe.',
      parameters: { value: { type: 'number', required: true } },
      output: {
        schema: { type: 'number' },
        render: (_args, value) => {
          renders++;
          return [{ type: 'text', text: String(value) }];
        },
      },
      async execute(args) {
        calls++;
        return args.value;
      },
    });
    // Simulate a buggy provider that violates its declared output. Native DSH must catch it.
    const buggy: ToolDefinition = {
      ...valid,
      name: 'buggy_provider',
      async execute() {
        return { wrong: 'shape' };
      },
    };
    const handle = await createDshSession(host, {
      ...definition,
      sessionId: 'native-validation',
      tools: [valid, buggy],
    });
    const invoke = (name: string, args: Record<string, unknown>) =>
      host.tools.execute({
        agent: handle.agent,
        callId: ToolCallId(name),
        name,
        arguments: args,
        signal: new AbortController().signal,
      });
    const badArgs = await invoke('native_validation', { value: 'not a number' });
    assert.equal(badArgs.isError, true);
    assert.equal(calls, 0);
    assert.equal(renders, 0);
    const badOutput = await invoke('buggy_provider', { value: 2 });
    assert.equal(badOutput.isError, true);
    assert.equal(renders, 0);
    const good = await invoke('native_validation', { value: 2 });
    assert.equal(good.isError, false);
    assert.equal(calls, 1);
    assert.equal(renders, 1);
  },
);

test('mounted upstream timeout policy aborts a cooperative tool and returns TOOL_TIMEOUT', async () => {
  const { setTimeout } = await import('node:timers/promises');
  const host = await createDshHost([]);
  try {
    const handle = await createDshSession(host, {
      sessionId: 'timeout-fixture',
      provider: 'unused',
      model: 'unused',
      instructions: 'Tool timeout test.',
      tools: [
        defineTool({
          name: 'slow_fixture',
          description: 'Cooperative timeout fixture.',
          parameters: {},
          output: {
            schema: { type: 'string' },
            render: (_args, value) => [{ type: 'text', text: value }],
          },
          timeoutMs: 15,
          async execute(_args, exec) {
            await setTimeout(1000, undefined, { signal: exec.signal });
            return 'too late';
          },
        }),
      ],
    });
    const result = await host.tools.execute({
      agent: handle.agent,
      callId: ToolCallId('timeout-call'),
      name: 'slow_fixture',
      arguments: {},
      signal: new AbortController().signal,
    });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result), /TOOL_TIMEOUT/);
    await handle.dispose();
  } finally {
    await host.fiber.dispose();
  }
});
