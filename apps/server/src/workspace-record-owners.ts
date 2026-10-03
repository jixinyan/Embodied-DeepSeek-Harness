import { z } from 'zod';
import type { ContractValidator } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';
import { applicationRecordOwners } from './application-record-owners.js';
import { nativeAuditRecordOwners } from './native-audit-record-owners.js';
import { sessionRecordOwners } from './session-record-owners.js';
import { evidenceRecordOwners } from './evidence-record-owners.js';
import { reportRecordOwners } from './report-record-owners.js';
import { taskRecordOwners } from './task-record-owners.js';
import { runRecordOwners } from './run-record-owners.js';
import { RunEventReferences } from './event-record-owners.js';
import { RequestIdentityArchives } from './request-identity-archives.js';
import { inspectSkillProvenance } from './skill-provenance.js';
import type { DomainRecordOwner } from './domain-retention.js';

export interface WorkspaceReferenceExtension {
  version: string;
  inspect(record: { readonly key: string; readonly value: unknown }): readonly string[];
}

export function workspaceRecordOwners(
  store: LocalStore,
  validator: ContractValidator,
  extension: WorkspaceReferenceExtension,
): DomainRecordOwner[] {
  z.string().min(1).max(128).parse(extension?.version);
  if (typeof extension.inspect !== 'function')
    throw new Error('Workspace retention requires explicit payload reference ownership.');
  const custom = Object.freeze({
    version: extension.version,
    inspect: extension.inspect.bind(extension),
  });
  const events = new RunEventReferences(store, validator, {
    version: custom.version,
    inspect: (event, runId) =>
      custom.inspect({ key: `event:${runId}:${event.sequence}`, value: event }),
  });
  const owners = [
    ...sessionRecordOwners(store, validator),
    ...evidenceRecordOwners(store, validator),
    ...reportRecordOwners(store, validator),
    ...taskRecordOwners(store, validator),
    ...runRecordOwners(store, validator, { inlineEventReferences: events }),
    events.owner(),
    ...applicationRecordOwners(store, validator, custom),
    ...nativeAuditRecordOwners(store, validator, custom),
    new RequestIdentityArchives(store).owner(),
    {
      id: 'skill',
      prefix: 'skill:',
      version: '1',
      inspect: ({ key }) => {
        const provenance = inspectSkillProvenance(store, validator, key.slice('skill:'.length));
        if (provenance.state !== 'available')
          throw new Error('SKILL retention requires complete source provenance.');
        return { references: provenance.records.map((record) => record.key), retain: true };
      },
    } satisfies DomainRecordOwner,
  ];
  return owners.map((owner) => ({
    ...owner,
    version: JSON.stringify([owner.version, custom.version]),
    inspect: (record) => {
      const declaration = owner.inspect(record);
      const references = z
        .array(z.string().min(1).max(512))
        .parse(custom.inspect(Object.freeze({ key: record.key, value: record.value })));
      return {
        ...declaration,
        references: [...new Set([...declaration.references, ...references])],
      };
    },
  }));
}
