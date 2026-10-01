import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    attachments: { type: 'string' },
    audit: { type: 'string' },
    output: { type: 'string' },
    'observation-only': { type: 'boolean', default: false },
  },
});
for (const name of ['source', 'attachments', 'audit', 'output']) {
  if (!values[name]) throw new Error(`--${name} is required.`);
}
const source = resolve(values.source);
const objects = resolve(values.attachments, 'v1/objects');
const output = resolve(values.output);
const runBytes = await readFile(join(source, 'run.json'));
const eventBytes = await readFile(join(source, 'events.json'));
const run = JSON.parse(runBytes);
const events = JSON.parse(eventBytes);
const auditBytes = await readFile(resolve(values.audit));
const audit = JSON.parse(auditBytes);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (audit.runId !== run.id || !events.length) throw new Error('Audit and run identity differ.');
if (values['observation-only']) {
  if (
    run.state !== 'running' ||
    run.executions.length ||
    run.clarification?.state !== 'pending' ||
    audit.nativeToolErrors !== 0 ||
    audit.physicalControls !== 0 ||
    audit.resources !== 'released'
  ) {
    throw new Error('The source must be an audited pre-motion user-wait snapshot.');
  }
} else if (
  !['succeeded', 'failed'].includes(run.state) ||
  audit.state !== run.state ||
  audit.checkedEvents !== events.length ||
  audit.observedInvariants !== 'passed'
) {
  throw new Error('The source must match a passed native terminal workflow audit.');
}
for (let index = 0; index < events.length; index++) {
  const event = events[index];
  if (
    event.sequence !== index + 1 ||
    !Number.isFinite(Date.parse(event.at)) ||
    (index && Date.parse(event.at) < Date.parse(events[index - 1].at))
  ) {
    throw new Error('Recorded event sequence or timestamps are invalid.');
  }
}
await mkdir(output, { recursive: true });
if ((await readdir(output)).length) throw new Error('Replay output must be an empty directory.');
await mkdir(join(output, 'source'));
await mkdir(join(output, 'images'));
await writeFile(join(output, 'source/run.json'), runBytes);
await writeFile(join(output, 'source/events.json'), eventBytes);
await writeFile(join(output, 'source/audit.json'), auditBytes);
const frames = [];
const copied = new Set();
async function retainImage(image, event, kind) {
  if (!/^sha256:[a-f0-9]{64}$/.test(image.attachmentId))
    throw new Error('Invalid attachment identity.');
  const hash = image.attachmentId.slice(7);
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[
    image.mediaType
  ];
  if (!extension) throw new Error(`Unsupported recorded image type: ${image.mediaType}`);
  const original = join(objects, hash.slice(0, 2), hash);
  const bytes = await readFile(original);
  if (digest(bytes) !== hash || bytes.length !== image.bytes || !image.width || !image.height) {
    throw new Error('Recorded attachment bytes differ from their immutable reference.');
  }
  const file = `images/${hash}.${extension}`;
  if (!copied.has(file)) {
    await copyFile(original, join(output, file));
    copied.add(file);
  }
  frames.push({ kind, file, eventAt: event.at, eventSequence: event.sequence, image });
}
for (const event of events) {
  if (event.type === 'tool.completed' && event.detail.tool === 'perception.capture') {
    for (const image of event.detail.result.images)
      await retainImage(image, event, 'agent.observation');
  }
  if (values['observation-only'] && event.type === 'dsh.tool-result') {
    for (const block of event.detail.data.message.content) {
      if (block.type === 'tool-result') {
        for (const result of block.content) {
          if (result.type === 'image' && /overlay/i.test(result.attachment.name)) {
            await retainImage(result.attachment, event, 'tool.evidence');
          }
        }
      }
    }
  }
}
if (!frames.length) throw new Error('No original recorded observation attachments were retained.');
const manifest = {
  format: 'edh.recorded-replay.v1',
  runId: run.id,
  eventCount: events.length,
  videos: [],
  scope: values['observation-only']
    ? 'pre-motion grounding, awaiting user'
    : 'terminal native task workflow',
  sourceSha256: { run: digest(runBytes), events: digest(eventBytes), audit: digest(auditBytes) },
  retainedImages: frames.length,
  uniqueImageObjects: copied.size,
};
await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(join(output, 'frames.json'), `${JSON.stringify(frames, null, 2)}\n`);
console.log(JSON.stringify(manifest));
