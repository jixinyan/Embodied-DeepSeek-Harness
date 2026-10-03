import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  Session,
  SessionId,
  ToolCallRecovery,
  interruptedTurnClosers,
  TOOL_NOT_STARTED,
  TOOL_OUTCOME_UNKNOWN,
  type SessionEvent,
} from '@deepseek-ai/dsh-session';
import { LocalStore, SessionAudits } from '@edh/storage';

const args = parseArgs({ options: { 'data-directory': { type: 'string' } } }).values;
if (!args['data-directory']) throw new Error('Provide an actual retained journal directory.');
const source = resolve(args['data-directory'], 'records.jsonl');
const digest = createHash('sha256')
  .update(await readFile(source))
  .digest('hex');
await mkdir('.local/work', { recursive: true });
const directory = await mkdtemp(resolve('.local/work/dsh-recovery-history-'));
await copyFile(source, resolve(directory, 'records.jsonl'));
const store = new LocalStore(directory);
const checks: Record<string, unknown>[] = [];
try {
  const audits = new SessionAudits(store);
  for (const run of store.scan<{ id: string }>('run:')) {
    for (const audit of audits.read(run.value.id)) {
      const events = audit.value as SessionEvent[];
      const balanced = new ToolCallRecovery();
      for (const event of events) balanced.observe(event);
      assert.deepEqual(balanced.results(), []);
      assert.deepEqual(interruptedTurnClosers(events), []);
      for (let index = 0; index < events.length; index++) {
        const event = events[index];
        if (event?.type !== 'tool/call') continue;
        const prefix = events.slice(0, index + 1);
        const recovery = new ToolCallRecovery();
        for (const retained of prefix) recovery.observe(retained);
        const pending = recovery.results();
        assert(
          pending.some(
            (result) =>
              result.data.message.source.callId === event.data.callId &&
              result.data.error?.code === TOOL_OUTCOME_UNKNOWN,
          ),
        );
        const requested = prefix.filter((entry) => entry.type === 'assistant/message').at(-1);
        assert(requested);
        const committed = prefix.filter((entry) => entry.type === 'tool/result');
        const restored = Session.create(SessionId(`retained-${run.value.id}-${index}`), [
          ...prefix,
          ...interruptedTurnClosers(prefix),
        ]);
        assert.deepEqual(restored.snapshotEvents().slice(0, prefix.length), prefix);
        for (const result of committed) assert.deepEqual(restored.eventAt(result.seq), result);
        for (const result of pending) {
          assert.equal(result.data.message.role, 'user');
          assert.equal(result.data.message.content[0]?.type, 'tool-result');
          assert([TOOL_OUTCOME_UNKNOWN, TOOL_NOT_STARTED].includes(result.data.error?.code ?? ''));
          const started = prefix.find(
            (entry) =>
              entry.type === 'tool/call' && entry.data.callId === result.data.message.source.callId,
          );
          assert.deepEqual(result.sourceEventSeqs, started ? [started.seq] : undefined);
          recovery.observe(result);
        }
        assert.deepEqual(recovery.results(), []);
        assert.deepEqual(interruptedTurnClosers(restored.snapshotEvents()), []);
        assert.equal(
          restored.snapshotEvents().filter((entry) => entry.type === 'tool/call').length,
          prefix.filter((entry) => entry.type === 'tool/call').length,
        );
        checks.push({
          audit: audit.key,
          callId: event.data.callId,
          tool: event.data.name,
          retainedThroughSeq: event.seq,
          completedResultsPreserved: committed.length,
          recoveryCodes: pending.map((result) => result.data.error?.code),
          physicalCallsReplayed: 0,
        });
      }
    }
  }
  assert(checks.length > 0, 'Actual journal has no native tool-call audit.');
  assert.equal(
    createHash('sha256')
      .update(await readFile(source))
      .digest('hex'),
    digest,
  );
  await writeFile(
    resolve(directory, 'acceptance.json'),
    JSON.stringify({ source, digest, directory, sourceUnchanged: true, checks }, null, 2),
  );
  process.stdout.write(`${JSON.stringify({ directory, nativeCalls: checks.length })}\n`);
} finally {
  store.close();
}
