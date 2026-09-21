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
import { AssignmentReports, type ReportInput } from '@edh/communication';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { UpperRun, CORE_TOOLS } from '../../apps/server/src/application.js';
import { FixtureBackend, FIXTURE_GOAL } from '../../apps/server/src/fixture-backend.js';
import { ScriptedModel, textResponse, toolResponse } from './scripted-model.js';

test(
  'user role and native tool compose through explicit delegation with isolated context and run lifetime',
  { timeout: 10000 },
  async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'edh-extension-'));
    const store = new LocalStore(directory);
    let replayed = false;
    const model = new ScriptedModel([
      textResponse('Planner ready.'),
      textResponse('Analyst received explicit context.'),
      textResponse('Planner received missing-context report.'),
      async function* (options) {
        const message = options.messages.filter((item) => item.source.kind === 'plugin').at(-1)!;
        const block = message.content.find((item) => item.type === 'text');
        assert(block?.type === 'text');
        const evidenceId = JSON.parse(block.text).payload.evidence[0].evidence.id;
        yield* toolResponse('agent__report', {
          status: 'completed',
          summary: 'Target identified.',
          result: { target: 'cup', confidence: 'high' },
          evidenceRefs: [evidenceId],
          requestedContext: [],
          expectedVersion: 1,
        })(options);
      },
      ...Array.from(
        { length: 4 },
        () =>
          async function* (options: Parameters<ReturnType<typeof textResponse>>[0]) {
            const latest = options.messages.at(-1)!;
            const block = latest.content.find((part) => part.type === 'text');
            if (latest.source.kind === 'plugin' && block?.type === 'text') {
              const { payload } = JSON.parse(block.text);
              if (payload.kind === 'agent-report') {
                yield* toolResponse('team__ack_report', {
                  assignmentId: payload.report.assignment_id,
                  reportId: payload.reportId,
                  disposition: 'accepted',
                  summary:
                    'Candidate report assessed; physical success still requires verification.',
                })(options);
                return;
              }
            }
            if (!replayed && options.tools?.some((tool) => tool.name === 'scene__describe')) {
              const call = options.messages
                .flatMap((message) => message.content)
                .findLast((part) => part.type === 'tool-call' && part.name === 'agent__report');
              assert(call?.type === 'tool-call');
              const result = latest.content.find((part) => part.type === 'tool-result');
              assert(
                result?.type === 'tool-result' && !result.isError,
                'Final report receipt reaches its author before retirement.',
              );
              replayed = true;
              yield* toolResponse(
                'agent__report',
                JSON.parse(call.arguments),
                'replay-before-idle',
              )(options);
              return;
            }
            yield* textResponse('Report or acknowledgement turn complete.')(options);
          },
      ),
      toolResponse('agent__report', {
        status: 'completed',
        summary: 'Late child report.',
        result: { target: 'cup', confidence: 'high' },
        evidenceRefs: [],
        requestedContext: [],
        expectedVersion: 0,
      }),
      textResponse('Child report retained.'),
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
output_schema: result.json
tools: [scene.describe, files.read, files.write, evidence.read, execution.start, todo_write]
---
ANALYST_ROLE_MARKER. Only use explicitly supplied context.
`,
      );
      await writeFile(
        resolve(directory, 'result.json'),
        JSON.stringify({
          type: 'object',
          properties: {
            target: { type: 'string' },
            confidence: { type: 'string', enum: ['low', 'high'] },
          },
          required: ['target', 'confidence'],
          additionalProperties: false,
        }),
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
      for (const args of [{}, { instruction: 3 }, { instruction: 'Move', unexpected: true }])
        assert.equal((await invoke(owner, 'execution__start', args)).isError, true);
      assert.equal(run.state.requests.length, 0, 'Malformed calls must not admit physical work.');
      assert.equal(
        (await invoke(owner, 'tasks__abandon', { status: 'succeeded', reason: 'forged' })).isError,
        true,
      );
      assert.equal(run.state.state, 'running');
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
      const analyst = run.sessions.get(
        Object.values(run.state.assignments).find((a) => a.member === 'analyst')!.id,
      );
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

      const report: ReportInput = {
        status: 'completed',
        summary: 'Target identified.',
        result: { target: 'cup', confidence: 'high' },
        evidenceRefs: [],
        requestedContext: [],
        expectedVersion: 0,
      };
      assert.equal(
        (
          await invoke(analyst.id, 'agent__report', {
            ...report,
            result: { target: 'cup', confidence: 'invented' },
          })
        ).isError,
        true,
      );
      assert.equal(
        (await invoke(analyst.id, 'agent__report', { ...report, result: null })).isError,
        true,
      );
      assert.equal(
        (await invoke(analyst.id, 'agent__report', { ...report, evidenceRefs: ['ungranted'] }))
          .isError,
        true,
      );
      assert.equal(
        (await invoke(analyst.id, 'agent__report', { ...report, agent_id: 'forged' })).isError,
        true,
      );
      assert.equal(
        (await invoke(analyst.id, 'agent__report', { ...report, expectedVersion: 5 })).isError,
        true,
      );
      assert.equal(
        (
          await invoke(analyst.id, 'agent__report', {
            ...report,
            status: 'insufficient_context',
            result: null,
          })
        ).isError,
        true,
      );
      assert.equal(
        run.snapshot().events.filter((event) => event.type === 'agent.report').length,
        0,
      );
      assert.equal(
        (
          await invoke(analyst.id, 'agent__report', {
            ...report,
            status: 'insufficient_context',
            result: null,
            requestedContext: ['A current view of the cabinet.'],
          })
        ).isError,
        false,
      );
      await run.settle();
      assert.match(JSON.stringify(model.requests[2]?.messages), /insufficient_context/);
      assert.equal(run.state.assignments[analyst.id]!.reportVersion, 1);
      assert.equal(run.sessions.acceptsMessages(analyst.id), true, 'Missing context is not final.');
      const lateChild = await run.sessions.create('analyst', {
        ...analyst.brief,
        assignment_id: randomUUID(),
        caller_assignment_id: analyst.id,
        caller_agent_id: analyst.sessionId,
        expected_output: { ...analyst.brief.expected_output, recipient: analyst.id },
      });
      await invoke(owner, 'perception__capture');
      const evidenceId = run.state.latestSensor!.evidence.id;
      assert.equal(
        (
          await invoke(owner, 'context__respond', {
            assignmentId: analyst.id,
            message: 'Here is the requested frame.',
            evidenceRefs: [evidenceId],
          })
        ).isError,
        false,
      );
      await run.settle();
      assert.match(JSON.stringify(model.requests[3]?.messages), new RegExp(evidenceId));
      const completed = { ...report, evidenceRefs: [evidenceId], expectedVersion: 1 };
      assert.equal(run.sessions.isLive(analyst.id), false);
      assert.equal(host.agents.get(SessionId(analyst.sessionId)), undefined);
      assert.equal(run.state.assignments[analyst.id]!.status, 'retired');
      const callerInput = model.requests
        .slice(4)
        .find((request) => JSON.stringify(request.messages).includes('agent-report'));
      assert(callerInput, 'Actual caller input must include the accepted structured report.');
      assert.match(JSON.stringify(callerInput.messages), /confidence/);
      assert(
        run
          .snapshot()
          .events.some(
            (event) =>
              event.type === 'dsh.tool-call' &&
              (event.detail.data as { name: string }).name === 'agent__report',
          ),
      );
      assert.equal(
        new AssignmentReports(store, validator).read(analyst.id)!.report.agent_id,
        analyst.sessionId,
      );
      assert.equal(new AssignmentReports(store, validator).read(analyst.id)!.version, 2);
      assert(replayed, 'Exact replay in the final native turn returns the durable receipt.');
      const reports = new AssignmentReports(store, validator);
      assert.equal(reports.submit(run.sessions.get(analyst.id), completed).replay, true);
      assert.equal(
        run.snapshot().events.filter((event) => event.type === 'agent.report').length,
        2,
      );
      assert.equal(
        model.requests.length,
        8,
        'Report replay adds only an author turn, not another caller message.',
      );
      assert(
        store
          .list<{ state: string }>('report-delivery:')
          .every((record) => record.value.state === 'settled'),
      );

      assert.throws(
        () =>
          reports.submit(run!.sessions.get(analyst.id), {
            ...completed,
            summary: 'Changed final result.',
          }),
        /final report/,
      );
      await assert.rejects(
        run.sessions.deliver(analyst.id, { work: 'Write a late file.' }, owner),
        /finishing or retired/,
      );
      assert.equal(
        (await invoke(owner, 'team__query', { assignmentId: analyst.id })).isError,
        false,
      );
      const finalRecord = store.get<{ id: string }>(`report:${analyst.id}`)!.value;
      const ack = store.get<{ recipientAssignmentId: string; disposition: string }>(
        `report-ack:${finalRecord.id}`,
      )!.value;
      assert.equal(ack.recipientAssignmentId, owner);
      assert.equal(ack.disposition, 'accepted');
      assert(
        run
          .snapshot()
          .events.some(
            (event) =>
              event.type === 'dsh.tool-call' &&
              (event.detail.data as { name: string }).name === 'team__ack_report',
          ),
      );
      const ackArgs = {
        assignmentId: analyst.id,
        reportId: finalRecord.id,
        disposition: 'accepted' as const,
        summary: 'Candidate report assessed; physical success still requires verification.',
      };
      assert.equal((await invoke(owner, 'team__ack_report', ackArgs)).isError, false);
      assert.throws(
        () => reports.acknowledge(analyst.id, finalRecord.id, analyst.id, ackArgs),
        /designated/,
      );
      assert.equal(
        (await invoke(owner, 'team__ack_report', { ...ackArgs, recipientAssignmentId: analyst.id }))
          .isError,
        true,
      );
      assert.equal(
        (await invoke(owner, 'team__ack_report', { ...ackArgs, disposition: 'rejected' })).isError,
        true,
      );
      assert.equal(
        run.snapshot().events.filter((event) => event.type === 'agent.report-acknowledged').length,
        1,
      );
      assert.equal(
        run.snapshot().events.find((event) => event.type === 'agent.report-acknowledged')!.detail
          .assignmentId,
        owner,
      );
      assert.equal(
        run.state.state,
        'running',
        'A completed analysis report cannot finish the robot task.',
      );
      assert.equal(run.state.verdicts.length, 0);

      await run.sessions.deliver(
        lateChild.id,
        { kind: 'delegated', brief: lateChild.brief },
        analyst.id,
      );
      await run.settle();
      assert.equal(
        run.state.state,
        'running',
        'Late reports must not reopen the caller or fail the task.',
      );
      assert.equal(run.sessions.isLive(lateChild.id), false);
      assert.equal(reports.status(lateChild.id).reportDelivery?.state, 'failed');
      assert.match(
        reports.delivery(reports.read(lateChild.id)!.id)?.error ?? '',
        /Recipient assignment has finished/,
      );
      assert.equal(reports.read(lateChild.id)?.report.summary, 'Late child report.');
      assert.equal(
        run
          .snapshot()
          .events.filter(
            (event) => event.type === 'message.delivered' && event.detail.recipient === analyst.id,
          ).length,
        2,
        'No third message is delivered to the retired parent.',
      );
      const duplicateBrief = { ...analyst.brief, assignment_id: randomUUID() };
      const attempts = await Promise.allSettled([
        run.sessions.create('analyst', duplicateBrief),
        run.sessions.create('analyst', duplicateBrief),
      ]);
      assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);
      await run.stop();
      assert.equal(
        (await invoke(duplicateBrief.assignment_id, 'scene__describe')).isError,
        true,
        'Custom tools cannot start after task cancellation.',
      );
      assert.equal(calls, 1);
      assert(
        run
          .snapshot()
          .events.some(
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
