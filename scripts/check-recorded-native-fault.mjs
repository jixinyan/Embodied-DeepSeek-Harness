import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    directory: { type: 'string' },
    output: { type: 'string' },
    'acceptance-directory': { type: 'string', default: 'acceptance' },
    'require-diagnostic': { type: 'boolean', default: false },
    'require-query-reviews': { type: 'boolean', default: false },
  },
});
assert(values.directory && values.output, 'Supply --directory and --output.');
const root = resolve(values.directory);
const acceptanceDirectory = resolve(root, values['acceptance-directory']);
const json = async (path) =>
  JSON.parse(
    await readFile(
      path.startsWith('acceptance/')
        ? resolve(acceptanceDirectory, path.slice('acceptance/'.length))
        : resolve(root, path),
      'utf8',
    ),
  );
const run = await json('acceptance/final-run.json');
const events = await json('acceptance/final-events.json');
const fault = await json('acceptance/original-fault.json');
const ticket = await json('acceptance/original-policy-request.json');
const signal = await json('acceptance/native-signal.json');
const release = await json('acceptance/owned-release.json');
const services = await json('acceptance/services-closed.json');
const ownership = await json('acceptance/final-ownership.json');
const close = await json('acceptance/close-response.json');
const sessions = await json('acceptance/sessions-after-close.json');
const session = await json('acceptance/session.json');
assert.equal(run.source, 'simulation');
assert.equal(run.state, 'failed');
assert.equal(run.id, ticket.task_scope.task_id);
assert.equal(events.length, run.eventCount);
events.forEach((event, index) => assert.equal(event.sequence, index + 1));
assert.deepEqual(Object.keys(fault).sort(), ['execution_id', 'message', 'task_scope', 'type']);
assert.equal(fault.execution_id, ticket.execution_id);
assert.deepEqual(fault.task_scope, ticket.task_scope);
assert(fault.type && fault.message);
const failures = events.filter((event) => event.type === 'run.failed');
assert.equal(failures.length, 1);
assert.equal(failures[0].detail.error, `Native backend ${fault.type}: ${fault.message}`);
assert.equal(run.verdicts.length, 0);
assert(!events.some((event) => event.type.startsWith('verification.')));
assert(!Object.values(run.assignments).some((assignment) => assignment.member === 'verifier'));
for (const assignment of Object.values(run.assignments)) {
  assert.equal(assignment.status, 'retired');
  const retirement = events.find(
    (event) => event.type === 'agent.retired' && event.detail.assignmentId === assignment.id,
  );
  assert(retirement && retirement.sequence > failures[0].sequence);
  assert.equal(retirement.detail.reason, 'team-shutdown');
}
assert(run.executions.length);
for (const execution of run.executions) {
  assert.equal(execution.execution_id, fault.execution_id);
  assert.deepEqual(execution.task_scope, fault.task_scope);
  assert.equal(execution.device_confirmed, false);
  assert(!execution.boundary_event_id);
  assert.notEqual(execution.state, 'ended');
}
const consoleText = await readFile(resolve(root, 'console.log'), 'utf8');
const originalFaults = consoleText
  .split('\n')
  .filter((line) => line.startsWith('Native worker fault: '))
  .map((line) => JSON.parse(line.slice('Native worker fault: '.length)));
assert.deepEqual(originalFaults, [fault]);
const policyRecords = (await readFile(resolve(root, 'policy.log'), 'utf8'))
  .split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => JSON.parse(line));
