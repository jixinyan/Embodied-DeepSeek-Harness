import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { delimiter, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ContractValidator, type ExecutionStatus } from '@edh/contracts';
import { SensorSamples } from '@edh/perception';
import type { SensorSample } from '@edh/execution';
import { LocalStore } from '@edh/storage';
import { AssignmentHistory, RunHistory, VerdictHistory, type RunState } from '@edh/tasks';
import { VerificationBoundaries, VerificationContexts } from '@edh/verification';
import { SessionTaskCatalogs } from '../apps/server/src/session-task-catalog.js';
import { SessionTaskHistory } from '../apps/server/src/session-task-history.js';
import type { UserSessionRecord } from '../apps/server/src/user-sessions.js';
import {
  normalizedImagePath,
  readImageFile,
} from '../harness/agent-runtime/storage/src/dsh/attachment-local/store.js';

const args = parseArgs({
  options: {
    'data-directory': { type: 'string' },
    'session-id': { type: 'string' },
    'first-run-id': { type: 'string' },
    'second-run-id': { type: 'string' },
    'native-episode-root': { type: 'string' },
    'policy-request-directory': { type: 'string' },
    'bridge-service-log': { type: 'string' },
    'native-policy-service-log': { type: 'string' },
    python: { type: 'string' },
    provider: { type: 'string', default: 'robodojo' },
    'policy-manifest': { type: 'string' },
    'simulation-videos': { type: 'string' },
  },
}).values;
for (const [name, value] of Object.entries(args)) assert(value, `Missing --${name}.`);
const required = (name: keyof typeof args) => {
  const value = args[name];
  assert(value, `Provide --${name} for an actual retained native run.`);
  return value;
};
const sourceDirectory = resolve(required('data-directory'));
const source = resolve(sourceDirectory, 'records.jsonl');
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sourceDigest = sha256(await readFile(source));
await mkdir('.local/work', { recursive: true });
const directory = await mkdtemp(resolve('.local/work/retained-terminal-task-'));
await copyFile(source, resolve(directory, 'records.jsonl'));
const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const store = new LocalStore(directory);
try {
  const sessionId = required('session-id');
  const provider = required('provider');
  assert(['robodojo', 'robotwin', 'behavior', 'robocasa'].includes(provider));
  const session = store.get<UserSessionRecord>(`user-session:${sessionId}`)?.value;
  assert(session, 'Retained User Session is missing.');
  assert.equal(session.state, 'closed');
  assert.equal(session.resources, 'released');
  const membership = new SessionTaskHistory(store);
  const members = [...membership.members(session)].sort((a, b) => a.position - b.position);
  const firstId = required('first-run-id');
  const secondId = required('second-run-id');
  assert.notEqual(firstId, secondId);
  assert.equal(members.length, 2, 'Acceptance requires exactly two tasks in one native Session.');
  assert.deepEqual(
    members.map(({ runId }) => runId),
    [firstId, secondId],
  );
  const catalog = new SessionTaskCatalogs(store, validator).read(session);
  const history = new RunHistory(store);
  const verdicts = new VerdictHistory(store, validator);
  const assignments = new AssignmentHistory(store, validator);
  const load = (id: string) => {
    const state = store.get<RunState>(`run:${id}`)?.value;
    assert(state, `Missing retained run: ${id}`);
    assert.equal(state.source, 'simulation');
    assert.equal(state.state, 'succeeded');
    const run = history.restore(state);
    const configuration = store.get(`run-config:${id}`);
    assert.equal(configuration?.version, 1);
    assert.deepEqual(configuration?.value, session.configuration);
    const nativeSessions = new Set<string>();
    for (const actor of Object.values(run.assignments)) {
      assert.equal(actor.status, 'retired');
      const archive = assignments.read(id, actor.id);
      assert(archive, 'Each retired role requires its actual archived assignment.');
      assert.equal(archive.assignment.brief.task_scope.task_id, id);
      assert(!nativeSessions.has(actor.sessionId), 'Role contexts share a native Session.');
      nativeSessions.add(actor.sessionId);
    }
    return { run, nativeSessions };
  };
  const first = load(firstId);
  const second = load(secondId);
  assert.equal(first.run.scenario, second.run.scenario);
  assert.equal(first.run.instruction, second.run.instruction);
  assert.equal(first.run.teamDigest, second.run.teamDigest);
  for (const id of second.nativeSessions)
    assert(!first.nativeSessions.has(id), 'A new task reused an earlier role context.');
  assert(Date.parse(second.run.createdAt) > Date.parse(first.run.updatedAt));
  const original = first.run.requests.at(-1);
  assert(original);
  const definition = catalog.tasks[first.run.scenario];
  assert(definition, 'The native task is missing from the immutable Session catalog.');
  assert.equal(original.goal_id, definition.goal.id);
  assert.deepEqual(original.success_contract, definition.goal.successContract);
  assert.equal(second.run.executions.length, 1);
  assert.equal(second.run.requests.length, 1);
  const repeated = second.run.requests[0]!;
  assert.deepEqual(repeated.success_contract, original.success_contract);
  assert.equal(repeated.goal_id, original.goal_id);
  const firstEnd = validator.parse('ExecutionStatus', first.run.executions.at(-1));
  const secondEnd = validator.parse('ExecutionStatus', second.run.executions[0]);
  for (const end of [firstEnd, secondEnd]) {
    assert.equal(end.state, 'ended');
    assert.equal(end.stop_reason, 'episode_terminated');
    assert.equal(end.device_confirmed, true);
  }
  assert(firstEnd.control_steps > 0 && firstEnd.policy_calls > 0);
  assert.notEqual(secondEnd.execution_id, firstEnd.execution_id);
  assert.notEqual(secondEnd.boundary_event_id, firstEnd.boundary_event_id);
  assert.equal(secondEnd.task_scope.task_id, secondId);
  assert.equal(secondEnd.state_version, 1);
  assert.equal(secondEnd.control_steps, 0);
  assert.equal(secondEnd.policy_calls, 0);
  assert.equal(secondEnd.raw_sim_steps, 0);
  assert.equal(Object.keys(second.run.policySessions ?? {}).length, 0);
  const updates = second.run.events.filter(({ type }) => type === 'execution.updated');
  assert.equal(updates.length, 1, 'Terminal preflight must publish one immediate ended state.');
  assert.deepEqual(updates[0]!.detail.execution, secondEnd);
  assert(
    !second.run.events.some(
      ({ type }) => type.startsWith('policy.') || type === 'simulation.frame',
    ),
  );

  const imageSources: Record<string, { path: string; sha256: string }>[] = [];
  const formal = async (run: RunState, end: ExecutionStatus) => {
    const samples = new SensorSamples(store, validator, run.id, run.source);
    const contexts = new VerificationContexts(store, validator, samples, run.id);
    const boundaries = new VerificationBoundaries(store, validator, run.id);
    assert.deepEqual(boundaries.read(end.execution_id, end.boundary_event_id!), end);
    const final = run.verdicts.find((value) => value.execution_id === end.execution_id);
    assert(final, 'Ended execution has no accepted formal verdict.');
    const result = verdicts.resolve(run.id, final);
    assert.equal(result.status, 'passed');
    assert.equal(result.boundary_event_id, end.boundary_event_id);
    assert.deepEqual(result.task_scope, end.task_scope);
    const context = contexts.inspect(result.verifier_assignment_id);
    assert(context);
    assert.equal(context.executionId, end.execution_id);
    assert.equal(context.boundaryId, end.boundary_event_id);
    assert.equal(context.requestId, result.verification_request_id);
    assert.deepEqual(context.scope, end.task_scope);
    assert.deepEqual(context.facts, result.checks);
    assert.deepEqual(
      result.checks.map(({ check_id, value }) => ({ check_id, value })),
      [{ check_id: 'task_success', value: true }],
    );
    const actor = run.assignments[result.verifier_assignment_id];
    assert(actor && actor.sessionId === result.verifier_id);
    const created = run.events.find(
      ({ type, detail }) =>
        type === 'agent.created' &&
        detail.assignment &&
        (detail.assignment as { id: string }).id === actor.id,
    );
    const ended = run.events.find(
      ({ type, detail }) =>
        type === 'execution.updated' &&
        (detail.execution as ExecutionStatus).boundary_event_id === end.boundary_event_id,
    );
    assert(created && ended && created.sequence > ended.sequence);
    for (const evidenceId of [end.observation_refs[0]!, context.evidenceId]) {
      const sample = samples.read(evidenceId);
      assert(sample && sample.images?.length === 3);
      assert.equal(sample.visualization.provider, provider);
      assert.equal(sample.visualization.uncertainActions, 0);
      assert.deepEqual(sample.evidence.task_scope, end.task_scope);
      const images: Record<string, { path: string; sha256: string }> = {};
      for (const ref of sample.images) {
        const name = ref.name;
        assert(name && name.endsWith('.png'));
        const camera = name.slice(0, -4);
        assert(!Object.hasOwn(images, camera));
        const root = resolve(sourceDirectory, 'attachments/v1');
        const image = await readImageFile(root, ref);
        images[camera] = { path: normalizedImagePath(root, ref), sha256: sha256(image.data) };
      }
      imageSources.push(images);
    }
    return { result, context };
  };
  const firstFormal = await formal(first.run, firstEnd);
  const secondFormal = await formal(second.run, secondEnd);
  assert.notEqual(firstFormal.result.verifier_id, secondFormal.result.verifier_id);
  const firstSamples = new SensorSamples(store, validator, firstId, 'simulation');
  const firstBoundarySample = firstSamples.read(firstEnd.observation_refs[0]!);
  assert(firstBoundarySample);
  const nativeRequest = firstBoundarySample.visualization.policyRequestId;
  const segment = firstBoundarySample.visualization.segmentId;
  assert.equal(typeof nativeRequest, 'string');
  assert.equal(typeof segment, 'string');
  const retainedSamples = (run: RunState) => {
    const samples = new SensorSamples(store, validator, run.id, run.source);
    return store
      .list<SensorSample>(`sensor-sample:[${JSON.stringify(run.id)},`)
      .map(({ value }) => {
        const sample = samples.read(value.evidence.id);
        assert(sample);
        return sample;
      })
      .sort((a, b) => a.sequence - b.sequence);
  };
  const packet = {
    provider,
    sessionId,
    catalogDigest: catalog.descriptor.digest,
    first: {
      run: first.run,
      end: firstEnd,
      formal: firstFormal,
      samples: retainedSamples(first.run),
    },
    second: {
      run: second.run,
      end: secondEnd,
      formal: secondFormal,
      samples: retainedSamples(second.run),
    },
    imageSources,
    finalReceipt: resolve(
      required('policy-request-directory'),
      firstEnd.execution_id,
      nativeRequest as string,
      `${segment}.json`,
    ),
    nativeEpisodeRoot: resolve(required('native-episode-root')),
    policyRequestDirectory: resolve(required('policy-request-directory')),
    bridgeServiceLog: resolve(required('bridge-service-log')),
    nativePolicyServiceLog: resolve(required('native-policy-service-log')),
    ...(provider === 'robodojo'
      ? {}
      : {
          policyManifest: resolve(required('policy-manifest')),
          simulationVideos: resolve(required('simulation-videos')),
        }),
  };
  const packetPath = resolve(directory, 'source-records.json');
  await writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, { flag: 'wx' });
  const nativeOutput = resolve(directory, 'native-acceptance.json');
  execFileSync(
    required('python'),
    [
      provider === 'robodojo'
        ? 'scripts/check-retained-terminal-native.py'
        : 'scripts/check-retained-provider-terminal-native.py',
      '--source-records',
      packetPath,
      '--output',
      nativeOutput,
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        PYTHONPATH: [resolve('harness/physical-runtime/src'), process.env.PYTHONPATH]
          .filter(Boolean)
          .join(delimiter),
        PYTHONDONTWRITEBYTECODE: '1',
      },
    },
  );
  assert.equal(sha256(await readFile(source)), sourceDigest, 'Original source journal changed.');
  const acceptance = {
    kind: 'actual-retained-native-terminal-task',
    source,
    sourceDigest,
    sourceUnchanged: true,
    sessionId,
    firstRunId: firstId,
    secondRunId: secondId,
    resources: session.resources,
    independentRoleContexts: true,
    freshFormalBoundary: secondEnd.boundary_event_id,
    secondControls: 0,
    secondPolicyCalls: 0,
    secondPhysicsSteps: 0,
    secondTaskSucceeded: true,
    secondToolErrors: second.run.events.filter(({ type }) => type === 'tool.failed').length,
    native: JSON.parse(await readFile(nativeOutput, 'utf8')),
    directory,
  };
  await writeFile(
    resolve(directory, 'acceptance.json'),
    `${JSON.stringify(acceptance, null, 2)}\n`,
    {
      flag: 'wx',
    },
  );
  console.log(JSON.stringify(acceptance, null, 2));
} finally {
  store.close();
}
