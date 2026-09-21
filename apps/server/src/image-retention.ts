import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ContractValidator } from '@edh/contracts';
import {
  ImageMaintenanceConflict,
  inspectStoredImageReferences,
  type ImageObjectMaintenance,
  type ImageObjectInspection,
  type LocalStore,
} from '@edh/storage';
import { inspectSkillProvenance } from './skill-provenance.js';

export interface ImageReferenceLease {
  revision: string;
  attachmentIds: readonly string[];
  release(): void | Promise<void>;
}
export interface ImageReferenceSource {
  id: string;
  acquire(signal: AbortSignal): ImageReferenceLease | Promise<ImageReferenceLease>;
}
export interface ImageRetentionPolicy {
  version: string;
  sources: readonly ImageReferenceSource[];
}
export interface ImageCollectionPreview {
  token: string;
  storeSequence: number;
  referencesDigest: string;
  sourceIds: string[];
  skillCount: number;
  inspection: ImageObjectInspection;
}

const identity = z.string().min(1).max(512);
const count = z.number().int().nonnegative().safe();
const usage = z.object({ files: count, bytes: count });
const imageInspection = z.object({
  state: z.literal('ready'),
  revision: identity,
  objects: usage,
  requestCache: usage,
});
const objectInspection = imageInspection.extend({
  retainedObjects: usage,
  unreferencedObjects: usage,
});
const objectCleanup = z.object({
  before: imageInspection,
  after: imageInspection,
  removedFiles: count,
  reclaimedBytes: count,
  retainedObjects: count,
});
const referenceIds = z.array(
  z
    .string()
    .length(71)
    .regex(/^sha256:[a-f0-9]{64}$/),
);
const session = z.object({
  state: z.enum([
    'opening',
    'ready',
    'running',
    'draining',
    'closing',
    'closed',
    'error',
    'interrupted',
  ]),
  resources: z.enum(['allocating', 'held', 'released', 'unknown']),
});

