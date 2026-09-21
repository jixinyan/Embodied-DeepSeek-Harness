import { lstat, opendir, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export interface ImageFileUsage {
  files: number;
  bytes: number;
}
export interface ReadyImageInspection {
  state: 'ready';
  revision: string;
  objects: ImageFileUsage;
  requestCache: ImageFileUsage;
}
export type ImageStorageInspection = ReadyImageInspection | { state: 'busy'; revision: string };
export interface ImageCacheCleanup {
  before: ReadyImageInspection;
  after: ReadyImageInspection;
  removedFiles: number;
  reclaimedBytes: number;
}
export interface ImageObjectCleanup extends ImageCacheCleanup {
  retainedObjects: number;
}
export interface ImageObjectInspection extends ReadyImageInspection {
  retainedObjects: ImageFileUsage;
  unreferencedObjects: ImageFileUsage;
}
export interface ImageObjectMaintenance {
  inspectObjectRetention(
    retainedAttachmentIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<ImageObjectInspection>;
  collectUnreferencedObjects(
    revision: string,
    retainedAttachmentIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<ImageObjectCleanup>;
}
export interface ImageStorageMaintenance {
  inspect(signal?: AbortSignal): Promise<ImageStorageInspection>;
  clearRequestCache(revision: string, signal?: AbortSignal): Promise<ImageCacheCleanup>;
  objects?: ImageObjectMaintenance;
}
export class ImageMaintenanceConflict extends Error {}

const digest = /^[a-f0-9]{64}$/;
const cachedFile =
  /^[a-f0-9]{64}(?:\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.tmp)?$/;

async function directoryExists(path: string): Promise<boolean> {
  let stat;
  try {
    stat = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error('Image storage contains an invalid directory.');
  return true;
}

async function* imageFiles(
  root: string,
  section: 'objects' | 'request-images',
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  if (!(await directoryExists(root))) return;
  const directory = join(root, section);
  if (!(await directoryExists(directory))) return;
  for await (const shard of await opendir(directory)) {
    signal?.throwIfAborted();
    if (!/^[a-f0-9]{2}$/.test(shard.name) || !shard.isDirectory() || shard.isSymbolicLink())
      throw new Error('Image storage contains an invalid shard.');
    const shardPath = join(directory, shard.name);
    if (!(await directoryExists(shardPath))) throw new Error('Image storage shard disappeared.');
    for await (const file of await opendir(shardPath)) {
      signal?.throwIfAborted();
      const pattern = section === 'objects' ? digest : cachedFile;
      if (
        !pattern.test(file.name) ||
        !file.name.startsWith(shard.name) ||
        !file.isFile() ||
        file.isSymbolicLink()
      )
        throw new Error('Image storage contains an invalid file.');
      const path = join(shardPath, file.name);
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error('Image storage file changed type.');
      yield { path, directory: shardPath, name: file.name, bytes: stat.size };
    }
  }
}

export async function inspectImageFiles(
  root: string,
  revision: string,
  signal?: AbortSignal,
): Promise<ReadyImageInspection> {
  const count = async (section: 'objects' | 'request-images') => {
    const usage = { files: 0, bytes: 0 };
    for await (const file of imageFiles(root, section, signal)) {
      usage.files++;
      usage.bytes += file.bytes;
      if (!Number.isSafeInteger(usage.bytes))
        throw new Error('Image storage usage exceeds the supported range.');
    }
    return usage;
  };
  const objects = await count('objects');
  const requestCache = await count('request-images');
  signal?.throwIfAborted();
  return { state: 'ready', revision, objects, requestCache };
}

export async function clearRequestImageFiles(
  root: string,
  signal?: AbortSignal,
): Promise<ImageFileUsage> {
  const removed = { files: 0, bytes: 0 };
  const directories = new Set<string>();
  for await (const file of imageFiles(root, 'request-images', signal)) {
    signal?.throwIfAborted();
    await unlink(file.path);
    removed.files++;
    removed.bytes += file.bytes;
    directories.add(file.directory);
  }
  for (const directory of directories) {
    const handle = await open(directory, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  return removed;
}

export async function clearUnreferencedImageFiles(
  root: string,
  retained: ReadonlySet<string>,
  signal?: AbortSignal,
): Promise<ImageFileUsage> {
  await inspectRetainedImageFiles(root, retained, signal);
  signal?.throwIfAborted();
  const removed = { files: 0, bytes: 0 };
  const directories = new Set<string>();
  for await (const file of imageFiles(root, 'objects', signal)) {
    if (retained.has(`sha256:${file.name}`)) continue;
    signal?.throwIfAborted();
    await unlink(file.path);
    removed.files++;
    removed.bytes += file.bytes;
    directories.add(file.directory);
  }
  for (const directory of directories) {
    const handle = await open(directory, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  return removed;
}

export async function inspectRetainedImageFiles(
  root: string,
  retained: ReadonlySet<string>,
  signal?: AbortSignal,
): Promise<Pick<ImageObjectInspection, 'retainedObjects' | 'unreferencedObjects'>> {
  const remaining = new Set(retained);
  const retainedObjects = { files: 0, bytes: 0 };
  const unreferencedObjects = { files: 0, bytes: 0 };
  for await (const file of imageFiles(root, 'objects', signal)) {
    const id = `sha256:${file.name}`;
    const usage = retained.has(id) ? retainedObjects : unreferencedObjects;
    usage.files++;
    usage.bytes += file.bytes;
    if (!Number.isSafeInteger(usage.bytes))
      throw new Error('Image storage usage exceeds the supported range.');
    remaining.delete(id);
  }
  if (remaining.size) throw new Error('Referenced original images are missing from storage.');
  signal?.throwIfAborted();
  return { retainedObjects, unreferencedObjects };
}
