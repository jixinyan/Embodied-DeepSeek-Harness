import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LocalStore } from '@edh/storage';
import type { UserClarification } from '@edh/tasks';
import { defineTool } from '@edh/tools';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { createDshSession } from '../../harness/agent-runtime/agents/src/runtime.js';
import {
  ClarificationConflict,
  UserClarifications,
  interruptClarifications,
  readClarification,
  replayClarificationResponse,
} from '../../apps/server/src/clarifications.js';

const question = () => ({
  assignmentId: randomUUID(),
  callId: randomUUID(),
  goalId: 'documentation:review.v1',
  attemptId: 'attempt-1',
  question: 'Which document should this review cover?',
  reason: 'The task does not identify a source document.',
  options: ['Project specification', 'Architecture guide'],
});
const response = () => ({ requestId: randomUUID(), text: 'Review the architecture guide.' });

async function openQuestions() {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/edh-clarifications-'));
  const store = new LocalStore(directory);
  const runId = randomUUID();
  const published: UserClarification[] = [];
  const service = new UserClarifications(store, runId, (record) => published.push(record));
  return {
    directory,
    store,
    runId,
    published,
    service,
    async close() {
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test('question identity is stable and repeated native calls cannot alter the question', async () => {
  const t = await openQuestions();
  try {
    const input = question();
    const first = t.service.request(input);
    const sequence = t.store.statistics().sequence;
    assert.deepEqual(t.service.request(input), first);
    assert.equal(t.store.statistics().sequence, sequence);
    assert.equal(t.published.length, 1);
    assert.throws(
      () => t.service.request({ ...input, question: 'Change the source?' }),
      ClarificationConflict,
    );
    assert.throws(() => t.service.request(question()), /pending question/);
    input.options.push('Unshared document');
    first.options.push('Changed return value');
    t.published[0]!.question = 'Changed subscriber value';
    const stored = readClarification(t.store, t.runId, first.id)!;
    assert.deepEqual(stored.options, ['Project specification', 'Architecture guide']);
    assert.equal(stored.question, 'Which document should this review cover?');
    assert.equal(stored.goalId, 'documentation:review.v1');
  } finally {
    await t.close();
  }
});

test('free-text answers persist once and only exact request retries receive the receipt', async () => {
  const t = await openQuestions();
  try {
    const request = question();
    const record = t.service.request(request);
    const answer = response();
    const accepted = t.service.answer(record.id, answer);
    assert.equal(accepted.replay, false);
    assert.equal(accepted.record.state, 'answered');
    assert.equal(accepted.record.delivery, 'queued');
    const sequence = t.store.statistics().sequence;
    assert.deepEqual(t.service.answer(record.id, answer), { ...accepted, replay: true });
    assert.equal(t.store.statistics().sequence, sequence);
    assert.throws(() => t.service.answer(record.id, response()), /different response/);
    assert.throws(
      () => t.service.answer(record.id, { ...answer, text: 'Changed answer' }),
      /different response/,
    );
    assert.throws(() => t.service.request(request), /already been resolved/);
    answer.text = 'Changed input';
    accepted.record.response!.text = 'Changed result';
    assert.equal(
      readClarification(t.store, t.runId, record.id)!.response!.text,
      'Review the architecture guide.',
    );
    const settled = t.service.delivered(record.id);
    assert.equal(settled.delivery, 'settled');
    assert.equal(settled.error, null);
    assert.throws(() => t.service.delivered(record.id), /no longer pending/);
    assert.equal(t.published.length, 3);
  } finally {
    await t.close();
  }
});

test('new questions and older delivery completion retain independent records', async () => {
  const t = await openQuestions();
  try {
    const first = t.service.request(question());
    t.service.answer(first.id, response());
    const second = t.service.request(question());
    t.service.delivered(first.id, 'Model adapter unavailable.');
    assert.equal(readClarification(t.store, t.runId, first.id)!.delivery, 'failed');
    assert.equal(readClarification(t.store, t.runId, second.id)!.state, 'pending');
    assert.throws(() => t.service.delivered(second.id), /no longer pending/);
    assert.throws(() => t.service.answer('a'.repeat(64), response()), /not found/);
  } finally {
    await t.close();
  }
});

test('cancellation is scoped to the requesting assignment and run', async () => {
  const t = await openQuestions();
  try {
    const first = t.service.request(question());
    const otherRun = new UserClarifications(t.store, randomUUID(), (record) =>
      t.published.push(record),
    );
    const other = otherRun.request(question());
    t.service.cancel('Assignment ended.', other.assignmentId);
    assert.equal(readClarification(t.store, t.runId, first.id)!.state, 'pending');
    t.service.cancel('Assignment ended.', first.assignmentId);
    assert.equal(readClarification(t.store, t.runId, first.id)!.state, 'cancelled');
    assert.equal(readClarification(t.store, otherRun.runId, other.id)!.state, 'pending');
    assert.throws(() => t.service.answer(first.id, response()), /no longer accepting/);
    const sequence = t.store.statistics().sequence;
    t.service.cancel('Repeated cancellation.');
    assert.equal(t.store.statistics().sequence, sequence);
  } finally {
    await t.close();
  }
});

test('journal reopen interrupts pending interactions while preserving accepted answers', async () => {
  const t = await openQuestions();
  try {
    const settled = t.service.request(question());
    const settledAnswer = response();
    t.service.answer(settled.id, settledAnswer);
    t.service.delivered(settled.id);
    const queued = t.service.request(question());
    const queuedAnswer = response();
    t.service.answer(queued.id, queuedAnswer);
    const pending = t.service.request(question());
    t.store.close();
    const reopened = new LocalStore(t.directory);
    try {
      interruptClarifications(reopened);
      assert.equal(readClarification(reopened, t.runId, settled.id)!.delivery, 'settled');
      assert.equal(readClarification(reopened, t.runId, pending.id)!.state, 'interrupted');
      const interrupted = readClarification(reopened, t.runId, queued.id)!;
      assert.equal(interrupted.state, 'answered');
      assert.equal(interrupted.delivery, 'interrupted');
      assert.deepEqual(interrupted.response, queuedAnswer);
      assert.deepEqual(replayClarificationResponse(interrupted, queuedAnswer), interrupted);
      assert.throws(
        () =>
          replayClarificationResponse(
            readClarification(reopened, t.runId, pending.id)!,
            response(),
          ),
        /no longer accepting/,
      );
      const sequence = reopened.statistics().sequence;
      interruptClarifications(reopened);
      assert.equal(reopened.statistics().sequence, sequence);
    } finally {
      reopened.close();
    }
  } finally {
    await t.close();
  }
});

test('invalid questions and answers fail before any publication', async () => {
  const t = await openQuestions();
  try {
    for (const input of [
      { ...question(), question: ' ' },
      { ...question(), reason: 'x'.repeat(12001) },
      { ...question(), goalId: 'goal\n' },
      { ...question(), options: ['same', ' same '] },
      { ...question(), options: ['x'.repeat(1001)] },
      { ...question(), options: Array.from({ length: 9 }, (_, i) => String(i)) },
      { ...question(), unrecognized: true },
    ])
      assert.throws(() => t.service.request(input));
    assert.equal(t.published.length, 0);
    assert.equal(t.store.statistics().sequence, 0);
    const record = t.service.request(question());
    for (const input of [
      { ...response(), requestId: 'invalid' },
      { ...response(), text: ' ' },
      { ...response(), text: 'x'.repeat(12001) },
      { ...response(), unrecognized: true },
    ])
      assert.throws(() => t.service.answer(record.id, input));
    assert.equal(readClarification(t.store, t.runId, record.id)!.state, 'pending');
    assert.equal(t.published.length, 1);
  } finally {
    await t.close();
  }
});

test('write exclusion prevents question or answer publication without changing durable state', async () => {
  const t = await openQuestions();
  try {
    const hold = t.store.holdWrites();
    try {
      assert.throws(() => t.service.request(question()), /writes are suspended/);
      assert.equal(t.published.length, 0);
    } finally {
      hold.release();
    }
    const record = t.service.request(question());
    const answerHold = t.store.holdWrites();
    try {
      assert.throws(() => t.service.answer(record.id, response()), /writes are suspended/);
      assert.deepEqual(readClarification(t.store, t.runId, record.id), record);
      assert.equal(t.published.length, 1);
    } finally {
      answerHold.release();
    }
  } finally {
    await t.close();
  }
});

test('persisted key, identity and lifecycle corruption fail when read', async () => {
  const t = await openQuestions();
  try {
    const record = t.service.request(question());
    const key = `clarification:${t.runId}:${record.id}`;
    for (const value of [
      { ...record, assignmentId: randomUUID() },
      { ...record, runId: randomUUID() },
      { ...record, state: 'answered' },
      { ...record, delivery: 'queued' },
      { ...record, error: 'Unexpected error state.' },
      { ...record, question: ` ${record.question}` },
      { ...record, options: ['duplicate', 'duplicate'] },
      { ...record, extra: true },
    ]) {
      t.store.put(key, value, t.store.get(key)!.version);
      assert.throws(() => readClarification(t.store, t.runId, record.id));
    }
  } finally {
    await t.close();
  }
});

test('native DSH dispatch publishes the question and carries the conclude-turn signal', async () => {
  const t = await openQuestions();
  const host = await createDshHost([]);
  try {
    const authored = question();
    const tool = defineTool({
      name: 'user__ask',
      description: 'Request the source document for an authored review task.',
      parameters: {
        question: { type: 'string', required: true },
        reason: { type: 'string', required: true },
        options: { type: 'array', items: { type: 'string' }, required: true },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      async execute(args, exec) {
        const record = t.service.request({ ...authored, ...args, callId: exec.callId });
        exec.concludeTurn();
        return { clarification: { ...record } };
      },
    });
    const handle = await createDshSession(host, {
      sessionId: randomUUID(),
      provider: 'openai-compatible',
      model: 'deployment-model',
      instructions: 'Review the document explicitly selected by the user.',
      tools: [tool],
    });
    const invoke = (args: Record<string, unknown>) =>
      host.tools.execute({
        agent: handle.agent,
        name: 'user__ask',
        callId: ToolCallId(authored.callId),
        arguments: args,
        signal: new AbortController().signal,
      });
    const rejected = await invoke({ question: 42, reason: authored.reason, options: [] });
    assert.equal(rejected.isError, true);
    assert.equal(t.published.length, 0);
    const result = await invoke({
      question: authored.question,
      reason: authored.reason,
      options: authored.options,
    });
    assert.equal(result.isError, false);
    assert.equal(result.concludesTurn, true);
    assert.equal(t.published.length, 1);
    assert.equal(t.published[0]!.callId, authored.callId);
    await handle.agent.whenIdle();
    await handle.dispose();
  } finally {
    await host.fiber.dispose();
    await t.close();
  }
});
