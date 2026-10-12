import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { createDshSession } from '@edh/agents';
import { createConfiguredModels } from '@edh/models';
import { TeamSessions } from '@edh/communication';
import { ContractValidator } from '@edh/contracts';
import { FileTeamLoader } from '@edh/teams';
import { CORE_TOOLS } from '@edh/tools';
import { SessionId } from '@deepseek-ai/dsh-session';
import { createDshHost } from '../apps/server/src/runtime.ts';

const { values } = parseArgs({ options: { output: { type: 'string' } } });
assert(values.output, 'Supply a new --output directory.');
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
await mkdir(output, { recursive: false });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = await Promise.all(
  [
    'apps/server/src/runtime.ts',
    'harness/agent-runtime/agents/src/runtime.ts',
    'harness/agent-runtime/agents/src/dsh/loop/agent.ts',
    'harness/agent-runtime/models/src/configuration.ts',
    'harness/agent-runtime/models/src/openai-compatible.ts',
    'harness/agent-runtime/models/src/openai-responses.ts',
    'harness/agent-runtime/models/src/dsh/llm/retry-policy.ts',
    'harness/agent-runtime/models/src/dsh/llm/index.ts',
    'harness/agent-runtime/agents/src/dsh/model-retry/index.ts',
    'harness/agent-runtime/agents/src/dsh/model-retry/types.ts',
    'harness/agent-runtime/agents/src/dsh/model-retry/brand.ts',
    'harness/agent-runtime/communication/src/sessions.ts',
    'apps/server/src/event-record-owners.ts',
    'apps/console/public/app.js',
    'harness/agent-runtime/teams/src/loader.ts',
    'harness/contracts/schema/physical.schema.json',
    'examples/teams/console-demo.yaml',
    'harness/agent-runtime/agents/roles/builtins.json',
    'harness/agent-runtime/agents/roles/planner/ROLE.md',
    'harness/agent-runtime/agents/roles/planner/WORKFLOW.md',
    'harness/agent-runtime/agents/roles/verifier/ROLE.md',
    'harness/agent-runtime/agents/roles/verifier/WORKFLOW.md',
    'harness/agent-runtime/agents/roles/evolver/ROLE.md',
    'scripts/check-model-retry-offline.mjs',
  ].map(async (name) => ({
    path: resolve(root, name),
    sha256: hash(await readFile(resolve(root, name))),
  })),
);

