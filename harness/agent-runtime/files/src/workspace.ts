import type { LocalStore } from '@edh/storage';
import type { WorkspaceFile } from './index.js';
/** Logical assignment files. Paths never address the host filesystem. */
export class AssignmentFiles {
  constructor(private readonly store: LocalStore) {}
  private key(assignmentId: string, path: string): string {
    if (
      !/^[A-Za-z0-9-]+$/.test(assignmentId) ||
      !path ||
      path.length > 180 ||
      path.startsWith('/') ||
      path.split('/').some((part) => !part || part === '..' || part === '.') ||
      /[\\\x00-\x1f]/.test(path)
    )
      throw new Error('Invalid workspace path.');
    return `file:${assignmentId}:${path}`;
  }
  read(assignmentId: string, path: string): WorkspaceFile {
    const r = this.store.get<string>(this.key(assignmentId, path));
    if (!r) throw new Error('Workspace file not found.');
    return { path, content: r.value, version: String(r.version) };
  }
  write(
    assignmentId: string,
    path: string,
    content: string,
    expectedVersion: number,
  ): WorkspaceFile {
    if (Buffer.byteLength(content) > 128 * 1024) throw new Error('Workspace file exceeds 128 KiB.');
    const version = this.store.put(this.key(assignmentId, path), content, expectedVersion);
    return { path, content, version: String(version) };
  }
  search(assignmentId: string, query: string): WorkspaceFile[] {
    this.key(assignmentId, 'probe');
    const prefix = `file:${assignmentId}:`;
    return this.store
      .list<string>(prefix)
      .filter((r) => r.value.includes(query) || r.key.includes(query))
      .slice(0, 50)
      .map((r) => ({
        path: r.key.slice(prefix.length),
        content: r.value,
        version: String(r.version),
      }));
  }
}
