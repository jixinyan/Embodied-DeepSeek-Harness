import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { snapshotSessionEvent, type SessionEvent } from '@deepseek-ai/dsh-session';
import { CORE_TOOLS } from '@edh/tools';
import { inspectStoredImageReferences } from '@edh/storage';
import { workspaceRecordOwners } from './workspace-record-owners.js';
import type {
  DeploymentRetentionContext,
  DeploymentRetentionBinding,
} from './deployment-retention.js';

const text = z.string();
const count = z.number().int().nonnegative().safe();
const step = { turn: count.positive(), step: count.positive() };
const jsonObject = z.record(text, z.unknown());
const range = z.object({ start: count, end: count }).strict();
const nativeTools = new Set(CORE_TOOLS.map((name) => name.replaceAll('.', '__')));
const toolName = text.refine((name) => nativeTools.has(name), 'Unknown native tool payload.');
const nativeData = {
  'turn/start': z.object({ turn: count.positive() }).strict(),
  'turn/end': z.object({ turn: count.positive(), reason: jsonObject }).strict(),
  'step/start': z.object(step).strict(),
  'step/end': z.object(step).strict(),
  'user/message': jsonObject,
  'assistant/message': z
    .object({
      ...step,
      message: jsonObject,
      stream: z.array(jsonObject),
      usage: jsonObject.optional(),
      interrupted: z.literal(true).optional(),
    })
    .strict(),
  'assistant/attempt': z.object({ ...step, stream: z.array(jsonObject) }).strict(),
  'tool/call': z.object({ ...step, callId: text.min(1), name: toolName, arguments: text }).strict(),
  'tool/result': z
    .object({
      ...step,
      message: jsonObject,
      error: z.object({ name: text, code: text }).strict().optional(),
    })
    .strict(),
  'request/header': z
    .object({
      header: z
        .object({
          config: jsonObject,
          adapterDefaults: jsonObject.optional(),
          system: text.optional(),
          tools: z.array(jsonObject).optional(),
        })
        .strict(),
      reason: z.enum(['initial', 'resume', 'change', 'series']),
      startsSeries: z.literal(true).optional(),
    })
    .strict(),
  'request/context': z
    .object({
      provider: text.min(1),
      model: text.min(1),
      contextWindow: count.positive().optional(),
    })
    .strict(),
  'session/end-seed': z.object({ inherited: z.literal(true).optional() }).strict(),
  'agent/inbox/spliced': z
    .object({
      target: z.enum(['next-turn', 'next-step']),
      start: count,
      removedCount: count.optional(),
      inserted: z.array(jsonObject),
      outcome: z.literal('canceled').optional(),
    })
    .strict(),
  'todo/write': z
    .object({
      todos: z.array(
        z
          .object({ content: text, status: z.enum(['pending', 'in_progress', 'completed']) })
          .strict(),
      ),
    })
    .strict(),
  'compaction/start': z
    .object({ compactionId: text.min(1), sourceCommandId: text.optional(), turn: count.nullable() })
    .strict(),
  'compaction/end': z
    .object({
      compactionId: text.min(1),
      sourceCommandId: text.optional(),
      turn: count.nullable(),
      error: text.optional(),
    })
    .strict(),
  'compaction/prune': z
    .object({ shadowedRange: range, shadowedSeqs: z.array(count), shadowedTokenCount: count })
    .strict(),
  'compaction/summary': z
    .object({
      compactionId: text.min(1),
      sourceCommandId: text.optional(),
      summary: z.array(jsonObject),
      shadowedRange: range,
      shadowedSeqs: z.array(count),
      shadowedTokenCount: count,
      provider: text.min(1),
      model: text.min(1),
      maxTokens: count.positive().optional(),
      usage: jsonObject.optional(),
      rawOutput: z.array(jsonObject).optional(),
      llmStreamCall: z.literal(true).optional(),
    })
    .strict(),
  'edh/visual-history': z
    .object({
      maxImages: count.positive(),
      incomingImages: count,
      retainedImages: count,
      omitted: z.array(
        z
          .object({ originalSeq: count, replacementSeq: count, attachmentIds: z.array(text) })
          .strict(),
      ),
    })
    .strict(),
  'llm/retry': z
    .object({
      retryId: text.min(1),
      ...step,
      provider: text.min(1),
      mode: z.enum(['normal', 'always']),
      policyKey: text.min(1),
      retry: count.positive(),
      maxRetries: count.optional(),
      delayMs: count,
      failure: jsonObject,
    })
    .strict(),
  'llm/retry-started': z
    .object({ retryId: text.min(1), ...step, retry: count.positive() })
    .strict(),
} satisfies Record<string, z.ZodType>;
const nativeEnvelope = z
  .object({
    type: text.min(1),
    seq: count,
    time: z.number().finite(),
    data: z.unknown(),
    ignorable: z.literal(true).optional(),
    sourceEventSeqs: z.array(count).optional(),
    surfaceOp: z.unknown().optional(),
  })
  .strict();
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

