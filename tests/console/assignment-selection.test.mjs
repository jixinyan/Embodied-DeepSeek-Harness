import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LocalStore } from '@edh/storage';
import { AssignmentHistory } from '@edh/tasks';
import { api } from '../../apps/console/public/api.js';
import { createAssignmentSelection } from '../../apps/console/public/assignment-details.js';
import { readAssignmentDetails } from '../../apps/server/src/assignment-view.js';
import { assertLocalRequest, HttpError } from '../../apps/server/src/local-http.js';
import { assignmentDocuments } from '../runtime/support/assignment-documents.js';

test('console archive selection loads stored details, cancels superseded reads and surfaces missing records', async () => {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/edh-assignment-selection-'));
  const store = new LocalStore(directory);
  const { state, assignment, validator } = await assignmentDocuments();
  const otherId = randomUUID();
  state.assignments[otherId] = {
    ...structuredClone(state.assignments[assignment.id]),
    id: otherId,
    sessionId: randomUUID(),
    brief: { ...assignment.brief, assignment_id: otherId },
    todos: [{ content: 'Read the repository README.', status: 'completed' }],
  };
  const history = new AssignmentHistory(store, validator);
  history.retain(state, assignment.id);
  history.retain(state, otherId);
  store.put(`run:${state.id}`, state, 0);
  const server = createServer((req, res) => {
    try {
      assertLocalRequest(req, server.address().port);
      const result = readAssignmentDetails(
        store,
        validator,
        state.id,
        new URL(req.url, 'http://localhost').searchParams,
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(error instanceof HttpError ? error.status : 500, {
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  let selection;
  try {
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    const base = `http://127.0.0.1:${server.address().port}`;
    let notify;
    let changes = 0;
    const errors = [];
    selection = createAssignmentSelection(
      (path, data, signal) => api(new URL(path, base).href, data, signal),
      () => {
        changes++;
        notify();
      },
      (message) => errors.push(message),
    );
    let completed = new Promise((done) => {
      notify = done;
    });
    assert.equal(selection.select(state.id, state.assignments[assignment.id]), undefined);
    assert.equal(selection.loading, true);
    assert.equal(selection.select(state.id, state.assignments[otherId]), undefined);
    await completed;
    assert.equal(changes, 1);
    assert.deepEqual(errors, []);
    const details = selection.select(state.id, state.assignments[otherId]);
    assert.equal(details.assignment.id, otherId);
    assert.equal(details.assignment.todos[0].content, 'Read the repository README.');
    assert.equal(selection.loading, false);
    assert.equal(selection.select(state.id, state.assignments[otherId]), details);
    selection.clear();
    assert.equal(selection.error, undefined);
    completed = new Promise((done) => {
      notify = done;
    });
    selection.select(state.id, { id: 'missing', detailsStored: true });
    await completed;
    assert.deepEqual(errors, ['Assignment not found in this run.']);
    assert.equal(selection.loading, false);
    assert.equal(selection.error, errors[0]);
    assert.equal(selection.select(state.id, { id: 'active', detailsStored: false }), undefined);
    assert.equal(selection.error, undefined);
    assert.equal(selection.loading, false);
  } finally {
    selection?.clear();
    await new Promise((done, reject) => server.close((error) => (error ? reject(error) : done())));
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
