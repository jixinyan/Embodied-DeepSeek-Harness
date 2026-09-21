import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { CheckResult, ContractValidator, TaskScope } from '@edh/contracts';
import type { SensorSample } from '@edh/execution';
import type { SensorSamples } from '@edh/perception';
import type { LocalStore } from '@edh/storage';

const identifier = z.string().min(1).max(128);
const recordSchema = z
  .object({
    format: z.literal('edh.verification-context.v1'),
    runId: identifier,
    assignmentId: identifier,
    requestId: identifier,
    executionId: identifier,
    boundaryId: identifier,
    scope: z.unknown(),
    evidenceId: identifier,
    facts: z.array(z.unknown()),
  })
  .strict();

export interface VerificationContextRecord {
  format: 'edh.verification-context.v1';
  runId: string;
  assignmentId: string;
  requestId: string;
  executionId: string;
  boundaryId: string;
  scope: TaskScope;
  evidenceId: string;
  facts: CheckResult[];
}

export class VerificationContexts {
  private readonly active = new Map<string, number>();
  private closed = false;

  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
    private readonly samples: SensorSamples,
    private readonly runId: string,
  ) {
    identifier.parse(runId);
  }

  get activeCount(): number {
    return this.active.size;
  }

  private key(id: string) {
    identifier.parse(id);
    return `verification-context:${JSON.stringify([this.runId, id])}`;
  }

  private sample(id: string, scope: TaskScope, agentVisible = false): SensorSample {
    const sample = this.samples.read(id);
    if (
      !sample ||
      (agentVisible && sample.evidence.visibility !== 'agent') ||
      !isDeepStrictEqual(sample.evidence.task_scope, scope) ||
      scope.task_id !== this.runId
    )
      throw new Error('Verification evidence is unavailable or outside the assignment scope.');
    return sample;
  }

  private validate(value: unknown): VerificationContextRecord {
    const record = recordSchema.parse(value);
    const scope = this.validator.parse('TaskScope', record.scope);
    const facts = record.facts.map((fact) => this.validator.parse('CheckResult', fact));
    if (new Set(facts.map((fact) => fact.check_id)).size !== facts.length)
      throw new Error('Verification checks contain duplicate identities.');
    if (facts.some((fact) => fact.evidence_refs.some((id) => id !== record.evidenceId)))
      throw new Error('Verification checks reference evidence outside the captured sample.');
    if (record.runId !== this.runId || scope.task_id !== this.runId)
      throw new Error('Verification context belongs to another run.');
    return { ...record, scope, facts };
  }

  open(
    assignmentId: string,
    input: {
      requestId: string;
      executionId: string;
      boundaryId: string;
      scope: TaskScope;
      evidenceId: string;
    },
  ): void {
    if (this.closed) throw new Error('Verification contexts are closed.');
    if (this.active.has(assignmentId)) throw new Error('Verification assignment already exists.');
    const record = this.validate({
      ...input,
      format: 'edh.verification-context.v1',
      runId: this.runId,
      assignmentId,
      facts: [],
    });
    this.sample(record.evidenceId, record.scope);
    const version = this.store.put(this.key(assignmentId), record, 0);
    this.active.set(assignmentId, version);
  }

  inspect(assignmentId: string): VerificationContextRecord | undefined {
    const row = this.store.get(this.key(assignmentId));
    if (!row) return undefined;
    const record = this.validate(row.value);
    if (record.assignmentId !== assignmentId)
      throw new Error('Verification assignment identity conflict.');
    return record;
  }

  get(assignmentId: string): (VerificationContextRecord & { sample: SensorSample }) | undefined {
    const version = this.active.get(assignmentId);
    if (version === undefined) return undefined;
    if (this.store.revision(this.key(assignmentId))?.version !== version)
      throw new Error('Active verification context was changed outside its owner.');
    const record = this.inspect(assignmentId);
    if (!record) throw new Error('Active verification context is missing.');
    return {
      ...record,
      sample: this.sample(record.evidenceId, record.scope, record.facts.length > 0),
    };
  }

  update(assignmentId: string, facts: readonly CheckResult[], evidenceId: string): void {
    const current = this.get(assignmentId);
    if (!current) throw new Error('Verification assignment is no longer active.');
    const { sample: _sample, ...previous } = current;
    const record = this.validate({ ...previous, facts, evidenceId });
    this.sample(evidenceId, record.scope, true);
    const version = this.store.put(this.key(assignmentId), record, this.active.get(assignmentId)!);
    this.active.set(assignmentId, version);
  }

  release(assignmentId: string): void {
    this.active.delete(assignmentId);
  }

  close(): void {
    this.closed = true;
    this.active.clear();
  }
}
