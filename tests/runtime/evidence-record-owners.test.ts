import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { ExecutionStatus, VerificationResult } from '@edh/contracts';
import type { SensorSample } from '@edh/execution';
import { LocalImageStore, LocalStore } from '@edh/storage';
import { SensorSamples } from '@edh/perception';
import { AssignmentHistory, VerdictHistory } from '@edh/tasks';
import { VerificationBoundaries, VerificationContexts } from '@edh/verification';
import { evidenceRecordOwners } from '../../apps/server/src/evidence-record-owners.js';
import { verdictDocuments } from './support/verdict-documents.js';

const key = (prefix: string, ...ids: string[]) => prefix + JSON.stringify(ids);

async function documents(store: LocalStore, image?: ImageAttachmentRef) {
  const { state, result, assignment, validator } = await verdictDocuments();
  state.assignments[assignment.id]!.verificationContextStored = true;
  const samples = new SensorSamples(store, validator, state.id, state.source);
  samples.retain({
    source: state.source,
    sequence: 0,
    description: 'Authored retention document. No sensor, model or policy executed.',
    visualization: {},
    evidence: {
      id: 'document-evidence',
      kind: image ? 'image' : 'event',
      source: 'authored-document',
      visibility: 'agent',
      task_scope: assignment.brief.task_scope,
      clock_id: 'document-clock',
      created_at: state.createdAt,
      observed_at: state.createdAt,
    },
    ...(image ? { images: [image] } : {}),
  });
  const status = validator.parse('ExecutionStatus', {
    schema_version: 'physical.execution.v1',
    execution_id: result.execution_id,
    task_scope: result.task_scope,
    state: 'ended',
    state_version: 1,
    control_steps: 0,
    policy_calls: 0,
    elapsed_wall_time_s: 0,
    device_confirmed: true,
    observation_refs: ['document-evidence'],
    clock_id: 'document-clock',
    recorded_at: state.createdAt,
    boundary_event_id: result.boundary_event_id,
    boundary_at: state.createdAt,
    stop_reason: 'budget_exhausted',
  });
  new VerificationBoundaries(store, validator, state.id).admit(undefined, status);
  const contexts = new VerificationContexts(store, validator, samples, state.id);
  contexts.open(assignment.id, {
    requestId: result.verification_request_id,
    executionId: result.execution_id,
    boundaryId: result.boundary_event_id,
    scope: result.task_scope,
    evidenceId: 'document-evidence',
  });
  contexts.update(assignment.id, result.checks, 'document-evidence');
  contexts.close();
  state.verdicts = [new VerdictHistory(store, validator).retain(state.id, result)];
  state.executions = [status];
  store.put(`run:${state.id}`, state, 0);
  const owners = evidenceRecordOwners(store, validator);
  const inspect = (name: string) => {
    const owner = owners.find((candidate) => name.startsWith(candidate.prefix));
    assert(owner);
    const row = store.get(name);
    assert(row);
    return owner.inspect({ key: name, ...row });
  };
  return {
    state,
    result,
    assignment,
    validator,
    inspect,
    sampleKey: key('sensor-sample:', state.id, 'document-evidence'),
    boundaryKey: key(
      'verification-boundary:',
      state.id,
      result.execution_id,
      result.boundary_event_id,
    ),
    contextKey: key('verification-context:', state.id, assignment.id),
    verdictKey: key('verdict-history:', state.id, result.verdict_id),
  };
}