function strings(value: unknown): string[] {
  const result: string[] = [];
  const pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (typeof item === 'string') result.push(item);
    else if (item && typeof item === 'object') pending.push(...Object.values(item));
  }
  return result;
}

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
          if (identityFields.has(field) && typeof child === 'string' && child.length >= 16)
            addIdentity(child, row.key);
          if (child && typeof child === 'object') pending.push(child);
        }
      }
      const contents = [row.key, ...strings(row.value)].join('\n');
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
    const event = nativeEnvelope.parse(value);
    if (!Object.hasOwn(nativeData, event.type))
      throw new Error(`Unknown native audit event schema: ${event.type}`);
    const schema = nativeData[event.type as keyof typeof nativeData];
    schema.parse(event.data);
    if (event.type === 'request/header')
      for (const tool of nativeData['request/header'].parse(event.data).header.tools ?? [])
        toolName.parse(tool.name);
    snapshotSessionEvent(event as SessionEvent);
    const pending = [event.data];
    while (pending.length) {
      const item = pending.pop();
      if (!item || typeof item !== 'object') continue;
      const fields = item as Record<string, unknown>;
      if (fields.type === 'tool-call') toolName.parse(fields.name);
      if (fields.type === 'file')
        throw new Error('Native file attachment extensions require their own retention binding.');
      pending.push(...Object.values(item).filter((child) => child && typeof child === 'object'));
    }
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
      for (const sequence of z
        .array(count)
        .parse((event.data as Record<string, unknown>).shadowedSeqs))
        source(sequence);
    if (event.type === 'edh/visual-history')
      for (const omitted of nativeData['edh/visual-history'].parse(event.data).omitted) {
        source(omitted.originalSeq);
        source(omitted.replacementSeq);
      }
  };
  const references = {
    version: 'edh-native-payload-sources-v1',
    inspect: ({ key, value }: { key: string; value: unknown }) => {
      if (key.startsWith('archived-request:')) return [];
      refresh();
      const keys = new Set<string>();
      if (key.startsWith('session-audit-event:')) inspectNative(key, value, keys);
      for (const runId of recordRuns.get(key) ?? [])
        for (const recordKey of runRecords.get(runId) ?? []) keys.add(recordKey);
      const contents = strings(value).join('\n');
      for (const [identity, recordKeys] of identities)
        if (contents.includes(identity)) for (const recordKey of recordKeys) keys.add(recordKey);
      return [...keys];
    },
  };
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
    domainRetention: { version: 'edh-native-workspace-v1', references, sources: [nativeSource] },
    imageRetention: {
      version: 'edh-native-images-v1',
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
                for (const value of strings(row.value))
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
                  const event = nativeEnvelope.parse(row.value);
                  if (event.type === 'edh/visual-history')
                    for (const omitted of nativeData['edh/visual-history'].parse(event.data)
                      .omitted)
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
