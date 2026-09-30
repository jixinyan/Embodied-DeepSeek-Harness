import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Context } from '@deepseek-ai/cordis';
import { Sam31HttpClient, Yolo26HttpClient } from '@edh/perception';
import { LocalImageStore } from '@edh/storage';

const { values } = parseArgs({
  options: {
    image: { type: 'string' },
    prompt: { type: 'string' },
    output: { type: 'string' },
    sam: { type: 'string', default: 'http://127.0.0.1:8005' },
    yolo: { type: 'string', default: 'http://127.0.0.1:8006' },
  },
});
if (!values.image || !values.prompt || !values.output)
  throw new Error('Image, prompt and output arguments are required.');
const output = resolve(values.output);
await mkdir(output, { recursive: false });
const image = await readFile(values.image);
const signal = AbortSignal.timeout(600_000);
const segmentation = await new Sam31HttpClient(values.sam).segment({
  image,
  mediaType: 'image/png',
  textPrompt: values.prompt,
  signal,
});
if (!segmentation.instances.length)
  throw new Error('No native segmentation regions are available.');
const context = new Context();
await context.plugin(LocalImageStore, { directory: join(output, 'images') });
const images = context.attachments as LocalImageStore;
const report = [];
try {
  for (const instance of segmentation.instances) {
    const sourceHash = createHash('sha256').update(instance.maskPng).digest('hex');
    const reference = await images.saveImage({
      data: instance.maskPng,
      mediaType: 'image/png',
      name: `SAM region ${instance.objectId}`,
    });
    const stored = await images.readImage(reference, signal);
    if (
      reference.mediaType !== 'image/png' ||
      reference.attachmentId !== `sha256:${sourceHash}` ||
      !Buffer.from(stored.data).equals(Buffer.from(instance.maskPng))
    )
      throw new Error('Stored binary segmentation changed its encoding or pixels.');
    const depth = await new Yolo26HttpClient(values.yolo).estimate({
      image,
      mediaType: 'image/png',
      width: segmentation.width,
      height: segmentation.height,
      maskPng: stored.data,
      signal,
    });
    if (depth.selectedPixels !== instance.areaPixels)
      throw new Error('Stored-mask depth region differs from its binary segmentation.');
    await writeFile(join(output, `${instance.objectId}-stored-mask.png`), stored.data);
    report.push({
      objectId: instance.objectId,
      reference,
      maskSha256: sourceHash,
      sourceImageSha256: segmentation.sourceImageSha256,
      selectedPixels: depth.selectedPixels,
      validPixels: depth.validPixels,
      medianAxialDepthM: depth.medianAxialDepthM,
      byteIdenticalAfterStorage: true,
    });
  }
} finally {
  await context.fiber.dispose();
}
await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
