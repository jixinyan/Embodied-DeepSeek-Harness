import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { TeamSessions } from '@edh/communication';
import { ContractValidator, type InvocationBrief } from '@edh/contracts';
import { FileTeamLoader } from '@edh/teams';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { CORE_TOOLS } from '../../apps/server/src/application.js';
import { FixtureModel } from '../../apps/server/src/fixture-model.js';

async function setup(audit: () => void) {
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const loaded = await new FileTeamLoader({
    validator,
    builtinDirectory: resolve('harness/agent-runtime/agents/roles'),
    roleRoot: resolve('examples'),
    defaultModel: 'fixture',
    models: ['fixture'],
    tools: CORE_TOOLS,
    providers: [],
  }).inspect('examples/teams/console-demo.yaml');
  const team = { ...loaded, teamRunId: randomUUID() };
  const host = await createDshHost([{ providers: ['fixture'], adapter: new FixtureModel(0) }]);
  const sessions = new TeamSessions(
    host,
    team,
    validator,
    { tools: () => [], event: () => {}, audit },
    () => ({ provider: 'fixture', model: 'fixture' }),
  );
  const brief = JSON.parse(await readFile('tests/fixtures/invocation.json', 'utf8'))
    .value as InvocationBrief;
  brief.team_run_id = team.teamRunId;
  brief.tools_and_limits.allowed_tools = [];
  return { host, sessions, brief };
}

test('failed audit does not leave native DSH sessions alive and repeated close shares completion', async () => {
  let audits = 0;
  const { host, sessions, brief } = await setup(() => {
    audits++;
    throw new Error('Audit write failed');
  });
  try {
    await sessions.create('lead', brief);
    await sessions.create('lead', { ...brief, assignment_id: randomUUID() });
    assert.equal(host.agents.list().length, 2);
    const closing = sessions.close();
    assert.equal(sessions.close(), closing);
    await assert.rejects(closing, (error) => {
      assert(error instanceof AggregateError);
      assert.equal(error.errors.length, 2);
      assert(error.errors.every((failure: Error) => failure.message === 'Audit write failed'));
      return true;
    });
    assert.equal(audits, 2);
    assert.equal(
      host.agents.list().length,
      0,
      'Dispose each native handle even if its audit failed.',
    );
  } finally {
    await host.fiber.dispose();
  }
});

test('team close drains a native session created after shutdown began', async () => {
  const { host, sessions, brief } = await setup(() => {});
  let release!: () => void, ready!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  const entered = new Promise<void>((done) => {
    ready = done;
  });
  const create = host.agents.create.bind(host.agents);
  host.agents.create = async (...args: Parameters<typeof create>) => {
    const handle = await create(...args);
    ready();
    await gate;
    return handle;
  };
  try {
    const creating = sessions.create('lead', brief);
    const rejected = assert.rejects(creating, /Team closed during creation/);
    await entered;
    let settled = false;
    const closing = sessions.close();
    void closing.then(() => {
      settled = true;
    });
    await setTimeout(0);
    assert.equal(settled, false);
    release();
    await rejected;
    await closing;
    assert.equal(host.agents.list().length, 0);
  } finally {
    release();
    await sessions.close();
    await host.fiber.dispose();
  }
});
