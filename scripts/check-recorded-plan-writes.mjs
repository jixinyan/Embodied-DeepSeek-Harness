import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ContractValidator } from '@edh/contracts';
import { TaskPlans } from '@edh/planning';
import { LocalStore } from '@edh/storage';
import { CORE_TOOL_PARAMETERS, validateJsonSchemaValue } from '@edh/tools';
import { modelToolContractSchema } from '../apps/server/src/model-tool-schema.ts';

assert(process.argv[2], 'Supply a recorded replay directory containing source events and run.');
const sourceDirectory = resolve(process.argv[2], 'source');
const eventBytes = await readFile(resolve(sourceDirectory, 'events.json'));
const events = JSON.parse(eventBytes.toString('utf8'));
const run = JSON.parse(await readFile(resolve(sourceDirectory, 'run.json'), 'utf8'));
const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const parameters = {
  type: 'object',
  properties: {
    ...CORE_TOOL_PARAMETERS['planning.update'],
    plan: await modelToolContractSchema(validator, 'PlanDocument'),
  },
  required: ['plan', 'expectedVersion'],
  additionalProperties: false,
};
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
await mkdir('.local/checks', { recursive: true });
const directory = await mkdtemp(resolve('.local/checks/recorded-plans-'));
const store = new LocalStore(directory);
const plans = new TaskPlans(store, validator);
let rejectedCalls = 0;
let acceptedCalls = 0;
let templatesChecked = 0;
const requests = [];
const verdicts = [];
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
    if (event.type === 'execution.requested')
      requests.push(validator.parse('SubgoalRequest', event.detail.request));
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
    plans.update(args.plan, args.expectedVersion, owner, verdicts, requests);
    const current = structuredClone(plans.read(run.id));
    const next = plans.nextWrite(run.id, owner, finalGoal);
    assert.equal(next.expectedVersion, current.version);
    assert.equal(next.plan.version, current.version + 1);
    assert.deepEqual(next.plan.items, current.items);
    assert.deepEqual(validateJsonSchemaValue(parameters, next, 'arguments'), []);
    assert.deepEqual(plans.read(run.id), current);
    assert.notEqual(next.plan.items, plans.read(run.id).items);
    templatesChecked++;
    acceptedCalls++;
  }
  assert(acceptedCalls > 0, 'Recorded source must contain accepted plan writes.');
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
    rejectedRecordedStringPlans: rejectedCalls,
    acceptedRecordedObjectPlans: acceptedCalls,
    readOnlyWriteTemplatesChecked: templatesChecked,
    sourceVerdictStatuses: verdicts.map((verdict) => verdict.status),
    scope: 'Recorded production schema/plan checks; no new model or simulation execution.',
  };
  await writeFile(resolve(directory, 'audit.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ...result, auditDirectory: directory }));
} finally {
  store.close();
}
