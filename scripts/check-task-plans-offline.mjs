import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { ContractValidator } from '@edh/contracts';
import { TaskPlans } from '@edh/planning';
import { LocalStore } from '@edh/storage';
import { parseTaskCatalog, TaskGoals } from '@edh/tasks';

const { values } = parseArgs({ options: { output: { type: 'string' } } });
assert(values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = await Promise.all(
  [
    'harness/agent-runtime/planning/src/index.ts',
    'harness/agent-runtime/planning/src/plans.ts',
    'harness/agent-runtime/tasks/src/index.ts',
    'harness/agent-runtime/tasks/src/goals.ts',
    'harness/agent-runtime/tasks/src/goal-binding.ts',
    'harness/agent-runtime/tasks/src/task-definition.ts',
    'harness/contracts/src/validation.ts',
    'harness/contracts/schema/physical.schema.json',
    'harness/agent-runtime/storage/src/local-store.ts',
    'examples/tasks/robodojo-build-tower.json',
    'scripts/check-task-plans-offline.mjs',
  ].map(async (name) => ({
    path: resolve(root, name),
    sha256: hash(await readFile(resolve(root, name))),
  })),
);
const validator = new ContractValidator(
  JSON.parse(
    await readFile(resolve(root, 'harness/contracts/schema/physical.schema.json'), 'utf8'),
  ),
);
const catalog = parseTaskCatalog(
  JSON.parse(await readFile(resolve(root, 'examples/tasks/robodojo-build-tower.json'), 'utf8')),
  validator,
);
const task = catalog.tasks.build_tower;
const goals = new TaskGoals(validator, task.goal, task.allowedSubgoalChecks, task.predefinedGoals);
const taskId = randomUUID();
const owner = { agentId: randomUUID(), assignmentId: randomUUID() };
const finalGoal = {
  id: task.goal.id,
  description: task.instruction,
  successContract: task.goal.successContract,
};
await mkdir(output, { recursive: false });
const data = resolve(output, 'data');
const store = new LocalStore(data);
const plans = new TaskPlans(store, validator);
const checks = [];
const accept = (name) => checks.push({ name, rejected: false });
const reject = (name, operation, message) => {
  assert.throws(operation, message);
  checks.push({ name, rejected: true });
};
let initial;
let current;
let compaction;
try {
  assert.equal(plans.read(taskId), undefined);
  initial = plans.nextWrite(taskId, owner, finalGoal);
  assert.equal(initial.expectedVersion, 0);
  assert.equal(initial.plan.version, 1);
  assert.deepEqual(initial.plan.items[0].success_contract, task.goal.successContract);
  accept('configured-initial-template');
  const admitted = goals.prepare(initial.plan);
  plans.update(initial.plan, initial.expectedVersion, owner, []);
  goals.admit(admitted);
  assert.deepEqual(plans.read(taskId), initial.plan);
  assert.deepEqual(goals.ready(initial.plan, task.goal.id, [], []), task.goal);
  accept('persist-configured-plan');
  const journal = resolve(data, 'records.jsonl');
  const beforeRead = hash(await readFile(journal));
  const next = plans.nextWrite(taskId, owner, finalGoal);
  assert.equal(next.expectedVersion, 1);
  assert.equal(next.plan.version, 2);
  assert.deepEqual(next.plan.items, initial.plan.items);
  assert.equal(hash(await readFile(journal)), beforeRead);
  accept('read-only-next-template');
  reject(
    'foreign-owner-template',
    () => plans.nextWrite(taskId, { ...owner, assignmentId: randomUUID() }, finalGoal),
    /Plan requires decision owner/,
  );
  reject(
    'stale-plan-write',
    () => plans.update(initial.plan, initial.expectedVersion, owner, []),
    /Version conflict.*expected 0, found 1/,
  );
  const unverified = structuredClone(next.plan);
  unverified.items[0].status = 'done';
  unverified.items[0].last_verdict_ref = 'missing-formal-verdict';
  reject(
    'completion-without-verdict',
    () => plans.update(unverified, next.expectedVersion, owner, []),
    /Completed plan item requires latest accepted goal verdict/,
  );
  const changedCriterion = structuredClone(next.plan);
  changedCriterion.items[0].success_contract.version += '-changed';
  reject(
    'changed-final-criterion',
    () => goals.prepare(changedCriterion),
    /Admitted goal criteria are immutable/,
  );
  const abandoned = structuredClone(next.plan);
  abandoned.items[0].status = 'abandoned';
  reject(
    'abandoned-final-goal',
    () => goals.prepare(abandoned),
    /Plan must retain the required final task goal/,
  );
  assert.equal(hash(await readFile(journal)), beforeRead);
  const admittedNext = goals.prepare(next.plan);
  plans.update(next.plan, next.expectedVersion, owner, []);
  goals.admit(admittedNext);
  current = plans.read(taskId);
  assert.deepEqual(current, next.plan);
  accept('publish-next-version');
} finally {
  store.close();
}
await assert.rejects(access(resolve(data, 'writer.lock')), { code: 'ENOENT' });
const reopened = new LocalStore(data);
try {
  const reader = new TaskPlans(reopened, validator);
  assert.deepEqual(reader.read(taskId), current);
  assert.equal(reopened.get(`plan:${taskId}`).version, current.version);
  accept('reopen-versioned-plan');
  compaction = reopened.compact();
  assert.equal(compaction.compacted, true);
  assert.deepEqual(reader.read(taskId), current);
} finally {
  reopened.close();
}
await assert.rejects(access(resolve(data, 'writer.lock')), { code: 'ENOENT' });
const compacted = new LocalStore(data);
try {
  assert.deepEqual(new TaskPlans(compacted, validator).read(taskId), current);
  assert.equal(compacted.get(`plan:${taskId}`).version, current.version);
  accept('compacted-version');
} finally {
  compacted.close();
}
await assert.rejects(access(resolve(data, 'writer.lock')), { code: 'ENOENT' });
const readAdmissions = [];
for (const [name, plan, rewrite, error] of [
  ['original-plan', initial.plan, false, null],
  ['foreign-task', { ...initial.plan, task_id: randomUUID() }, false, /identity or version/],
  ['document-version', { ...initial.plan, version: 2 }, false, /identity or version/],
  ['storage-version', initial.plan, true, /identity or version/],
  [
    'schema-version',
    { ...initial.plan, schema_version: 'physical.plan.invalid' },
    false,
    /PlanDocument:.*schema_version/,
  ],
  [
    'duplicate-goals',
    { ...initial.plan, items: [initial.plan.items[0], initial.plan.items[0]] },
    false,
    /Identifiers must be unique/,
  ],
]) {
  const directory = resolve(output, 'read', name);
  const derivativeStore = new LocalStore(directory);
  let sha256;
  try {
    derivativeStore.put(`plan:${taskId}`, plan, 0);
    if (rewrite) derivativeStore.put(`plan:${taskId}`, plan, 1);
    const journal = resolve(directory, 'records.jsonl');
    sha256 = hash(await readFile(journal));
    const reader = new TaskPlans(derivativeStore, validator);
    if (error) {
      reject(`read-${name}`, () => reader.read(taskId), error);
      assert.throws(() => reader.nextWrite(taskId, owner, finalGoal), error);
    } else {
      assert.deepEqual(reader.read(taskId), initial.plan);
      assert.equal(reader.nextWrite(taskId, owner, finalGoal).expectedVersion, 1);
      accept(`read-${name}`);
    }
    assert.equal(hash(await readFile(journal)), sha256);
  } finally {
    derivativeStore.close();
  }
  await assert.rejects(access(resolve(directory, 'writer.lock')), { code: 'ENOENT' });
  readAdmissions.push({
    name,
    journalPath: relative(output, resolve(directory, 'records.jsonl')),
    journalSha256: sha256,
    journalUnchanged: true,
    writerReleased: true,
  });
}
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
await writeFile(
  resolve(output, 'acceptance.json'),
  `${JSON.stringify(
    {
      schemaVersion: 'edh.task_plans_cpu.v1',
      recordedAt: new Date().toISOString(),
      sources,
      checks,
      catalogRevision: catalog.revision,
      taskId,
      owner,
      configuredGoal: task.goal,
      storedPlanVersion: current.version,
      compaction,
      journalSha256: hash(await readFile(resolve(data, 'records.jsonl'))),
      readAdmissions,
      writerReleased: true,
      modelInferencePerformed: false,
      environmentAllocationPerformed: false,
      physicalControlPerformed: false,
      scope:
        'Production task-plan admission and durable storage using the authored RoboDojo Tower configuration.',
    },
    null,
    2,
  )}\n`,
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    checks: checks.length,
    writerReleased: true,
    storedPlanVersion: current.version,
  }),
);
