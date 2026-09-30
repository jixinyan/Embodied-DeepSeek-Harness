import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Sam31HttpClient, Yolo26HttpClient } from '@edh/perception';

const { values } = parseArgs({
  options: {
    image: { type: 'string' },
    prompt: { type: 'string' },
    width: { type: 'string' },
    height: { type: 'string' },
    output: { type: 'string' },
    sam: { type: 'string', default: 'http://127.0.0.1:8005' },
    yolo: { type: 'string', default: 'http://127.0.0.1:8006' },
  },
});
if (!values.image || !values.prompt || !values.output || !values.width || !values.height)
  throw new Error('Image, prompt, output, width and height arguments are required.');
const width = Number(values.width);
const height = Number(values.height);
if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1)
  throw new Error('Source dimensions must be positive integers.');
const image = await readFile(values.image);
const sam = new Sam31HttpClient(values.sam);
const yolo = new Yolo26HttpClient(values.yolo);
const reports = [];
await mkdir(values.output, { recursive: true });
for (const phase of ['cold', 'warm']) {
  const started = performance.now();
  const segmentation = await sam.segment({
    image,
    mediaType: 'image/png',
    textPrompt: values.prompt,
    signal: AbortSignal.timeout(600_000),
  });
  if (
    segmentation.width !== width ||
    segmentation.height !== height ||
    !segmentation.instances.length
  )
    throw new Error('Segmentation returned no source-sized instances.');
  await writeFile(join(values.output, `${phase}-segmentation.png`), segmentation.overlayPng);
  const instances = [];
  for (const instance of segmentation.instances) {
    const depth = await yolo.estimate({
      image,
      mediaType: 'image/png',
      width,
      height,
      maskPng: instance.maskPng,
      roiXyxy: instance.bboxXyxy,
      signal: AbortSignal.timeout(600_000),
    });
    if (depth.selectedPixels !== instance.areaPixels)
      throw new Error('Depth region differs from the SAM mask area.');
    await writeFile(
      join(values.output, `${phase}-${instance.objectId}-mask.png`),
      instance.maskPng,
    );
    await writeFile(join(values.output, `${phase}-${instance.objectId}-depth.npy`), depth.depthNpy);
    await writeFile(
      join(values.output, `${phase}-${instance.objectId}-depth.png`),
      depth.overlayPng,
    );
    const { depthNpy, overlayPng, ...depthReport } = depth;
    instances.push({
      objectId: instance.objectId,
      score: instance.score,
      bboxXyxy: instance.bboxXyxy,
      areaPixels: instance.areaPixels,
      depth: depthReport,
    });
  }
  const report = {
    phase,
    elapsedMs: performance.now() - started,
    sourceImageSha256: segmentation.sourceImageSha256,
    samSourceRevision: segmentation.sourceRevision,
    samCheckpointSha256: segmentation.checkpointSha256,
    samSessionId: segmentation.sessionId,
    instances,
  };
  reports.push(report);
  console.log(JSON.stringify(report));
}
if (reports[0]!.samSessionId === reports[1]!.samSessionId)
  throw new Error('Independent segmentation calls reused a SAM session.');
await writeFile(join(values.output, 'result.json'), JSON.stringify(reports, null, 2));
