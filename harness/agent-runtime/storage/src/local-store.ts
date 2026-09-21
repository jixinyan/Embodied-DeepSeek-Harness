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
} from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import LineByLine from 'n-readlines';

export interface StoredRecord {
  version: number;
  value: unknown;
}
interface Entry {
  sequence: number;
  key: string;
  record: StoredRecord;
  hash: string;
}
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
  private readonly records = new Map<string, RecordLocation>();
  private sequence = 0;
  private journalBytes = 0;
  private readonly fd: number;
  private readonly lock: string;
  private closed = false;
  private poisoned = false;
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
      let line: Buffer | false;
      while ((line = reader.next()) !== false) {
        if (this.journalBytes + line.length >= size) continue;
        const offset = this.journalBytes;
        this.journalBytes += line.length + 1;
        if (!line.length) continue;
        const entry = JSON.parse(line.toString('utf8')) as Entry;
        if (
          entry.sequence !== this.sequence + 1 ||
          entry.hash !== hash(entry.sequence, entry.key, entry.record) ||
          entry.record.version !== (this.records.get(entry.key)?.version ?? 0) + 1
        )
          throw new Error('Domain store corruption; refusing to replay.');
        this.sequence = entry.sequence;
        this.records.set(entry.key, {
          version: entry.record.version,
          sequence: entry.sequence,
          offset,
          length: line.length,
          hash: entry.hash,
        });
      }
      readerFd = undefined;
      if (this.journalBytes !== size) {
        ftruncateSync(this.fd, this.journalBytes);
        fsyncSync(this.fd);
      }
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
    const entry = JSON.parse(bytes.toString('utf8')) as Entry;
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
  *scan<T>(prefix: string): Generator<{ key: string; version: number; value: T }> {
    if (this.closed || this.poisoned) throw new Error('Store is not readable.');
    for (const key of this.records.keys())
      if (key.startsWith(prefix)) yield { key, ...this.get<T>(key)! };
  }
  put<T>(key: string, value: T, expectedVersion: number): number {
    if (this.closed || this.poisoned) throw new Error('Store is not writable.');
    if (!key || key.length > 512) throw new Error('Invalid record key.');
    const version = this.records.get(key)?.version ?? 0;
    if (version !== expectedVersion)
      throw new Error(`Version conflict for ${key}: expected ${expectedVersion}, found ${version}`);
    const encoded = JSON.stringify(value);
    if (encoded === undefined || Buffer.byteLength(encoded) > 8 * 1024 * 1024)
      throw new Error('Invalid or oversized record.');
    const record = { version: version + 1, value: JSON.parse(encoded) as unknown };
    const sequence = this.sequence + 1;
    const entry: Entry = { sequence, key, record, hash: hash(sequence, key, record) };
    const bytes = Buffer.from(JSON.stringify(entry) + '\n');
    try {
      if (fstatSync(this.fd).size !== this.journalBytes)
        throw new Error('Domain store size changed outside its writer.');
      let offset = 0;
      while (offset < bytes.length) offset += writeSync(this.fd, bytes, offset);
      fsyncSync(this.fd);
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
    return record.version;
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      closeSync(this.fd);
    } finally {
      unlinkSync(this.lock);
    }
  }
}