export class ImageRetention {
  readonly sourceIds: readonly string[];
  private readonly sources: readonly ImageReferenceSource[];
  private readonly version: string;
  private pending = false;
  private preview: ImageCollectionPreview | undefined;

  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
    private readonly images: ImageObjectMaintenance,
    policy: ImageRetentionPolicy,
  ) {
    this.version = identity.parse(policy.version);
    if (!Array.isArray(policy.sources)) throw new Error('Image reference sources are required.');
    const ids = new Set(['journal']);
    this.sources = Object.freeze(
      policy.sources.map((source) => {
        const id = z
          .string()
          .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/)
          .parse(source.id);
        if (ids.has(id) || typeof source.acquire !== 'function')
          throw new Error('Image reference source identity or acquisition is invalid.');
        ids.add(id);
        return Object.freeze({ id, acquire: source.acquire.bind(source) });
      }),
    );
    this.sourceIds = Object.freeze([...ids]);
  }

  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (this.pending) throw new ImageMaintenanceConflict('Image retention is in progress.');
    this.pending = true;
    try {
      return await action();
    } finally {
      this.pending = false;
    }
  }

  private async withReferences<T>(
    signal: AbortSignal,
    action: (snapshot: {
      storeSequence: number;
      attachmentIds: string[];
      referencesDigest: string;
      skillCount: number;
    }) => Promise<T>,
  ): Promise<T> {
    const releases: (() => void | Promise<void>)[] = [];
    const failures: unknown[] = [];
    let hold: ReturnType<LocalStore['holdWrites']> | undefined;
    let result: T | undefined;
    try {
      signal.throwIfAborted();
      const ids = new Set<string>();
      const revisions: [string, string][] = [];
      for (const source of this.sources) {
        const lease = await source.acquire(signal);
        if (!lease || typeof lease.release !== 'function')
          throw new Error('Image reference source did not return a releasable lease.');
        releases.push(() => lease.release());
        signal.throwIfAborted();
        revisions.push([source.id, identity.parse(lease.revision)]);
        for (const id of referenceIds.parse(lease.attachmentIds)) ids.add(id);
      }
      hold = this.store.holdWrites();
      for (const row of this.store.scan('user-session:')) {
        const state = session.parse(row.value);
        if (state.state !== 'closed' || state.resources !== 'released')
          throw new ImageMaintenanceConflict(
            'Session resources must be confirmed released before original-image collection.',
          );
      }
      let skillCount = 0;
      for (const row of this.store.scan('skill:')) {
        const source = inspectSkillProvenance(
          this.store,
          this.validator,
          row.key.slice('skill:'.length),
        );
        if (source.state !== 'available')
          throw new ImageMaintenanceConflict(
            'SKILL source records are incomplete. Restore their references before original-image collection.',
          );
        skillCount++;
      }
      const inventory = inspectStoredImageReferences(this.store);
      for (const reference of inventory.references) ids.add(reference.attachmentId);
      const attachmentIds = [...ids].sort();
      const referencesDigest = createHash('sha256')
        .update(JSON.stringify([this.version, revisions, attachmentIds]))
        .digest('hex');
      signal.throwIfAborted();
      result = await action({
        storeSequence: hold.sequence,
        attachmentIds,
        referencesDigest,
        skillCount,
      });
    } catch (error) {
      failures.push(error);
    } finally {
      hold?.release();
      for (const release of releases.reverse()) {
        try {
          await release();
        } catch (error) {
          failures.push(error);
        }
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length)
      throw new AggregateError(failures, 'Image retention and reference release failed.');
    return result!;
  }

  inspect(signal: AbortSignal): Promise<ImageCollectionPreview> {
    return this.exclusive(async () => {
      this.preview = undefined;
      const preview = await this.withReferences(signal, async (snapshot) => {
        const inspection = objectInspection.parse(
          await this.images.inspectObjectRetention(snapshot.attachmentIds, signal),
        );
        if (
          inspection.retainedObjects.files !== snapshot.attachmentIds.length ||
          inspection.retainedObjects.files + inspection.unreferencedObjects.files !==
            inspection.objects.files ||
          inspection.retainedObjects.bytes + inspection.unreferencedObjects.bytes !==
            inspection.objects.bytes
        )
          throw new Error('Image provider returned an inconsistent reference inventory.');
        return {
          token: randomUUID(),
          storeSequence: snapshot.storeSequence,
          referencesDigest: snapshot.referencesDigest,
          sourceIds: [...this.sourceIds],
          skillCount: snapshot.skillCount,
          inspection,
        };
      });
      signal.throwIfAborted();
      this.preview = preview;
      return structuredClone(preview);
    });
  }

  collect(token: string, signal: AbortSignal) {
    return this.exclusive(async () => {
      const preview = this.preview;
      this.preview = undefined;
      if (!preview || preview.token !== token)
        throw new ImageMaintenanceConflict('Inspect original-image retention before collection.');
      return this.withReferences(signal, async (snapshot) => {
        if (
          snapshot.storeSequence !== preview.storeSequence ||
          snapshot.referencesDigest !== preview.referencesDigest
        )
          throw new ImageMaintenanceConflict('Image references changed. Inspect retention again.');
        const result = objectCleanup.parse(
          await this.images.collectUnreferencedObjects(
            preview.inspection.revision,
            snapshot.attachmentIds,
            signal,
          ),
        );
        if (
          result.before.revision !== preview.inspection.revision ||
          result.before.objects.files !== preview.inspection.objects.files ||
          result.before.objects.bytes !== preview.inspection.objects.bytes ||
          result.removedFiles !== preview.inspection.unreferencedObjects.files ||
          result.reclaimedBytes !== preview.inspection.unreferencedObjects.bytes ||
          result.retainedObjects !== snapshot.attachmentIds.length ||
          result.after.objects.files !== preview.inspection.retainedObjects.files ||
          result.after.objects.bytes !== preview.inspection.retainedObjects.bytes
        )
          throw new Error('Image provider returned an inconsistent collection result.');
        return result;
      });
    });
  }
}
