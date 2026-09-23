import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { contextManagementOptions, validateCompactionRoute } from '@edh/memory';
import { OpenAICompatibleAdapter } from '@edh/models';
import { createDshHost } from '../../apps/server/src/runtime.js';
import {
  resolveCompactSpec,
  resolveConfig,
  resolveTargetPolicy,
} from '../../harness/agent-runtime/memory/src/dsh/compaction-basic/config.ts';

const route = { provider: 'local', model: 'vision-model' };

test('32K deployment policy reserves output and pressure headroom', () => {
  const options = contextManagementOptions({ compaction: {} });
  assert.deepEqual(options.compaction, { headroomTokens: 4096, maxTokens: 8192 });
  const policy = resolveTargetPolicy(resolveConfig(options.compaction), route);
  const spec = resolveCompactSpec(policy, 32768, 2048);
  assert.equal(spec.thresholdTokens, 26214);
  assert.equal(spec.retainTokens, 4915);
  assert.equal(spec.maxTokens, 8192);
  assert.doesNotThrow(() => validateCompactionRoute(options.compaction!, route, 32768, 2048));
});

test('upstream defaults and exact model overrides retain their native semantics', () => {
  const defaults = resolveConfig();
  assert.equal(defaults.headroomTokens, 65536);
  assert.equal(defaults.maxTokens, 65536);
  const policy = resolveTargetPolicy(
    resolveConfig({
      headroomTokens: 4096,
      modelPolicies: [{ ...route, headroomTokens: 1024 }],
    }),
    route,
  );
  assert.equal(policy.headroomTokens, 1024);
  assert.equal(policy.maxTokens, 1024);
});

test('admission rejects budgets that cannot fit the configured window', () => {
  const options = contextManagementOptions({ compaction: {} });
  assert.throws(
    () => validateCompactionRoute(options.compaction!, route, 4096, 2048),
    /leaving no pressure budget/,
  );
  assert.throws(
    () => validateCompactionRoute(options.compaction!, route, 32768, 2048, 32768),
    /leaving no message budget/,
  );
  assert.throws(
    () => validateCompactionRoute(options.compaction!, route, undefined, 2048),
    /requires contextWindow/,
  );
  assert.throws(
    () => contextManagementOptions({ compaction: { headroomTokens: 0, maxTokens: 0 } }),
    /maxTokens/,
  );
});

test('native request admission rejects an oversized cap before HTTP transport', async (t) => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests += 1;
    response.writeHead(503);
    response.end('No model response is served by this admission test.');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const adapter = new OpenAICompatibleAdapter({
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    models: [{ id: route.model, contextWindow: 32768, maxTokens: 2048 }],
  });
  const send = (agent: { followup: (message: ReturnType<typeof createUserMessage>) => void }) => {
    agent.followup(
      createUserMessage({
        content: [{ type: 'text', text: 'Check request admission.' }],
        source: { kind: 'user' },
      }),
    );
  };

  const protectedHost = await createDshHost([{ providers: [route.provider], adapter }], {
    compaction: {},
  });
  t.after(() => protectedHost.fiber.dispose());
  const protectedHandle = await protectedHost.agents.create({
    sessionId: SessionId('oversized-native-request'),
    agentOptions: { ...route, maxTokens: 30000 },
  });
  send(protectedHandle.agent);
  await protectedHandle.agent.whenIdle();
  assert.equal(requests, 0);
  const rejected = protectedHandle.agent.session
    .snapshotEvents()
    .findLast((event) => event.type === 'turn/end');
  assert(rejected && rejected.type === 'turn/end');
  assert.equal(rejected.data.reason.kind, 'error');
  assert.match(JSON.stringify(rejected.data.reason), /pressure budget/);
  await protectedHandle.dispose();

  const dynamicHost = await createDshHost([{ providers: [route.provider], adapter }], {
    compaction: {},
  });
  t.after(() => dynamicHost.fiber.dispose());
  dynamicHost.on('agent/request', async (_payload, next) => ({
    ...(await next()),
    maxTokens: 30000,
  }));
  const dynamicHandle = await dynamicHost.agents.create({
    sessionId: SessionId('dynamic-oversized-request'),
    agentOptions: { ...route, maxTokens: 2048 },
  });
  send(dynamicHandle.agent);
  await dynamicHandle.agent.whenIdle();
  assert.equal(requests, 0);
  const dynamicEnd = dynamicHandle.agent.session
    .snapshotEvents()
    .findLast((event) => event.type === 'turn/end');
  assert(dynamicEnd && dynamicEnd.type === 'turn/end');
  assert.equal(dynamicEnd.data.reason.kind, 'error');
  assert.match(JSON.stringify(dynamicEnd.data.reason), /pressure budget/);
  await dynamicHandle.dispose();

  const disabledHost = await createDshHost([{ providers: [route.provider], adapter }], {
    compaction: { auto: false },
  });
  t.after(() => disabledHost.fiber.dispose());
  const disabledHandle = await disabledHost.agents.create({
    sessionId: SessionId('disabled-native-compaction'),
    agentOptions: { ...route, maxTokens: 30000 },
  });
  send(disabledHandle.agent);
  await disabledHandle.agent.whenIdle();
  assert.equal(requests, 1);
  await disabledHandle.dispose();
});
