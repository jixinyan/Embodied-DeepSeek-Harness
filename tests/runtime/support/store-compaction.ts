import assert from 'node:assert/strict';
import { LocalStore } from '../../../harness/agent-runtime/storage/src/local-store.js';

const directory = process.argv[2];
if (!directory) throw new Error('Missing acceptance directory.');
let store = new LocalStore(directory);
for (let revision = 1; revision <= 2; revision++)
  for (let index = 0; index < 96; index++)
    store.put(`document:${index}`, { index, revision, text: 'x'.repeat(512 * 1024) }, revision - 1);
const before = store.statistics().journalBytes;
store.compact();
const after = store.statistics().journalBytes;
assert.ok(after < before);
store.close();
store = new LocalStore(directory);
let records = 0;
try {
  for (const record of store.scan<{ index: number; revision: number; text: string }>('document:')) {
    assert.equal(record.version, 2);
    assert.equal(record.value.index, records++);
    assert.equal(record.value.revision, 2);
    assert.equal(record.value.text.length, 512 * 1024);
  }
} finally {
  store.close();
}
console.log(JSON.stringify({ records, before, after }));
