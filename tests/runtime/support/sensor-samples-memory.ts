import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { ContractValidator } from '../../../harness/contracts/src/validation.js';
import { LocalStore } from '../../../harness/agent-runtime/storage/src/local-store.js';
import { SensorSamples } from '../../../harness/agent-runtime/perception/src/sensor-samples.js';

const directory = process.argv[2];
if (!directory) throw new Error('Missing acceptance directory.');
const validator = new ContractValidator(
  JSON.parse(readFileSync('harness/contracts/schema/physical.schema.json', 'utf8')),
);
let store = new LocalStore(directory);
const count = 1600;
try {
  const samples = new SensorSamples(store, validator, 'memory-documents', 'test_fixture');
  for (let sequence = 0; sequence < count; sequence++) {
    const sample = samples.retain({
      evidence: {
        id: `document-${sequence}`,
        kind: 'event',
        source: 'authored-metadata-document',
        created_at: '2026-09-20T00:00:00.000Z',
        observed_at: '2026-09-20T00:00:00.000Z',
        clock_id: 'document-clock',
        visibility: 'agent',
        task_scope: { task_id: 'document-task' },
      },
      sequence,
      source: 'test_fixture',
      description: `Authored document ${sequence}: ` + 'x'.repeat(60 * 1024),
      visualization: {},
    });
    assert.equal(samples.read(sample.evidence.id)!.sequence, sequence);
  }
} finally {
  store.close();
}
store = new LocalStore(directory);
try {
  const samples = new SensorSamples(store, validator, 'memory-documents', 'test_fixture');
  for (let sequence = 0; sequence < count; sequence++) {
    const sample = samples.read(`document-${sequence}`)!;
    assert.equal(sample.sequence, sequence);
    assert.equal(sample.description, `Authored document ${sequence}: ` + 'x'.repeat(60 * 1024));
  }
} finally {
  store.close();
}
console.log(JSON.stringify({ count, journalBytes: statSync(`${directory}/records.jsonl`).size }));
