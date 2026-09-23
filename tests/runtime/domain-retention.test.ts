import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, open, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ContractValidator } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { RecoveryHistory } from '@edh/tasks';
import { SensorSamples } from '@edh/perception';
import {
  DomainRetention,
  type DomainRecordOwner,
  type DomainReferenceSource,
} from '../../apps/server/src/domain-retention.js';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const signal = () => new AbortController().signal;
const noteSchema = z
  .object({
    format: z.literal('edh.retention-note.v1'),
    references: z.array(z.string()),
    retain: z.boolean(),
  })
  .strict();
const note = (references: string[] = [], retain = false) => ({
  format: 'edh.retention-note.v1',
  references,
  retain,
});
const notes: DomainRecordOwner = {
  id: 'notes',
  version: '1',
  prefix: 'note:',
  inspect: ({ value }) => {
    const { references, retain } = noteSchema.parse(value);
    return { references, retain };
  },
};

class FileReferences implements DomainReferenceSource {
  readonly id = 'document-library';
  constructor(readonly path: string) {}
  async acquire(signal: AbortSignal) {
    signal.throwIfAborted();
    const lock = this.path + '.lock';
    const handle = await open(lock, 'wx', 0o600);
    try {
      const text = await readFile(this.path, { encoding: 'utf8', signal });
      return {
        keys: JSON.parse(text),
        revision: createHash('sha256').update(text).digest('hex'),
        release: async () => {
          await handle.close();
          await unlink(lock);
        },
      };
    } catch (error) {
      await handle.close();
      await unlink(lock);
      throw error;
    }
  }
}

async function workspace(action: (store: LocalStore, source: FileReferences) => Promise<void>) {
  await mkdir('.local/work', { recursive: true });
  const path = await mkdtemp(resolve('.local/work/domain-retention-'));
  const store = new LocalStore(path);
  const source = new FileReferences(resolve(path, 'references.json'));
  try {
    await writeFile(source.path, '[]');
    await action(store, source);
    await assert.rejects(stat(source.path + '.lock'), { code: 'ENOENT' });
  } finally {
    store.close();
    await rm(path, { recursive: true, force: true });
  }
}

function controller(store: LocalStore, source: FileReferences, owners = [notes]) {
  return new DomainRetention(store, validator, { version: '1', owners, sources: [source] });
}

test('declared references admit a complete selected component and preserve retained data across reopen', async () => {
  await workspace(async (store, source) => {
    store.put('note:parent', note(['note:child']), 0);
    store.put('note:child', note(['note:parent']), 0);
    store.put('note:kept', note([], true), 0);
    const service = controller(store, source);
    await assert.rejects(service.inspect(['note:child'], signal()), /Retained record/);
    const keys = ['note:parent', 'note:child'];
    const pending = service.inspect(keys, signal());
    keys.push('note:kept');
    const preview = await pending;
    assert.equal(preview.retainedRecords, 1);
    assert.equal(preview.skillCount, 0);
    assert.equal(preview.selected.length, 2);
    preview.selected.push({ key: 'note:kept', version: 1, hash: 'changed-client-copy' });
    const kept = store.get('note:kept');
    const result = await service.retire(preview.token, signal());
    assert.equal(result.removedRecords, 2);
    assert.equal(result.after.sequence, preview.storeSequence + 1);
    assert.equal(store.get('note:child'), undefined);
    assert.deepEqual(store.get('note:kept'), kept);
    await assert.rejects(service.retire(preview.token, signal()), /Inspect domain references/);
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      assert.deepEqual(reopened.list(''), [{ key: 'note:kept', ...kept! }]);
    } finally {
      reopened.close();
    }
  });
});

