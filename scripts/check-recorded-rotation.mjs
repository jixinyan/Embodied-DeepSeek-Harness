import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { admitRotationRequest, readRotationMotion } from '@edh/observation';
import { LocalStore } from '@edh/storage';

const { values } = parseArgs({
  options: {
    'data-directory': { type: 'string', multiple: true },
    output: { type: 'string' },
  },
});
assert(values['data-directory']?.length && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const implementationPaths = [
  'harness/agent-runtime/observation/src/rotation.ts',
  'harness/agent-runtime/observation/src/index.ts',
  'harness/agent-runtime/execution/src/backend-port.ts',
  'apps/server/src/native-worker.ts',
  'harness/physical-runtime/src/physical_harness/environments/__init__.py',
  'harness/physical-runtime/src/physical_harness/environments/behavior/rotation.py',
  'harness/physical-runtime/src/physical_harness/execution/worker.py',
  'scripts/check-recorded-rotation.mjs',
];
const implementationSources = await Promise.all(
  implementationPaths.map(async (name) => ({
    path: name,
    sha256: hash(await readFile(resolve(root, name))),
  })),
);
await mkdir(output, { recursive: false });
const journals = [];
const records = [];
let rejectedRequests = 0;
let rejectedReceipts = 0;

for (const [index, sourceDirectory] of values['data-directory'].entries()) {
  const source = resolve(sourceDirectory, 'records.jsonl');
  const sourceSha256 = hash(await readFile(source));
  const directory = resolve(output, `journal-${index}`);
  await mkdir(directory);
  const copied = resolve(directory, 'records.jsonl');
  await copyFile(source, copied);
  assert.equal(hash(await readFile(copied)), sourceSha256);
  const store = new LocalStore(directory);
  try {
    const sequence = store.statistics().sequence;
    for (const row of store.scan('run:')) {
      const run = row.value;
      assert.equal(run.source, 'simulation');
      const events = Array.from({ length: run.eventCount }, (_, eventIndex) => {
        const record = store.get(`event:${run.id}:${eventIndex + 1}`);
        assert(record);
        assert.equal(record.value.sequence, eventIndex + 1);
        return record.value;
      });
      for (const event of events.filter(
        (candidate) =>
          candidate.type === 'tool.completed' && candidate.detail.tool === 'observation.rotate',
      )) {
        const { callId, assignmentId, result } = event.detail;
        const starts = events.filter(
          (candidate) =>
            candidate.type === 'tool.started' &&
            candidate.detail.callId === callId &&
            candidate.detail.assignmentId === assignmentId,
        );
        const calls = events.filter(
          (candidate) =>
            candidate.type === 'dsh.tool-call' &&
            candidate.detail.data.callId === callId &&
            candidate.detail.assignmentId === assignmentId,
        );
        assert.equal(starts.length, 1);
        assert.equal(calls.length, 1);
        assert.equal(starts[0].detail.tool, 'observation.rotate');
        assert.equal(calls[0].detail.data.name, 'observation__rotate');
        assert.deepEqual(JSON.parse(calls[0].detail.data.arguments), starts[0].detail.args);
        assert(starts[0].sequence < event.sequence);
        assert.equal(assignmentId, run.decisionAssignmentId);
        const request = admitRotationRequest(
          starts[0].detail.args.yawDeg,
          starts[0].detail.args.pitchDeg,
          ['yaw', 'pitch'],
        );
        const motion = readRotationMotion(result.rotation, request);
        assert.deepEqual(motion, result.rotation);
        assert(Object.isFrozen(request) && Object.isFrozen(motion));
        assert(Object.isFrozen(motion.before_position) && Object.isFrozen(motion.after_position));
        const derivatives = [];
        for (const field of [
          'requested_yaw_deg',
          'requested_pitch_deg',
          'achieved_yaw_deg',
          'achieved_pitch_deg',
          'before_yaw_deg',
          'after_yaw_deg',
          'before_pitch_deg',
          'after_pitch_deg',
        ])
          for (const value of [Number.NaN, Number.POSITIVE_INFINITY, '0'])
            derivatives.push([`${field}:${String(value)}`, { ...result.rotation, [field]: value }]);
        for (const field of ['before_position', 'after_position'])
          for (const value of [[0, 0], [0, 0, 0, 0], [0, Number.NaN, 0], [0, '0', 0], null])
            derivatives.push([
              `${field}:${derivatives.length}`,
              { ...result.rotation, [field]: value },
            ]);
        for (const field of ['control_steps', 'raw_sim_steps'])
          for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '1'])
            derivatives.push([`${field}:${String(value)}`, { ...result.rotation, [field]: value }]);
        for (const [field, value] of [
          ['requested_yaw_deg', motion.requested_yaw_deg + 1],
          ['requested_pitch_deg', motion.requested_pitch_deg + 1],
          ['stop_reason', 'unconfirmed'],
          ['unknown_field', true],
        ])
          derivatives.push([field, { ...result.rotation, [field]: value }]);
        derivatives.push([
          'missing_stop_reason',
          Object.fromEntries(
            Object.entries(result.rotation).filter(([key]) => key !== 'stop_reason'),
          ),
        ]);
        const rejected = [];
        for (const [name, input] of derivatives) {
          assert.throws(() => readRotationMotion(input, request));
          rejected.push(name);
          rejectedReceipts++;
        }
        const invalidRequests = [
          [91, request.pitchDeg, ['yaw', 'pitch']],
          [-91, request.pitchDeg, ['yaw', 'pitch']],
          [request.yawDeg, 46, ['yaw', 'pitch']],
          [request.yawDeg, -46, ['yaw', 'pitch']],
          [Number.NaN, request.pitchDeg, ['yaw', 'pitch']],
          [request.yawDeg, Number.POSITIVE_INFINITY, ['yaw', 'pitch']],
          ['0', request.pitchDeg, ['yaw', 'pitch']],
          [request.yawDeg, null, ['yaw', 'pitch']],
          [1, 0, ['pitch']],
          [0, 1, ['yaw']],
          [0, 0, []],
        ];
        for (const [yaw, pitch, axes] of invalidRequests) {
          assert.throws(() => admitRotationRequest(yaw, pitch, axes));
          rejectedRequests++;
        }
        assert.throws(() => {
          motion.control_steps += 1;
        }, TypeError);
        assert.throws(() => {
          motion.before_position[0] += 1;
        }, TypeError);
        assert.deepEqual(readRotationMotion(result.rotation, request), result.rotation);
        records.push({
          runId: run.id,
          originalOutcome: run.state,
          assignmentId,
          callId,
          receiptSequence: event.sequence,
          request,
          motion,
          originalMotionSha256: hash(Buffer.from(JSON.stringify(result.rotation))),
          rejectedReceiptCases: rejected,
          rejectedRequestCases: invalidRequests.length,
        });
      }
    }
    assert.equal(store.statistics().sequence, sequence);
  } finally {
    store.close();
  }
  assert.equal(existsSync(resolve(directory, 'writer.lock')), false);
  assert.equal(hash(await readFile(copied)), sourceSha256);
  assert.equal(hash(await readFile(source)), sourceSha256);
  journals.push({ path: source, sha256: sourceSha256, readCopy: copied, writerReleased: true });
}
assert(records.length > 0, 'Selected original journals contain no native rotation receipts.');
for (const source of implementationSources)
  assert.equal(hash(await readFile(resolve(root, source.path))), source.sha256);
const report = {
  schemaVersion: 'edh.recorded_rotation_cpu.v1',
  recordedAt: new Date().toISOString(),
  implementationSources,
  journals,
  records,
  acceptedOriginalReceipts: records.length,
  rejectedReceipts,
  rejectedRequests,
  sourceJournalsUnchanged: true,
  readJournalsUnchanged: true,
  gpuAllocations: 0,
  modelCalls: 0,
  simulatorAllocations: 0,
  physicalControls: 0,
};
await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    output,
    acceptedOriginalReceipts: records.length,
    rejectedReceipts,
    rejectedRequests,
  }),
);
