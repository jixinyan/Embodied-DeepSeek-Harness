import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { auditNativeCampaignTask, nativeCampaignSchema } from './native-campaign.mjs';

const { values } = parseArgs({
  options: {
    manifest: { type: 'string' },
    case: { type: 'string' },
    directory: { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values.manifest && values.case && values.directory && values.output);
const sources = [];
const read = async (path) => {
  const bytes = await readFile(path);
  sources.push({ path: resolve(path), sha256: createHash('sha256').update(bytes).digest('hex') });
  return JSON.parse(bytes.toString('utf8'));
};
const manifest = nativeCampaignSchema.parse(await read(values.manifest));
const item = manifest.cases.find((item) => item.id === values.case);
assert(item, `Case missing from manifest: ${values.case}`);
const directory = resolve(values.directory);
const session = await read(resolve(directory, 'session.json'));
const closed = await read(resolve(directory, 'closed.json'));
assert.equal(closed.id, session.id);
assert.equal(closed.resources, 'released');
const results = [];
for (const [index, expectation] of item.tasks.entries()) {
  const taskDirectory = resolve(directory, `task-${index + 1}`);
  const run = await read(resolve(taskDirectory, 'run.json'));
  const events = await read(resolve(taskDirectory, 'events.json'));
  assert.equal(run.userSessionId, session.id);
  results.push(auditNativeCampaignTask(run, events, expectation));
}
const output = resolve(values.output);
const workRoot = fileURLToPath(new URL('../.local/work/', import.meta.url));
const childPath = relative(workRoot, output);
assert(
  childPath && !isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`),
);
await mkdir(dirname(output), { recursive: true });
const report = {
  case: item.id,
  sessionId: session.id,
  resources: 'released',
  results,
  sources,
  newModelInferencePerformed: false,
  newPhysicalControlsPerformed: false,
  originalSourceAuditRequired: true,
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(report));
