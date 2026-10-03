import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { directory: { type: 'string' }, output: { type: 'string' } },
});
assert(values.directory && values.output, 'Supply --directory and --output.');
const root = resolve(values.directory);
const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
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
assert.equal(inferences.length, 1);
const inference = inferences[0];
assert.equal(inference.request_id, ticket.request_id);
assert.deepEqual(inference.task_scope, ticket.task_scope);
assert.equal(inference.generation, ticket.generation);
assert.equal(inference.observation_id, ticket.observation_id);
assert.equal(inference.actions.length, inference.action_count);
assert(inference.action_count > 0 && inference.checkpoint_digest && inference.checkpoint_revision);
assert(inference.actions.every((action) => action.every(Number.isFinite)));
assert.equal(signal.signal, 'SIGSTOP');
assert.equal(signal.owned_group, signal.worker.pid);
assert(Date.parse(signal.requested_at) >= Date.parse(inference.received_at));
assert(Date.parse(failures[0].at) > Date.parse(inference.completed_at));
const capture = await json(`captures/behavior/${signal.native_observation_id}/capture.json`);
assert.equal(capture.native_pid, signal.native.pid);
const captureBytes = await readFile(
  resolve(root, `captures/behavior/${signal.native_observation_id}/capture.json`),
);
assert.equal(createHash('sha256').update(captureBytes).digest('hex'), signal.capture_sha256);
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
const policyDirectory = await readdir(resolve(root, 'policy-requests'), { recursive: true });
assert(!policyDirectory.some((name) => name.split('/').at(-1).startsWith('stop-')));
const policyJson = await Promise.all(
  policyDirectory
    .filter((name) => name.endsWith('.json'))
    .map((name) => json(`policy-requests/${name}`)),
);
assert(!policyJson.some((record) => record.schema_version === 'edh.native_policy_receipt.v1'));
assert.deepEqual(
  policyJson.filter((record) => record.schema_version === 'physical.policy_request.v1'),
  [ticket],
);
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
    receivedAt: inference.received_at,
    completedAt: inference.completed_at,
    proposedActions: inference.action_count,
    fullModelActions: inference.model_actions?.length ?? null,
    checkpointDigest: inference.checkpoint_digest,
  },
  historicalExecution: run.executions.at(-1),
  faultOwnerCounters: {
    availability: 'unavailable',
    reservedActions: null,
    uncertainActions: null,
  },
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
  writerLockAbsent: true,
  closeHttpStatus: close.status,
  sessionState: retainedSession.state,
  sessionResources: retainedSession.resources,
  deviceState: 'unknown',
};
await writeFile(resolve(values.output), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
