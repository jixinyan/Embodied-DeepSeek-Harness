import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ContractValidator } from '@edh/contracts';
import { SensorSamples } from '@edh/perception';
import { LocalStore } from '@edh/storage';

const { values } = parseArgs({
  options: {
    run: { type: 'string' },
    journal: { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values.run && values.journal && values.output, 'Required: --run, --journal, --output.');
const run = JSON.parse(await readFile(resolve(values.run), 'utf8'));
assert(['simulation', 'hardware'].includes(run.source), 'A native run source is required.');
assert(
  ['succeeded', 'failed', 'cancelled', 'unknown', 'interrupted'].includes(run.state),
  'Export requires a terminal run.',
);
const schemaPath = new URL('../harness/contracts/schema/physical.schema.json', import.meta.url);
const validator = new ContractValidator(JSON.parse(await readFile(schemaPath, 'utf8')));
const store = new LocalStore(resolve(values.journal));
try {
  const reader = new SensorSamples(store, validator, run.id, run.source);
  const samples = [];
  for (const record of store.scan('sensor-sample:')) {
    if (record.value.evidence.task_scope.task_id !== run.id) continue;
    const sample = reader.read(record.value.evidence.id);
    assert(sample, 'The immutable sensor record is missing.');
    samples.push(sample);
  }
  assert(samples.length, 'No native sensor samples exist for this run.');
  samples.sort((left, right) => left.sequence - right.sequence);
  for (let index = 1; index < samples.length; index++)
    assert(samples[index].sequence > samples[index - 1].sequence, 'Sensor sequences overlap.');
  await writeFile(resolve(values.output), `${JSON.stringify(samples, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ runId: run.id, source: run.source, samples: samples.length }));
} finally {
  store.close();
}
