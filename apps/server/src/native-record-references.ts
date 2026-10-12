import type { LocalStore } from '@edh/storage';
import { admitNativeAuditEvent } from './native-audit-payloads.js';
import type { WorkspaceReferenceExtension } from './workspace-record-owners.js';

const namespaces = new Set([
  'user-session',
  'session-open-request',
  'session-task-request',
  'session-task-catalog',
  'session-task-member',
  'run-user-session',
  'request',
  'run',
  'run-config',
  'run-submission',
  'run-interruption',
  'event',
  'assignment-history',
  'recovery',
  'recovery-event',
  'verdict-history',
  'verification-boundary',
  'verification-context',
  'report',
  'report-record',
  'report-delivery',
  'report-ack',
  'sensor-sample',
  'sensor-image',
  'plan',
  'clarification',
  'file',
  'session-audit',
  'session-audit-event',
  'skill',
  'archived-request',
]);
const identityFields = new Set([
  'id',
  'runId',
  'task_id',
  'assignmentId',
  'assignment_id',
  'sessionId',
  'agent_id',
  'team_run_id',
  'recoveryId',
  'recovery_id',
  'reportId',
  'verdictId',
  'verdict_id',
  'boundaryId',
  'execution_id',
  'job_id',
  'evidenceId',
  'skill_id',
]);
const generatedIdentity = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;

export function nativePayloadStrings(value: unknown): string[] {
  const result: string[] = [];
  const pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (typeof item === 'string') result.push(item);
    else if (item && typeof item === 'object') pending.push(...Object.values(item));
  }
  return result;
}

export function nativeRecordReferences(store: LocalStore): WorkspaceReferenceExtension {
  let inventorySequence = -1;
  let identities = new Map<string, Set<string>>();
  let runRecords = new Map<string, Set<string>>();
  let recordRuns = new Map<string, Set<string>>();
  const refresh = () => {
    const sequence = store.statistics().sequence;
    if (sequence === inventorySequence) return;
    identities = new Map();
    runRecords = new Map();
    recordRuns = new Map();
    const addIdentity = (identity: string, key: string) => {
      const keys = identities.get(identity) ?? new Set<string>();
      keys.add(key);
      identities.set(identity, keys);
    };
    const runIds = [...store.revisions('run:')].map(({ key }) => key.slice(4));
    for (const row of store.scan('')) {
      const namespace = row.key.slice(0, row.key.indexOf(':'));
      if (!namespaces.has(namespace))
        throw new Error(`Unknown native record namespace: ${namespace}`);
      if (namespace === 'archived-request') continue;
      addIdentity(row.key, row.key);
      const pending = [row.value];
      while (pending.length) {
        const value = pending.pop();
        if (!value || typeof value !== 'object') continue;
        for (const [field, child] of Object.entries(value)) {
          if (
            identityFields.has(field) &&
            typeof child === 'string' &&
            generatedIdentity.test(child)
          )
            addIdentity(child, row.key);
          if (child && typeof child === 'object') pending.push(child);
        }
      }
      const contents = [row.key, ...nativePayloadStrings(row.value)].join('\n');
      const runs = new Set(runIds.filter((runId) => contents.includes(runId)));
      recordRuns.set(row.key, runs);
      for (const runId of runs) {
        const records = runRecords.get(runId) ?? new Set<string>();
        records.add(row.key);
        runRecords.set(runId, records);
      }
    }
    inventorySequence = sequence;
  };
  const inspectNative = (key: string, value: unknown, references: Set<string>) => {
    const event = admitNativeAuditEvent(value);
    const parts = key.slice('session-audit-event:'.length).split(':');
    const prefix = `session-audit-event:${parts[0]}:${parts[1]}:`;
    const source = (sequence: number) => {
      if (sequence >= event.seq)
        throw new Error('Native payload cites a nonpreceding source event.');
      const sourceKey = `${prefix}${sequence}`;
      if (!store.revision(sourceKey)) throw new Error('Native payload source event is missing.');
      references.add(sourceKey);
    };
    if (event.type === 'compaction/prune' || event.type === 'compaction/summary')
      for (const sequence of event.data.shadowedSeqs) source(sequence);
    if (event.type === 'edh/visual-history')
      for (const omitted of event.data.omitted) {
        source(omitted.originalSeq);
        source(omitted.replacementSeq);
      }
  };
  return {
    version: 'edh-native-payload-sources-v4',
    inspect: ({ key, value }) => {
      if (key.startsWith('archived-request:')) return [];
      refresh();
      const keys = new Set<string>();
      if (key.startsWith('session-audit-event:')) inspectNative(key, value, keys);
      // Run 记录保留全部任务来源，各个来源通过 Run 记录相互保护。
      for (const runId of recordRuns.get(key) ?? []) {
        const root = `run:${runId}`;
        if (key === root) for (const recordKey of runRecords.get(runId)!) keys.add(recordKey);
        else keys.add(root);
      }
      const contents = nativePayloadStrings(value).join('\n');
      for (const [identity, recordKeys] of identities) {
        if (!contents.includes(identity)) continue;
        if (runRecords.has(identity)) {
          const root = `run:${identity}`;
          if (!recordKeys.has(root)) throw new Error('Native Run identity source is incomplete.');
          keys.add(root);
        } else for (const recordKey of recordKeys) keys.add(recordKey);
      }
      return [...keys];
    },
  };
}
