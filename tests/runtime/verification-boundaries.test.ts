import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator, type ExecutionStatus } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { VerificationBoundaries } from '@edh/verification';

import schema from '../../harness/contracts/schema/physical.schema.json' with { type: 'json' };

const validator = new ContractValidator(schema);
const scope = {
  task_id: '1df69c9c-7db6-4ae1-9a1c-dd726f44c15c',
  goal_id: 'open_cabinet',
  attempt_id: 'attempt-1',
};
const running: ExecutionStatus = validator.parse('ExecutionStatus', {
  schema_version: 'physical.execution.v1',
  execution_id: '1ebcb999-97e1-4e0d-9dd6-52bacfd12e97',
  task_scope: scope,
  state: 'running',
  control_steps: 112,
  policy_calls: 7,
  raw_sim_steps: 2800,
  device_confirmed: false,
  observation_refs: ['73b2fbaa-a932-4970-b466-d6cd02ca5fae'],
  state_version: 113,
  elapsed_wall_time_s: 18.180005128029734,
  clock_id: '6f42a3b8-0bc5-4e5a-8922-d99793d8b0b6',
  recorded_at: '2026-09-26T19:36:06.690Z',
});
const paused: ExecutionStatus = validator.parse('ExecutionStatus', {
  ...running,
  state: 'paused',
  policy_calls: 8,
  device_confirmed: true,
  observation_refs: ['355b1327-a276-42dd-b95c-a4ce494c617f'],
  state_version: 114,
  elapsed_wall_time_s: 18.38390241097659,
  recorded_at: '2026-09-26T19:36:06.894Z',
  stop_reason: 'planner_pause',
  boundary_event_id: '9c16efe8-b137-43e4-bea8-aeb9043d6a77',
  boundary_at: '2026-09-26T19:36:06.894Z',
});
const ended: ExecutionStatus = validator.parse('ExecutionStatus', {
  ...running,
  state: 'ended',
  control_steps: 256,
  policy_calls: 17,
  raw_sim_steps: 6400,
  device_confirmed: true,
  observation_refs: ['fbcfa593-d6bd-4eec-9f20-90dde5d74c05'],
  state_version: 259,
  elapsed_wall_time_s: 99.4181743869558,
  recorded_at: '2026-09-26T19:37:27.928Z',
  stop_reason: 'budget_exhausted',
  boundary_event_id: 'bee2f6d3-8075-49fe-88bb-6967743bb6a4',
  boundary_at: '2026-09-26T19:37:27.928Z',
});

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

test('recorded running and paused statuses do not enter formal verification', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, scope.task_id);
    const sequence = store.statistics().sequence;
    assert.throws(() => boundaries.admit(undefined, running), /stopped execution boundary/);
    assert.throws(
      () => boundaries.admit(running, paused),
      /confirmed completed execution boundary/,
    );
    assert.equal(store.statistics().sequence, sequence);
  });
});

test('recorded confirmed budget end publishes one immutable formal boundary', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, scope.task_id);
    assert.equal(boundaries.admit(paused, ended), true);
    assert.deepEqual(boundaries.read(ended.execution_id, ended.boundary_event_id!), ended);
    assert.throws(() => boundaries.admit(paused, ended), /fresh verification boundary/);
    assert.throws(() => boundaries.admit(undefined, ended), /fresh verification boundary/);
    const read = boundaries.read(ended.execution_id, ended.boundary_event_id!)!;
    read.observation_refs.push('caller-edit');
    assert.deepEqual(boundaries.read(ended.execution_id, ended.boundary_event_id!), ended);
  });
});

test('unconfirmed and external stops cannot publish a formal boundary', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, scope.task_id);
    const sequence = store.statistics().sequence;
    for (const status of [
      { ...ended, device_confirmed: false },
      { ...ended, stop_reason: 'user_stop' as const },
      { ...ended, stop_reason: 'backend_error' as const },
    ])
      assert.throws(
        () => boundaries.admit(paused, validator.parse('ExecutionStatus', status)),
        /confirmed completed execution boundary/,
      );
    assert.equal(store.statistics().sequence, sequence);
  });
});

test('recorded status rejects conflicting run, version and boundary identity', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, scope.task_id);
    assert.throws(
      () => boundaries.admit(paused, { ...ended, task_scope: { ...scope, task_id: 'other-run' } }),
      /another run/,
    );
    assert.throws(
      () => boundaries.admit({ ...paused, state_version: ended.state_version }, ended),
      /identity or version conflicts/,
    );
    assert.throws(
      () => boundaries.admit({ ...paused, boundary_event_id: ended.boundary_event_id! }, ended),
      /record is missing/,
    );
    assert.equal(store.statistics().records, 0);
  });
});

test('historical paused records remain readable without new admission', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, scope.task_id);
    store.put(
      `verification-boundary:${JSON.stringify([scope.task_id, paused.execution_id, paused.boundary_event_id])}`,
      { format: 'edh.verification-boundary.v1', runId: scope.task_id, status: paused },
      0,
    );
    assert.deepEqual(boundaries.read(paused.execution_id, paused.boundary_event_id!), paused);
    assert.throws(
      () => boundaries.admit(running, paused),
      /confirmed completed execution boundary/,
    );
    assert.equal(boundaries.admit(paused, ended), true);
    store.compact();
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      const reader = new VerificationBoundaries(reopened, validator, scope.task_id);
      assert.deepEqual(reader.read(paused.execution_id, paused.boundary_event_id!), paused);
      assert.deepEqual(reader.read(ended.execution_id, ended.boundary_event_id!), ended);
    } finally {
      reopened.close();
    }
  });
});

test('boundary labels are scoped to their recorded run and execution identities', async () => {
  await withStore((store) => {
    const current = new VerificationBoundaries(store, validator, scope.task_id);
    const otherExecution = { ...ended, execution_id: 'another-execution' };
    const otherRunId = 'another-run';
    const otherRun = new VerificationBoundaries(store, validator, otherRunId);
    const otherRunStatus = { ...ended, task_scope: { ...scope, task_id: otherRunId } };
    assert.equal(current.admit(undefined, ended), true);
    assert.equal(current.admit(undefined, otherExecution), true);
    assert.equal(otherRun.admit(undefined, otherRunStatus), true);
    assert.deepEqual(
      current.read(otherExecution.execution_id, ended.boundary_event_id!),
      otherExecution,
    );
    assert.deepEqual(otherRun.read(ended.execution_id, ended.boundary_event_id!), otherRunStatus);
  });
});

test('write exclusion and rewritten records reject publication and reading', async () => {
  await withStore((store) => {
    const boundaries = new VerificationBoundaries(store, validator, scope.task_id);
    const hold = store.holdWrites();
    try {
      assert.throws(() => boundaries.admit(paused, ended), /suspended/);
      assert.equal(boundaries.read(ended.execution_id, ended.boundary_event_id!), undefined);
    } finally {
      hold.release();
    }
    assert.equal(boundaries.admit(paused, ended), true);
    const key = `verification-boundary:${JSON.stringify([scope.task_id, ended.execution_id, ended.boundary_event_id])}`;
    store.put(key, store.get(key)!.value, 1);
    assert.throws(() => boundaries.read(ended.execution_id, ended.boundary_event_id!), /rewritten/);
    assert.throws(() => boundaries.admit(paused, ended), /rewritten/);
  });
});
