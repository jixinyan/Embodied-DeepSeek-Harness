import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import { request } from 'undici';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    profile: { type: 'string' },
    task: { type: 'string', multiple: true },
    output: { type: 'string' },
    'timeout-ms': { type: 'string', default: '3600000' },
  },
});
assert(
  values.url && values.profile && values.task?.length && values.output,
  'Required: --url, --profile, --task (repeatable), --output.',
);
const url = new URL(values.url);
assert(['http:', 'https:'].includes(url.protocol));
const timeoutMs = Number(values['timeout-ms']);
assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 86400000);
const output = resolve(values.output);
await mkdir(output, { recursive: false });
const save = (name, value) =>
  writeFile(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);

async function api(path, body) {
  const response = await request(new URL(path, url), {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
    signal: AbortSignal.timeout(900000),
    headersTimeout: 900000,
    bodyTimeout: 900000,
  });
  const result = await response.body.json();
  assert(
    response.statusCode >= 200 && response.statusCode < 300,
    JSON.stringify({ status: response.statusCode, result }),
  );
  return result;
}

async function capture(directory, runId) {
  const run = await api(`/api/runs/${runId}?events=none`);
  const events = [];
  while (events.length < run.eventCount) {
    const page = await api(
      `/api/runs/${runId}/history?after=${events.length}&through=${run.eventCount}`,
    );
    assert.equal(page.afterSequence, events.length);
    assert(page.events.length && events.length + page.events.length <= run.eventCount);
    for (const event of page.events) {
      assert.equal(event.sequence, events.length + 1);
      events.push(event);
    }
  }
  await writeFile(resolve(directory, 'run.json'), JSON.stringify(run, null, 2));
  await writeFile(resolve(directory, 'events.json'), JSON.stringify(events, null, 2));
  return { run, events };
}

const config = await api('/api/config');
await save('configuration.json', config);
const profile = config.launchProfiles[values.profile];
assert(profile, `Unknown launch profile: ${values.profile}`);
const fields = [
  'source',
  'environment',
  'embodiment',
  'executionMode',
  'checkpoint',
  'policy',
  'defaultModel',
];
const session = await api('/api/sessions', {
  profileId: values.profile,
  requestId: randomUUID(),
  catalogRevision: config.deploymentDigest,
  selection: Object.fromEntries(fields.map((field) => [field, profile[field]])),
});
await save('session.json', session);
const accepted = [];
try {
  const catalog = await api(`/api/sessions/${session.id}/tasks`);
  await save('catalog.json', catalog);
  for (const [index, scenario] of values.task.entries()) {
    assert(catalog.tasks[scenario], `Unknown admitted task: ${scenario}`);
    const readyDeadline = Date.now() + timeoutMs;
    const lifecycle = [];
    for (;;) {
      const current = await api(`/api/sessions/${session.id}`);
      assert.equal(current.id, session.id);
      assert.equal(current.resources, 'held', JSON.stringify(current));
      if (lifecycle.at(-1)?.state !== current.state) {
        lifecycle.push({ state: current.state, updatedAt: current.updatedAt });
        await save(`session-lifecycle-before-task-${index + 1}.json`, lifecycle);
      }
      if (current.state === 'ready') {
        await save(`ready-before-task-${index + 1}.json`, current);
        break;
      }
      assert(index > 0 && ['running', 'draining'].includes(current.state), JSON.stringify(current));
      assert(Date.now() < readyDeadline, 'Session did not finish retiring its previous task.');
      await setTimeout(300);
    }
    const directory = resolve(output, `task-${index + 1}`);
    await mkdir(directory);
    const submission = await api(`/api/sessions/${session.id}/tasks`, {
      scenario,
      requestId: randomUUID(),
      catalogRevision: catalog.descriptor.digest,
      instruction: catalog.tasks[scenario].instruction,
    });
    await writeFile(resolve(directory, 'submission.json'), JSON.stringify(submission, null, 2));
    const deadline = Date.now() + timeoutMs;
    let previous;
    let run;
    for (;;) {
      run = await api(`/api/runs/${submission.runId}?events=none`);
      const execution = run.executions.at(-1);
      const progress = JSON.stringify({
        runId: run.id,
        state: run.state,
        attempt: run.attempt,
        controls: execution?.control_steps,
        inferences: execution?.policy_calls,
        verdicts: run.verdicts.map((verdict) => verdict.status),
      });
      if (progress !== previous) {
        console.log(progress);
        previous = progress;
      }
      if (['succeeded', 'failed', 'cancelled', 'unknown', 'interrupted'].includes(run.state)) break;
      assert(
        Date.now() < deadline,
        `Actual run exceeded its acceptance deadline: ${submission.runId}`,
      );
      await setTimeout(3000);
    }
    const captured = await capture(directory, submission.runId);
    run = captured.run;
    const events = captured.events;
    const errors = events.filter((event) => event.type === 'tool.failed');
    const result = {
      scenario,
      runId: submission.runId,
      outcome: run.state,
      eventCount: events.length,
      toolErrors: errors.length,
      formalVerdicts: run.verdicts.map((verdict) => verdict.status),
    };
    accepted.push(result);
    await save('results.json', accepted);
    assert.equal(run.state, 'succeeded', JSON.stringify(result));
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert(run.verdicts.length && run.verdicts.at(-1).status === 'passed');
  }
} finally {
  const closed = await api(`/api/sessions/${session.id}/close`, {});
  await save('closed.json', closed);
  assert.equal(closed.resources, 'released');
  for (const [index, result] of accepted.entries()) {
    const { run, events } = await capture(resolve(output, `task-${index + 1}`), result.runId);
    result.outcome = run.state;
    result.eventCount = events.length;
    result.toolErrors = events.filter((event) => event.type === 'tool.failed').length;
    result.formalVerdicts = run.verdicts.map((verdict) => verdict.status);
  }
  await save('results.json', accepted);
}
console.log(JSON.stringify({ sessionId: session.id, tasks: accepted, resources: 'released' }));
