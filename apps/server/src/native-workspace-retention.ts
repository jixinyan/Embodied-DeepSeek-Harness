import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { inspectStoredImageReferences } from '@edh/storage';
import { admitNativeAuditEvent } from './native-audit-payloads.js';
import { nativePayloadStrings, nativeRecordReferences } from './native-record-references.js';
import { workspaceRecordOwners } from './workspace-record-owners.js';
import type {
  DeploymentRetentionContext,
  DeploymentRetentionBinding,
} from './deployment-retention.js';

export function nativeWorkspaceRetention(
  context: DeploymentRetentionContext,
): DeploymentRetentionBinding {
  const { store } = context;
  if (
    !context.providers.length ||
    context.providers.some(
      (provider) => !['robotwin', 'robocasa', 'behavior', 'robodojo'].includes(provider),
    ) ||
    context.additionalTools.length
  )
    throw new Error(
      'Native retention requires built-in native environments and tools. Extension deployments must supply their retention binding.',
    );
  const references = nativeRecordReferences(store);
  const exportLease = () => {
    store.assertCurrent();
    const files: number[] = [];
    const skills = [...store.scan<{ metadata: { skill_id: string }; markdown: string }>('skill:')];
    const root = resolve(store.directory, 'skills');
    const names = existsSync(root) ? readdirSync(root).sort() : [];
    const expectedNames = skills.map(({ value }) => value.metadata.skill_id).sort();
    if (JSON.stringify(names) !== JSON.stringify(expectedNames))
      throw new Error('Native SKILL export inventory conflicts with retained sources.');
    const digest = createHash('sha256').update(String(store.statistics().sequence));
    try {
      for (const row of skills) {
        const id = z
          .string()
          .regex(/^[A-Za-z0-9-]+$/)
          .parse(row.value.metadata.skill_id);
        const directory = resolve(root, id);
        if (JSON.stringify(readdirSync(directory)) !== JSON.stringify(['SKILL.md']))
          throw new Error('Native SKILL export contains an unknown source file.');
        const fd = openSync(resolve(directory, 'SKILL.md'), 'r');
        files.push(fd);
        const bytes = readFileSync(fd, 'utf8');
        if (
          bytes !==
          `---\n${JSON.stringify(row.value.metadata, null, 2)}\n---\n\n${row.value.markdown}\n`
        )
          throw new Error('Native SKILL export conflicts with its immutable journal source.');
        digest.update(row.key).update(bytes);
      }
      let released = false;
      return {
        revision: digest.digest('hex'),
        keys: skills.map(({ key }) => key),
        release: () => {
          if (released) throw new Error('Native export lease was already released.');
          released = true;
          for (const fd of files) closeSync(fd);
        },
      };
    } catch (error) {
      for (const fd of files) closeSync(fd);
      throw error;
    }
  };
  const nativeSource = {
    id: 'native-workspace-exports',
    acquire: (signal: AbortSignal) => {
      signal.throwIfAborted();
      return exportLease();
    },
  };
  const owners = workspaceRecordOwners(store, context.validator, references);
  return {
    domainRetention: { version: 'edh-native-workspace-v4', references, sources: [nativeSource] },
    imageRetention: {
      version: 'edh-native-images-v4',
      sources: [
        {
          id: 'native-payload-images',
          acquire: (signal) => {
            signal.throwIfAborted();
            if (!context.imageDirectory)
              throw new Error(
                'Native image retention requires the owned local attachment directory. Custom image providers must supply their retention binding.',
              );
            const lease = exportLease();
            try {
              const ids = new Set(
                inspectStoredImageReferences(store).references.map(
                  ({ attachmentId }) => attachmentId,
                ),
              );
              for (const row of store.scan('')) {
                const owner = owners.find((candidate) => row.key.startsWith(candidate.prefix));
                if (!owner) throw new Error('Native image source has no complete record owner.');
                for (const key of owner.inspect(row).references)
                  if (!store.revision(key))
                    throw new Error('Native image source record is missing.');
                for (const value of nativePayloadStrings(row.value))
                  for (const match of value.matchAll(/sha256:[a-f0-9]{64}/g)) {
                    const hash = match[0].slice(7);
                    if (
                      existsSync(
                        resolve(context.imageDirectory, 'v1/objects', hash.slice(0, 2), hash),
                      )
                    )
                      ids.add(match[0]);
                  }
                if (row.key.startsWith('session-audit-event:')) {
                  const event = admitNativeAuditEvent(row.value);
                  if (event.type === 'edh/visual-history')
                    for (const omitted of event.data.omitted)
                      for (const attachmentId of omitted.attachmentIds)
                        ids.add(
                          z
                            .string()
                            .regex(/^sha256:[a-f0-9]{64}$/)
                            .parse(attachmentId),
                        );
                }
              }
              return {
                revision: lease.revision,
                attachmentIds: [...ids].sort(),
                release: lease.release,
              };
            } catch (error) {
              lease.release();
              throw error;
            }
          },
        },
      ],
    },
  };
}
