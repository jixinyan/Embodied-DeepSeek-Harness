import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator, type ExecutionStatus } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { VerificationBoundaries } from '@edh/verification';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const at = '2026-09-21T00:00:00.000Z';
function document(executionId = 'authored-execution', runId = 'document-task'): ExecutionStatus {
  return validator.parse('ExecutionStatus', {
    schema_version: 'physical.execution.v1',
    execution_id: executionId,
    task_scope: { task_id: runId, goal_id: 'document-review', attempt_id: 'attempt-1' },
    state: 'paused',
    state_version: 1,
    control_steps: 0,
    policy_calls: 0,
    elapsed_wall_time_s: 0,
    device_confirmed: true,
    observation_refs: ['authored-document-reference'],
    clock_id: 'document-clock',
    recorded_at: at,
    boundary_event_id: 'boundary-1',
    boundary_at: at,
    stop_reason: 'user_stop',
  });
}

function resumed(status: ExecutionStatus): ExecutionStatus {
  const { boundary_event_id: _id, boundary_at: _at, stop_reason: _reason, ...fields } = status;
  return { ...fields, state: 'running', state_version: status.state_version + 1 };
}

async function withStore(work: (store: LocalStore) => Promise<void> | void) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/verification-boundaries-'));
  const store = new LocalStore(directory);
  try {
    await work(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('formal admission scopes boundary identities by run and execution', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, 'document-task');
    const first = document();
    const second = document('another-execution');
    assert.equal(boundaries.admit(undefined, first), true);
    assert.equal(boundaries.admit(undefined, second), true);
    assert.deepEqual(boundaries.read(first.execution_id, 'boundary-1'), first);
    assert.deepEqual(boundaries.read(second.execution_id, 'boundary-1'), second);
    const another = new VerificationBoundaries(store, validator, 'another-task');
    const otherTask = document(first.execution_id, 'another-task');
    assert.equal(another.admit(undefined, otherTask), true);
    assert.deepEqual(another.read(first.execution_id, 'boundary-1'), otherTask);
    assert.throws(() => boundaries.admit(undefined, otherTask), /another run/);
  });
});

test('continuous paused updates preserve one formal admission and the original detached record', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, 'document-task');
    const first = document();
    boundaries.admit(undefined, first);
    const sequence = store.statistics().sequence;
    const next = {
      ...first,
      state_version: 2,
      elapsed_wall_time_s: 1,
      recorded_at: '2026-09-21T00:00:01.000Z',
      observation_refs: ['later-document-reference'],
    };
    assert.equal(boundaries.admit(first, next), false);
    assert.equal(boundaries.admit(next, { ...next, state_version: 3 }), false);
    assert.equal(store.statistics().sequence, sequence);
    const read = boundaries.read(first.execution_id, 'boundary-1')!;
    read.observation_refs.push('caller-edit');
    first.task_scope.goal_id = 'caller-edit';
    assert.deepEqual(boundaries.read(first.execution_id, 'boundary-1'), document());
  });
});

test('new stops require fresh identities after resume and preserve earlier boundary history', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, 'document-task');
    const first = document();
    boundaries.admit(undefined, first);
    const running = resumed(first);
    const reused = { ...first, state_version: 3 };
    assert.throws(() => boundaries.admit(running, reused), /fresh verification boundary/);
    const next = { ...reused, boundary_event_id: 'boundary-2' };
    assert.equal(boundaries.admit(running, next), true);
    assert.throws(
      () => boundaries.admit(next, { ...first, state_version: 4 }),
      /fresh verification boundary/,
    );
    const ended = { ...next, state: 'ended' as const, state_version: 4 };
    assert.throws(() => boundaries.admit(next, ended), /fresh verification boundary/);
    assert.equal(boundaries.admit(next, { ...ended, boundary_event_id: 'boundary-3' }), true);
    assert.deepEqual(boundaries.read(first.execution_id, 'boundary-1'), first);
  });
});

test('changed stopped facts, scopes and stale versions reject before scheduling', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, 'document-task');
    const first = document();
    boundaries.admit(undefined, first);
    const sequence = store.statistics().sequence;
    for (const change of [
      { boundary_at: '2026-09-21T00:00:01.000Z' },
      { control_steps: 1 },
      { stop_reason: 'verifier_pause' as const },
      { clock_id: 'another-clock' },
      { task_scope: { ...first.task_scope, attempt_id: 'attempt-2' } },
      { task_scope: { ...first.task_scope, recovery_id: 'unrelated-recovery' } },
    ])
      assert.throws(() => boundaries.admit(first, { ...first, state_version: 2, ...change }));
    assert.throws(() => boundaries.admit(first, first), /version conflicts/);
    assert.throws(() => boundaries.admit(undefined, first), /fresh verification boundary/);
    assert.throws(() => boundaries.admit(undefined, resumed(first)), /stopped execution/);
    assert.throws(
      () => boundaries.admit({ ...first, execution_id: 'another' }, { ...first, state_version: 2 }),
      /identity or version conflicts/,
    );
    assert.equal(store.statistics().sequence, sequence);
  });
});

test('write exclusion and unavailable or rewritten published boundaries fail explicitly', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, 'document-task');
    const first = document();
    const hold = store.holdWrites();
    try {
      assert.throws(() => boundaries.admit(undefined, first), /suspended/);
      assert.equal(boundaries.read(first.execution_id, 'boundary-1'), undefined);
    } finally {
      hold.release();
    }
    assert.throws(
      () => boundaries.admit(first, { ...first, state_version: 2 }),
      /record is missing/,
    );
    assert.equal(boundaries.admit(undefined, first), true);
    const key = 'verification-boundary:["document-task","authored-execution","boundary-1"]';
    store.put(key, store.get(key)!.value, 1);
    assert.throws(() => boundaries.read(first.execution_id, 'boundary-1'), /rewritten/);
    assert.throws(() => boundaries.admit(first, { ...first, state_version: 2 }), /rewritten/);
  });
});

test('compaction and reopening retain scoped admissions without scheduling model work', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, 'document-task');
    const first = document();
    boundaries.admit(undefined, first);
    store.put('maintenance-document', { revision: 1 }, 0);
    store.put('maintenance-document', { revision: 2 }, 1);
    assert.equal(store.compact().compacted, true);
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      const reader = new VerificationBoundaries(reopened, validator, 'document-task');
      assert.deepEqual(reader.read(first.execution_id, 'boundary-1'), first);
      assert.equal(reader.admit(first, { ...first, state_version: 2 }), false);
      assert.throws(() => reader.admit(undefined, first), /fresh verification boundary/);
      assert.equal(reopened.statistics().records, 2);
    } finally {
      reopened.close();
    }
  });
});

test('budget end schedules formal verification while preserving an unconfirmed device state', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, 'document-task');
    const ended: ExecutionStatus = {
      ...document(),
      state: 'ended',
      stop_reason: 'budget_exhausted',
      device_confirmed: false,
      control_steps: 100,
    };
    assert.equal(boundaries.admit(undefined, ended), true);
    assert.equal(boundaries.read(ended.execution_id, 'boundary-1')!.device_confirmed, false);
    const record = {
      format: 'edh.verification-boundary.v1',
      runId: 'another-run',
      status: { ...ended, boundary_event_id: 'conflicting-record' },
    };
    store.put(
      'verification-boundary:["document-task","authored-execution","conflicting-record"]',
      record,
      0,
    );
    assert.throws(
      () => boundaries.read(ended.execution_id, 'conflicting-record'),
      /identity conflicts/,
    );
  });
});
