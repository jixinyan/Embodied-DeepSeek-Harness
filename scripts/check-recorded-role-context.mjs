import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ContractValidator } from '@edh/contracts';
import { AssignmentReports } from '@edh/communication';
import { SensorSamples } from '@edh/perception';
import { LocalStore } from '@edh/storage';

const { values } = parseArgs({
  options: {
    run: { type: 'string' },
    events: { type: 'string' },
    journal: { type: 'string' },
    output: { type: 'string' },
    'checkpoint-verification': { type: 'string' },
    'closed-session': { type: 'string' },
    'require-cancelled-pending': { type: 'boolean', default: false },
    'require-pre-motion': { type: 'boolean', default: false },
  },
});
assert(values.run && values.events && values.journal && values.output);
const run = JSON.parse(await readFile(resolve(values.run), 'utf8'));
const events = JSON.parse(await readFile(resolve(values.events), 'utf8'));
assert(['simulation', 'hardware'].includes(run.source));
assert(['succeeded', 'failed', 'cancelled', 'unknown', 'interrupted'].includes(run.state));
assert.equal(events.length, run.eventCount);
events.forEach((event, index) => assert.equal(event.sequence, index + 1));
const validator = new ContractValidator(
  JSON.parse(
    await readFile(
      new URL('../harness/contracts/schema/physical.schema.json', import.meta.url),
      'utf8',
    ),
  ),
);
const assignments = new Map(
  events
    .filter((event) => event.type === 'agent.created')
    .map((event) => [event.detail.assignment.id, event.detail.assignment]),
);
assert.equal(assignments.size, events.filter((event) => event.type === 'agent.created').length);
const nativeCalls = new Map(
  events
    .filter((event) => event.type === 'dsh.tool-call')
    .map((event) => [event.detail.data.callId, event]),
);
const startedCalls = new Map(
  events
    .filter((event) => event.type === 'tool.started')
    .map((event) => [event.detail.callId, event]),
);
const completedCalls = new Map(
  events
    .filter((event) => event.type === 'tool.completed')
    .map((event) => [event.detail.callId, event]),
);
function originalCall(event) {
  const native = nativeCalls.get(event.detail.callId);
  assert(native, 'The actual native model call is missing.');
  assert.equal(native.detail.assignmentId, event.detail.assignmentId);
  assert.equal(native.detail.data.name, event.detail.tool.replaceAll('.', '__'));
  assert.deepEqual(JSON.parse(native.detail.data.arguments), event.detail.args);
  return native;
}
const checkpoint = values['checkpoint-verification']
  ? JSON.parse(await readFile(resolve(values['checkpoint-verification']), 'utf8'))
  : undefined;
const closedSession = values['closed-session']
  ? JSON.parse(await readFile(resolve(values['closed-session']), 'utf8'))
  : undefined;
