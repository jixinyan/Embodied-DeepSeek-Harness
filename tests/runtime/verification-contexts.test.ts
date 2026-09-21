import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator, type CheckResult } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { SensorSamples } from '@edh/perception';
import { VerificationContexts } from '@edh/verification';
import type { SensorSample } from '@edh/execution';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const scope = { task_id: 'document-review', goal_id: 'read-document', attempt_id: 'attempt-1' };
const source = await readFile('README.md', 'utf8');
const document = (id: string): SensorSample => ({
  evidence: {
    id,
    kind: 'event',
    source: 'authored-project-document',
    created_at: '2026-09-21T00:00:00.000Z',
    observed_at: '2026-09-21T00:00:00.000Z',
    clock_id: 'document-clock',
    visibility: 'agent',
    task_scope: scope,
  },
  sequence: 0,
  source: 'test_fixture',
  description: source,
  visualization: {},
});
const input = (evidenceId: string) => ({
  requestId: 'document-check-request',
  executionId: 'document-boundary-record',
  boundaryId: 'document-boundary',
  scope,
  evidenceId,
});
const fact = (evidenceId: string): CheckResult => ({
  check_id: 'provider-result-unavailable',
  value: null,
  reason: 'No physical provider was invoked during document-storage acceptance.',
  evidence_refs: [evidenceId],
});

async function withStore(action: (store: LocalStore, samples: SensorSamples) => Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const path = await mkdtemp(resolve('.local/work/verification-contexts-'));
  const store = new LocalStore(path);
  try {
    await action(store, new SensorSamples(store, validator, scope.task_id, 'test_fixture'));
  } finally {
    store.close();
    await rm(path, { recursive: true, force: true });
  }
}

test('verification contexts retain durable facts and resolve source documents on demand', async () => {
  await withStore(async (store, samples) => {
    samples.retain(document('initial'));
    samples.retain(document('checked'));
    const contexts = new VerificationContexts(store, validator, samples, scope.task_id);
    contexts.open('reviewer', input('initial'));
    assert.equal(contexts.activeCount, 1);
    assert.deepEqual(contexts.get('reviewer')!.sample, document('initial'));
    const facts = [fact('checked')];
    contexts.update('reviewer', facts, 'checked');
    facts[0]!.value = true;
    const record = contexts.inspect('reviewer')!;
    assert.deepEqual(record.facts, [fact('checked')]);
    assert.equal('sample' in record, false);
    assert.equal(record.evidenceId, 'checked');
    const read = contexts.get('reviewer')!;
    read.sample.description = 'Caller edit';
    read.facts[0]!.value = false;
    assert.deepEqual(contexts.get('reviewer')!.sample, document('checked'));
    assert.deepEqual(contexts.get('reviewer')!.facts, [fact('checked')]);
    contexts.release('reviewer');
    contexts.release('reviewer');
    assert.equal(contexts.activeCount, 0);
    assert.equal(contexts.get('reviewer'), undefined);
    assert.throws(() => contexts.update('reviewer', [], 'checked'), /no longer active/);
    assert.throws(() => contexts.open('reviewer', input('initial')), /Version conflict/);
    assert.deepEqual(contexts.inspect('reviewer'), record);
    contexts.close();
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      const reader = new VerificationContexts(
        reopened,
        validator,
        new SensorSamples(reopened, validator, scope.task_id, 'test_fixture'),
        scope.task_id,
      );
      assert.equal(reader.get('reviewer'), undefined);
      assert.deepEqual(reader.inspect('reviewer'), record);
      assert.equal(reader.activeCount, 0);
      reader.close();
    } finally {
      reopened.close();
    }
  });
});

test('verification updates reject missing, private and foreign-scope evidence before publication', async () => {
  await withStore(async (store, samples) => {
    samples.retain(document('initial'));
    const privateDocument = document('private');
    privateDocument.evidence.visibility = 'debug_only';
    samples.retain(privateDocument);
    const foreign = document('foreign');
    foreign.evidence.task_scope = { ...scope, attempt_id: 'attempt-2' };
    samples.retain(foreign);
    const otherRecovery = document('other-recovery');
    otherRecovery.evidence.task_scope = { ...scope, recovery_id: 'another-recovery' };
    samples.retain(otherRecovery);
    const contexts = new VerificationContexts(store, validator, samples, scope.task_id);
    contexts.open('reviewer', input('initial'));
    const before = store.statistics().sequence;
    for (const id of ['missing', 'private', 'foreign', 'other-recovery'])
      assert.throws(() => contexts.update('reviewer', [fact(id)], id), /unavailable or outside/);
    assert.throws(() => contexts.update('reviewer', [fact('foreign')], 'initial'), /outside/);
    assert.throws(
      () => contexts.update('reviewer', [fact('initial'), fact('initial')], 'initial'),
      /duplicate/,
    );
    assert.throws(() => contexts.open('reviewer', input('initial')), /already exists/);
    assert.throws(() => contexts.open('other', input('missing')), /unavailable or outside/);
    assert.equal(store.statistics().sequence, before);
    assert.deepEqual(contexts.get('reviewer')!.facts, []);
    contexts.open('private-boundary', input('private'));
    assert.equal(contexts.get('private-boundary')!.sample.evidence.visibility, 'debug_only');
    contexts.update('private-boundary', [fact('initial')], 'initial');
    assert.equal(contexts.get('private-boundary')!.sample.evidence.visibility, 'agent');
    contexts.release('private-boundary');
    contexts.close();
    assert.equal(contexts.activeCount, 0);
    assert.throws(() => contexts.open('late', input('initial')), /closed/);
  });
});

test('source publication failures do not activate a verifier or advance its accepted revision', async () => {
  await withStore(async (store, samples) => {
    samples.retain(document('initial'));
    const contexts = new VerificationContexts(store, validator, samples, scope.task_id);
    let hold = store.holdWrites();
    try {
      assert.throws(() => contexts.open('reviewer', input('initial')), /suspended/);
      assert.equal(contexts.activeCount, 0);
    } finally {
      hold.release();
    }
    contexts.open('reviewer', input('initial'));
    hold = store.holdWrites();
    try {
      assert.throws(() => contexts.update('reviewer', [fact('initial')], 'initial'), /suspended/);
      assert.deepEqual(contexts.get('reviewer')!.facts, []);
    } finally {
      hold.release();
    }
    const key = `verification-context:${JSON.stringify([scope.task_id, 'reviewer'])}`;
    store.put(key, contexts.inspect('reviewer'), 1);
    assert.throws(() => contexts.get('reviewer'), /changed outside its owner/);
    contexts.release('reviewer');
    assert.equal(contexts.activeCount, 0);
  });
});

test('repeated verifier lifetimes retain only active identities and keep history inspectable', async () => {
  await withStore(async (store, samples) => {
    const contexts = new VerificationContexts(store, validator, samples, scope.task_id);
    for (let i = 0; i < 80; i++) {
      const id = `review-${i}`;
      samples.retain(document(id));
      contexts.open(id, input(id));
      contexts.update(id, [fact(id)], id);
      assert.equal(contexts.activeCount, 1);
      contexts.release(id);
      assert.equal(contexts.activeCount, 0);
    }
    assert.deepEqual(contexts.inspect('review-0')!.facts, [fact('review-0')]);
    assert.deepEqual(contexts.inspect('review-79')!.facts, [fact('review-79')]);
    contexts.close();
  });
});
