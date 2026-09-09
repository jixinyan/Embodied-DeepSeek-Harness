import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  ContractValidator,
  type PlanDocument,
  type SubgoalRequest,
  type VerificationResult,
} from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { TaskPlans } from '@edh/planning';
import { TaskGoals } from '@edh/tasks';

const source = JSON.parse(await readFile('tests/contracts/wire-cases.json', 'utf8')).bases;
const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);

test('plans retain executed criteria and cannot use an older success to hide later failure', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'edh-plan-'));
  const store = new LocalStore(directory);
  try {
    const plans = new TaskPlans(store, validator);
    const plan = structuredClone(source.plan.value) as PlanDocument;
    const request = structuredClone(source.subgoal.value) as SubgoalRequest;
    const passed = structuredClone(source.verification_passed.value) as VerificationResult;
    const owner = { agentId: plan.owner_agent_id, assignmentId: plan.owner_assignment_id };
    plans.update(plan, 0, owner, [], [request]);
    const completed: PlanDocument = {
      ...plan,
      version: 2,
      items: [{ ...plan.items[0]!, status: 'done', last_verdict_ref: passed.verdict_id }],
    };
    const failed = {
      ...passed,
      verdict_id: 'later-failure',
      status: 'failed' as const,
      task_scope: { ...passed.task_scope, attempt_id: 'attempt_2' },
    };
    assert.throws(
      () => plans.update(completed, 1, owner, [passed, failed], [request]),
      /latest accepted/,
    );
    assert.throws(
      () => plans.update(completed, 1, owner, [passed], [{ ...request, attempt_id: 'attempt_2' }]),
      /latest accepted/,
    );
    assert.throws(
      () => plans.update({ ...plan, version: 2, items: [] }, 1, owner, [], [request]),
      /must remain/,
    );
    const changed = structuredClone(completed);
    if ('all' in changed.items[0]!.success_contract)
      changed.items[0]!.success_contract.all[0]!.args = ['different-cup'];
    assert.throws(() => plans.update(changed, 1, owner, [passed], [request]), /must remain/);
    assert.equal(plans.read(plan.task_id)?.version, 1);
    plans.update(completed, 1, owner, [passed], [request]);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Planner goals use registered predicates, immutable final criteria and verified dependencies', () => {
  const plan = structuredClone(source.plan.value) as PlanDocument;
  const request = structuredClone(source.subgoal.value) as SubgoalRequest;
  const passed = structuredClone(source.verification_passed.value) as VerificationResult;
  const check = { check_id: 'cabinet-open', check: 'open', args: ['cabinet_1'] };
  const catalog = new TaskGoals(
    validator,
    {
      id: request.goal_id,
      configuration: 'fixture',
      successContract: request.success_contract,
      entities: request.entities,
      capabilities: request.required_capabilities,
      taskSemantics: ['store cup'],
      budget: request.budget,
    },
    [check],
  );
  const open: PlanDocument['items'][number] = {
    ...plan.items[0]!,
    goal_id: 'open-cabinet',
    status: 'planned' as const,
    success_contract: {
      id: 'cabinet-access',
      version: '1',
      source: catalog.subgoalSource,
      all: [check],
    },
  };
  plan.items.unshift(open);
  plan.items[1]!.dependencies = ['open-cabinet'];
  catalog.admit(catalog.prepare(plan));
  assert.equal(catalog.ready(plan, 'open-cabinet', [], []).id, 'open-cabinet');
  assert.throws(() => catalog.ready(plan, request.goal_id, [], []), /dependency/);
  const invalid = structuredClone(plan);
  invalid.items[0]!.success_contract = {
    ...open.success_contract,
    all: [{ ...check, args: ['other-cabinet'] }],
  };
  assert.throws(() => catalog.prepare(invalid), /immutable/);
  assert.throws(() => catalog.prepare({ ...plan, items: [open] }), /final task goal/);
  const newInvalid = structuredClone(invalid);
  newInvalid.items[0]!.goal_id = 'unregistered';
  assert.throws(() => catalog.prepare(newInvalid), /Unregistered/);
  const openVerdict = {
    ...passed,
    verdict_id: 'open-passed',
    goal_contract_id: 'cabinet-access',
    task_scope: { ...passed.task_scope, goal_id: 'open-cabinet' },
  };
  plan.items[0] = { ...open, status: 'done', last_verdict_ref: openVerdict.verdict_id };
  assert.equal(
    catalog.ready(plan, request.goal_id, [openVerdict], [{ ...request, goal_id: 'open-cabinet' }])
      .id,
    request.goal_id,
  );
});
