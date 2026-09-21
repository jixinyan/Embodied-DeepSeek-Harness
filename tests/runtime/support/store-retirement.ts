import assert from 'node:assert/strict';
import { LocalStore } from '../../../harness/agent-runtime/storage/src/local-store.js';

const directory = process.argv[2];
if (!directory) throw new Error('Missing acceptance directory.');
let store = new LocalStore(directory);
for (let revision = 1; revision <= 2; revision++)
  for (let index = 0; index < 96; index++)
    store.put(`document:${index}`, { index, revision, text: 'x'.repeat(512 * 1024) }, revision - 1);
const before = store.statistics().journalBytes;
store.retire(
  Array.from({ length: 48 }, (_, index) => `document:${index * 2}`),
  192,
);
const after = store.statistics().journalBytes;
store.close();
store = new LocalStore(directory);
let records = 0;
const sequence = store.statistics().sequence;
try {
  for (let index = 0; index < 96; index++) {
    const record = store.get<{ index: number; revision: number; text: string }>(
      `document:${index}`,
    );
    if (index % 2 === 0) assert.equal(record, undefined);
    else {
      assert.equal(record!.version, 2);
      assert.equal(record!.value.index, index);
      assert.equal(record!.value.revision, 2);
      assert.equal(record!.value.text.length, 512 * 1024);
      records++;
    }
  }
} finally {
  store.close();
}
console.log(JSON.stringify({ records, sequence, before, after }));
