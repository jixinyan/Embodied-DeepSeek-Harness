import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { LocalStore } from '../../../harness/agent-runtime/storage/src/local-store.js';
import { RunHistory } from '../../../harness/agent-runtime/tasks/src/history.js';
import type { RunState } from '../../../harness/agent-runtime/tasks/src/run-state.js';

const directory = process.argv[2];
if (!directory) throw new Error('Missing acceptance directory.');
const state: RunState = {
  id: 'publication-memory',
  instruction: 'Record and read history acceptance documents.',
  scenario: 'history-publication',
  source: 'test_fixture',
  state: 'running',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  teamDigest: 'history-publication',
  teamId: 'history-publication',
  decisionAssignmentId: '',
  attempt: 1,
  recoveryId: null,
  retryChanges: [],
  assignments: {},
  events: [],
  eventCount: 0,
  executions: [],
  requests: [],
  verdicts: [],
  latestSensor: null,
  agentSeen: {},
  skillIds: [],
  error: null,
};
let store = new LocalStore(directory);
try {
  const history = new RunHistory(store);
  let version = 0;
  for (let index = 1; index <= 4097; index++) {
    ({ version } = history.append(state, version, 'user.note', {
      index,
      text: String(index) + 'x'.repeat(20 * 1024),
    }));
    assert.equal(state.eventCount, index);
    assert.equal(state.events.length, 0);
  }
  assert.equal(state.state, 'running');
} finally {
  store.close();
}
store = new LocalStore(directory);
let count = 0;
try {
  const persisted = store.get<RunState>(`run:${state.id}`)!.value;
  assert.deepEqual(persisted, state);
  const history = new RunHistory(store);
  while (count < history.total(persisted)) {
    const page = history.page(persisted, count);
    for (const event of page.events) {
      assert.equal(event.sequence, ++count);
      assert.deepEqual(event.detail, { index: count, text: String(count) + 'x'.repeat(20 * 1024) });
    }
    assert.equal(page.throughSequence, count);
  }
  assert.equal(count, 4097);
} finally {
  store.close();
}
console.log(JSON.stringify({ count, journalBytes: statSync(`${directory}/records.jsonl`).size }));
