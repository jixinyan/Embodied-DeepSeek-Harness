import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { LocalStore } from '../../../harness/agent-runtime/storage/src/local-store.js';

const directory = process.argv[2];
if (!directory) throw new Error('Missing acceptance directory.');
let store = new LocalStore(directory);
try {
  for (let index = 0; index < 128; index++)
    store.put(`document:${index}`, { index, text: 'x'.repeat(512 * 1024) }, 0);
} finally {
  store.close();
}
store = new LocalStore(directory);
let count = 0;
try {
  for (const entry of store.scan<{ index: number; text: string }>('document:')) {
    assert.equal(entry.value.index, count++);
    assert.equal(entry.value.text.length, 512 * 1024);
  }
  assert.equal(count, 128);
} finally {
  store.close();
}
console.log(JSON.stringify({ count, journalBytes: statSync(`${directory}/records.jsonl`).size }));
