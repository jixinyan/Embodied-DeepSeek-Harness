import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator } from '@edh/contracts';
import { TaskPlans } from '@edh/planning';
import { LocalStore } from '@edh/storage';
import { TaskGoals } from '@edh/tasks';
import {
  coreModelToolParameters,
  modelToolContractSchema,
  validateJsonSchemaValue,
} from '@edh/tools';

assert(process.argv[2], 'Supply a recorded replay directory containing source events and run.');
const sourceDirectory = resolve(process.argv[2], 'source');
const eventBytes = await readFile(resolve(sourceDirectory, 'events.json'));
const events = JSON.parse(eventBytes.toString('utf8'));
const runBytes = await readFile(resolve(sourceDirectory, 'run.json'));
const run = JSON.parse(runBytes.toString('utf8'));
const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const parameters = coreModelToolParameters('planning.update', {
  planSchema: await modelToolContractSchema(validator, 'PlanDocument'),
});
const firstRead = events.find(
  (event) => event.type === 'tool.completed' && event.detail.tool === 'planning.read',
).detail.result;
assert.equal(firstRead.taskId, run.id);
const owner = {
  agentId: firstRead.ownerAgentId,
  assignmentId: firstRead.ownerAssignmentId,
};
const finalGoal = {
  id: firstRead.finalGoalId,
  description: run.instruction,
  successContract: firstRead.goals.find((goal) => goal.id === firstRead.finalGoalId)
    .successContract,
};
const goalCatalog = new TaskGoals(
  validator,
  firstRead.goals.find((goal) => goal.id === finalGoal.id),
  firstRead.allowedSubgoalChecks,
  firstRead.goals.filter((goal) => goal.id !== finalGoal.id),
);
assert.deepEqual(goalCatalog.subgoalSource, firstRead.subgoalSource);
await mkdir('.local/checks', { recursive: true });
const directory = await mkdtemp(resolve('.local/checks/recorded-plans-'));
const store = new LocalStore(directory);
const plans = new TaskPlans(store, validator);
let rejectedCalls = 0;
let acceptedCalls = 0;
let templatesChecked = 0;
let admittedExecutions = 0;
const requests = [];
const verdicts = [];
const pendingWrites = new Map();
try {
  const initial = plans.nextWrite(run.id, owner, finalGoal);
  assert.equal(initial.expectedVersion, 0);
  assert.equal(initial.plan.version, 1);
  assert.equal(initial.plan.items[0].goal_id, finalGoal.id);
  assert.deepEqual(initial.plan.items[0].success_contract, finalGoal.successContract);
  assert.deepEqual(validateJsonSchemaValue(parameters, initial, 'arguments'), []);
  assert.equal(plans.read(run.id), undefined);
  templatesChecked++;
  for (const event of events) {
    if (event.type === 'plan.updated') {
      const write = pendingWrites.get(event.detail.plan.version);
      assert(write, 'Published plan requires its original preceding model arguments.');
      assert(write.callSequence < event.sequence && event.sequence < write.receiptSequence);
      const args = write.args;
      assert.deepEqual(event.detail.plan, args.plan);
      const admitted = goalCatalog.prepare(args.plan);
      plans.update(args.plan, args.expectedVersion, owner, verdicts, requests);
      goalCatalog.admit(admitted);
      const current = structuredClone(plans.read(run.id));
      const next = plans.nextWrite(run.id, owner, finalGoal);
      assert.equal(next.expectedVersion, current.version);
      assert.equal(next.plan.version, current.version + 1);
      assert.deepEqual(next.plan.items, current.items);
      assert.deepEqual(validateJsonSchemaValue(parameters, next, 'arguments'), []);
      assert.deepEqual(plans.read(run.id), current);
      assert.notEqual(next.plan.items, plans.read(run.id).items);
      pendingWrites.delete(args.plan.version);
      templatesChecked++;
      acceptedCalls++;
    }
    if (event.type === 'execution.requested') {
      const request = validator.parse('SubgoalRequest', event.detail.request);
      assert.equal(request.task_id, run.id);
      assert.equal(request.decision_owner_id, owner.agentId);
      assert.equal(request.owner_assignment_id, owner.assignmentId);
      assert(!requests.some((previous) => previous.attempt_id === request.attempt_id));
      assert(requests.filter((previous) => previous.goal_id === request.goal_id).length < 3);
      const plan = plans.read(run.id);
      assert(plan, 'Original execution requires its previously committed plan.');
      const binding = goalCatalog.ready(plan, request.goal_id, verdicts, requests);
      assert.deepEqual(request.success_contract, binding.successContract);
      assert.deepEqual(request.budget, binding.budget);
      assert.deepEqual(request.entities, binding.entities);
      assert.deepEqual(request.required_capabilities, binding.capabilities);
      requests.push(request);
      admittedExecutions++;
    }
    if (event.type === 'verification.completed')
      verdicts.push(validator.parse('VerificationResult', event.detail.result));
    if (event.type !== 'dsh.tool-call' || event.detail.data.name !== 'planning__update') continue;
    const args = JSON.parse(event.detail.data.arguments);
    const issues = validateJsonSchemaValue(parameters, args, 'arguments');
    if (issues.length) {
      const recordedRejection = events.find(
        (candidate) =>
          candidate.type === 'tool.failed' && candidate.detail.callId === event.detail.data.callId,
      );
      assert(recordedRejection, 'Rejected input must have an actual recorded rejection.');
      assert.equal(typeof args.plan, 'string');
      assert(issues.some((issue) => issue.includes('arguments.plan')));
      assert.match(recordedRejection.detail.error, /arguments.plan.*must be an object/);
      rejectedCalls++;
      continue;
    }
    const receipt = events.find(
      (candidate) =>
        candidate.type === 'tool.completed' && candidate.detail.callId === event.detail.data.callId,
    );
    assert(receipt, 'Accepted input must have an actual recorded write receipt.');
    assert.deepEqual(receipt.detail.result.plan, args.plan);
    assert(!pendingWrites.has(args.plan.version));
    pendingWrites.set(args.plan.version, {
      args,
      callSequence: event.sequence,
      receiptSequence: receipt.sequence,
    });
  }
  assert.equal(pendingWrites.size, 0);
  assert(acceptedCalls > 0, 'Recorded source must contain accepted plan writes.');
  assert(admittedExecutions > 0, 'Recorded source must contain admitted execution requests.');
  assert.deepEqual(requests, run.requests);
  assert.deepEqual(await readFile(resolve(sourceDirectory, 'events.json')), eventBytes);
  assert.deepEqual(await readFile(resolve(sourceDirectory, 'run.json')), runBytes);
  const analyst = events.find(
    (event) => event.type === 'agent.created' && event.detail.member === 'analyst',
  );
  if (analyst)
    assert.throws(
      () =>
        plans.nextWrite(
          run.id,
          { agentId: analyst.detail.sessionId, assignmentId: analyst.detail.assignmentId },
          finalGoal,
        ),
      /decision owner/,
    );
  const result = {
    runId: run.id,
    sourceSha256: createHash('sha256').update(eventBytes).digest('hex'),
    runSourceSha256: createHash('sha256').update(runBytes).digest('hex'),
    rejectedRecordedStringPlans: rejectedCalls,
    acceptedRecordedObjectPlans: acceptedCalls,
    readOnlyWriteTemplatesChecked: templatesChecked,
    admittedRecordedExecutions: admittedExecutions,
    originalSourceHashesUnchanged: true,
    sourceVerdictStatuses: verdicts.map((verdict) => verdict.status),
    scope: 'Recorded production schema/plan checks; no new model or simulation execution.',
  };
  await writeFile(resolve(directory, 'audit.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ...result, auditDirectory: directory }));
} finally {
  store.close();
}
