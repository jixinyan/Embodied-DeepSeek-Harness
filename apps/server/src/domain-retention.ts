import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ContractValidator } from '@edh/contracts';
import type { LocalStore, StoreRevision } from '@edh/storage';
import { inspectSkillProvenance } from './skill-provenance.js';

export interface DomainRecordOwner {
  id: string;
  version: string;
  prefix: string;
  inspect(record: { readonly key: string; readonly version: number; readonly value: unknown }): {
    references: readonly string[];
    retain: boolean;
  };
}

export interface DomainReferenceLease {
  revision: string;
  keys: readonly string[];
  release(): void | Promise<void>;
}

export interface DomainReferenceSource {
  id: string;
  acquire(signal: AbortSignal): DomainReferenceLease | Promise<DomainReferenceLease>;
}

export interface DomainRetentionPolicy {
  version: string;
  owners: readonly DomainRecordOwner[];
  sources: readonly DomainReferenceSource[];
}

export interface DomainRetirementPreview {
  token: string;
  storeSequence: number;
  referencesDigest: string;
  sourceIds: string[];
  selected: ({ key: string } & StoreRevision)[];
  retainedRecords: number;
  skillCount: number;
}

export class DomainRetentionConflict extends Error {}

const identity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/);
const version = z.string().min(1).max(512);
const keySchema = z.string().min(1).max(512);
const keysSchema = z.array(keySchema);
const referencesSchema = z.object({ references: keysSchema, retain: z.boolean() }).strict();
const sessionSchema = z.object({ state: z.string(), resources: z.string() });

