import assert from 'node:assert/strict';
import { LocalStore, SessionAudits } from '../../../harness/agent-runtime/storage/src/index.js';

const directory = process.argv[2]!;
let store = new LocalStore(directory);
try {
  for (let index = 0; index < 193; index++)
    store.put(`session-audit-event:run:agent:${index}`, { index, text: 'x'.repeat(512 * 1024) }, 0);
  store.put('session-audit:run:agent', { format: 'edh.session-audit.v1', count: 193 }, 0);
  store.close();
  store = new LocalStore(directory);
  const audits = new SessionAudits(store);
  assert.deepEqual(audits.index('run').sessions, [{ assignmentId: 'agent', eventTotal: 193 }]);
  let offset = 0;
  while (offset < 193) {
    const page = audits.page('run', 'agent', offset);
    assert.equal(page.events.length, 1);
    const event = page.events[0] as { index: number; text: string };
    assert.equal(event.index, offset);
    assert.equal(event.text.length, 512 * 1024);
    offset = page.throughOffset;
  }
  console.log(JSON.stringify({ events: offset, journalBytes: store.statistics().journalBytes }));
} finally {
  store.close();
}