test('external roots, retained declarations and every unselected incoming edge block deletion', async () => {
  await workspace(async (store, source) => {
    store.put('note:root', note(['note:child']), 0);
    store.put('note:child', note(), 0);
    store.put('note:permanent', note([], true), 0);
    await writeFile(source.path, JSON.stringify(['note:root']));
    const service = controller(store, source);
    const original = await readFile(resolve(store.directory, 'records.jsonl'));
    await assert.rejects(
      service.inspect(['note:root', 'note:child'], signal()),
      /reference source/,
    );
    await assert.rejects(service.inspect(['note:child'], signal()), /Retained record/);
    await assert.rejects(service.inspect(['note:permanent'], signal()), /owner requires retention/);
    await assert.rejects(service.inspect(['note:child', 'note:child'], signal()), /Duplicate/);
    await assert.rejects(service.inspect(['absent'], signal()), /Selected record is missing/);
    assert.deepEqual(await readFile(resolve(store.directory, 'records.jsonl')), original);
  });
});

test('changed journal, external revisions and source roots invalidate single-use previews', async () => {
  for (const change of ['journal', 'revision', 'root'])
    await workspace(async (store, source) => {
      store.put('note:remove', note(), 0);
      const service = controller(store, source);
      const preview = await service.inspect(['note:remove'], signal());
      if (change === 'journal') store.put('note:added', note(), 0);
      if (change === 'revision') await writeFile(source.path, '[ ]');
      if (change === 'root') await writeFile(source.path, '["note:remove"]');
      await assert.rejects(service.retire(preview.token, signal()), /changed|reference source/);
      assert(store.get('note:remove'));
      await assert.rejects(service.retire(preview.token, signal()), /Inspect domain references/);
    });
});

test('undeclared owners and dangling references stop inspection and release actual source locks', async () => {
  for (const condition of ['unknown-owner', 'missing-target', 'missing-root', 'invalid-source'])
    await workspace(async (store, source) => {
      store.put('note:remove', note(), 0);
      if (condition === 'unknown-owner') store.put('extension:document', {}, 0);
      if (condition === 'missing-target') store.put('note:broken', note(['absent']), 0);
      if (condition === 'missing-root') await writeFile(source.path, '["absent"]');
      if (condition === 'invalid-source') await writeFile(source.path, '[123]');
      await assert.rejects(controller(store, source).inspect(['note:remove'], signal()));
      await assert.rejects(stat(source.path + '.lock'), { code: 'ENOENT' });
      store.put('note:after', note(), 0);
      assert.equal(store.get('note:remove')!.version, 1);
    });
});

test('live session resources and durable request identities cannot be retired', async () => {
  for (const prefix of ['request:', 'session-open-request:', 'session-task-request:'])
    await workspace(async (store, source) => {
      const key = prefix + 'document';
      store.put(key, note(), 0);
      const service = controller(store, source, [{ ...notes, prefix }]);
      await assert.rejects(service.inspect([key], signal()), /reference source/);
      assert.equal(store.get(key)!.version, 1);
    });
  await workspace(async (store, source) => {
    store.put('note:remove', note(), 0);
    store.put('user-session:document', { state: 'interrupted', resources: 'unknown' }, 0);
    await assert.rejects(
      controller(store, source).inspect(['note:remove'], signal()),
      /confirmed released/,
    );
    assert(store.get('note:remove'));
  });
});

test('cancellation and overlapping operations leave no active leases or journal write holds', async () => {
  await workspace(async (store, source) => {
    store.put('note:remove', note(), 0);
    const service = controller(store, source);
    const abort = new AbortController();
    const pending = service.inspect(['note:remove'], abort.signal);
    const overlap = service.inspect(['note:remove'], signal());
    abort.abort(new Error('Operator cancelled inspection.'));
    await assert.rejects(overlap, /in progress/);
    await assert.rejects(pending);
    await assert.rejects(stat(source.path + '.lock'), { code: 'ENOENT' });
    store.put('note:after', note(), 0);
    const preview = await service.inspect(['note:remove'], signal());
    const hold = store.holdWrites();
    try {
      await assert.rejects(service.retire(preview.token, signal()), /suspended/);
      assert(store.get('note:remove'));
    } finally {
      hold.release();
    }
    const refreshed = await service.inspect(['note:remove'], signal());
    await service.retire(refreshed.token, signal());
    assert.equal(store.get('note:remove'), undefined);
  });
});

