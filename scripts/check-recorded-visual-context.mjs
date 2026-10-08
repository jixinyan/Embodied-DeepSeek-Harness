import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Session, SessionId, deriveEventMessage } from '@deepseek-ai/dsh-session';
import { LocalStore, SessionAudits } from '@edh/storage';
import { imageReferences } from '../harness/agent-runtime/memory/src/visual-history.ts';
import { createDshHost } from '../apps/server/src/runtime.ts';

const { values } = parseArgs({
  options: {
    'data-directory': { type: 'string', multiple: true },
    output: { type: 'string' },
  },
});
assert(values['data-directory']?.length && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
await mkdir(output, { recursive: false });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = [
  'apps/server/src/runtime.ts',
  'harness/agent-runtime/memory/src/context.ts',
  'harness/agent-runtime/memory/src/visual-history.ts',
  'harness/agent-runtime/memory/src/dsh/token-meter/index.ts',
  'harness/agent-runtime/agents/src/dsh/loop/agent.ts',
  'harness/agent-runtime/agents/src/dsh/loop/index.ts',
  'scripts/check-recorded-visual-context.mjs',
];
const implementation = await Promise.all(
  sourcePaths.map(async (path) => ({ path, sha256: hash(await readFile(resolve(root, path))) })),
);
const checks = [];
for (const [index, sourceDirectory] of values['data-directory'].entries()) {
  const source = resolve(sourceDirectory, 'records.jsonl');
  const sourceSha256 = hash(await readFile(source));
  const directory = resolve(output, `journal-${index}`);
  await mkdir(directory);
  await copyFile(source, resolve(directory, 'records.jsonl'));
  const store = new LocalStore(directory);
  let selected;
  try {
    const audits = new SessionAudits(store);
    for (const run of store.scan('run:')) {
      assert(['simulation', 'hardware'].includes(run.value.source));
      for (const audit of audits.read(run.value.id)) {
        const events = audit.value;
        const original = Session.create(SessionId(`visual-original-${index}`), events);
        const groups = original.surface.nodes.flatMap((seq) => {
          const event = original.eventAt(seq);
          const message = deriveEventMessage(event);
          const attachmentIds = message ? imageReferences(message.content) : [];
          return attachmentIds.length ? [{ seq, attachmentIds, event }] : [];
        });
        const batch = events.find(
          (event) =>
            event.type === 'user/message' && imageReferences(event.data.content).length > 1,
        );
        const text = events.find(
          (event) => event.type === 'user/message' && !imageReferences(event.data.content).length,
        );
        if (groups.length >= 3 && batch && text) {
          selected = { runId: run.value.id, audit: audit.key, events, groups, batch, text };
          break;
        }
      }
      if (selected) break;
    }
  } finally {
    store.close();
  }
  assert(
    selected,
    'The original journal requires three image groups and original image/text inputs.',
  );
  const originalSha256 = hash(JSON.stringify(selected.events));
  const batchImages = imageReferences(selected.batch.data.content).length;
  const originalImages = selected.groups.reduce(
    (sum, group) => sum + group.attachmentIds.length,
    0,
  );
  const cases = [];
  for (const mode of ['text-only', 'fresh-observation', 'fresh-over-budget']) {
    const budget = mode === 'fresh-over-budget' ? batchImages - 1 : batchImages * 2;
    assert(originalImages > budget);
    const host = await createDshHost([], {
      compaction: { auto: false },
      visualHistory: { maxImages: budget },
    });
    let handle;
    let sibling;
    const errors = [];
    try {
      handle = await host.agents.create({
        sessionId: SessionId(`visual-${index}-${mode}`),
        seed: selected.events,
      });
      sibling = await host.agents.create({
        sessionId: SessionId(`visual-${index}-${mode}-sibling`),
        seed: selected.events,
      });
      await Promise.all([handle.agent.whenIdle(), sibling.agent.whenIdle()]);
      const session = handle.agent.session;
      const before = session.snapshotEvents();
      const beforeSurface = [...session.surface.nodes];
      const siblingBefore = sibling.agent.session.snapshotEvents();
      handle.agent.ctx.on('agent/error', ({ error }) => errors.push(error));
      const incoming = mode === 'text-only' ? selected.text : selected.batch;
      handle.agent.followup(incoming.data);
      await handle.agent.whenIdle();
      const after = session.snapshotEvents();
      assert.deepEqual(after.slice(0, before.length), before);
      assert.deepEqual(sibling.agent.session.snapshotEvents(), siblingBefore);
      const appended = after.slice(before.length);
      const pruning = appended.filter((event) => event.type === 'edh/visual-history');
      assert.equal(errors.length, 1);
      assert.equal(appended.filter((event) => event.type === 'tool/call').length, 0);
      assert.equal(appended.filter((event) => event.type === 'assistant/attempt').length, 0);
      if (mode === 'fresh-over-budget') {
        assert.match(errors[0].message, /Fresh observation batch requires/);
        assert.equal(pruning.length, 0);
        assert.deepEqual([...session.surface.nodes], beforeSurface);
      } else {
        assert.match(errors[0].message, /has no provider\/model/);
        assert.equal(pruning.length, 1);
        const maintenance = pruning[0].data;
        assert.equal(maintenance.maxImages, budget);
        assert.equal(maintenance.incomingImages, mode === 'text-only' ? 0 : batchImages);
        assert(maintenance.omitted.length > 0);
        assert(maintenance.retainedImages <= budget);
        for (const group of selected.groups) {
          const omitted = maintenance.omitted.find((entry) => entry.originalSeq === group.seq);
          if (omitted) {
            assert.deepEqual(omitted.attachmentIds, group.attachmentIds);
            const replacement = session.eventAt(omitted.replacementSeq);
            assert.deepEqual(replacement.sourceEventSeqs, [group.seq]);
            assert.equal(imageReferences(deriveEventMessage(replacement).content).length, 0);
          } else {
            assert(session.surface.nodes.includes(group.seq));
            assert.deepEqual(
              imageReferences(deriveEventMessage(session.eventAt(group.seq)).content),
              group.attachmentIds,
            );
          }
        }
        const surfaceImages = session.surface.nodes.reduce(
          (sum, seq) =>
            sum + imageReferences(deriveEventMessage(session.eventAt(seq))?.content ?? []).length,
          0,
        );
        assert(surfaceImages <= budget);
        assert(
          appended.some(
            (event) =>
              event.type === 'user/message' &&
              JSON.stringify(event.data) === JSON.stringify(incoming.data),
          ),
        );
        const restored = Session.create(SessionId(`restored-${index}-${mode}`), after);
        assert.deepEqual([...restored.surface.nodes], [...session.surface.nodes]);
        const { logRevision, ...restoredMeasurement } = host.tokenMeter.measure(restored);
        const { logRevision: currentRevision, ...currentMeasurement } =
          host.tokenMeter.measure(session);
        assert.equal(logRevision, restored.seq);
        assert.equal(currentRevision, session.seq);
        assert.deepEqual(restoredMeasurement, currentMeasurement);
      }
      assert(
        appended.some((event) => event.type === 'turn/end' && event.data.reason.kind === 'error'),
      );
      const file = `${index}-${mode}.events.json`;
      await writeFile(resolve(output, file), JSON.stringify(after) + '\n', { flag: 'wx' });
      cases.push({
        mode,
        maxImages: budget,
        originalImages,
        incomingOriginalSeq: incoming.seq,
        originalError: { type: errors[0].constructor.name, message: errors[0].message },
        maintenance: pruning.map((event) => event.data),
        originalAuditPreserved: true,
        siblingContextUnchanged: true,
        replayedToolCalls: 0,
        modelAttempts: 0,
        eventsFile: file,
        eventsSha256: hash(JSON.stringify(after)),
      });
    } finally {
      const results = await Promise.allSettled([handle?.dispose(), sibling?.dispose()]);
      try {
        const failures = results
          .filter((result) => result.status === 'rejected')
          .map((result) => result.reason);
        if (failures.length)
          throw new AggregateError(failures, 'Native visual-context ownership release failed.');
        assert.equal(host.sessions.list().length, 0);
        assert.equal(host.agents.list().length, 0);
      } finally {
        await host.fiber.dispose();
      }
    }
  }
  assert.equal(hash(JSON.stringify(selected.events)), originalSha256);
  assert.equal(hash(await readFile(source)), sourceSha256);
  checks.push({
    source,
    sourceSha256,
    runId: selected.runId,
    audit: selected.audit,
    originalEvents: selected.events.length,
    originalSha256,
    sourceUnchanged: true,
    cases,
  });
}
for (const entry of implementation)
  assert.equal(hash(await readFile(resolve(root, entry.path))), entry.sha256);
const result = {
  implementation,
  checks,
  sourceJournals: checks.length,
  cases: checks.reduce((sum, check) => sum + check.cases.length, 0),
  nativeLoops: checks.length * 3,
  independentContexts: checks.length * 6,
  contextsReleased: true,
  originalAuditPreserved: true,
  replayedToolCalls: 0,
  modelAttempts: 0,
  modelCalls: 0,
  policyCalls: 0,
  environmentAllocations: 0,
  gpuJobs: 0,
  scope:
    'Native visual-history pre-step admission and original-journal replay; no model is registered or invoked.',
};
await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(result, null, 2) + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify({ output, cases: result.cases, modelCalls: 0, policyCalls: 0 }));
