import { isAbsolute, join, parse, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Context } from '@deepseek-ai/cordis';
import {
  AttachmentStore,
  AttachmentId,
  type ImageAttachmentRef,
  type ImageRequestPolicy,
  type RequestImageAttachment,
  type SaveImageAttachment,
} from '@deepseek-ai/dsh-attachment';
import { z } from 'zod';
import {
  ImageMaintenanceConflict,
  inspectImageFiles,
  clearRequestImageFiles,
  clearUnreferencedImageFiles,
  inspectRetainedImageFiles,
  type ImageStorageInspection,
  type ImageCacheCleanup,
  type ImageObjectCleanup,
  type ImageObjectInspection,
} from './image-maintenance.js';
import { CompressionLimiter } from './dsh/attachment-local/compression-limiter.ts';
import { detectImage } from './dsh/attachment-local/image.ts';
import { readRequestImageFile } from './dsh/attachment-local/request-image.ts';
import {
  commitPreparedImageFile,
  normalizedImagePath,
  prepareImageFile,
  readImageFile,
} from './dsh/attachment-local/store.ts';

const positive = (maximum: number, value: number) =>
  z.number().int().positive().max(maximum).default(value);
const optionsSchema = z
  .object({
    directory: z.string().min(1).refine(isAbsolute),
    maxImageBytes: positive(32 * 1024 * 1024, 20 * 1024 * 1024),
    maxImagesPerMessage: positive(16, 16),
    maxMessageImageBytes: positive(128 * 1024 * 1024, 64 * 1024 * 1024),
    maxImagePixels: positive(64_000_000, 64_000_000),
    maxImageDimension: positive(65536, 8192),
    normalizedImageMaxPixels: positive(64_000_000, 2048 * 2048),
    normalizedImageMaxDimension: positive(65536, 8192),
    normalizedImageMaxBytes: positive(32 * 1024 * 1024, 4 * 1024 * 1024),
    imageCompressionConcurrency: positive(8, 2),
    maxPendingOperations: positive(1024, 32),
  })
  .strict();

export type LocalImageOptions = z.input<typeof optionsSchema>;
export interface LosslessMaskStore {
  saveMaskPng(input: SaveImageAttachment): Promise<ImageAttachmentRef>;
}
const retainedIds = z.array(
  z
    .string()
    .length(71)
    .regex(/^sha256:[a-f0-9]{64}$/),
);

export class LocalImageStore extends AttachmentStore {
  readonly root: string;
  readonly imageLimits;
  readonly normalizationPolicy;
  private readonly compression: CompressionLimiter;
  private readonly maxPending: number;
  private readonly pending = new Set<Promise<unknown>>();
  private closed = false;
  private readonly instanceId = randomUUID();
  private revision = 0n;
  private writers = 0;
  private inspections = 0;
  private maintaining = false;
  private collectingObjects = false;

  private revisionToken(): string {
    return `${this.instanceId}:${this.revision}`;
  }

  private async mutation<T>(run: () => Promise<T>): Promise<T> {
    if (this.closed) throw new Error('Image storage is closed.');
    if (this.maintaining)
      throw new ImageMaintenanceConflict('Image storage maintenance is in progress.');
    this.writers++;
    this.revision++;
    try {
      return await this.operation(run);
    } finally {
      this.writers--;
      this.revision++;
    }
  }

