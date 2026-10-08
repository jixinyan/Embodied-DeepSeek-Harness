import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, open } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { request } from 'undici';
import { nativeCampaignSchema, auditNativeCampaignTask } from './native-campaign.mjs';
import { nativeDeploymentRoot } from '../apps/server/src/native-deployment.mjs';

const { values } = parseArgs({
  options: {
    manifest: { type: 'string' },
    readiness: { type: 'string' },
    output: { type: 'string' },
    url: { type: 'string' },
    prepare: { type: 'boolean', default: false },
  },
});
assert(values.manifest && values.readiness && values.output);
assert(values.prepare !== Boolean(values.url), 'Select --prepare or an actual Console --url.');
const manifest = nativeCampaignSchema.parse(JSON.parse(await readFile(values.manifest, 'utf8')));
const readiness = JSON.parse(await readFile(values.readiness, 'utf8'));
assert(readiness.sourceCode && /^[a-f0-9]{40}$/.test(readiness.sourceCode.revision));
assert(readiness.writerReleased && readiness.listenerClosed);
assert(
  readiness.nativeEnvironmentAllocated === false && readiness.modelInferencePerformed === false,
);
for (const source of readiness.sources)
  assert.equal(
    createHash('sha256')
      .update(await readFile(source.path))
      .digest('hex'),
    source.sha256,
    `Readiness source changed: ${source.path}`,
  );