const inferences = policyRecords.filter(
  (record) =>
    record.event === 'policy_inference_completed' && record.execution_id === fault.execution_id,
);
assert(inferences.length);
const selectedInference = inferences.filter((record) => record.request_id === ticket.request_id);
assert.equal(selectedInference.length, 1);
const inference = selectedInference[0];
assert.equal(inference.request_id, ticket.request_id);
assert.deepEqual(inference.task_scope, ticket.task_scope);
assert.equal(inference.generation, ticket.generation);
assert.equal(inference.observation_id, ticket.observation_id);
const nativeOpenPi = inference.backend === 'OpenPI/JAX';
const proposedActions = nativeOpenPi ? inference.action_horizon : inference.action_count;
const checkpointDigest = nativeOpenPi ? inference.checkpoint_sha256 : inference.checkpoint_digest;
assert.equal(inference.actions.length, proposedActions);
assert(proposedActions > 0 && checkpointDigest && inference.checkpoint_revision);
assert(inference.actions.every((action) => action.every(Number.isFinite)));
assert.equal(signal.signal, 'SIGSTOP');
assert.equal(signal.owned_group, signal.worker.pid);
if (nativeOpenPi) {
  const firstControl = await json('acceptance/original-first-control.json');
  assert.equal(firstControl.schema_version, 'edh.native_policy_receipt.v1');
  assert.equal(firstControl.segment.execution_id, fault.execution_id);
  assert.equal(firstControl.segment.request_id, ticket.request_id);
  assert(Date.parse(signal.requested_at) >= Date.parse(firstControl.recorded_at));
  const readyBytes = await readFile(
    resolve(root, 'episodes/build_tower', basename(dirname(signal.ready_path)), 'ready.json'),
  );
  assert.equal(JSON.parse(readyBytes.toString('utf8')).pid, signal.native.pid);
  assert.equal(createHash('sha256').update(readyBytes).digest('hex'), signal.ready_sha256);
  const bridgeRequest = await json(`bridge-original/${ticket.request_id}.request.json`);
  assert.deepEqual(bridgeRequest, ticket);
  const bridgeInference = await json(`bridge-original/${ticket.request_id}.inference.json`);
  const { event: inferenceEvent, ...wireInference } = inference;
  assert.equal(inferenceEvent, 'policy_inference_completed');
  const { admitted_actions: admittedActions, ...recordedInference } = bridgeInference;
  assert.deepEqual(recordedInference, wireInference);
  assert.deepEqual(admittedActions, inference.actions.slice(0, ticket.max_actions));
  assert.equal(inference.native_instruction, ticket.instruction);
  assert.equal(inference.raw_actions.length, inference.action_horizon);
} else {
  assert(Date.parse(signal.requested_at) >= Date.parse(inference.received_at));
  assert(Date.parse(failures[0].at) > Date.parse(inference.completed_at));
  const capturePath = `captures/behavior/${signal.native_observation_id}/capture.json`;
  const capture = await json(capturePath);
  assert.equal(capture.native_pid, signal.native.pid);
  const captureBytes = await readFile(resolve(root, capturePath));
  assert.equal(createHash('sha256').update(captureBytes).digest('hex'), signal.capture_sha256);
}
assert.equal(release.owned_group, signal.owned_group);
assert.equal(release.owned_group_absent, true);
assert.equal(release.processes.worker.original_pid, signal.worker.pid);
assert.equal(release.processes.native.original_pid, signal.native.pid);
assert.equal(release.processes.worker.original_exited, true);
assert.equal(release.processes.native.original_exited, true);
assert.equal(release.device_stop_confirmed, false);
assert.equal(release.device_state, 'unknown');
assert.equal(close.status, 400);
const retainedSession = sessions.sessions.find((value) => value.id === session.id);
assert(retainedSession);
assert.equal(retainedSession.state, 'error');
assert.equal(retainedSession.resources, 'unknown');
assert.equal(services.device_state, 'unknown');
assert.equal(services.session_resources, 'unknown');
assert(services.services.every((service) => service.exited));
assert(Object.values(services.closed_ports).every((code) => code !== 0));
assert.equal(ownership.writer_lock_absent, true);
assert.equal(ownership.original_owned_pids_absent, true);
assert.equal(ownership.device_state, 'unknown');
assert.equal(ownership.session_resources, 'unknown');
assert(ownership.source_files > 0);
assert.equal(Object.keys(ownership.source_inventory).length, ownership.source_files);
const journal = await readFile(resolve(root, 'console/records.jsonl'));
assert.equal(createHash('sha256').update(journal).digest('hex'), ownership.journal_sha256);
const journalRecords = journal
  .toString('utf8')
  .trimEnd()
  .split('\n')
  .map((line) => JSON.parse(line));
