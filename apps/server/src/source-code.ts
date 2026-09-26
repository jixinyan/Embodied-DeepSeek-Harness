import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);

export async function sourceCodeAvailability(root: string) {
  const publishedUrl = process.env.EDH_PUBLISHED_SOURCE_URL;
  const gitDirectory = resolve(root, '.git');
  const hasGitDirectory = await stat(gitDirectory).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    },
  );
  if (!hasGitDirectory) return { state: 'unavailable', revision: null, url: null };
  const [{ stdout: revisionOutput }, { stdout: changes }] = await Promise.all([
    execute('git', ['rev-parse', 'HEAD'], { cwd: root }),
    execute('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root }),
  ]);
  const revision = revisionOutput.trim();
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid Git source revision.');
  if (changes.trim()) return { state: 'modified', revision, url: null };
  if (!publishedUrl) return { state: 'unpublished', revision, url: null };
  const url = new URL(publishedUrl);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith(`/tree/${revision}`)
  )
    throw new Error('Published source URL must identify the exact current commit.');
  return { state: 'published', revision, url: url.href };
}
