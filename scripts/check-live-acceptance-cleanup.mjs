import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    directory: { type: 'string' },
    mode: { type: 'string' },
    'error-log': { type: 'string' },
    'exit-code': { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values.directory && values.output && values['error-log'] && values['exit-code']);
assert(['task-deadline', 'admission-failure'].includes(values.mode));
const directory = resolve(values.directory);
const json = async (name) => JSON.parse(await readFile(resolve(directory, name), 'utf8'));
const exitCode = Number((await readFile(resolve(values['exit-code']), 'utf8')).trim());
assert(Number.isSafeInteger(exitCode) && exitCode > 0, 'Actual failure must exit unsuccessfully.');
const error = await readFile(resolve(values['error-log']), 'utf8');
const request = await json('session-request.json');
const session = await json('session.json');
const closed = await json('closed.json');
assert.equal(session.requestId, request.requestId);
assert.equal(session.profileId, request.profileId);
assert.equal(session.deploymentDigest, request.catalogRevision);
assert.equal(closed.id, session.id);
assert.equal(closed.requestId, session.requestId);
assert.equal(closed.state, 'closed');
assert.equal(closed.resources, 'released');
const results = await json('results.json');
let events = 0;
let runId = null;
if (values.mode === 'task-deadline') {
  const submission = await json('task-1/submission.json');
  const before = await json('task-1/before-close-run.json');
  const beforeEvents = await json('task-1/before-close-events.json');
  const after = await json('task-1/run.json');
  const afterEvents = await json('task-1/events.json');
  assert.equal(before.id, submission.runId);
  assert.equal(after.id, before.id);
  assert.equal(before.source, 'simulation');
  assert(['running', 'verifying'].includes(before.state));
  assert.equal(after.state, 'cancelled');
  assert.equal(beforeEvents.length, before.eventCount);
  assert.equal(afterEvents.length, after.eventCount);
  assert(afterEvents.length > beforeEvents.length);
  assert.deepEqual(afterEvents.slice(0, beforeEvents.length), beforeEvents);
  afterEvents.forEach((event, index) => {
    assert.equal(event.sequence, index + 1);
    assert(Number.isFinite(Date.parse(event.at)));
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].runId, after.id);
  assert.equal(results[0].outcome, after.state);
  assert.equal(results[0].eventCount, afterEvents.length);
  assert(error.includes(`Actual run exceeded its acceptance deadline: ${after.id}`));
  assert(Object.values(after.assignments).every((assignment) => assignment.status === 'retired'));
  events = afterEvents.length;
  runId = after.id;
} else {
  assert.equal(session.state, 'error');
  assert.equal(session.resources, 'unknown');
  assert.equal(session.taskHistory.count, 0);
  assert.equal(closed.taskHistory.count, 0);
  assert.deepEqual(results, []);
  assert(error.includes('Native worker FileNotFoundError'));
  assert(error.includes('EDH') || error.includes('record'));
}
const report = {
  mode: values.mode,
  sessionId: session.id,
  requestId: request.requestId,
  runId,
  checkedEvents: events,
  originalFailureRetained: true,
  actualExitCode: exitCode,
  resources: closed.resources,
};
await writeFile(resolve(values.output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(report));
