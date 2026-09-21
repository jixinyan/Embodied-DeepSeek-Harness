import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { ContractValidator } from '@edh/contracts';
import type { SkillBundle } from '@edh/memory';
import { SensorSamples } from '@edh/perception';
import { RecoveryHistory, type RunState } from '@edh/tasks';
import type { LocalStore } from '@edh/storage';
import { SessionTaskHistory, sessionTaskKey, readSessionTasks } from './session-task-history.js';

const identifier = z.string().min(1).max(128);
const ownerSchema = z.object({ sessionId: identifier });
const runSchema = z.object({
  id: identifier,
  source: z.enum(['test_fixture', 'simulation', 'hardware']),
  verdicts: z.array(z.unknown()),
});

export interface SkillProvenance {
  skillId: string;
  state: 'available' | 'incomplete';
  storeSequence: number;
  runId: string | null;
  userSessionId: string | null;
  recoveryId: string;
  goalId: string | null;
  failedVerdictId: string | null;
  successfulVerdictId: string;
  records: { key: string; version: number | null }[];
  evidence: { evidenceId: string; attachmentIds: string[] }[];
  images: { attachmentId: string; evidenceIds: string[] }[];
  missing: { key: string; reason: string }[];
}

export function inspectSkillProvenance(
  store: LocalStore,
  validator: ContractValidator,
  skillId: string,
): SkillProvenance {
  return resolveProvenance(store, validator, skillId, store.statistics().sequence);
}