export class DomainRetention {
  readonly sourceIds: readonly string[];
  private readonly owners: readonly DomainRecordOwner[];
  private readonly sources: readonly DomainReferenceSource[];
  private readonly version: string;
  private pending = false;
  private preview: DomainRetirementPreview | undefined;

  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
    policy: DomainRetentionPolicy,
  ) {
    this.version = version.parse(policy.version);
    if (!Array.isArray(policy.owners) || !policy.owners.length || !Array.isArray(policy.sources))
      throw new Error('Domain retention requires explicit record owners and reference sources.');
    const ownerIds = new Set<string>();
    const prefixes: string[] = [];
    this.owners = Object.freeze(
      policy.owners
        .map((owner) => {
          const id = identity.parse(owner.id);
          const prefix = keySchema.parse(owner.prefix);
          if (
            ownerIds.has(id) ||
            typeof owner.inspect !== 'function' ||
            prefixes.some((existing) => existing.startsWith(prefix) || prefix.startsWith(existing))
          )
            throw new Error(
              'Domain record owners require unique identities and nonoverlapping prefixes.',
            );
          ownerIds.add(id);
          prefixes.push(prefix);
          return Object.freeze({
            id,
            prefix,
            version: version.parse(owner.version),
            inspect: owner.inspect.bind(owner),
          });
        })
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    const sourceIds = new Set(['journal', 'skills', 'requests']);
    this.sources = Object.freeze(
      policy.sources
        .map((source) => {
          const id = identity.parse(source.id);
          if (sourceIds.has(id) || typeof source.acquire !== 'function')
            throw new Error('Domain reference sources require unique identities and acquisition.');
          sourceIds.add(id);
          return Object.freeze({ id, acquire: source.acquire.bind(source) });
        })
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    this.sourceIds = Object.freeze([...sourceIds].sort());
  }

  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (this.pending) throw new DomainRetentionConflict('Domain retention is in progress.');
    this.pending = true;
    try {
      return await action();
    } finally {
      this.pending = false;
    }
  }

  private async inspectReferences<T>(
    selectedKeys: readonly string[],
    signal: AbortSignal,
    action: (snapshot: Omit<DomainRetirementPreview, 'token'>, releaseWrites: () => void) => T,
  ): Promise<T> {
    const releases: (() => void | Promise<void>)[] = [];
    const failures: unknown[] = [];
    let hold: ReturnType<LocalStore['holdWrites']> | undefined;
    let result: T | undefined;
    try {
      signal.throwIfAborted();
      const keys = keysSchema.min(1).parse(selectedKeys);
      const selected = new Set(keys);
      if (selected.size !== keys.length) throw new Error('Duplicate retirement selection.');
      const roots = new Set<string>();
      const revisions: [string, string][] = [];
      for (const source of this.sources) {
        const lease = await source.acquire(signal);
        if (!lease || typeof lease.release !== 'function')
          throw new Error('Domain reference source did not return a releasable lease.');
        releases.push(() => lease.release());
        signal.throwIfAborted();
        revisions.push([source.id, version.parse(lease.revision)]);
        for (const key of keysSchema.parse(lease.keys)) roots.add(key);
      }
      this.store.assertCurrent();
      hold = this.store.holdWrites();
      const records = [...selected].sort().map((key) => {
        const revision = this.store.revision(key);
        if (!revision) throw new DomainRetentionConflict(`Selected record is missing: ${key}`);
        return { key, ...revision };
      });
      for (const row of this.store.scan('user-session:')) {
        const session = sessionSchema.parse(row.value);
        if (session.state !== 'closed' || session.resources !== 'released')
          throw new DomainRetentionConflict(
            'Session resources must be confirmed released before record retirement.',
          );
      }
      let skillCount = 0;
      for (const row of this.store.revisions('skill:')) {
        const provenance = inspectSkillProvenance(
          this.store,
          this.validator,
          row.key.slice('skill:'.length),
        );
        if (provenance.state !== 'available')
          throw new DomainRetentionConflict(
            'SKILL source records must be complete before record retirement.',
          );
        for (const record of provenance.records) roots.add(record.key);
        skillCount++;
      }
      for (const prefix of ['request:', 'session-open-request:', 'session-task-request:'])
        for (const record of this.store.revisions(prefix)) roots.add(record.key);
      for (const key of roots) {
        if (!this.store.revision(key))
          throw new DomainRetentionConflict(`Retained reference is missing: ${key}`);
        if (selected.has(key))
          throw new DomainRetentionConflict(
            `Selected record is retained by a reference source: ${key}`,
          );
      }
      const hash = createHash('sha256').update(
        JSON.stringify([
          this.version,
          this.owners.map(({ id, version: revision, prefix }) => [id, revision, prefix]),
          revisions,
          [...roots].sort(),
        ]),
      );
      for (const row of this.store.scan('')) {
        signal.throwIfAborted();
        const owner = this.owners.find((candidate) => row.key.startsWith(candidate.prefix));
        if (!owner)
          throw new DomainRetentionConflict(`Record has no declared reference owner: ${row.key}`);
        const declaration = referencesSchema.parse(owner.inspect(Object.freeze(row)));
        const references = [...new Set(declaration.references)].sort();
        if (declaration.retain && selected.has(row.key))
          throw new DomainRetentionConflict(`Record owner requires retention: ${row.key}`);
        for (const key of references) {
          if (!this.store.revision(key))
            throw new DomainRetentionConflict(`Record ${row.key} references missing record ${key}`);
          if (!selected.has(row.key) && selected.has(key))
            throw new DomainRetentionConflict(
              `Retained record ${row.key} references selected record ${key}`,
            );
        }
        hash.update(
          JSON.stringify([
            row.key,
            this.store.revision(row.key),
            owner.id,
            declaration.retain,
            references,
          ]),
        );
      }
      this.store.assertCurrent();
      signal.throwIfAborted();
      result = action(
        {
          storeSequence: hold.sequence,
          referencesDigest: hash.digest('hex'),
          sourceIds: [...this.sourceIds],
          selected: records,
          retainedRecords: this.store.statistics().records - selected.size,
          skillCount,
        },
        () => hold!.release(),
      );
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
      throw new AggregateError(failures, 'Domain retention and reference release failed.');
    return result!;
  }

  inspect(keys: readonly string[], signal: AbortSignal): Promise<DomainRetirementPreview> {
    return this.exclusive(async () => {
      this.preview = undefined;
      const preview = await this.inspectReferences(keys, signal, (snapshot) => ({
        ...snapshot,
        token: randomUUID(),
      }));
      signal.throwIfAborted();
      this.preview = preview;
      return structuredClone(preview);
    });
  }

  retire(token: string, signal: AbortSignal) {
    return this.exclusive(async () => {
      const preview = this.preview;
      this.preview = undefined;
      if (!preview || preview.token !== token)
        throw new DomainRetentionConflict('Inspect domain references before record retirement.');
      return this.inspectReferences(
        preview.selected.map((record) => record.key),
        signal,
        (snapshot, releaseWrites) => {
          if (
            snapshot.storeSequence !== preview.storeSequence ||
            snapshot.referencesDigest !== preview.referencesDigest
          )
            throw new DomainRetentionConflict(
              'Domain references changed. Inspect retirement again.',
            );
          releaseWrites();
          return this.store.retire(
            preview.selected.map((record) => record.key),
            snapshot.storeSequence,
          );
        },
      );
    });
  }
}
