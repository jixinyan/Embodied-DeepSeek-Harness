import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { SessionId } from '@deepseek-ai/dsh-session';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { createDshSession } from '../../harness/agent-runtime/agents/src/runtime.js';
import { ScriptedModel, textResponse, toolResponse } from './scripted-model.js';

function send(agent: Agent, text: string): void {
  agent.followup(
    createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }),
  );
}

function fixtureTool(onCall: () => void = () => {}) {
  return defineTool({
    name: 'inspect_fixture',
    description: 'Read a synthetic cup-location fixture. No sensor is connected.',
    parameters: { object: { type: 'string', required: true } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          object: { type: 'string', required: true },
          inside: { type: 'boolean', required: true },
          observation: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args) {
      onCall();
      return { object: args.object, inside: false, observation: 'synthetic-frame-1' };
    },
  });
}

const definition = {
  provider: 'scripted',
  model: 'fixture',
  instructions: 'Inspect the explicitly supplied evidence.',
  tools: [],
};

test(
  'original DSH loop calls a structured tool and wakes for a later host message',
  { timeout: 10000 },
  async (t) => {
    const adapter = new ScriptedModel([
      toolResponse('inspect_fixture', { object: 'cup' }),
      textResponse('The synthetic fixture says the cup is outside.'),
      textResponse('Additional context received.'),
    ]);
    const host = await createDshHost([{ providers: ['scripted'], adapter }]);
    t.after(() => host.fiber.dispose());
    let toolCalls = 0;
    const lifecycle: string[] = [];
    host.on('agent/status', ({ status }) => {
      lifecycle.push(status);
    });
    const handle = await createDshSession(host, {
      ...definition,
      sessionId: 'loop',
      tools: [
        fixtureTool(() => {
          toolCalls++;
        }),
      ],
    });
    send(handle.agent, 'Inspect this cup.');
    await handle.agent.whenIdle();
    assert.equal(toolCalls, 1);
    assert.equal(adapter.requests.length, 2);
    assert.match(JSON.stringify(adapter.requests[1]?.messages), /synthetic-frame-1/);
    assert.match(JSON.stringify(adapter.requests[1]?.messages), /"inside\\":false|"inside":false/);
    assert(adapter.requests[0]?.tools?.some((tool) => tool.name === 'inspect_fixture'));
    const events = handle.agent.session.snapshotEvents();
    assert(events.some((event) => event.type === 'tool/result'));
    assert(events.some((event) => event.type === 'turn/end'));
    handle.agent.followup(
      createUserMessage({
        content: [{ type: 'text', text: 'A later explicit handoff: cabinet access is clear.' }],
        source: { kind: 'plugin', plugin: 'edh-test-host' },
      }),
    );
    await handle.agent.whenIdle();
    assert.equal(adapter.requests.length, 3);
    assert.match(JSON.stringify(adapter.requests[2]?.messages), /cabinet access is clear/);
    assert.equal(lifecycle.filter((status) => status === 'running').length, 2);
    assert.equal(lifecycle.at(-1), 'idle');
    await handle.dispose();
    assert.equal(host.agents.get(SessionId('loop')), undefined);
    assert.equal(host.sessions.get(SessionId('loop')), undefined);
    assert.equal(host.tools.get('inspect_fixture', handle.agent), undefined);
  },
);

test(
  'new sessions keep prompts, tools and histories separate; direct out-of-scope dispatch fails',
  { timeout: 10000 },
  async (t) => {
    const adapter = new ScriptedModel([
      textResponse('planner'),
      textResponse('scene'),
      textResponse('handoff seen'),
    ]);
    const host = await createDshHost([{ providers: ['scripted'], adapter }]);
    t.after(() => host.fiber.dispose());
    let executions = 0;
    const planner = await createDshSession(host, {
      ...definition,
      sessionId: 'planner',
      instructions: 'PLANNER_PRIVATE_MARKER',
      tools: [
        fixtureTool(() => {
          executions++;
        }),
      ],
    });
    const scene = await createDshSession(host, {
      ...definition,
      sessionId: 'scene',
      instructions: 'SCENE_ROLE_ONLY',
    });
    assert.notEqual(planner.agent.session, scene.agent.session);
    const sceneEvents: string[] = [];
    scene.agent.ctx.on('agent/status', ({ agent, status }) => {
      sceneEvents.push(`${agent.id}:${status}`);
    });
    send(planner.agent, 'PRIVATE_HISTORY_MARKER');
    await planner.agent.whenIdle();
    assert.equal(sceneEvents.length, 0);
    send(scene.agent, 'Analyze only this explicit brief.');
    await scene.agent.whenIdle();
    const sceneInput = JSON.stringify(adapter.requests[1]);
    assert.match(sceneInput, /SCENE_ROLE_ONLY/);
    assert.doesNotMatch(
      sceneInput,
      /PLANNER_PRIVATE_MARKER|PRIVATE_HISTORY_MARKER|inspect_fixture/,
    );
    assert(sceneEvents.every((event) => event.startsWith('scene:')));
    const denied = await host.tools.execute({
      agent: scene.agent,
      callId: ToolCallId('denied'),
      name: 'inspect_fixture',
      arguments: { object: 'cup' },
      signal: new AbortController().signal,
    });
    assert.equal(denied.isError, true);
    assert.equal(executions, 0);
    send(scene.agent, 'Explicitly handed over now: PRIVATE_HISTORY_MARKER');
    await scene.agent.whenIdle();
    assert.match(JSON.stringify(adapter.requests[2]?.messages), /PRIVATE_HISTORY_MARKER/);
    assert.throws(
      () => createDshSession(planner.agent.ctx, { ...definition, sessionId: 'invalid-child' }),
      /neutral host/,
    );
  },
);

