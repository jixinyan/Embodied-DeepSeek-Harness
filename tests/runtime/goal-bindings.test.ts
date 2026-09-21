import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator, type PlanDocument } from '@edh/contracts';
import { TaskGoals, parseGoalBinding, type GoalBinding } from '@edh/tasks';
import { TaskPlans } from '@edh/planning';
import { LocalStore } from '@edh/storage';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const root: GoalBinding = {
  id: 'document:inspection',
  configuration: 'authored-document',
  successContract: {
    id: 'document:review',
    version: '1',
    all: [{ check_id: 'review', check: 'document_reviewed', args: ['document'] }],
    source: { kind: 'user', reference: 'authored-goal-binding-document' },
  },
  entities: { document: 'project-spec' },
  capabilities: ['read-documents'],
  taskSemantics: ['Review a project document'],
  budget: { max_control_steps: 100, max_wall_time_s: 60 },
};
const permitted = { check_id: 'available', check: 'document_available', args: ['document'] };

function plan(catalog: TaskGoals): PlanDocument {
  return {
    schema_version: 'physical.plan.v1',
    task_id: 'document-task',
    version: 1,
    owner_agent_id: 'document-planner',
    owner_assignment_id: 'document-assignment',
    items: [
      {
        goal_id: 'document:available',
        description: 'Locate the project document',
        status: 'planned',
        dependencies: [],
        success_contract: {
          id: 'document:availability',
          version: '1',
          source: catalog.subgoalSource,
          all: [permitted],
        },
      },
      {
        goal_id: root.id,
        description: 'Review the project document',
        status: 'planned',
        dependencies: ['document:available'],
        success_contract: structuredClone(root.successContract),
      },
    ],
  };
}

test('goal bindings validate all configuration fields and preserve detached source values', () => {
  const input = structuredClone(root);
  const parsed = parseGoalBinding(input, validator);
  assert.deepEqual(parsed, root);
  input.entities.document = 'changed';
  input.capabilities.push('changed');
  input.budget.max_control_steps = 1;
  assert.deepEqual(parsed, root);
  const invalid: unknown[] = [
    null,
    { ...root, id: 'goal\n' },
    { ...root, id: 'a'.repeat(129) },
    { ...root, configuration: '  ' },
    { ...root, entities: [] },
    { ...root, entities: { document: null } },
    { ...root, entities: { ' ': 'document' } },
    { ...root, entities: { document: ' ' } },
    { ...root, capabilities: 'read-documents' },
    { ...root, capabilities: [null] },
    { ...root, capabilities: [' '] },
    { ...root, taskSemantics: undefined },
    { ...root, taskSemantics: [' '] },
    { ...root, unexpected: true },
    { ...root, budget: { ...root.budget, max_control_steps: Number.MAX_SAFE_INTEGER + 1 } },
    { ...root, budget: { ...root.budget, max_control_steps: 0 } },
    { ...root, budget: { ...root.budget, max_control_steps: 1.5 } },
    { ...root, budget: { ...root.budget, max_wall_time_s: Infinity } },
    { ...root, budget: { ...root.budget, max_wall_time_s: 0 } },
    { ...root, budget: { ...root.budget, extra: true } },
    { ...root, successContract: { ...root.successContract, all: [permitted, permitted] } },
  ];
  for (const input of invalid) assert.throws(() => parseGoalBinding(input, validator));
  assert.deepEqual(
    parseGoalBinding({ ...root, capabilities: [], entities: {}, taskSemantics: [] }, validator),
    { ...root, capabilities: [], entities: {}, taskSemantics: [] },
  );
});

test('configured goals apply the same validation and total capacity before admission', () => {
  const invalid = { ...root, id: 'prerequisite', capabilities: [' '] };
  assert.throws(() => new TaskGoals(validator, invalid));
  assert.throws(() => new TaskGoals(validator, root, [], [invalid]));
  assert.throws(() => new TaskGoals(validator, root, [], [root]), /Duplicate/);
  const predefined = Array.from({ length: 63 }, (_, index) => ({ ...root, id: `goal-${index}` }));
  const catalog = new TaskGoals(validator, root, [], predefined);
  assert.equal(catalog.catalog().goals.length, 64);
  assert.throws(
    () => new TaskGoals(validator, root, [], [...predefined, { ...root, id: 'extra' }]),
    /64 admitted goals/,
  );
  const detached = catalog.get(root.id);
  detached.entities.document = 'changed';
  assert.deepEqual(catalog.get(root.id), root);
});

test('goal batch admission validates every member before changing the catalog', () => {
  const catalog = new TaskGoals(validator, root);
  const newGoal = { ...root, id: 'new-goal' };
  for (const invalid of [
    { ...root, configuration: 'different' },
    { ...root, budget: { ...root.budget, max_control_steps: 101 } },
    { ...root, entities: { document: 'different' } },
    { ...root, capabilities: ['different'] },
    { ...root, taskSemantics: ['different'] },
  ]) {
    assert.throws(() => catalog.admit([newGoal, invalid]), /immutable/);
    assert.equal(catalog.catalog().goals.length, 1);
  }
  assert.throws(() => catalog.admit([newGoal, newGoal]), /Duplicate/);
  assert.throws(() => catalog.admit([newGoal, { ...root, capabilities: [' '] }]));
  assert.equal(catalog.catalog().goals.length, 1);
  catalog.admit([newGoal, root]);
  newGoal.entities = { document: 'changed' };
  assert.deepEqual(catalog.get('new-goal').entities, root.entities);
  const batch = Array.from({ length: 63 }, (_, index) => ({ ...root, id: `extra-${index}` }));
  assert.throws(() => catalog.admit(batch), /64 admitted goals/);
  assert.equal(catalog.catalog().goals.length, 2);
});

test('prepared Planner goals preserve bindings and validate before a plan journal write', async () => {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/goal-bindings-'));
  const store = new LocalStore(directory);
  try {
    const catalog = new TaskGoals(validator, root, [permitted]);
    const plans = new TaskPlans(store, validator);
    const document = plan(catalog);
    const owner = {
      agentId: document.owner_agent_id,
      assignmentId: document.owner_assignment_id,
    };
    const update = (input: PlanDocument) => {
      const prepared = catalog.prepare(input);
      plans.update(input, 0, owner, [], []);
      catalog.admit(prepared);
      return prepared;
    };
    const invalid = structuredClone(document);
    invalid.items[0]!.description = ' ';
    assert.throws(() => update(invalid), /nonblank/);
    assert.equal(plans.read(document.task_id), undefined);
    assert.equal(store.statistics().sequence, 0);
    const prepared = update(document);
    const admitted = catalog.get('document:available');
    assert.deepEqual(admitted.entities, root.entities);
    assert.deepEqual(admitted.budget, root.budget);
    assert.deepEqual(admitted.capabilities, root.capabilities);
    assert.deepEqual(admitted.taskSemantics, [
      ...root.taskSemantics,
      document.items[0]!.description,
    ]);
    prepared[0]!.entities.document = 'changed';
    assert.deepEqual(catalog.get('document:available').entities, root.entities);
    assert.equal(plans.read(document.task_id)?.version, 1);
    const duplicate = structuredClone(document);
    duplicate.items.push(duplicate.items[0]!);
    assert.throws(() => catalog.prepare(duplicate), /unique/);
    const foreign = plan(new TaskGoals(validator, root, [permitted]));
    foreign.items[0]!.goal_id = 'goal\n';
    assert.throws(() => catalog.prepare(foreign), /PlanDocument/);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
