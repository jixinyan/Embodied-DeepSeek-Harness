import { isDeepStrictEqual } from 'node:util';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { ContractValidator } from '@edh/contracts';
import type { SensorSample } from '@edh/execution';
import type { LocalStore } from '@edh/storage';
import { admitSensorSample } from './sensor-sample.js';

export class SensorSamples {
  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
    private readonly runId: string,
    private readonly source: SensorSample['source'],
  ) {
    if (
      typeof runId !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/.test(runId) ||
      !['test_fixture', 'simulation', 'hardware'].includes(source)
    )
      throw new Error('Invalid sensor catalog identity or source.');
  }

  private key(kind: 'sample' | 'image', id: string): string {
    if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/.test(id))
      throw new Error('Invalid sensor record identity.');
    return `sensor-${kind}:${JSON.stringify([this.runId, id])}`;
  }

  read(id: string): SensorSample | undefined {
    const record = this.store.get<SensorSample>(this.key('sample', id));
    if (!record) return undefined;
    const sample = admitSensorSample(this.validator, record.value, this.source);
    if (record.version !== 1 || sample.evidence.id !== id)
      throw new Error('Invalid immutable sensor record.');
    for (const image of sample.images ?? []) {
      const saved = this.store.get<ImageAttachmentRef>(this.key('image', image.attachmentId));
      if (!saved || saved.version !== 1 || !isDeepStrictEqual(saved.value, image))
        throw new Error('Sensor record has inconsistent attachment metadata.');
    }
    return sample;
  }

  retain(input: SensorSample): SensorSample {
    const sample = JSON.parse(
      JSON.stringify(admitSensorSample(this.validator, input, this.source)),
    ) as SensorSample;
    const previous = this.read(sample.evidence.id);
    if (previous && !isDeepStrictEqual(previous, sample))
      throw new Error('An immutable evidence ID cannot be rebound to another sensor sample.');
    const additions: ImageAttachmentRef[] = [];
    for (const image of sample.images ?? []) {
      const saved = this.store.get<ImageAttachmentRef>(this.key('image', image.attachmentId));
      if (saved && (saved.version !== 1 || !isDeepStrictEqual(saved.value, image)))
        throw new Error('An immutable attachment ID cannot be rebound to different metadata.');
      if (!saved) additions.push(image);
    }
    for (const image of additions) this.store.put(this.key('image', image.attachmentId), image, 0);
    if (!previous) this.store.put(this.key('sample', sample.evidence.id), sample, 0);
    return sample;
  }
}