const retained = new Map(journalRecords.map((record) => [record.key, record.record.value]));
for (const event of events)
  assert.deepEqual(retained.get(`event:${run.id}:${event.sequence}`), event);
const storedRun = retained.get(`run:${run.id}`);
assert(storedRun);
for (const field of ['id', 'state', 'eventCount', 'error', 'executions', 'requests', 'verdicts'])
  assert.deepEqual(storedRun[field], run[field]);
const storedSession = retained.get(`user-session:${session.id}`);
assert.equal(storedSession.state, retainedSession.state);
assert.equal(storedSession.resources, retainedSession.resources);
const policyDirectory = await readdir(resolve(root, 'policy-requests'), { recursive: true });
assert(!policyDirectory.some((name) => name.split('/').at(-1).startsWith('stop-')));
const policyJson = await Promise.all(
  policyDirectory
    .filter((name) => name.endsWith('.json'))
    .map((name) => json(`policy-requests/${name}`)),
);
const receipts = policyJson.filter(
  (record) => record.schema_version === 'edh.native_policy_receipt.v1',
);
const requests = policyJson.filter(
  (record) => record.schema_version === 'physical.policy_request.v1',
);
assert.deepEqual(
  requests.find((record) => record.request_id === ticket.request_id),
  ticket,
);
for (const record of requests) {
  assert.equal(record.execution_id, fault.execution_id);
  assert.deepEqual(record.task_scope, fault.task_scope);
}
const diagnostics = consoleText
  .split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => JSON.parse(line))
  .filter((record) => record.event === 'native_background_fault_diagnostic');
