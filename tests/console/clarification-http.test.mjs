import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LocalStore } from '@edh/storage';
import { ZodError } from 'zod';
import { api } from '../../apps/console/public/api.js';
import {
  UserClarifications,
  ClarificationConflict,
  readClarification,
} from '../../apps/server/src/clarifications.js';
import { assertLocalRequest, HttpError, readJsonBody } from '../../apps/server/src/local-http.js';

test('console JSON transport preserves durable response identity and surfaces admission errors', async () => {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/edh-clarification-http-'));
  const store = new LocalStore(directory);
  const service = new UserClarifications(store, randomUUID(), () => {});
  const question = service.request({
    assignmentId: randomUUID(),
    callId: randomUUID(),
    goalId: 'documentation-review',
    attemptId: 'attempt-1',
    question: 'Which document should be reviewed?',
    reason: 'A source document is required to continue the review.',
    options: [],
  });
  const server = createServer((req, res) => {
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(value));
    };
    void (async () => {
      assertLocalRequest(req, server.address().port);
      if (req.method === 'GET')
        return json(200, { clarification: readClarification(store, service.runId, question.id) });
      const input = await readJsonBody(req, 96 * 1024);
      return json(202, service.answer(question.id, input));
    })().catch((error) => {
      json(
        error instanceof HttpError
          ? error.status
          : error instanceof ClarificationConflict
            ? 409
            : error instanceof ZodError
              ? 400
              : 500,
        { error: error.message },
      );
    });
  });
  try {
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${server.address().port}/response`;
    assert.equal((await api(url)).clarification.state, 'pending');
    await assert.rejects(api(url, { requestId: randomUUID(), text: ' ' }));
    const foreign = await fetch(url, { headers: { Origin: 'https://untrusted.example' } });
    assert.equal(foreign.status, 403);
    for (const [body, contentType, status] of [
      ['[]', 'application/json', 400],
      ['{', 'application/json', 400],
      ['{}', 'text/plain', 415],
      [JSON.stringify({ text: 'x'.repeat(100000) }), 'application/json', 413],
    ]) {
      const rejected = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
      });
      assert.equal(rejected.status, status);
      await rejected.text();
    }
    const request = { requestId: randomUUID(), text: '\u6587'.repeat(12000) };
    const hold = store.holdWrites();
    try {
      await assert.rejects(api(url, request), /writes are suspended/);
      assert.equal((await api(url)).clarification.state, 'pending');
    } finally {
      hold.release();
    }
    const accepted = await api(url, request);
    assert.equal(accepted.replay, false);
    assert.deepEqual(accepted.record.response, request);
    const sequence = store.statistics().sequence;
    assert.deepEqual(await api(url, request), { ...accepted, replay: true });
    assert.equal(store.statistics().sequence, sequence);
    await assert.rejects(api(url, { ...request, requestId: randomUUID() }), /different response/);
    assert.equal((await api(url)).clarification.delivery, 'queued');
  } finally {
    await new Promise((done, reject) => {
      server.close((error) => (error ? reject(error) : done()));
      server.closeIdleConnections();
    });
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