test(
  'cancel reaches an active model, clears pending work and allows a later wake',
  { timeout: 10000 },
  async (t) => {
    const entered = Promise.withResolvers<void>();
    let wasAborted = false;
    const adapter = new ScriptedModel([
      async function* (options) {
        const signal = options.signal;
        assert(signal);
        yield { type: 'block-start', index: 0, blockType: 'text' };
        await new Promise<void>((_resolve, reject) => {
          const abort = () => {
            wasAborted = true;
            reject(signal.reason);
          };
          if (signal.aborted) abort();
          else signal.addEventListener('abort', abort, { once: true });
          entered.resolve();
        });
      },
      textResponse('New input after cancellation.'),
    ]);
    const host = await createDshHost([{ providers: ['scripted'], adapter }]);
    t.after(() => host.fiber.dispose());
    const { agent } = await createDshSession(host, { ...definition, sessionId: 'cancel' });
    send(agent, 'Start a slow model call.');
    await entered.promise;
    send(agent, 'QUEUED_INPUT_MUST_BE_CANCELED');
    agent.cancel({ kind: 'user' });
    await agent.whenIdle();
    assert(wasAborted);
    assert.equal(agent.status, 'idle');
    assert.equal(agent.inbox.nextTurn.length, 0);
    assert.equal(adapter.requests.length, 1);
    const last = agent.session.snapshotEvents().findLast((event) => event.type === 'turn/end');
    assert.equal(last?.type === 'turn/end' && last.data.reason.kind, 'aborted');
    send(agent, 'Resume with a new explicit message.');
    await agent.whenIdle();
    assert.equal(adapter.requests.length, 2);
    assert.doesNotMatch(
      JSON.stringify(adapter.requests[1]?.messages),
      /QUEUED_INPUT_MUST_BE_CANCELED/,
    );
  },
);

test(
  'aborted creation publishes no session; host disposal drains and unregisters its agents',
  { timeout: 10000 },
  async () => {
    const host = await createDshHost([{ providers: ['scripted'], adapter: new ScriptedModel([]) }]);
    try {
      const controller = new AbortController();
      controller.abort(new Error('Creation canceled by host.'));
      await assert.rejects(
        createDshSession(host, {
          ...definition,
          sessionId: 'never-live',
          signal: controller.signal,
        }),
        /Creation canceled/,
      );
      assert.equal(host.agents.get(SessionId('never-live')), undefined);
      assert.equal(host.sessions.get(SessionId('never-live')), undefined);
      const a = await createDshSession(host, { ...definition, sessionId: 'owned-a' });
      const b = await createDshSession(host, { ...definition, sessionId: 'owned-b' });
      const registry = host.agents;
      const sessions = host.sessions;
      assert.equal(registry.list().length, 2);
      await host.fiber.dispose();
      assert.equal(registry.list().length, 0);
      assert.equal(sessions.get(a.agent.id), undefined);
      assert.equal(sessions.get(b.agent.id), undefined);
    } finally {
      await host.fiber.dispose();
    }
  },
);

test(
  'failed scoped setup rolls back registrations and both lifecycle registries',
  { timeout: 10000 },
  async (t) => {
    const host = await createDshHost([{ providers: ['scripted'], adapter: new ScriptedModel([]) }]);
    t.after(() => host.fiber.dispose());
    let publications = 0;
    host.on('agent/created', () => {
      publications++;
    });
    await assert.rejects(
      createDshSession(host, {
        ...definition,
        sessionId: 'rollback',
        tools: [fixtureTool(), fixtureTool()],
      }),
    );
    assert.equal(publications, 0);
    assert.equal(host.agents.get(SessionId('rollback')), undefined);
    assert.equal(host.sessions.get(SessionId('rollback')), undefined);
    // Reusing the identity after rollback must work with a clean scope.
    const good = await createDshSession(host, {
      ...definition,
      sessionId: 'rollback',
      tools: [fixtureTool()],
    });
    assert.equal(publications, 1);
    await good.dispose();
  },
);

test(
  'host shutdown cancels and drains an active tool before removing its session',
  { timeout: 10000 },
  async (t) => {
    const entered = Promise.withResolvers<void>();
    let drained = false;
    const tool = defineTool({
      name: 'wait_for_stop',
      description: 'Synthetic cooperative operation for lifecycle testing.',
      parameters: {},
      output: {
        schema: { type: 'boolean' },
        render: (_args, value) => [{ type: 'text', text: String(value) }],
      },
      async execute(_args, exec) {
        try {
          await new Promise<void>((_resolve, reject) => {
            const abort = () => reject(exec.signal.reason);
            if (exec.signal.aborted) abort();
            else exec.signal.addEventListener('abort', abort, { once: true });
            entered.resolve();
          });
          return true;
        } finally {
          drained = true;
        }
      },
    });
    const adapter = new ScriptedModel([toolResponse('wait_for_stop', {})]);
    const host = await createDshHost([{ providers: ['scripted'], adapter }]);
    t.after(() => host.fiber.dispose());
    const handle = await createDshSession(host, {
      ...definition,
      sessionId: 'shutdown-active',
      tools: [tool],
    });
    send(handle.agent, 'Run the cooperative fixture.');
    await entered.promise;
    const registry = host.agents;
    const sessions = host.sessions;
    await host.fiber.dispose();
    assert(drained);
    assert.equal(registry.get(handle.agent.id), undefined);
    assert.equal(sessions.get(handle.agent.id), undefined);
    assert.equal(adapter.requests.length, 1);
  },
);
