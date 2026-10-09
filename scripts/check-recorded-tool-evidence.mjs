import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { ContractValidator } from '@edh/contracts';
import { SensorSamples, sensorImages } from '@edh/perception';
import { LocalStore, SessionAudits } from '@edh/storage';
import { CORE_TOOLS, coreToolEvidenceIds } from '@edh/tools';
import { VerificationContexts } from '@edh/verification';

const { values } = parseArgs({
  options: {
    'data-directory': { type: 'string', multiple: true },
    'require-tool': { type: 'string', multiple: true },
    output: { type: 'string' },
  },
});
assert(values['data-directory']?.length && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const schemaPath = resolve(root, 'harness/contracts/schema/physical.schema.json');
const schemaBytes = await readFile(schemaPath);
const validator = new ContractValidator(JSON.parse(schemaBytes.toString('utf8')));
const implementationPaths = [
  'harness/agent-runtime/tools/src/core-output.ts',
  'harness/agent-runtime/tools/src/index.ts',
  'harness/agent-runtime/perception/src/sensor-sample.ts',
  'harness/agent-runtime/perception/src/sensor-samples.ts',
  'harness/agent-runtime/verification/src/contexts.ts',
  'harness/agent-runtime/storage/src/session-audits.ts',
  'apps/server/src/application.ts',
  'scripts/check-recorded-tool-evidence.mjs',
];
const implementationSources = await Promise.all(
  implementationPaths.map(async (name) => ({
    path: resolve(root, name),
    sha256: hash(await readFile(resolve(root, name))),
  })),
);
await mkdir(output, { recursive: false });
const journals = [];
const runs = [];
const tools = {};
let results = 0;
let imageResults = 0;
let images = 0;
let formalChecks = 0;

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
    for (const row of store.scan('run:')) {
      const run = row.value;
      assert(['simulation', 'hardware'].includes(run.source));
      const samples = new SensorSamples(store, validator, run.id, run.source);
      const contexts = new VerificationContexts(store, validator, samples, run.id);
      const events = Array.from({ length: run.eventCount }, (_, index) => {
        const record = store.get(`event:${run.id}:${index + 1}`);
        assert(record, 'An original task event is missing.');
        assert.equal(record.value.sequence, index + 1);
        return record.value;
      });
      const auditPrefix = `session-audit:${run.id}:`;
      const audits = new Map(
        new SessionAudits(store)
          .read(run.id)
          .map((record) => [record.key.slice(auditPrefix.length), record.value]),
      );
      const completed = events.filter(
        (event) => event.type === 'tool.completed' && CORE_TOOLS.includes(event.detail.tool),
      );
      const runResults = [];
      for (const event of completed) {
        const { assignmentId, callId, tool, result: value } = event.detail;
        const calls = events.filter(
          (candidate) =>
            candidate.type === 'dsh.tool-call' &&
            candidate.detail.assignmentId === assignmentId &&
            candidate.detail.data.callId === callId,
        );
        assert.equal(calls.length, 1, 'The original native tool call is missing.');
        assert.equal(calls[0].detail.data.name, tool.replaceAll('.', '__'));
        const started = events.filter(
          (candidate) =>
            candidate.type === 'tool.started' &&
            candidate.detail.assignmentId === assignmentId &&
            candidate.detail.callId === callId,
        );
        assert.equal(started.length, 1);
        assert.deepEqual(JSON.parse(calls[0].detail.data.arguments), started[0].detail.args);
        const matches = (candidate) =>
          candidate.detail.assignmentId === assignmentId &&
          candidate.detail.data?.message.source.callId === callId;
        const nativeResults = events.filter(
          (candidate) => candidate.type === 'dsh.tool-result' && matches(candidate),
        );
        assert.equal(nativeResults.length, 1, 'The original native tool result is missing.');
        const native = nativeResults[0];
        assert(native.sequence > event.sequence);
        const original = audits
          .get(assignmentId)
          ?.find((candidate) => candidate.seq === native.detail.sessionSequence);
        assert.equal(original?.type, 'tool/result');
        assert.deepEqual(original.data, native.detail.data);
        const blocks = original.data.message.content.filter((part) => part.type === 'tool-result');
        assert.equal(blocks.length, 1);
        assert.equal(blocks[0].toolCallId, callId);
        assert.equal(blocks[0].isError, false);
        let verificationSample;
        if (tool === 'verification.check') {
          const checked = events.filter(
            (candidate) =>
              candidate.type === 'verification.checked' &&
              candidate.detail.assignmentId === assignmentId &&
              candidate.sequence > started[0].sequence &&
              candidate.sequence < event.sequence,
          );
          assert.equal(checked.length, 1);
          assert.deepEqual(checked[0].detail.facts, value.facts);
          verificationSample = samples.read(checked[0].detail.evidence.id);
          assert(verificationSample, 'The original formal-check capture is missing.');
          assert.deepEqual(verificationSample.evidence, checked[0].detail.evidence);
          const context = contexts.inspect(assignmentId);
          assert(context, 'The persisted formal-check identity is missing.');
          assert.equal(context.boundaryId, value.boundaryId);
          const lastCheck = events.findLast(
            (candidate) =>
              candidate.type === 'verification.checked' &&
              candidate.detail.assignmentId === assignmentId,
          );
          assert.equal(context.evidenceId, lastCheck.detail.evidence.id);
          assert.deepEqual(context.facts, lastCheck.detail.facts);
          formalChecks++;
        }
        const evidenceIds = coreToolEvidenceIds(tool, value, verificationSample);
        const selected = evidenceIds.map((id) => {
          const sample = samples.read(id);
          assert(sample, 'The selected original tool evidence is missing.');
          assert.equal(sample.evidence.task_scope.task_id, run.id);
          assert.equal(sample.evidence.visibility, 'agent');
          return sample;
        });
        const attachments = sensorImages(selected);
        const rendered = [
          { type: 'text', text: JSON.stringify(value) },
          ...attachments.map((attachment) => ({ type: 'image', attachment })),
        ];
        assert.deepEqual(rendered, blocks[0].content);
        results++;
        tools[tool] = (tools[tool] ?? 0) + 1;
        if (attachments.length) imageResults++;
        images += attachments.length;
        runResults.push({
          assignmentId,
          tool,
          callId,
          sequence: event.sequence,
          evidenceIds,
          attachmentIds: attachments.map((attachment) => attachment.attachmentId),
          nativeContentSha256: hash(JSON.stringify(blocks[0].content)),
        });
      }
      runs.push({ runId: run.id, originalOutcome: run.state, results: runResults });
    }
  } finally {
    store.close();
  }
  assert.equal(hash(await readFile(source)), sourceSha256);
  assert.equal(hash(await readFile(copied)), sourceSha256);
  journals.push({ path: source, sha256: sourceSha256 });
}
assert(results > 0 && imageResults > 0 && formalChecks > 0);
for (const required of values['require-tool'] ?? [])
  assert(tools[required] > 0, `No original ${required} result was checked.`);
for (const source of implementationSources)
  assert.equal(hash(await readFile(source.path)), source.sha256);
assert.equal(hash(await readFile(schemaPath)), hash(schemaBytes));
const report = {
  schemaVersion: 'edh.recorded_tool_evidence_cpu.v1',
  recordedAt: new Date().toISOString(),
  journals,
  implementationSources,
  schemaSha256: hash(schemaBytes),
  runs,
  results,
  imageResults,
  images,
  formalChecks,
  tools,
  originalSourcesUnchanged: true,
  environmentAllocationPerformed: false,
  modelInferencePerformed: false,
  physicalControlPerformed: false,
  scope: 'Original domain/native DSH receipts and production image-reference selection.',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`, {
  flag: 'wx',
});
console.log(JSON.stringify({ results, imageResults, images, formalChecks, tools }));
