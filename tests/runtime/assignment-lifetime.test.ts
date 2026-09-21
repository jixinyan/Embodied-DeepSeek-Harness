import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SessionId } from '@deepseek-ai/dsh-session';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { ContractValidator, type InvocationBrief } from '@edh/contracts';
import { TeamSessions, type Assignment } from '@edh/communication';
import { AssignmentEvidenceGrants } from '@edh/memory';
import { LocalStore, SessionAudits } from '@edh/storage';
import { FileTeamLoader } from '@edh/teams';
import { CORE_TOOLS } from '@edh/tools';
import { createDshHost } from '../../apps/server/src/runtime.js';

async function openTeam() {
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const team = await new FileTeamLoader({
    validator,
    builtinDirectory: resolve('harness/agent-runtime/agents/roles'),
    roleRoot: resolve('examples'),
    defaultModel: 'deployment-model',
    models: ['deployment-model'],
    tools: CORE_TOOLS,
    providers: [],
  }).inspect(resolve('examples/teams/console-demo.yaml'));
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/edh-assignment-lifetime-'));
  const store = new LocalStore(directory);
  const host = await createDshHost([]);
  const grants = new AssignmentEvidenceGrants();
  const audits = new SessionAudits(store);
  const runId = randomUUID();
  const sessions = new TeamSessions(
    host,
    team,
    validator,
    {
      tools: () => [],
      event(type, detail) {
        if (type === 'agent.created') {
          const assignment = detail.assignment as Assignment;
          grants.open(assignment.id, assignment.brief.evidence_refs);
        }
        if (type === 'agent.retired') grants.release(String(detail.assignmentId));
        store.put(`lifecycle:${randomUUID()}`, { type, detail }, 0);
      },
      audit(id, session) {
        audits.appendNative(runId, id, session);
      },
    },
    () => ({ provider: 'openai-compatible', model: 'deployment-model' }),
  );
  function brief(refs: string[] = []): InvocationBrief {
    return {
      schema_version: 'physical.invocation.v1',
      assignment_id: randomUUID(),
      caller_agent_id: 'user',
      caller_assignment_id: 'user',
      team_run_id: team.teamRunId,
      objective: 'Review the explicitly supplied documentation.',
      task_scope: { task_id: runId, goal_id: 'review', attempt_id: 'attempt-1' },
      expected_output: { schema: 'builtin:AgentReport.v1', recipient: 'user' },
      entities: {},
      success_contract: {
        id: 'review',
        version: '1',
        all: [{ check_id: 'report', check: 'report_available', args: [] }],
        source: { kind: 'user', reference: 'Documentation review' },
      },
      known_facts: [],
      history_summary: '',
      changes: [],
      evidence_refs: refs,
      tools_and_limits: { allowed_tools: [], allowed_actions: [] },
    };
  }
  return {
    directory,
    store,
    host,
    grants,
    audits,
    runId,
    sessions,
    brief,
    async close() {
      try {
        await sessions.close();
      } finally {
        grants.close();
        await host.fiber.dispose();
        store.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

test('explicit evidence grants copy inputs, isolate assignments and reject late extensions', () => {
  const grants = new AssignmentEvidenceGrants();
  const refs = ['document-a'];
  grants.open('planner', refs);
  refs.push('unshared-document');
  grants.open('verifier', []);
  grants.extend('planner', ['document-b', 'document-a']);
  assert.deepEqual(grants.references('planner'), ['document-a', 'document-b']);
  assert.deepEqual(grants.references('verifier'), []);
  grants.references('planner').push('unshared-document');
  assert.equal(grants.has('planner', 'unshared-document'), false);
  assert.throws(() => grants.open('planner', []), /already exist/);
  grants.release('planner');
  grants.release('planner');
  assert.equal(grants.has('planner', 'document-a'), false);
  assert.throws(() => grants.extend('planner', ['document-a']), /unavailable/);
  assert.throws(() => grants.references('planner'), /unavailable/);
  grants.extend('verifier', ['document-a']);
  grants.close();
  grants.close();
  assert.equal(grants.has('verifier', 'document-a'), false);
  assert.throws(() => grants.extend('verifier', []), /unavailable/);
  assert.throws(() => grants.open('next-task', []), /closed/);
});

test('native assignment retirement releases registries and grants while retaining durable audit', async () => {
  const t = await openTeam();
  try {
    const brief = t.brief(['readme']);
    const assignment = await t.sessions.create('lead', brief);
    const sessionId = SessionId(assignment.sessionId);
    const session = t.host.sessions.get(sessionId)!;
    assert(t.host.agents.get(sessionId));
    session.append(
      'user/message',
      createUserMessage({
        source: { kind: 'plugin', plugin: 'documentation', form: 'relay' },
        content: [{ type: 'text', text: await readFile('README.md', 'utf8') }],
      }),
      { surfaceOp: 'append' },
    );
    const events = session.snapshotEvents();
    const completion = t.sessions.finish(assignment.id, 'review-scope-ended');
    assert.equal(t.sessions.finish(assignment.id, 'repeat'), completion);
    assert.equal(t.sessions.acceptsMessages(assignment.id), false);
    assert.equal(t.grants.has(assignment.id, 'readme'), true);
    await completion;
    assert.equal(t.sessions.isLive(assignment.id), false);
    assert.equal(t.host.agents.get(sessionId), undefined);
    assert.equal(t.host.sessions.get(sessionId), undefined);
    assert.equal(t.grants.has(assignment.id, 'readme'), false);
    assert.throws(() => t.grants.extend(assignment.id, ['late-frame']), /unavailable/);
    assert.deepEqual(t.sessions.get(assignment.id), assignment);
    await assert.rejects(t.sessions.create('lead', brief), /already exists/);
    await assert.rejects(t.sessions.deliver(assignment.id, {}, 'user'), /retired/);
    assert.deepEqual(t.audits.read(t.runId)[0]!.value, events);
    t.store.close();
    const reopened = new LocalStore(t.directory);
    try {
      assert.deepEqual(new SessionAudits(reopened).read(t.runId)[0]!.value, events);
    } finally {
      reopened.close();
    }
  } finally {
    await t.close();
  }
});

test('retired native assignments release capacity across repeated independent delegations', async () => {
  const t = await openTeam();
  try {
    for (let index = 0; index < 70; index++) {
      const assignment = await t.sessions.create('verifier', t.brief(['readme']));
      assert.equal(t.host.sessions.list().length, 1);
      const retirement = t.sessions.retire(assignment.id, 'segment-ended');
      assert.equal(t.sessions.retire(assignment.id, 'repeat'), retirement);
      assert.equal(t.sessions.acceptsMessages(assignment.id), false);
      await retirement;
      assert.equal(t.host.sessions.list().length, 0);
      assert.equal(t.host.agents.get(SessionId(assignment.sessionId)), undefined);
      assert.equal(t.grants.has(assignment.id, 'readme'), false);
    }
  } finally {
    await t.close();
  }
});

test('retirement audit includes events committed by native scoped cleanup', async () => {
  const t = await openTeam();
  try {
    const assignment = await t.sessions.create('lead', t.brief());
    const agent = t.host.agents.get(SessionId(assignment.sessionId))!;
    const before = agent.session.snapshotEvents().length;
    agent.ctx.effect(() => () => {
      agent.session.append(
        'user/message',
        createUserMessage({
          source: { kind: 'plugin', plugin: 'scope-lifecycle', form: 'relay' },
          content: [{ type: 'text', text: 'Documentation scope released.' }],
        }),
        { surfaceOp: 'append' },
      );
    });
    await t.sessions.retire(assignment.id, 'task-ended');
    const events = agent.session.snapshotEvents();
    assert.equal(events.length, before + 1);
    assert.deepEqual(t.audits.read(t.runId)[0]!.value, events);
    assert.equal(t.host.sessions.get(SessionId(assignment.sessionId)), undefined);
  } finally {
    await t.close();
  }
});

test('team close drains pending native creation and prevents further admission', async () => {
  const t = await openTeam();
  try {
    const creation = t.sessions.create('lead', t.brief());
    const closing = t.sessions.close();
    assert.equal(t.sessions.close(), closing);
    await assert.rejects(creation, /closed during creation/);
    await closing;
    assert.equal(t.host.sessions.list().length, 0);
    await assert.rejects(t.sessions.create('lead', t.brief()), /admission closed/);
  } finally {
    await t.close();
  }
});

test('native delivery publishes its error events when the selected model adapter is unavailable', async () => {
  const t = await openTeam();
  try {
    const assignment = await t.sessions.create('lead', t.brief());
    await assert.rejects(
      t.sessions.deliver(assignment.id, { instruction: 'Review the document.' }, 'user'),
      /no adapter registered/,
    );
    const session = t.host.sessions.get(SessionId(assignment.sessionId))!;
    const events = session.snapshotEvents();
    assert(events.some((event) => event.type === 'turn/end' && event.data.reason.kind === 'error'));
    assert.deepEqual(t.audits.read(t.runId)[0]!.value, events);
    assert.deepEqual(t.store.get(`session-audit:${t.runId}:${assignment.id}`)?.value, {
      format: 'edh.session-audit.v2',
      count: events.length,
      sessionId: session.id,
    });
    await t.sessions.retire(assignment.id, 'model-unavailable');
    assert.equal(t.host.sessions.get(SessionId(assignment.sessionId)), undefined);
  } finally {
    await t.close();
  }
});

test('creation publication failure still disposes the native assignment and releases evidence', async () => {
  const t = await openTeam();
  const hold = t.store.holdWrites();
  const brief = t.brief(['readme']);
  try {
    await assert.rejects(t.sessions.create('lead', brief), /creation and cleanup failed/);
    assert.equal(t.host.sessions.list().length, 0);
    const assignment = t.sessions.get(brief.assignment_id);
    assert.equal(t.host.agents.get(SessionId(assignment.sessionId)), undefined);
    assert.equal(t.grants.has(assignment.id, 'readme'), false);
    assert.equal(t.sessions.isLive(assignment.id), false);
    hold.release();
    await assert.rejects(t.sessions.close(), /shutdown failed/);
  } finally {
    hold.release();
    await assert.rejects(t.close(), /shutdown failed/);
  }
});

test('audit write failure releases native state and remains visible to every shutdown caller', async () => {
  const t = await openTeam();
  const assignment = await t.sessions.create('lead', t.brief(['readme']));
  const hold = t.store.holdWrites();
  try {
    const retirement = t.sessions.retire(assignment.id, 'task-ended');
    await assert.rejects(retirement, /retirement failed/);
    assert.equal(t.sessions.retire(assignment.id, 'repeat'), retirement);
    assert.equal(t.host.sessions.get(SessionId(assignment.sessionId)), undefined);
    assert.equal(t.host.agents.get(SessionId(assignment.sessionId)), undefined);
    assert.equal(t.grants.has(assignment.id, 'readme'), false);
    hold.release();
    const closing = t.sessions.close();
    assert.equal(t.sessions.close(), closing);
    await assert.rejects(closing, /shutdown failed/);
  } finally {
    hold.release();
    await assert.rejects(t.close(), /shutdown failed/);
  }
});