test('SKILL source roots block retirement and incomplete provenance blocks other collection', async () => {
  await workspace(async (store, source) => {
    const document = JSON.parse(await readFile('tests/fixtures/verification.json', 'utf8')).value;
    const verdict = (status: 'failed' | 'passed') =>
      validator.parse('VerificationResult', {
        ...document,
        verdict_id: `${status}-document`,
        status,
        task_scope: {
          task_id: 'document-run',
          goal_id: 'document-goal',
          attempt_id: `${status}-attempt`,
          ...(status === 'passed' ? { recovery_id: 'document-recovery' } : {}),
        },
        checks: [
          {
            check_id: 'document-check',
            value: status === 'passed',
            evidence_refs: ['document-evidence'],
          },
        ],
        evidence_refs: ['document-evidence'],
        explanation: 'Authored provenance document; no model or environment executed.',
      });
    const failed = verdict('failed');
    const passed = verdict('passed');
    const recovery = new RecoveryHistory(store);
    recovery.create('document-recovery', 'document-run', {
      failedVerdict: failed,
      originalGoalId: 'document-goal',
    });
    recovery.update('document-recovery', passed, null);
    store.put(
      'run:document-run',
      { id: 'document-run', source: 'test_fixture', verdicts: [failed, passed] },
      0,
    );
    store.put('run-config:document-run', { description: 'Authored configuration record' }, 0);
    new SensorSamples(store, validator, 'document-run', 'test_fixture').retain({
      source: 'test_fixture',
      sequence: 0,
      evidence: {
        id: 'document-evidence',
        kind: 'event',
        source: 'authored-document',
        created_at: document.observed_at,
        observed_at: document.observed_at,
        clock_id: document.clock_id,
        visibility: 'agent',
        task_scope: { task_id: 'document-run', goal_id: 'document-goal' },
      },
      description: 'Authored retention document; no sensor executed.',
      visualization: {},
    });
    const metadata = JSON.parse(
      await readFile('examples/skills/recovery-check/metadata.json', 'utf8'),
    );
    store.put(
      'skill:document-skill',
      {
        metadata: {
          ...metadata,
          skill_id: 'document-skill',
          recovery_id: 'document-recovery',
          verdict_ref: passed.verdict_id,
          evidence_refs: ['document-evidence'],
        },
        markdown: 'Authored SKILL source document for retention validation.',
      },
      0,
    );
    const service = controller(store, source);
    for (const key of [
      'skill:document-skill',
      'recovery:document-recovery',
      'run:document-run',
      'run-config:document-run',
      'sensor-sample:["document-run","document-evidence"]',
    ])
      await assert.rejects(service.inspect([key], signal()), /retained by a reference source/);
    store.retire(['run-config:document-run'], store.statistics().sequence);
    store.put('note:remove', note(), 0);
    await assert.rejects(
      service.inspect(['note:remove'], signal()),
      /SKILL source records must be complete/,
    );
    assert(store.get('note:remove'));
  });
});

test('owner namespaces and external source identities require an unambiguous configuration', async () => {
  await workspace(async (store, source) => {
    for (const owners of [
      [],
      [notes, notes],
      [notes, { ...notes, id: 'nested', prefix: 'note:item:' }],
    ])
      assert.throws(() => controller(store, source, owners));
    for (const sources of [
      [source, source],
      [{ id: 'journal', acquire: source.acquire.bind(source) }],
    ])
      assert.throws(
        () => new DomainRetention(store, validator, { version: '1', owners: [notes], sources }),
      );
    assert.throws(
      () => new DomainRetention(store, validator, { version: '', owners: [notes], sources: [] }),
    );
  });
});
