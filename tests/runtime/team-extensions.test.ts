import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionId } from '@deepseek-ai/dsh-session';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { defineTool } from '@edh/tools';
import { ContractValidator } from '@edh/contracts';
import { FileTeamLoader } from '@edh/teams';
import { LocalStore } from '@edh/storage';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { UpperRun, CORE_TOOLS } from '../../apps/server/src/application.js';
import { FixtureBackend, FIXTURE_GOAL } from '../../apps/server/src/fixture-backend.js';
import { ScriptedModel, textResponse } from './scripted-model.js';

test(
  'user role and native tool compose through explicit delegation with isolated context and run lifetime',
  { timeout: 10000 },
  async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'edh-extension-'));
    const store = new LocalStore(directory);
    const model = new ScriptedModel([
      textResponse('Planner ready.'),
      textResponse('Analyst received explicit context.'),
    ]);
    const host = await createDshHost([{ providers: ['fixture'], adapter: model }]);
    let run: UpperRun | undefined;
    try {
      const validator = new ContractValidator(
        JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
      );
      const teamFile = resolve(directory, 'team.yaml');
      await writeFile(
        teamFile,
        `schema_version: physical.team.v1
team_id: extension-test
entrypoint: lead
learning_enabled: false
members:
  lead: builtin:planner
  verifier: builtin:verifier
  analyst: analyst.md
bindings:
  decision_owner: lead
  final_verifier: verifier
tool_bindings: {}
`,
      );
      await writeFile(
        resolve(directory, 'analyst.md'),
        `---
role_id: scene-analyst
description: Inspect explicit evidence using a custom native tool.
tools: [scene.describe, files.read, files.write, evidence.read, execution.start, todo_write]
---
ANALYST_ROLE_MARKER. Only use explicitly supplied context.
`,
      );
      const team = await new FileTeamLoader({
        validator,
        builtinDirectory: resolve('harness/agent-runtime/agents/roles'),
        roleRoot: directory,
        defaultModel: 'fixture',
        models: ['fixture'],
        tools: [...CORE_TOOLS, 'scene.describe'],
        providers: [],
      }).inspect(teamFile);
      let calls = 0;
      run = new UpperRun({
        host,
        team,
        validator,
        store,
        backend: new FixtureBackend(validator, 'first-pass', 50),
        goal: FIXTURE_GOAL,
        instruction: 'PRIVATE_PLANNER_MARKER',
        scenario: 'extension-test',
        model: () => ({ provider: 'fixture', model: 'fixture' }),
        additionalTools: {
          'scene.describe': (assignment) =>
            defineTool({
              name: 'scene__describe',
              description: 'Synthetic perception extension.',
              parameters: {},
              output: {
                schema: { type: 'string' },
                render: (_args, value) => [{ type: 'text', text: value }],
              },
              async execute() {
                calls++;
                return `synthetic scene for ${assignment.id}`;
              },
            }),
        },
      });
      await run.start();
      await run.settle();
      const invoke = (assignmentId: string, name: string, args: object = {}) =>
        host.tools.execute({
          agent: host.agents.get(SessionId(run!.state.assignments[assignmentId]!.sessionId))!,
          callId: ToolCallId(randomUUID()),
          name,
          arguments: args,
          signal: new AbortController().signal,
        });
      const owner = run.state.decisionAssignmentId;
      assert.equal(
        (
          await invoke(owner, 'files__write', {
            path: 'notes.md',
            content: 'PRIVATE_FILE_MARKER',
            expectedVersion: 0,
          })
        ).isError,
        false,
      );
      assert.equal(
        (
          await invoke(owner, 'team__delegate', {
            member: 'analyst',
            objective: 'Describe the scene.',
            context: 'EXPLICIT_HANDOFF_MARKER',
            evidenceRefs: [],
          })
        ).isError,
        false,
      );
      await run.settle();
      const analyst = Object.values(run.state.assignments).find((a) => a.member === 'analyst')!;
      assert(analyst);
      const input = JSON.stringify(model.requests[1]);
      assert.match(input, /ANALYST_ROLE_MARKER/);
      assert.match(input, /EXPLICIT_HANDOFF_MARKER/);
      assert.doesNotMatch(input, /PRIVATE_PLANNER_MARKER|PRIVATE_FILE_MARKER/);
      assert.equal((await invoke(analyst.id, 'scene__describe')).isError, false);
      assert.equal(calls, 1);
      assert.equal(
        (await invoke(owner, 'scene__describe')).isError,
        true,
        'Tool exposure is role scoped.',
      );
      assert.equal(
        (await invoke(analyst.id, 'files__read', { path: 'notes.md' })).isError,
        true,
        'Private files are assignment scoped.',
      );
      assert.equal(
        (await invoke(analyst.id, 'evidence__read', { evidenceId: 'ungranted-evidence' })).isError,
        true,
      );
      assert.equal(
        (await invoke(analyst.id, 'execution__start', { instruction: 'Move the cup.' })).isError,
        true,
        'Even an exposed motion tool requires decision ownership.',
      );
      assert.equal(run.state.requests.length, 0);
      assert.equal(
        (
          await invoke(analyst.id, 'todo_write', {
            todos: [{ content: 'Inspect scene', status: 'completed' }],
          })
        ).isError,
        false,
      );
      assert.equal(run.state.assignments[owner]!.todos, undefined);
      assert.equal(run.state.state, 'running', 'Completed TODOs cannot finish the physical task.');
      assert.equal(run.state.verdicts.length, 0);

      const duplicateBrief = { ...analyst.brief, assignment_id: randomUUID() };
      const attempts = await Promise.allSettled([
        run.sessions.create('analyst', duplicateBrief),
        run.sessions.create('analyst', duplicateBrief),
      ]);
      assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);
      await run.stop();
      assert.equal(
        (await invoke(analyst.id, 'scene__describe')).isError,
        true,
        'Custom tools cannot start after task cancellation.',
      );
      assert.equal(calls, 1);
      assert(
        run.state.events.some(
          (event) => event.type === 'tool.completed' && event.detail.tool === 'scene.describe',
        ),
      );
    } finally {
      await run?.close();
      await host.fiber.dispose();
      store.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
