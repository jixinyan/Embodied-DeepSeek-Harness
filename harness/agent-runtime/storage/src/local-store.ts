import {
  openSync,
  closeSync,
  readFileSync,
  writeSync,
  fsyncSync,
  ftruncateSync,
  mkdirSync,
  unlinkSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

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
const hash = (sequence: number, key: string, record: StoredRecord) =>
  createHash('sha256')
    .update(JSON.stringify([sequence, key, record]))
    .digest('hex');
/** Single-process durable domain records. Session audit exports are not resumable DSH sessions. */
export class LocalStore {
  private readonly records = new Map<string, StoredRecord>();
  private sequence = 0;
  private readonly fd: number;
  private readonly lock: string;
  private closed = false;
  private poisoned = false;
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.lock = resolve(directory, 'writer.lock');
    let lockFd: number;
    try {
      lockFd = openSync(this.lock, 'wx', 0o600);
    } catch {
      throw new Error(
        `Store already locked. After confirming the old server is stopped, remove ${this.lock}.`,
      );
    }
    writeSync(lockFd, String(process.pid));
    closeSync(lockFd);
    this.fd = openSync(resolve(directory, 'records.jsonl'), 'a+', 0o600);
    try {
      const bytes = readFileSync(this.fd);
      const end = bytes.lastIndexOf(10) + 1;
      for (const line of bytes.subarray(0, end).toString('utf8').split('\n').filter(Boolean)) {
        const entry = JSON.parse(line) as Entry;
        if (
          entry.sequence !== this.sequence + 1 ||
          entry.hash !== hash(entry.sequence, entry.key, entry.record) ||
          entry.record.version !== (this.records.get(entry.key)?.version ?? 0) + 1
        )
          throw new Error('Domain store corruption; refusing to replay.');
        this.sequence = entry.sequence;
        this.records.set(entry.key, entry.record);
      }
      if (end !== bytes.length) {
        ftruncateSync(this.fd, end);
        fsyncSync(this.fd);
      }
    } catch (error) {
      closeSync(this.fd);
      unlinkSync(this.lock);
      throw error;
    }
  }
  get<T>(key: string): { version: number; value: T } | undefined {
    const record = this.records.get(key);
    return record ? (structuredClone(record) as { version: number; value: T }) : undefined;
  }
  list<T>(prefix: string): { key: string; version: number; value: T }[] {
    return [...this.records]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, record]) => ({
        key,
        ...(structuredClone(record) as { version: number; value: T }),
      }));
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
    try {
      const bytes = Buffer.from(JSON.stringify(entry) + '\n');
      let offset = 0;
      while (offset < bytes.length) offset += writeSync(this.fd, bytes, offset);
      fsyncSync(this.fd);
    } catch (error) {
      this.poisoned = true;
      throw error;
    }
    this.records.set(key, record);
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