if (values['require-diagnostic']) assert.equal(diagnostics.length, 1);
assert(diagnostics.length <= 1);
const diagnostic = diagnostics[0];
if (diagnostic) {
  assert.deepEqual(diagnostic.task_scope, fault.task_scope);
  assert.equal(diagnostic.type, fault.type);
  assert.equal(diagnostic.message, fault.message);
  assert.equal(diagnostic.gate.execution_id, fault.execution_id);
  assert.equal(diagnostic.device.execution_id, fault.execution_id);
  assert.equal(diagnostic.gate.generation, diagnostic.device.generation);
  assert.equal(diagnostic.gate.device_confirmed, false);
  assert.equal(diagnostic.device.stopped, true);
  assert.equal(diagnostic.gate.executed_actions, diagnostic.device.executed_actions);
  assert.equal(diagnostic.device.executed_actions, receipts.length);
  assert(diagnostic.gate.reserved_actions >= diagnostic.gate.executed_actions);
  for (const field of [
    'executed_actions',
    'uncertain_actions',
    'raw_sim_steps',
    'pending_owner_operations',
    'retained_cancelled_operations',
    'pending_cancelled_operations',
  ])
    assert(Number.isSafeInteger(diagnostic.device[field]) && diagnostic.device[field] >= 0);
  assert(
    diagnostic.device.pending_cancelled_operations <= diagnostic.device.pending_owner_operations,
  );
  assert(Date.parse(diagnostic.recorded_at) <= Date.parse(failures[0].at));
}
const queryTurns = [];
for (const completed of events.filter(
  (event) => event.type === 'tool.completed' && event.detail.tool === 'execution.query',
)) {
  const started = events.find(
    (event) => event.type === 'tool.started' && event.detail.callId === completed.detail.callId,
  );
  assert(started);
  if (started.detail.args.completeTurn !== true) continue;
  const native = events.find(
    (event) =>
      event.type === 'dsh.tool-call' && event.detail.data.callId === completed.detail.callId,
  );
  assert(native);
  assert.equal(native.detail.assignmentId, run.decisionAssignmentId);
  assert.equal(native.detail.data.name, 'execution__query');
  assert.deepEqual(JSON.parse(native.detail.data.arguments), started.detail.args);
  assert.equal(completed.detail.result.execution.execution_id, fault.execution_id);
  assert.deepEqual(completed.detail.result.execution.task_scope, fault.task_scope);
  const result = events.find(
    (event) =>
      event.type === 'dsh.tool-result' &&
      event.detail.data.message.source.callId === completed.detail.callId,
  );
  assert(result && result.sequence > completed.sequence);
  const blocks = result.detail.data.message.content;
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'tool-result');
  assert.equal(blocks[0].isError, false);
  assert.equal(blocks[0].content.length, 1);
  assert.deepEqual(JSON.parse(blocks[0].content[0].text), completed.detail.result);
  const ending = events.find(
    (event) =>
      event.type === 'agent.turn-ended' &&
      event.detail.assignmentId === native.detail.assignmentId &&
      event.detail.turn === native.detail.turn,
  );
  assert(ending && ending.sequence > result.sequence);
  assert.equal(ending.detail.reason.kind, 'completed');
  assert(
    !events.some(
      (event) =>
        event.type === 'agent.step-started' &&
        event.detail.assignmentId === native.detail.assignmentId &&
        event.detail.turn === native.detail.turn &&
        event.detail.step > native.detail.data.step,
    ),
  );
  queryTurns.push({
    turn: native.detail.turn,
    receiptSequence: result.sequence,
    completedTurnSequence: ending.sequence,
  });
}
const reviews = events.filter(
  (event) => event.type === 'message.delivered' && event.detail.payload?.kind === 'running-review',
);
if (values['require-query-reviews']) {
  assert(queryTurns.length >= 2);
  assert(reviews.length >= 2);
  assert(reviews.some((event) => event.sequence > queryTurns[0].completedTurnSequence));
}
const rotations = events.filter(
  (event) => event.type === 'tool.completed' && event.detail.tool === 'observation.rotate',
);
const report = {
  runId: run.id,
  executionId: fault.execution_id,
  sessionId: session.id,
  sourceCommit: ownership.source_commit,
  sourceFiles: ownership.source_files,
  journalSha256: ownership.journal_sha256,
  events: events.length,
  fault,
  failedAt: failures[0].at,
  retiredAssignments: Object.keys(run.assignments),
  verifierAssignments: 0,
  formalVerdicts: 0,
  recordedStopAcknowledgements: 0,
  inference: {
    requestId: inference.request_id,
    receivedAt: inference.received_at ?? null,
    completedAt: inference.completed_at ?? null,
    proposedActions,
    fullModelActions:
      (nativeOpenPi ? inference.raw_actions.length : inference.model_actions?.length) ?? null,
    checkpointDigest,
  },
  recordedInferences: inferences.length,
  confirmedControlReceipts: receipts.length,
  historicalExecution: run.executions.at(-1),
  faultOwnerCounters: diagnostic
    ? { availability: 'recorded', gate: diagnostic.gate, device: diagnostic.device }
    : { availability: 'unavailable', reservedActions: null, uncertainActions: null },
  queryCompletedTurns: queryTurns,
  runningReviews: reviews.length,
  activeObservation: {
    rotations: rotations.length,
    controls: rotations.reduce((sum, event) => sum + event.detail.result.rotation.control_steps, 0),
    physicsSteps: rotations.reduce(
      (sum, event) => sum + event.detail.result.rotation.raw_sim_steps,
      0,
    ),
  },
  signalRequestedAt: signal.requested_at,
  signalImmediateProcessStatus: signal.native_status_after_signal,
  ownedProcessGroupAbsent: true,
  ownedNativeGroup: signal.owned_native_group ?? signal.owned_group,
  originalProductionSdkCleanup: ownership.original_production_sdk_cleanup ?? null,
  writerLockAbsent: true,
  closeHttpStatus: close.status,
  sessionState: retainedSession.state,
  sessionResources: retainedSession.resources,
  deviceState: 'unknown',
};
await writeFile(resolve(values.output), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