function resolveProvenance(
  store: LocalStore,
  validator: ContractValidator,
  skillId: string,
  storeSequence: number,
): SkillProvenance {
  identifier.parse(skillId);
  const skillRecord = store.get<SkillBundle>(`skill:${skillId}`);
  if (!skillRecord) throw new Error('Skill not found.');
  const metadata = validator.parse('SkillMetadata', skillRecord.value.metadata);
  if (metadata.skill_id !== skillId) throw new Error('Skill identity does not match its record.');
  const result: SkillProvenance = {
    skillId,
    state: 'available',
    storeSequence,
    runId: null,
    userSessionId: null,
    recoveryId: metadata.recovery_id,
    goalId: null,
    failedVerdictId: null,
    successfulVerdictId: metadata.verdict_ref,
    records: [{ key: `skill:${skillId}`, version: skillRecord.version }],
    evidence: [],
    images: [],
    missing: [],
  };
  const read = <T>(key: string) => {
    const record = store.get<T>(key);
    result.records.push({ key, version: record?.version ?? null });
    if (!record) {
      result.state = 'incomplete';
      result.missing.push({ key, reason: 'Referenced record is unavailable.' });
    }
    return record?.value;
  };
  const recoveryKey = `recovery:${metadata.recovery_id}`;
  if (read(recoveryKey) === undefined) return result;
  const recovery = new RecoveryHistory(store).read(metadata.recovery_id);
  if (!recovery.runId) {
    result.state = 'incomplete';
    result.missing.push({
      key: recoveryKey,
      reason: 'Recovery has no explicit source run identity.',
    });
    return result;
  }
  result.runId = identifier.parse(recovery.runId);
  result.goalId = identifier.parse(recovery.context.originalGoalId);
  const failed = validator.parse('VerificationResult', recovery.context.failedVerdict);
  const passed = validator.parse('VerificationResult', recovery.result);
  result.failedVerdictId = failed.verdict_id;
  if (
    failed.status !== 'failed' ||
    passed.status !== 'passed' ||
    passed.verdict_id !== metadata.verdict_ref ||
    passed.task_scope.recovery_id !== metadata.recovery_id ||
    failed.task_scope.task_id !== result.runId ||
    passed.task_scope.task_id !== result.runId ||
    failed.task_scope.goal_id !== result.goalId ||
    passed.task_scope.goal_id !== result.goalId ||
    failed.goal_contract_id !== passed.goal_contract_id ||
    failed.goal_contract_version !== passed.goal_contract_version ||
    failed.verdict_id === passed.verdict_id ||
    failed.task_scope.attempt_id === passed.task_scope.attempt_id
  )
    throw new Error('Skill recovery does not establish failed-to-passed original-goal provenance.');
  const references = new Set([...failed.evidence_refs, ...passed.evidence_refs]);
  if (
    references.size !== metadata.evidence_refs.length ||
    new Set(metadata.evidence_refs).size !== metadata.evidence_refs.length ||
    metadata.evidence_refs.some((ref) => !references.has(ref))
  )
    throw new Error('Skill evidence references do not match its recovery verdicts.');
  const run = read<RunState>(`run:${result.runId}`);
  if (run === undefined) return result;
  const checkedRun = runSchema.parse(run);
  if (
    checkedRun.id !== result.runId ||
    checkedRun.source !== metadata.origin ||
    !run.verdicts.some((value) => isDeepStrictEqual(value, failed)) ||
    !run.verdicts.some((value) => isDeepStrictEqual(value, passed))
  )
    throw new Error('Skill source run does not retain the matching origin and accepted verdicts.');
  read(`run-config:${result.runId}`);
  const ownershipKey = `run-user-session:${result.runId}`;
  const ownership = store.get(ownershipKey);
  if (ownership) {
    result.records.push({ key: ownershipKey, version: ownership.version });
    result.userSessionId = ownerSchema.parse(ownership.value).sessionId;
    const sessionKey = `user-session:${result.userSessionId}`;
    const session = read(sessionKey);
    if (session !== undefined) {
      const history = new SessionTaskHistory(store);
      const checked = readSessionTasks(session);
      if (checked.id !== result.userSessionId)
        throw new Error('Skill source session does not own its run.');
      const member = checked.taskHistory ? read(sessionTaskKey(checked.id, result.runId)) : session;
      if (member !== undefined && !history.has(checked, result.runId))
        throw new Error('Skill source session does not own its run.');
    }
  }
  const catalog = new SensorSamples(store, validator, result.runId, metadata.origin);
  const images = new Map<string, { attachmentId: string; evidenceIds: string[] }>();
  for (const evidenceId of metadata.evidence_refs) {
    const key = `sensor-sample:${JSON.stringify([result.runId, evidenceId])}`;
    if (read(key) === undefined) continue;
    const sample = catalog.read(evidenceId)!;
    if (
      sample.evidence.task_scope.task_id !== result.runId ||
      sample.evidence.visibility !== 'agent'
    )
      throw new Error('Skill evidence has an incompatible task scope or visibility.');
    const attachmentIds = (sample.images ?? []).map((image) => image.attachmentId);
    result.evidence.push({ evidenceId, attachmentIds });
    for (const attachmentId of attachmentIds) {
      const existing = images.get(attachmentId);
      if (existing) existing.evidenceIds.push(evidenceId);
      else {
        images.set(attachmentId, { attachmentId, evidenceIds: [evidenceId] });
        read(`sensor-image:${JSON.stringify([result.runId, attachmentId])}`);
      }
    }
  }
  result.images = [...images.values()];
  return result;
}

export function readWorkspaceSkills(store: LocalStore, validator: ContractValidator) {
  const recent: { key: string; value: SkillBundle }[] = [];
  for (const row of store.scan<SkillBundle>('skill:')) {
    recent.push(row);
    if (recent.length > 100) recent.shift();
  }
  const sequence = store.statistics().sequence;
  return {
    skills: recent.map(({ key, value: bundle }) => {
      const provenance = resolveProvenance(store, validator, key.slice('skill:'.length), sequence);
      return {
        ...bundle,
        runId: provenance.runId,
        userSessionId: provenance.userSessionId,
        provenance,
      };
    }),
  };
}

export function skillSourceLimitations(source: RunState['source']): string[] {
  runSchema.shape.source.parse(source);
  return source === 'test_fixture'
    ? ['Observed in the CPU fixture only; no cross-embodiment transfer has been validated.']
    : [
        `Observed in the source ${source} configuration only; transfer to other environments, embodiments or policies has not been validated.`,
      ];
}