for (const item of manifest.cases) {
  const profile = readiness.profiles.find((profile) => profile.profileId === item.profileId);
  assert(profile, `Profile lacks native readiness: ${item.profileId}`);
  assert(item.tasks.every((task) => task.taskId === profile.nativeTaskId));
  if (item.tasks.some((task) => task.minimumGoals > 1))
    assert(
      profile.allowedSubgoalChecks.length > 0,
      'Multi-goal acceptance requires admitted checks.',
    );
}
const output = resolve(values.output);
const childPath = relative(resolve(nativeDeploymentRoot, '.local/work'), output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
await mkdir(output, { recursive: false });
const save = (name, value) =>
  writeFile(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
const plan = {
  sourceCode: readiness.sourceCode,
  deploymentDigest: readiness.deploymentDigest,
  sources: readiness.sources,
  manifest,
  profiles: readiness.profiles,
  status: 'prepared',
  nativeTaskExecutionPerformed: false,
};
await save('campaign-plan.json', plan);
if (values.prepare) {
  console.log(
    JSON.stringify({
      status: 'prepared',
      cases: manifest.cases.length,
      output,
      nativeTaskExecutionPerformed: false,
    }),
  );
} else {
  const url = new URL(values.url);
  assert(
    ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !url.search,
  );
  const api = async (path, body) => {
    const timeout = body === undefined ? 30_000 : 900_000;
    const response = await request(new URL(path, url), {
      method: body === undefined ? 'GET' : 'POST',
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeout),
      headersTimeout: timeout,
      bodyTimeout: timeout,
    });
    const result = await response.body.json();
    assert(
      response.statusCode >= 200 && response.statusCode < 300,
      JSON.stringify({ status: response.statusCode, result }),
    );
    return result;
  };
  const releaseOwnedSession = async (directory) => {
    const listing = await api('/api/sessions');
    const requestPath = resolve(directory, 'session-request.json');
    if (!listing.activeId || !existsSync(requestPath)) return { ownedActiveSession: false };
    const openRequest = JSON.parse(await readFile(requestPath, 'utf8'));
    const candidate = await api(`/api/sessions/${listing.activeId}`);
    if (candidate.requestId !== openRequest.requestId) return { ownedActiveSession: false };
    assert.equal(candidate.profileId, openRequest.profileId);
    assert.equal(candidate.deploymentDigest, openRequest.catalogRevision);
    const closed = await api(`/api/sessions/${candidate.id}/close`, {});
    await writeFile(resolve(directory, 'campaign-closed.json'), JSON.stringify(closed, null, 2));
    assert.equal(closed.resources, 'released');
    return { ownedActiveSession: true, sessionId: candidate.id, resources: 'released' };
  };
  const configuration = await api('/api/config');
  assert.equal(configuration.sourceCode.revision, readiness.sourceCode.revision);
  assert(
    ['published', 'unpublished'].includes(configuration.sourceCode.state),
    'Actual release workflows require an unchanged committed EDH checkout.',
  );
  assert.equal(configuration.deploymentDigest, readiness.deploymentDigest);
  assert.equal((await api('/api/sessions')).activeId, null);
  const abort = new AbortController();
  const interrupt = () => abort.abort(new Error('Native campaign interrupted.'));
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  const results = [];
  try {
    for (const item of manifest.cases) {
      abort.signal.throwIfAborted();
      const directory = resolve(output, item.id);
      const log = await open(resolve(output, `${item.id}.log`), 'wx');
      let exit;
      let failure;
      try {
        exit = await new Promise((accept, reject) => {
          const child = spawn(
            process.execPath,
            [
              '--import',
              'tsx',
              resolve(nativeDeploymentRoot, 'scripts/run-live-acceptance.mjs'),
              '--url',
              values.url,
              '--profile',
              item.profileId,
              ...item.tasks.flatMap((task) => ['--task', task.taskId]),
              '--timeout-ms',
              String(item.timeoutMs),
              '--output',
              directory,
            ],
            {
              cwd: nativeDeploymentRoot,
              env: {
                ...process.env,
                TSX_TSCONFIG_PATH: resolve(nativeDeploymentRoot, 'tsconfig.runtime.json'),
              },
              stdio: ['ignore', log.fd, log.fd],
            },
          );
          const terminate = () => child.kill('SIGTERM');
          console.log(JSON.stringify({ case: item.id, state: 'running', driverPid: child.pid }));
          abort.signal.addEventListener('abort', terminate, { once: true });
          if (abort.signal.aborted) terminate();
          child.once('error', reject);
          child.once('close', (code, signal) => {
            abort.signal.removeEventListener('abort', terminate);
            accept({ code, signal });
          });
        });
        await save(`${item.id}-exit.json`, exit);
        assert.equal(exit.signal, null, `Native case interrupted: ${item.id}.`);
        assert.equal(
          exit.code,
          0,
          `Native case failed: ${item.id}; inspect retained task history.`,
        );
      } catch (error) {
        failure = error;
      } finally {
        const cleanupErrors = [];
        try {
          await log.close();
        } catch (error) {
          cleanupErrors.push(error);
        }
        try {
          await save(`${item.id}-cleanup.json`, await releaseOwnedSession(directory));
        } catch (error) {
          cleanupErrors.push(error);
        }
        if (cleanupErrors.length)
          throw new AggregateError(
            [...(failure === undefined ? [] : [failure]), ...cleanupErrors],
            'Native campaign case or owned Session release failed.',
          );
      }
      if (failure !== undefined) throw failure;
      abort.signal.throwIfAborted();
      const audits = [];
      for (const [index, expectation] of item.tasks.entries()) {
        const taskDirectory = resolve(directory, `task-${index + 1}`);
        const run = JSON.parse(await readFile(resolve(taskDirectory, 'run.json'), 'utf8'));
        const events = JSON.parse(await readFile(resolve(taskDirectory, 'events.json'), 'utf8'));
        audits.push(auditNativeCampaignTask(run, events, expectation));
      }
      const closed = JSON.parse(await readFile(resolve(directory, 'closed.json'), 'utf8'));
      assert.equal(closed.resources, 'released');
      assert.equal((await api('/api/sessions')).activeId, null);
      const services = await api('/api/services');
      assert(services.services.every((service) => service.leases === 0 && service.pid === null));
      results.push({ id: item.id, profileId: item.profileId, audits, resources: 'released' });
      await save('campaign-results.json', results);
      console.log(JSON.stringify(results.at(-1)));
    }
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
  await save('campaign-workflow-acceptance.json', {
    status: 'workflow-accepted',
    results,
    originalSourceAuditRequired: true,
    scope:
      'Sequential actual Console task workflows; full v1 requires original native source, action, checkpoint and video acceptance.',
  });
}
