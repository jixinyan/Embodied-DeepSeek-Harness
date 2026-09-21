import {
  openSync,
  closeSync,
  readSync,
  fstatSync,
  writeSync,
  fsyncSync,
  ftruncateSync,
  mkdirSync,
  unlinkSync,
  renameSync,
  statSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import LineByLine from 'n-readlines';
import { z } from 'zod';

export interface StoredRecord {
  version: number;
  value: unknown;
}
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const entrySchema = z
  .object({
    sequence: z.number().int().positive().safe(),
    key: z.string().min(1).max(512),
    record: z.object({ version: z.number().int().positive().safe(), value: z.unknown() }).strict(),
    hash: digestSchema,
  })
  .strict();
type Entry = z.infer<typeof entrySchema>;
const checkpointSchema = z.discriminatedUnion('format', [
  z
    .object({
      format: z.literal('edh-domain-checkpoint-v1'),
      sequence: z.number().int().positive().safe(),
      records: z.number().int().positive().safe(),
      hash: digestSchema,
    })
    .strict(),
  z
    .object({
      format: z.literal('edh-domain-checkpoint-v2'),
      sequence: z.number().int().positive().safe(),
      records: z.number().int().nonnegative().safe(),
      sequenceOffset: z.number().int().positive().safe(),
      hash: digestSchema,
    })
    .strict(),
]);
const checkpointHash = (sequence: number, records: number) =>
  createHash('sha256')
    .update(JSON.stringify(['edh-domain-checkpoint-v1', sequence, records]))
    .digest('hex');
const retirementHash = (sequence: number, records: number, sequenceOffset: number) =>
  createHash('sha256')
    .update(JSON.stringify(['edh-domain-checkpoint-v2', sequence, records, sequenceOffset]))
    .digest('hex');

export interface StoreStatistics {
  records: number;
  sequence: number;
  journalBytes: number;
  currentRecordBytes: number;
  checkpointBytes: number;
  supersededBytes: number;
}
export interface StoreCompaction {
  compacted: boolean;
  before: StoreStatistics;
  after: StoreStatistics;
  reclaimedBytes: number;
}
export interface StoreRetirement {
  removedRecords: number;
  before: StoreStatistics;
  after: StoreStatistics;
  byteDifference: number;
}
export interface StoreRevision {
  readonly version: number;
  readonly hash: string;
}
export type StoreChange =
  | { readonly type: 'put'; readonly key: string }
  | { readonly type: 'compact' }
  | { readonly type: 'retire' };
interface RecordLocation {
  version: number;
  sequence: number;
  offset: number;
  length: number;
  hash: string;
}
const hash = (sequence: number, key: string, record: StoredRecord) =>
  createHash('sha256')
    .update(JSON.stringify([sequence, key, record]))
    .digest('hex');
/** Single-process durable domain records. Session audit exports are not resumable DSH sessions. */
export class LocalStore {
  private records = new Map<string, RecordLocation>();
  private sequence = 0;
  private journalBytes = 0;
  private fd: number;
  private checkpointBytes = 0;
  private readonly lock: string;
  private closed = false;
  private poisoned = false;
  private writeHolds = 0;
  private notifying = false;
  private readonly observers = new Set<(change: StoreChange) => void>();
  private fingerprint!: { dev: bigint; ino: bigint; size: bigint; mtimeNs: bigint };
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.lock = resolve(directory, 'writer.lock');
    let lockFd: number | undefined;
    let journalFd: number | undefined;
    let readerFd: number | undefined;
    try {
      lockFd = openSync(this.lock, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      throw new Error(
        `Store already locked. After confirming the old server is stopped, remove ${this.lock}.`,
      );
    }
    try {
      writeSync(lockFd, String(process.pid));
      fsyncSync(lockFd);
      closeSync(lockFd);
      lockFd = undefined;
      const journal = resolve(directory, 'records.jsonl');
      journalFd = openSync(journal, 'a+', 0o600);
      this.fd = journalFd;
      const size = fstatSync(this.fd).size;
      readerFd = openSync(journal, 'r');
      const reader = new LineByLine(readerFd, { readChunk: 64 * 1024 });
      let checkpointRemaining = 0;
      let checkpointVersions = 0;
      let line: Buffer | false;
      while ((line = reader.next()) !== false) {
        if (this.journalBytes + line.length >= size) continue;
        const offset = this.journalBytes;
        this.journalBytes += line.length + 1;
        if (!line.length) {
          if (checkpointRemaining) throw new Error('Domain checkpoint is incomplete.');
          continue;
        }
        const parsed = JSON.parse(line.toString('utf8')) as unknown;
        if (parsed && typeof parsed === 'object' && 'format' in parsed) {
          const checkpoint = checkpointSchema.parse(parsed);
          const sequenceOffset =
            checkpoint.format === 'edh-domain-checkpoint-v2' ? checkpoint.sequenceOffset : 0;
          if (
            offset !== 0 ||
            checkpoint.records > checkpoint.sequence - sequenceOffset ||
            (!checkpoint.records && sequenceOffset !== checkpoint.sequence) ||
            checkpoint.hash !==
              (checkpoint.format === 'edh-domain-checkpoint-v2'
                ? retirementHash(checkpoint.sequence, checkpoint.records, sequenceOffset)
                : checkpointHash(checkpoint.sequence, checkpoint.records))
          )
            throw new Error('Domain checkpoint corruption; refusing to replay.');
          this.sequence = checkpoint.sequence - checkpoint.records;
          this.checkpointBytes = this.journalBytes;
          checkpointRemaining = checkpoint.records;
          checkpointVersions = sequenceOffset;
          continue;
        }
        const entry = entrySchema.parse(parsed);
        if (
          entry.sequence !== this.sequence + 1 ||
          entry.hash !== hash(entry.sequence, entry.key, entry.record) ||
          (checkpointRemaining
            ? this.records.has(entry.key)
            : entry.record.version !== (this.records.get(entry.key)?.version ?? 0) + 1)
        )
          throw new Error('Domain store corruption; refusing to replay.');
        this.sequence = entry.sequence;
        if (checkpointRemaining) {
          checkpointVersions += entry.record.version;
          if (!Number.isSafeInteger(checkpointVersions))
            throw new Error('Domain checkpoint version accounting exceeds its limit.');
          checkpointRemaining--;
          if (!checkpointRemaining && checkpointVersions !== this.sequence)
            throw new Error('Domain checkpoint versions do not match its sequence.');
        }
        this.records.set(entry.key, {
          version: entry.record.version,
          sequence: entry.sequence,
          offset,
          length: line.length,
          hash: entry.hash,
        });
      }
      readerFd = undefined;
      if (checkpointRemaining) throw new Error('Domain checkpoint is incomplete.');
      if (this.journalBytes !== size) {
        if (!this.sequence) throw new Error('Domain store begins with an incomplete record.');
        ftruncateSync(this.fd, this.journalBytes);
        fsyncSync(this.fd);
      }
      this.fingerprint = fstatSync(this.fd, { bigint: true });
    } catch (error) {
      const failures: unknown[] = [error];
      for (const fd of [lockFd, journalFd, readerFd]) {
        if (fd === undefined) continue;
        try {
          closeSync(fd);
        } catch (failure) {
          if (fd === readerFd && (failure as NodeJS.ErrnoException).code === 'EBADF') continue;
          failures.push(failure);
        }
      }
      try {
        unlinkSync(this.lock);
      } catch (failure) {
        failures.push(failure);
      }
      if (failures.length > 1)
        throw new AggregateError(failures, 'Store startup and cleanup failed.');
      throw error;
    }
  }
  get<T>(key: string): { version: number; value: T } | undefined {
    if (this.closed || this.poisoned) throw new Error('Store is not readable.');
    const location = this.records.get(key);
    if (!location) return undefined;
    this.poisoned = true;
    const bytes = Buffer.alloc(location.length);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(
        this.fd,
        bytes,
        offset,
        bytes.length - offset,
        location.offset + offset,
      );
      if (!count) throw new Error('Domain store record is incomplete.');
      offset += count;
    }
    const entry = entrySchema.parse(JSON.parse(bytes.toString('utf8')));
    if (
      entry.key !== key ||
      entry.sequence !== location.sequence ||
      entry.record.version !== location.version ||
      entry.hash !== location.hash ||
      entry.hash !== hash(entry.sequence, entry.key, entry.record)
    )
      throw new Error('Domain store corruption; refusing to read.');
    this.poisoned = false;
    return entry.record as { version: number; value: T };
  }
  list<T>(prefix: string): { key: string; version: number; value: T }[] {
    return [...this.scan<T>(prefix)];
  }
  assertCurrent(): void {
    if (this.closed || this.poisoned) throw new Error('Store is not readable.');
    this.poisoned = true;
    const current = statSync(resolve(this.directory, 'records.jsonl'), { bigint: true });
    const expected = this.fingerprint;
    if (
      current.dev !== expected.dev ||
      current.ino !== expected.ino ||
      current.size !== expected.size ||
      current.mtimeNs !== expected.mtimeNs
    )
      throw new Error('Domain store changed outside its writer.');
    this.poisoned = false;
  }
  revision(key: string): StoreRevision | undefined {
    if (this.closed || this.poisoned) throw new Error('Store is not readable.');
    const record = this.records.get(key);
    return record ? { version: record.version, hash: record.hash } : undefined;
  }
  *revisions(prefix: string): Generator<{ key: string } & StoreRevision> {
    if (this.closed || this.poisoned) throw new Error('Store is not readable.');
    for (const [key, record] of this.records) {
      if (this.closed || this.poisoned) throw new Error('Store is not readable.');
      if (key.startsWith(prefix)) yield { key, version: record.version, hash: record.hash };
    }
  }
  observe(observer: (change: StoreChange) => void): () => void {
    if (this.notifying) throw new Error('Store observers cannot register observers.');
    this.assertCurrent();
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }
  private notify(change: StoreChange): void {
    this.notifying = true;
    try {
      for (const observer of this.observers) {
        const result: unknown = observer(Object.freeze(change));
        if (result !== undefined) throw new Error('Store observers must return synchronously.');
      }
    } catch (error) {
      this.poisoned = true;
      throw error;
    } finally {
      this.notifying = false;
    }
  }
  *scan<T>(prefix: string): Generator<{ key: string; version: number; value: T }> {
    if (this.closed || this.poisoned) throw new Error('Store is not readable.');
    for (const key of this.records.keys())
      if (key.startsWith(prefix)) yield { key, ...this.get<T>(key)! };
  }
  put<T>(key: string, value: T, expectedVersion: number): number {
    if (this.closed || this.poisoned) throw new Error('Store is not writable.');
    if (this.notifying) throw new Error('Store observers cannot mutate the store.');
    if (this.writeHolds) throw new Error('Store writes are suspended for reference inspection.');
    if (!key || key.length > 512) throw new Error('Invalid record key.');
    const version = this.records.get(key)?.version ?? 0;
    if (version !== expectedVersion)
      throw new Error(`Version conflict for ${key}: expected ${expectedVersion}, found ${version}`);
    const encoded = JSON.stringify(value);
    if (encoded === undefined || Buffer.byteLength(encoded) > 8 * 1024 * 1024)
      throw new Error('Invalid or oversized record.');
    const record = { version: version + 1, value: JSON.parse(encoded) as unknown };
    const sequence = this.sequence + 1;
    if (!Number.isSafeInteger(sequence) || !Number.isSafeInteger(record.version))
      throw new Error('Domain store sequence or version limit reached.');
    const entry: Entry = { sequence, key, record, hash: hash(sequence, key, record) };
    const bytes = Buffer.from(JSON.stringify(entry) + '\n');
    try {
      this.assertCurrent();
      let offset = 0;
      while (offset < bytes.length) {
        const written = writeSync(this.fd, bytes, offset);
        if (!written) throw new Error('Domain store write made no progress.');
        offset += written;
      }
      fsyncSync(this.fd);
      this.fingerprint = fstatSync(this.fd, { bigint: true });
    } catch (error) {
      this.poisoned = true;
      throw error;
    }
    this.records.set(key, {
      version: record.version,
      sequence,
      offset: this.journalBytes,
      length: bytes.length - 1,
      hash: entry.hash,
    });
    this.journalBytes += bytes.length;
    this.sequence = sequence;
    this.notify({ type: 'put', key });
    return record.version;
  }
  statistics(): StoreStatistics {
    if (this.closed || this.poisoned) throw new Error('Store is not readable.');
    let currentRecordBytes = 0;
    for (const location of this.records.values()) currentRecordBytes += location.length + 1;
    return {
      records: this.records.size,
      sequence: this.sequence,
      journalBytes: this.journalBytes,
      currentRecordBytes,
      checkpointBytes: this.checkpointBytes,
      supersededBytes: this.journalBytes - currentRecordBytes - this.checkpointBytes,
    };
  }
  holdWrites(): { sequence: number; release(): void } {
    const sequence = this.statistics().sequence;
    this.writeHolds++;
    let released = false;
    return {
      sequence,
      release: () => {
        if (released) return;
        released = true;
        this.writeHolds--;
      },
    };
  }
  compact(): StoreCompaction {
    const result = this.rewriteCheckpoint(new Set(), this.sequence);
    return {
      compacted: result.published,
      before: result.before,
      after: result.after,
      reclaimedBytes: result.byteDifference,
    };
  }
  retire(keys: readonly string[], expectedSequence: number): StoreRetirement {
    if (this.notifying) throw new Error('Store observers cannot mutate the store.');
    this.assertCurrent();
    if (!Number.isSafeInteger(expectedSequence) || expectedSequence < 0)
      throw new Error('Invalid retirement sequence.');
    if (expectedSequence !== this.sequence) throw new Error('Retirement sequence conflict.');
    if (!Array.isArray(keys) || !keys.length) throw new Error('Retirement requires record keys.');
    const removed = new Set<string>();
    for (const key of keys) {
      entrySchema.shape.key.parse(key);
      if (removed.has(key)) throw new Error(`Duplicate retirement key: ${key}`);
      if (!this.records.has(key)) throw new Error(`Missing retirement key: ${key}`);
      removed.add(key);
    }
    const sequence = this.sequence + 1;
    if (!Number.isSafeInteger(sequence)) throw new Error('Domain store sequence limit reached.');
    const result = this.rewriteCheckpoint(removed, sequence);
    return {
      removedRecords: removed.size,
      before: result.before,
      after: result.after,
      byteDifference: result.byteDifference,
    };
  }
  private rewriteCheckpoint(removed: ReadonlySet<string>, targetSequence: number) {
    if (this.notifying) throw new Error('Store observers cannot mutate the store.');
    this.assertCurrent();
    if (this.writeHolds) throw new Error('Store writes are suspended for reference inspection.');
    const before = this.statistics();
    if (!removed.size && !before.supersededBytes)
      return { published: false, before, after: before, byteDifference: 0 };
    const journal = resolve(this.directory, 'records.jsonl');
    const staging = resolve(this.directory, `records.compact-${randomUUID()}.jsonl`);
    const locations = new Map<string, RecordLocation>();
    let stagingFd: number | undefined;
    let directoryFd: number | undefined;
    let previousFd: number | undefined;
    let created = false;
    let published = false;
    let result:
      | {
          published: boolean;
          before: StoreStatistics;
          after: StoreStatistics;
          byteDifference: number;
        }
      | undefined;
    const failures: unknown[] = [];
    try {
      const original = fstatSync(this.fd, { bigint: true });
      const checkOriginal = () => {
        const current = statSync(journal, { bigint: true });
        if (
          current.dev !== original.dev ||
          current.ino !== original.ino ||
          current.size !== BigInt(this.journalBytes) ||
          current.mtimeNs !== original.mtimeNs
        )
          throw new Error('Domain store changed outside its writer.');
      };
      checkOriginal();
      stagingFd = openSync(staging, 'wx+', 0o600);
      created = true;
      let bytesWritten = 0;
      const append = (value: unknown) => {
        const bytes = Buffer.from(JSON.stringify(value) + '\n');
        let offset = 0;
        while (offset < bytes.length) {
          const written = writeSync(stagingFd!, bytes, offset);
          if (!written) throw new Error('Domain checkpoint write made no progress.');
          offset += written;
        }
        bytesWritten += bytes.length;
        return bytes.length;
      };
      const retainedCount = this.records.size - removed.size;
      let retainedVersions = 0;
      for (const [key, location] of this.records)
        if (!removed.has(key)) retainedVersions += location.version;
      const sequenceOffset = targetSequence - retainedVersions;
      if (!Number.isSafeInteger(sequenceOffset) || sequenceOffset < 0)
        throw new Error('Invalid domain checkpoint version accounting.');
      const checkpointBytes = sequenceOffset
        ? append({
            format: 'edh-domain-checkpoint-v2',
            sequence: targetSequence,
            records: retainedCount,
            sequenceOffset,
            hash: retirementHash(targetSequence, retainedCount, sequenceOffset),
          })
        : retainedCount
          ? append({
              format: 'edh-domain-checkpoint-v1',
              sequence: targetSequence,
              records: retainedCount,
              hash: checkpointHash(targetSequence, retainedCount),
            })
          : 0;
      let sequence = targetSequence - retainedCount;
      for (const key of this.records.keys()) {
        const record = this.get(key)!;
        if (removed.has(key)) continue;
        sequence++;
        const checksum = hash(sequence, key, record);
        const offset = bytesWritten;
        const length = append({ sequence, key, record, hash: checksum });
        locations.set(key, {
          version: record.version,
          sequence,
          offset,
          length: length - 1,
          hash: checksum,
        });
      }
      fsyncSync(stagingFd);
      checkOriginal();
      if (removed.size || bytesWritten < before.journalBytes) {
        directoryFd = openSync(this.directory, 'r');
        renameSync(staging, journal);
        published = true;
        previousFd = this.fd;
        this.fd = stagingFd;
        stagingFd = undefined;
        this.records = locations;
        this.journalBytes = bytesWritten;
        this.checkpointBytes = checkpointBytes;
        this.sequence = targetSequence;
        fsyncSync(directoryFd);
      }
      const after = this.statistics();
      result = {
        published,
        before,
        after,
        byteDifference: before.journalBytes - after.journalBytes,
      };
    } catch (error) {
      failures.push(error);
    }
    for (const fd of [stagingFd, previousFd, directoryFd]) {
      if (fd === undefined) continue;
      try {
        closeSync(fd);
      } catch (error) {
        failures.push(error);
      }
    }
    if (created && !published) {
      try {
        unlinkSync(staging);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) {
      this.poisoned = true;
      if (failures.length === 1) throw failures[0];
      throw new AggregateError(failures, 'Domain checkpoint and cleanup failed.');
    }
    if (published) {
      try {
        this.fingerprint = fstatSync(this.fd, { bigint: true });
        this.notify({ type: removed.size ? 'retire' : 'compact' });
      } catch (error) {
        this.poisoned = true;
        throw error;
      }
    }
    return result!;
  }
  close(): void {
    if (this.closed) return;
    if (this.notifying) throw new Error('Store observers cannot close the store.');
    this.closed = true;
    this.observers.clear();
    try {
      closeSync(this.fd);
    } finally {
      unlinkSync(this.lock);
    }
  }
}