  constructor(ctx: Context, options: LocalImageOptions) {
    const config = optionsSchema.parse(options);
    if (resolve(config.directory) === parse(config.directory).root)
      throw new Error('Image storage requires a dedicated directory.');
    super(ctx);
    this.root = join(resolve(config.directory), 'attachments', 'v1');
    this.imageLimits = Object.freeze({
      maxImageBytes: config.maxImageBytes,
      maxImagesPerMessage: config.maxImagesPerMessage,
      maxMessageImageBytes: config.maxMessageImageBytes,
      maxImagePixels: config.maxImagePixels,
      maxImageDimension: config.maxImageDimension,
      mediaTypes: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const),
    });
    this.normalizationPolicy = Object.freeze({
      maxPixels: config.normalizedImageMaxPixels,
      maxDimension: config.normalizedImageMaxDimension,
      maxBytes: config.normalizedImageMaxBytes,
    });
    this.compression = new CompressionLimiter(config.imageCompressionConcurrency);
    this.maxPending = config.maxPendingOperations;
    ctx.effect(() => async () => {
      this.closed = true;
      const results = await Promise.allSettled([...this.pending]);
      const failures = results.flatMap((result) =>
        result.status === 'rejected' ? [result.reason] : [],
      );
      if (failures.length) throw new AggregateError(failures, 'Image storage shutdown failed.');
    });
  }

  private async operation<T>(run: () => Promise<T>): Promise<T> {
    if (this.closed) throw new Error('Image storage is closed.');
    if (this.pending.size >= this.maxPending)
      throw new Error('Image storage operation limit reached.');
    const operation = run();
    this.pending.add(operation);
    try {
      return await operation;
    } finally {
      this.pending.delete(operation);
    }
  }

  private snapshot(inputs: readonly SaveImageAttachment[]): SaveImageAttachment[] {
    this.validateImageBatch(inputs);
    for (const input of inputs) {
      if (
        !(input.data instanceof Uint8Array) ||
        input.data.byteLength > this.imageLimits.maxImageBytes
      )
        throw new Error('Image input exceeds the configured byte limit or has invalid bytes.');
      if (input.name !== undefined && (typeof input.name !== 'string' || input.name.length > 256))
        throw new Error('Invalid image display name.');
    }
    return inputs.map((input) => ({
      data: new Uint8Array(input.data),
      mediaType: input.mediaType,
      ...(input.name === undefined ? {} : { name: input.name }),
    }));
  }

  async validateImage(input: SaveImageAttachment): Promise<void> {
    await this.operation(async () => {
      const [copy] = this.snapshot([input]);
      await this.compression.run(() =>
        prepareImageFile(copy!, this.imageLimits, this.normalizationPolicy),
      );
    });
  }

  override async saveImages(inputs: readonly SaveImageAttachment[]): Promise<ImageAttachmentRef[]> {
    return this.mutation(async () => {
      const copies = this.snapshot(inputs);
      const prepared = await this.compression.run(async () => {
        const images = [];
        for (const input of copies)
          images.push(await prepareImageFile(input, this.imageLimits, this.normalizationPolicy));
        return images;
      });
      const refs = [];
      for (const image of prepared) refs.push(await commitPreparedImageFile(this.root, image));
      return refs;
    });
  }

  async saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef> {
    return (await this.saveImages([input]))[0]!;
  }

  async saveMaskPng(input: SaveImageAttachment): Promise<ImageAttachmentRef> {
    return this.mutation(async () => {
      const [copy] = this.snapshot([input]);
      if (copy!.mediaType !== 'image/png') throw new Error('Mask storage requires PNG input.');
      const metadata = await this.compression.run(() =>
        detectImage(copy!.data, {
          maxPixels: this.imageLimits.maxImagePixels,
          maxDimension: this.imageLimits.maxImageDimension,
        }),
      );
      if (metadata.mediaType !== 'image/png' || metadata.animated || metadata.carriesMetadata)
        throw new Error(
          'Mask storage requires a single-frame PNG without orientation or metadata.',
        );
      const digest = createHash('sha256').update(copy!.data).digest('hex');
      return commitPreparedImageFile(this.root, {
        data: copy!.data,
        ref: {
          attachmentId: AttachmentId(`sha256:${digest}`),
          mediaType: 'image/png',
          width: metadata.width,
          height: metadata.height,
          bytes: copy!.data.byteLength,
          ...(copy!.name === undefined ? {} : { name: copy!.name }),
        },
      });
    });
  }

  async readImage(ref: ImageAttachmentRef, signal?: AbortSignal) {
    if (this.collectingObjects)
      throw new ImageMaintenanceConflict('Original image collection is in progress.');
    return this.operation(() => readImageFile(this.root, structuredClone(ref), signal));
  }

  override imageHostPath(ref: ImageAttachmentRef): string {
    if (this.collectingObjects)
      throw new ImageMaintenanceConflict('Original image collection is in progress.');
    return normalizedImagePath(this.root, ref);
  }

  override async readImageRequest(
    ref: ImageAttachmentRef,
    policy: ImageRequestPolicy,
    signal?: AbortSignal,
  ): Promise<RequestImageAttachment> {
    return this.mutation(async () => {
      signal?.throwIfAborted();
      const reference = structuredClone(ref);
      const requestPolicy = structuredClone(policy);
      return this.compression.run(async () => {
        signal?.throwIfAborted();
        const stored = await readImageFile(this.root, reference, signal);
        return readRequestImageFile(this.root, stored, requestPolicy, signal);
      });
    });
  }

  async inspectStorage(signal?: AbortSignal): Promise<ImageStorageInspection> {
    return this.operation(async () => {
      signal?.throwIfAborted();
      const revision = this.revisionToken();
      if (this.maintaining || this.writers) return { state: 'busy', revision };
      this.inspections++;
      try {
        const inspection = await inspectImageFiles(this.root, revision, signal);
        if (this.writers || revision !== this.revisionToken())
          return { state: 'busy', revision: this.revisionToken() };
        return inspection;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' && revision !== this.revisionToken())
          return { state: 'busy', revision: this.revisionToken() };
        throw error;
      } finally {
        this.inspections--;
      }
    });
  }

  async clearRequestCache(revision: string, signal?: AbortSignal): Promise<ImageCacheCleanup> {
    if (this.closed) throw new Error('Image storage is closed.');
    signal?.throwIfAborted();
    if (this.maintaining || this.writers || this.inspections)
      throw new ImageMaintenanceConflict('Image operations are still in progress.');
    if (revision !== this.revisionToken())
      throw new ImageMaintenanceConflict('Image storage changed. Refresh storage before cleanup.');
    this.maintaining = true;
    this.revision++;
    try {
      return await this.operation(async () => {
        const before = await inspectImageFiles(this.root, revision, signal);
        const removed = await clearRequestImageFiles(this.root, signal);
        const after = await inspectImageFiles(this.root, this.revisionToken(), signal);
        return { before, after, removedFiles: removed.files, reclaimedBytes: removed.bytes };
      });
    } finally {
      this.maintaining = false;
    }
  }

  async collectUnreferencedObjects(
    revision: string,
    retainedAttachmentIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<ImageObjectCleanup> {
    if (this.closed) throw new Error('Image storage is closed.');
    signal?.throwIfAborted();
    const retained = new Set(retainedIds.parse(retainedAttachmentIds));
    if (this.maintaining || this.pending.size || this.writers || this.inspections)
      throw new ImageMaintenanceConflict('Image operations are still in progress.');
    if (revision !== this.revisionToken())
      throw new ImageMaintenanceConflict('Image storage changed. Refresh storage before cleanup.');
    this.maintaining = true;
    this.collectingObjects = true;
    this.revision++;
    try {
      return await this.operation(async () => {
        const before = await inspectImageFiles(this.root, revision, signal);
        const removed = await clearUnreferencedImageFiles(this.root, retained, signal);
        const after = await inspectImageFiles(this.root, this.revisionToken(), signal);
        return {
          before,
          after,
          retainedObjects: retained.size,
          removedFiles: removed.files,
          reclaimedBytes: removed.bytes,
        };
      });
    } finally {
      this.collectingObjects = false;
      this.maintaining = false;
    }
  }

  async inspectObjectRetention(
    retainedAttachmentIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<ImageObjectInspection> {
    if (this.closed) throw new Error('Image storage is closed.');
    signal?.throwIfAborted();
    const retained = new Set(retainedIds.parse(retainedAttachmentIds));
    if (this.maintaining || this.writers || this.inspections)
      throw new ImageMaintenanceConflict('Image operations are still in progress.');
    this.maintaining = true;
    try {
      return await this.operation(async () => ({
        ...(await inspectImageFiles(this.root, this.revisionToken(), signal)),
        ...(await inspectRetainedImageFiles(this.root, retained, signal)),
      }));
    } finally {
      this.maintaining = false;
    }
  }
}