// 关闭实际预留的 TCP listener，以真实 ECONNREFUSED 验证生产 transport。
const listener = createServer();
await new Promise((accept, reject) => {
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', accept);
});
const port = listener.address().port;
await new Promise((accept, reject) =>
  listener.close((error) => (error ? reject(error) : accept())),
);
const baseURL = `http://127.0.0.1:${port}/v1`;
await assert.rejects(
  fetch(baseURL, { signal: AbortSignal.timeout(3000) }),
  (error) => error.cause?.code === 'ECONNREFUSED',
);
const checks = [];
const journals = [];
const traces = [];
const bounded = async (operation) => {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_accept, reject) => {
        timer = setTimeout(
          () => reject(new Error('Native retry diagnostic exceeded its deadline.')),
          10_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
const message = () =>
  createUserMessage({
    source: { kind: 'user' },
    content: [
      { type: 'text', text: 'Read this request. No tools or physical execution are available.' },
    ],
  });

async function check(protocol, mode) {
  const waiting = ['cancel', 'dispose', 'always-cancel'].includes(mode);
  const models = createConfiguredModels({
    version: 1,
    defaultModel: 'diagnostic',
    endpoints: {
      local: {
        hosting: 'vllm',
        protocol,
        baseURL,
        authentication: { type: 'none' },
        timeoutMs: 3000,
        retryPolicy: {
          mode: mode === 'always-cancel' ? 'always' : 'normal',
          ...(mode === 'always-cancel' ? {} : { maxRetries: mode === 'disabled' ? 0 : 2 }),
          backoff: {
            initialDelayMs: waiting ? 15_000 : 5,
            maxDelayMs: waiting ? 15_000 : 10,
            jitterRatio: 0,
          },
        },
      },
    },
    models: {
      diagnostic: { endpoint: 'local', model: 'Qwen/Qwen3.5-4B', inputModalities: ['text'] },
    },
  });
  const host = await createDshHost(models.adapters);
  const registry = host.agents;
  const requests = [];
  const handles = [];
  const errors = new Map();
  const trace = [];
  let teamSessions;
  if (mode === 'team') {
    const validator = new ContractValidator(
      JSON.parse(
        await readFile(resolve(root, 'harness/contracts/schema/physical.schema.json'), 'utf8'),
      ),
    );
    const team = await new FileTeamLoader({
      validator,
      builtinDirectory: resolve(root, 'harness/agent-runtime/agents/roles'),
      roleRoot: resolve(root, 'examples'),
      defaultModel: 'diagnostic',
      models: ['diagnostic'],
      tools: CORE_TOOLS,
      providers: [],
    }).inspect(resolve(root, 'examples/teams/console-demo.yaml'));
    teamSessions = new TeamSessions(
      host,
      team,
      validator,
      {
        tools: () => [],
        event: (type, detail) => trace.push({ type, detail }),
        audit: (assignmentId, session) => {
          assert.equal(assignmentId, teamSessions.get(assignmentId).id);
          assert(session.seq > 0);
        },
      },
      () => models.models.diagnostic,
    );
  }
  let retryScheduled;
  const scheduled = new Promise((accept) => {
    retryScheduled = accept;
  });
  host.on('llm/stream', (options, next) => {
    requests.push({
      sessionId: String(options.sessionId),
      provider: options.provider,
      model: options.model,
    });
    return next();
  });
  host.on('session/event', (_session, event) => {
    if (event.type === 'llm/retry') retryScheduled();
  });
  let released = false;
  let elapsedMs;
  try {
    for (let index = 0; index < (mode === 'independent' ? 2 : 1); index++) {
      let assignment;
      if (teamSessions)
        assignment = await teamSessions.create('lead', {
          schema_version: 'physical.invocation.v1',
          assignment_id: randomUUID(),
          caller_agent_id: 'user',
          caller_assignment_id: 'user',
          team_run_id: teamSessions.team.teamRunId,
          objective: 'Inspect the unavailable model transport without physical execution.',
          task_scope: {
            task_id: randomUUID(),
            goal_id: 'transport-check',
            attempt_id: 'attempt-1',
          },
          expected_output: { schema: 'builtin:AgentReport.v1', recipient: 'user' },
          entities: {},
          success_contract: {
            id: 'transport-check',
            version: '1',
            all: [{ check_id: 'report', check: 'report_available', args: [] }],
            source: { kind: 'user', reference: 'Transport diagnostic' },
          },
          known_facts: [],
          history_summary: '',
          changes: [],
          evidence_refs: [],
          tools_and_limits: { allowed_tools: [], allowed_actions: [] },
        });
      const handle = assignment
        ? {
            agent: registry.get(SessionId(assignment.sessionId)),
            dispose: () => teamSessions.retire(assignment.id, 'diagnostic-complete'),
          }
        : await createDshSession(host, {
            sessionId: randomUUID(),
            ...models.models.diagnostic,
            instructions: 'Follow the user request. No physical controls are available.',
            tools: [],
          });
      const failures = [];
      handle.agent.ctx.on('agent/error', ({ error }) =>
        failures.push({ code: error.code, message: error.message }),
      );
      errors.set(String(handle.agent.id), failures);
      handles.push(handle);
      if (assignment)
        await assert.rejects(
          bounded(
            teamSessions.deliver(assignment.id, { instruction: 'Read this request.' }, 'user'),
          ),
          /(?:Model|Responses) request failed during HTTP connection/,
        );
      else handle.agent.followup(message());
    }
    if (waiting) {
      await bounded(scheduled);
      const start = performance.now();
      if (mode !== 'dispose') handles[0].agent.cancel({ kind: 'user' });
      else {
        await bounded(host.fiber.dispose());
        released = true;
      }
      await bounded(Promise.all(handles.map((handle) => handle.agent.whenIdle())));
      elapsedMs = performance.now() - start;
      assert(
        elapsedMs < 3000,
        'Cancellation must release the actual 15-second retry timer promptly.',
      );
    } else {
      await bounded(Promise.all(handles.map((handle) => handle.agent.whenIdle())));
      if (mode === 'next-turn') {
        handles[0].agent.followup(message());
        await bounded(handles[0].agent.whenIdle());
      }
    }
    const chains = [];
    for (const handle of handles) {
      const sessionId = String(handle.agent.id);
      const events = handle.agent.session.snapshotEvents();
      const retries = events.filter((event) => event.type === 'llm/retry');
      const started = events.filter((event) => event.type === 'llm/retry-started');
      const attempts = events.filter((event) => event.type === 'assistant/attempt');
      const turns = events.filter((event) => event.type === 'turn/end');
      const failures = errors.get(sessionId);
      const expectedTurns = mode === 'next-turn' ? 2 : 1;
      const expectedRequests = waiting || mode === 'disabled' ? 1 : 3 * expectedTurns;
      assert.equal(
        requests.filter((request) => request.sessionId === sessionId).length,
        expectedRequests,
      );
      assert.equal(attempts.length, expectedRequests);
      assert.equal(retries.length, waiting ? 1 : mode === 'disabled' ? 0 : 2 * expectedTurns);
      assert.equal(started.length, waiting ? 0 : retries.length);
      assert.equal(turns.length, expectedTurns);
      assert.equal(
        events.filter((event) =>
          ['assistant/message', 'tool/call', 'tool/result'].includes(event.type),
        ).length,
        0,
      );
      assert.equal(failures.length, waiting ? 0 : expectedTurns);
      for (const failure of failures) assert.equal(failure.code, 'TRANSPORT');
      for (const retry of retries) {
        assert.equal(retry.data.failure.code, 'TRANSPORT');
        assert.equal(retry.data.provider, 'local');
        if (mode === 'always-cancel') assert.equal(retry.data.mode, 'always');
        else assert.equal(retry.data.maxRetries, 2);
        if (protocol === 'chat_completions')
          assert.match(retry.data.failure.message, /ECONNREFUSED/);
      }
      if (waiting) assert.equal(turns[0].data.reason.kind, 'aborted');
      else {
        for (const turn of turns) assert.equal(turn.data.reason.kind, 'error');
        for (let index = 0; index < expectedTurns && retries.length; index++) {
          const pair = retries.slice(index * 2, index * 2 + 2);
          assert.deepEqual(
            pair.map((event) => event.data.retry),
            [1, 2],
          );
          assert.deepEqual(
            pair.map((event) => event.data.delayMs),
            [5, 10],
          );
          assert.equal(pair[0].data.retryId, pair[1].data.retryId);
          chains.push(pair[0].data.retryId);
        }
      }
      if (!released)
        assert.deepEqual(host.sessionProjections.stateOf(handle.agent.session, 'llmRetry'), {});
      const file = `${protocol}-${mode}-${sessionId}.json`;
      const bytes = `${JSON.stringify(events, null, 2)}\n`;
      await writeFile(resolve(output, file), bytes, { flag: 'wx' });
      journals.push({ file, sha256: hash(bytes), sessionId, eventCount: events.length });
      if (teamSessions) {
        const observed = trace.filter((event) => event.type === 'agent.model-retry');
        assert.equal(observed.length, retries.length + started.length);
        for (const event of observed) {
          const native = events.find((item) => item.seq === event.detail.sessionSequence);
          assert.equal(event.detail.sessionId, sessionId);
          assert.equal(event.detail.member, 'lead');
          assert.equal(event.detail.type, native.type);
          assert.deepEqual(event.detail.data, native.data);
        }
        const traceFile = `${protocol}-team-trace.json`;
        const traceBytes = `${JSON.stringify(trace, null, 2)}\n`;
        await writeFile(resolve(output, traceFile), traceBytes, {
          flag: 'wx',
        });
        traces.push({ file: traceFile, sha256: hash(traceBytes), sessionId });
      }
    }
    assert.equal(new Set(chains).size, chains.length);
    checks.push({
      name: `${protocol}:${mode}`,
      requests: requests.length,
      sessions: handles.length,
      ...(elapsedMs === undefined ? {} : { elapsedMs }),
      expectedFailure: 'TRANSPORT',
      modelResponseCount: 0,
    });
  } finally {
    if (!released) {
      for (const handle of handles) await bounded(handle.dispose());
      if (teamSessions) await bounded(teamSessions.close());
      await bounded(host.fiber.dispose());
    }
  }
  assert.equal(registry.list().length, 0);
}

for (const protocol of ['chat_completions', 'responses'])
  for (const mode of [
    'bounded',
    'disabled',
    'independent',
    'next-turn',
    'cancel',
    'dispose',
    'always-cancel',
    'team',
  ])
    await check(protocol, mode);
await assert.rejects(
  fetch(baseURL, { signal: AbortSignal.timeout(3000) }),
  (error) => error.cause?.code === 'ECONNREFUSED',
);
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
const report = {
  schemaVersion: 'edh.model_retry.cpu.v1',
  checks,
  journals,
  traces,
  sources,
  listenerClosed: true,
  agentsReleased: true,
  gpuAllocationCount: 0,
  modelResponseCount: 0,
  simulatorAllocationCount: 0,
  scope:
    'Actual native DSH requests through production model adapters to a closed local TCP port; transport failure, retry, cancellation and disposal only.',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`, {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    output,
    checkCount: checks.length,
    journalCount: journals.length,
    agentsReleased: true,
  }),
);