async function workspace(work: (store: LocalStore, ctx: Context) => Promise<void>) {
  await mkdir('.local/work', { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/evidence-record-owners-'));
  const store = new LocalStore(directory);
  const ctx = new Context();
  try {
    await work(store, ctx);
  } finally {
    await ctx.fiber.dispose();
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('evidence owners preserve actual image metadata and complete formal-verification dependencies', async () => {
  await workspace(async (store, ctx) => {
    await ctx.plugin(LocalImageStore, { directory: resolve(store.directory, 'images') });
    const image = await ctx.attachments.saveImage({
      data: new Uint8Array(await readFile('apps/console/public/logo.png')),
      mediaType: 'image/png',
    });
    const source = await documents(store, image);
    const { state, inspect, sampleKey, boundaryKey, contextKey, verdictKey } = source;
    const runKey = `run:${state.id}`;
    const imageKey = key('sensor-image:', state.id, image.attachmentId);
    assert.deepEqual(inspect(sampleKey), { references: [runKey, imageKey], retain: false });
    assert.deepEqual(inspect(imageKey), { references: [runKey], retain: false });
    assert.deepEqual(inspect(boundaryKey), { references: [runKey, sampleKey], retain: false });
    assert.deepEqual(inspect(contextKey), {
      references: [runKey, boundaryKey, sampleKey],
      retain: false,
    });
    assert.deepEqual(inspect(verdictKey), {
      references: [runKey, boundaryKey, sampleKey, contextKey],
      retain: false,
    });
    for (const name of [sampleKey, imageKey, boundaryKey, contextKey, verdictKey])
      for (const dependency of inspect(name).references) assert(store.revision(dependency));
    const bytes = (await ctx.attachments.readImage(image)).data;
    assert.equal(bytes.byteLength, image.bytes);
    store.compact();
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      const owner = evidenceRecordOwners(reopened, source.validator).find(
        (owner) => owner.prefix === 'verdict-history:',
      )!;
      assert.deepEqual(
        owner.inspect({ key: verdictKey, ...reopened.get(verdictKey)! }).references,
        [runKey, boundaryKey, sampleKey, contextKey],
      );
      assert.deepEqual((await ctx.attachments.readImage(image)).data, bytes);
    } finally {
      reopened.close();
    }
  });
});

test('archived verification assignments add their immutable source to context and verdict references', async () => {
  await workspace(async (store) => {
    const source = await documents(store);
    const { state, assignment, validator, inspect } = source;
    new AssignmentHistory(store, validator).retain(state, assignment.id);
    store.put(`run:${state.id}`, state, store.get(`run:${state.id}`)!.version);
    const archiveKey = key('assignment-history:', state.id, assignment.id);
    for (const name of [source.contextKey, source.verdictKey])
      assert(inspect(name).references.includes(archiveKey));
    store.retire([archiveKey], store.statistics().sequence);
    assert.throws(() => inspect(source.contextKey), /archive is missing/);
  });
});

test('missing run, boundary, context and evidence sources prohibit verification reference inspection', async () => {
  for (const missing of ['run', 'boundary', 'context', 'sample'])
    await workspace(async (store) => {
      const source = await documents(store);
      const names = {
        run: `run:${source.state.id}`,
        boundary: source.boundaryKey,
        context: source.contextKey,
        sample: source.sampleKey,
      };
      store.retire([names[missing as keyof typeof names]], store.statistics().sequence);
      assert.throws(() => source.inspect(source.verdictKey), /missing/);
    });
});

test('verification source scope, actor and fact conflicts fail without changing the journal', async () => {
  for (const condition of ['scope', 'actor', 'facts', 'boundary', 'private'])
    await workspace(async (store) => {
      const source = await documents(store);
      const { state, assignment, result } = source;
      const name =
        condition === 'actor'
          ? `run:${state.id}`
          : condition === 'facts'
            ? source.verdictKey
            : condition === 'boundary'
              ? source.boundaryKey
              : source.sampleKey;
      let value: unknown;
      if (condition === 'actor') {
        state.assignments[assignment.id]!.sessionId = 'foreign-session';
        value = state;
      } else if (condition === 'facts') {
        const record = store.get<{ result: VerificationResult }>(name)!.value;
        record.result.checks[0]!.reason = 'Different source fact';
        value = record;
      } else if (condition === 'boundary') {
        const record = store.get<{ status: ExecutionStatus }>(name)!.value;
        record.status.task_scope.attempt_id = 'foreign-attempt';
        value = record;
      } else {
        const sample = store.get<SensorSample>(name)!.value;
        if (condition === 'scope') sample.evidence.task_scope.attempt_id = 'foreign-attempt';
        if (condition === 'private') sample.evidence.visibility = 'debug_only';
        value = sample;
      }
      store.retire([name], store.statistics().sequence);
      store.put(name, value, 0);
      const sequence = store.statistics().sequence;
      assert.throws(() => source.inspect(source.verdictKey), /conflict/);
      assert.equal(store.statistics().sequence, sequence);
      assert.equal(result.status, 'unknown');
    });
});

test('rewritten immutable source records and malformed image metadata fail at their readers', async () => {
  for (const kind of ['sample', 'boundary', 'verdict'])
    await workspace(async (store) => {
      const source = await documents(store);
      const name =
        kind === 'sample'
          ? source.sampleKey
          : kind === 'boundary'
            ? source.boundaryKey
            : source.verdictKey;
      store.put(name, store.get(name)!.value, 1);
      assert.throws(() => source.inspect(name), /immutable|rewritten/);
    });
  await workspace(async (store) => {
    const source = await documents(store);
    const name = key('sensor-image:', source.state.id, 'invalid-image');
    store.put(
      name,
      { attachmentId: 'invalid-image', mediaType: 'image/png', bytes: 0, width: 1, height: 1 },
      0,
    );
    assert.throws(() => source.inspect(name), /Invalid immutable image/);
  });
});