if (closedSession) {
  assert.equal(closedSession.state, 'closed');
  assert.equal(closedSession.resources, 'released');
  assert.equal(closedSession.taskHistory.lastRunId, run.id);
}
const store = new LocalStore(resolve(values.journal));
try {
  const reports = new AssignmentReports(store, validator);
  const sensors = new SensorSamples(store, validator, run.id, run.source);
  const continuations = [];
  const pending = [];
  for (const assignment of assignments.values()) {
    const history = reports.history(assignment.id);
    if (!history.length) continue;
    assert.notEqual(assignment.id, run.decisionAssignmentId);
    const caller = assignments.get(assignment.brief.caller_assignment_id);
    assert(caller, 'The published report caller is missing.');
    assert.notEqual(assignment.sessionId, caller.sessionId);
    for (const record of history) {
      assert.equal(record.report.agent_id, assignment.sessionId);
      assert.equal(record.report.assignment_id, assignment.id);
      assert.equal(record.report.team_run_id, assignment.brief.team_run_id);
      assert.equal(record.recipient, caller.id);
      assert.deepEqual(record.report.task_scope, assignment.brief.task_scope);
      const event = events.find(
        (event) => event.type === 'agent.report' && event.detail.reportId === record.id,
      );
      assert(event, 'The published report event is missing.');
      assert.equal(event.detail.version, record.version);
      assert.deepEqual(event.detail.report, record.report);
      const call = [...startedCalls.values()].find(
        (call) =>
          call.detail.tool === 'agent.report' &&
          call.detail.assignmentId === assignment.id &&
          call.detail.args.expectedVersion === record.version - 1,
      );
      assert(call, 'The original versioned native report call is missing.');
      originalCall(call);
      assert.equal(call.detail.args.status, record.report.status);
      assert.equal(call.detail.args.summary, record.report.summary);
      assert.deepEqual(call.detail.args.evidenceRefs, record.report.evidence_refs);
      if (record.report.status === 'insufficient_context')
        assert.deepEqual(call.detail.args.requestedContext, record.report.requested_context);
      else {
        assert.deepEqual(call.detail.args.requestedContext, []);
        assert(!Object.hasOwn(record.report, 'requested_context'));
      }
      if (call.detail.args.result === null) assert(!Object.hasOwn(record.report, 'result'));
      else assert.deepEqual(call.detail.args.result, record.report.result);
      const completed = completedCalls.get(call.detail.callId);
      assert(completed, 'The original native report receipt is missing.');
      assert.equal(completed.detail.result.reportId, record.id);
      assert.equal(completed.detail.result.version, record.version);
      for (const reference of record.report.evidence_refs) {
        const sample = sensors.read(reference);
        assert(sample, 'The report evidence is missing.');
        assert.equal(sample.evidence.task_scope.task_id, run.id);
      }
    }
    const first = history[0];
    const latest = history.at(-1);
    if (first.report.status === 'insufficient_context' && latest.report.status === 'completed') {
      assert(history.length >= 2);
      assert(first.report.requested_context.length);
      const firstEvent = events.find(
        (event) => event.type === 'agent.report' && event.detail.reportId === first.id,
      );
      const lastEvent = events.find(
        (event) => event.type === 'agent.report' && event.detail.reportId === latest.id,
      );
      const response = [...startedCalls.values()].find(
        (call) =>
          call.detail.tool === 'context.respond' &&
          call.detail.assignmentId === caller.id &&
          call.detail.args.assignmentId === assignment.id &&
          firstEvent.sequence < call.sequence &&
          call.sequence < lastEvent.sequence,
      );
      assert(response, 'No explicit caller context continued this assignment.');
      originalCall(response);
      assert(completedCalls.has(response.detail.callId));
      const delivery = events.find(
        (event) =>
          event.type === 'message.delivered' &&
          event.detail.payload.kind === 'context.respond' &&
          event.detail.sender === caller.id &&
          event.detail.recipient === assignment.id &&
          event.detail.payload.message === response.detail.args.message,
      );
      assert(delivery && response.sequence < delivery.sequence);
      assert(delivery.sequence < lastEvent.sequence);
      const acknowledgement = reports.acknowledgement(latest.id);
      assert(acknowledgement, 'The caller acknowledgement is missing.');
      assert.equal(acknowledgement.assignmentId, assignment.id);
      assert.equal(acknowledgement.recipientAssignmentId, caller.id);
      const ackEvent = events.find(
        (event) =>
          event.type === 'agent.report-acknowledged' && event.detail.reportId === latest.id,
      );
      assert(ackEvent && ackEvent.sequence > lastEvent.sequence);
      assert.deepEqual(ackEvent.detail.acknowledgement, acknowledgement);
      const acknowledgementCall = [...startedCalls.values()].find(
        (call) =>
          call.detail.tool === 'team.ack_report' &&
          call.detail.assignmentId === caller.id &&
          call.detail.args.reportId === latest.id,
      );
      assert(acknowledgementCall, 'The original caller acknowledgement call is missing.');
      originalCall(acknowledgementCall);
      assert.equal(acknowledgementCall.detail.args.disposition, acknowledgement.disposition);
      assert.equal(acknowledgementCall.detail.args.summary, acknowledgement.summary);
      assert(completedCalls.has(acknowledgementCall.detail.callId));
      if (checkpoint) {
        assert(!assignment.brief.history_summary.includes(checkpoint.checkpoint_sha256));
        assert(response.detail.args.message.includes(checkpoint.checkpoint_sha256));
        assert(response.detail.args.message.includes(checkpoint.revision));
        const result = JSON.stringify(latest.report.result);
        assert(result.includes(checkpoint.checkpoint_sha256));
        assert(result.includes(checkpoint.revision));
      }
      continuations.push({
        assignmentId: assignment.id,
        sessionId: assignment.sessionId,
        callerAssignmentId: caller.id,
        reportIds: history.map((record) => record.id),
        reportVersions: history.map((record) => record.version),
        explicitContextCallId: response.detail.callId,
        acknowledgement,
      });
    } else if (latest.report.status === 'insufficient_context') {
      assert(latest.report.requested_context.length);
      const retired = events.find(
        (event) => event.type === 'agent.retired' && event.detail.assignmentId === assignment.id,
      );
      assert(retired && retired.detail.cleanupFailed === false);
      const reportEvent = events.find(
        (event) => event.type === 'agent.report' && event.detail.reportId === latest.id,
      );
      assert(retired.sequence > reportEvent.sequence);
      pending.push({
        assignmentId: assignment.id,
        sessionId: assignment.sessionId,
        reportId: latest.id,
        requestedContext: latest.report.requested_context,
        retirementReason: retired.detail.reason,
      });
    }
  }
  assert(continuations.length, 'No actual same-assignment context continuation exists.');
  if (values['require-cancelled-pending']) {
    assert.equal(run.state, 'cancelled');
    assert(pending.length, 'No context-pending assignment was cancelled and retired.');
  }
  if (values['require-pre-motion']) {
    assert.equal(run.requests.length, 0);
    assert.equal(run.executions.length, 0);
    assert.equal(run.verdicts.length, 0);
  }
  const result = {
    runId: run.id,
    taskOutcome: run.state,
    checkedEvents: events.length,
    continuations,
    cancelledPendingAssignments: pending,
    toolErrors: events.filter((event) => event.type === 'tool.failed').length,
    ...(closedSession ? { closedSessionId: closedSession.id, resources: 'released' } : {}),
    observedInvariants: 'passed',
  };
  await writeFile(resolve(values.output), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(result));
} finally {
  store.close();
}
