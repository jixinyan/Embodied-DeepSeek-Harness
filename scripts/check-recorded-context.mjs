import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Session, SessionId } from '@deepseek-ai/dsh-session';
import { createScope } from '@deepseek-ai/dsh-scope';
import { LocalStore, SessionAudits } from '@edh/storage';
import { createDshHost } from '../apps/server/src/runtime.ts';

const { values } = parseArgs({
  options: {
    'data-directory': { type: 'string', multiple: true },
    output: { type: 'string' },
  },
});
assert(values['data-directory']?.length && values.output);
const output = resolve(values.output);
await mkdir(output, { recursive: false });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = [
  'apps/server/src/runtime.ts',
  'harness/agent-runtime/memory/src/context.ts',
  'harness/agent-runtime/memory/src/dsh/token-meter/index.ts',
  'harness/agent-runtime/foundation/src/dsh/scope/index.ts',
  'tsconfig.runtime.json',
];
const implementation = await Promise.all(
  sourceFiles.map(async (path) => ({ path, sha256: hash(await readFile(path)) })),
);
const host = await createDshHost([], { compaction: { auto: false } });
const checks = [];
let originalCalls = 0;
try {
  assert(host.tokenMeter && host.compaction);
  let readerContext;
  await host.inject(['sessions'], (context) => {
    readerContext = context;
  });
  assert(readerContext, 'Native Session service injection did not complete.');
  for (const [sourceIndex, sourceDirectory] of values['data-directory'].entries()) {
    const source = resolve(sourceDirectory, 'records.jsonl');
    const sourceHash = hash(await readFile(source));
    const directory = resolve(output, `journal-${sourceIndex}`);
    await mkdir(directory);
    await copyFile(source, resolve(directory, 'records.jsonl'));
    const store = new LocalStore(directory);
    const sessions = [];
    try {
      const audits = new SessionAudits(store);
      for (const run of store.scan('run:')) {
        assert.equal(run.key, `run:${run.value.id}`);
        assert(['simulation', 'hardware'].includes(run.value.source));
        for (const audit of audits.read(run.value.id)) {
          const events = audit.value;
          assert(events.length > 0);
          const firstUsage = events.find(
            (event) => event.type === 'assistant/message' || event.type === 'assistant/attempt',
          );
          assert(firstUsage, 'The original assignment has no native model settlement.');
          const originalHash = hash(JSON.stringify(events));
          const scopeA = createScope(readerContext, {});
          const scopeB = createScope(readerContext, {});
          const createdA = [];
          const createdB = [];
          const disposedA = [];
          const disposedB = [];
          scopeA.ctx.on('session/created', (session) => createdA.push(session.id));
          scopeB.ctx.on('session/created', (session) => createdB.push(session.id));
          scopeA.ctx.on('session/disposed', (session) => disposedA.push(session.id));
          scopeB.ctx.on('session/disposed', (session) => disposedB.push(session.id));
          const id = `${sourceIndex}-${audit.key.replaceAll(':', '-')}`;
          let sessionA;
          let sessionB;
          let measurement;
          let projection;
          let prefixes;
          try {
            sessionA = scopeA.ctx.sessions.create(SessionId(`${id}-reader-a`), { seed: events });
            sessionB = scopeB.ctx.sessions.create(SessionId(`${id}-reader-b`), { seed: events });
            assert.deepEqual(createdA, [sessionA.id]);
            assert.deepEqual(createdB, [sessionB.id]);
            assert.notEqual(sessionA, sessionB);
            assert.notEqual(sessionA.id, sessionB.id);
            assert.deepEqual(sessionA.snapshotEvents().slice(0, events.length), events);
            assert.deepEqual(sessionB.snapshotEvents().slice(0, events.length), events);
            measurement = host.tokenMeter.measure(sessionA);
            assert.equal(measurement.logRevision, sessionA.seq);
            assert.equal(
              measurement.surfaceTokens,
              measurement.nodes.reduce((sum, n) => sum + n.tokens, 0),
            );
            assert(Number.isSafeInteger(measurement.totalTokens) && measurement.totalTokens > 0);
            assert(Object.isFrozen(measurement) && Object.isFrozen(measurement.nodes));
            assert.deepEqual(host.tokenMeter.measure(sessionB), measurement);
            assert.deepEqual(host.tokenMeter.measure(sessionA), measurement);
            assert.notEqual(host.tokenMeter.measure(sessionA), measurement);
            projection = host.sessionProjections.snapshot(sessionA, [
              'tokenUsage',
              'contextPressure',
              'contextBreakdown',
            ]);
            assert.equal(projection.asOfSeq, sessionA.seq - 1);
            assert.deepEqual(
              host.sessionProjections.snapshot(sessionB, Object.keys(projection.values)),
              projection,
            );
            assert.deepEqual(Object.keys(projection.values).sort(), [
              'contextBreakdown',
              'contextPressure',
              'tokenUsage',
            ]);
            const usage = projection.values.tokenUsage;
            assert(usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens > 0);
            prefixes = [];
            for (const length of [
              ...new Set([firstUsage.seq + 1, Math.ceil(events.length / 2), events.length]),
            ]) {
              const prefix = Session.create(
                SessionId(`${id}-prefix-${length}`),
                events.slice(0, length),
              );
              const prefixMeasurement = host.tokenMeter.measure(prefix);
              assert.equal(prefixMeasurement.logRevision, prefix.seq);
              assert.deepEqual(host.tokenMeter.measure(prefix), prefixMeasurement);
              assert.deepEqual(host.tokenMeter.measure(sessionA), measurement);
              assert.deepEqual(
                host.sessionProjections.snapshot(sessionA, Object.keys(projection.values)),
                projection,
              );
              prefixes.push({ originalEvents: length, measurement: prefixMeasurement });
            }
          } finally {
            await scopeA.dispose();
            await scopeB.dispose();
          }
          assert.deepEqual(disposedA, [sessionA.id]);
          assert.deepEqual(disposedB, [sessionB.id]);
          assert.equal(host.sessions.get(sessionA.id), undefined);
          assert.equal(host.sessions.get(sessionB.id), undefined);
          assert.equal(hash(JSON.stringify(events)), originalHash);
          const toolCalls = events.filter((event) => event.type === 'tool/call').length;
          originalCalls += toolCalls;
          sessions.push({
            audit: audit.key,
            originalEvents: events.length,
            originalSha256: originalHash,
            originalToolCalls: toolCalls,
            measurement,
            projection,
            prefixes,
            scopedCreation: { a: createdA, b: createdB },
            scopedDisposal: { a: disposedA, b: disposedB },
          });
        }
      }
      assert(sessions.length > 0, 'The original journal has no native Session audits.');
    } finally {
      store.close();
    }
    assert.equal(hash(await readFile(source)), sourceHash);
    checks.push({ source, sourceSha256: sourceHash, sourceUnchanged: true, sessions });
  }
  assert.equal(host.sessions.list().length, 0);
} finally {
  await host.fiber.dispose();
}
for (const source of implementation) assert.equal(hash(await readFile(source.path)), source.sha256);
const result = {
  implementation,
  checks,
  sourceJournals: checks.length,
  nativeAssignments: checks.reduce((sum, check) => sum + check.sessions.length, 0),
  originalToolCalls: originalCalls,
  replayedToolCalls: 0,
  modelCalls: 0,
  policyCalls: 0,
  environmentAllocations: 0,
  scopesReleased: true,
  hostDisposed: true,
  imagePricing: 'Native fixed heuristic; no model adapter is registered by this CPU reader.',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ output, assignments: result.nativeAssignments, originalCalls })}\n`,
);
