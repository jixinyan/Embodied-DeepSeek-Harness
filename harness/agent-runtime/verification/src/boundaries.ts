import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { ContractValidator, ExecutionStatus } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';

const identifier = z.string().min(1).max(128);
const recordSchema = z
  .object({
    format: z.literal('edh.verification-boundary.v1'),
    runId: identifier,
    status: z.unknown(),
  })
  .strict();

export class VerificationBoundaries {
  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
    private readonly runId: string,
  ) {
    identifier.parse(runId);
  }

  private key(executionId: string, boundaryId: string): string {
    return `verification-boundary:${JSON.stringify([
      this.runId,
      identifier.parse(executionId),
      identifier.parse(boundaryId),
    ])}`;
  }

  private validate(value: unknown): ExecutionStatus {
    const status = this.validator.parse('ExecutionStatus', value);
    if (status.task_scope.task_id !== this.runId)
      throw new Error('Verification boundary belongs to another run.');
    if (status.state !== 'paused' && status.state !== 'ended')
      throw new Error('Historical verification record requires a stopped execution boundary.');
    return status;
  }

  read(executionId: string, boundaryId: string): ExecutionStatus | undefined {
    const row = this.store.get(this.key(executionId, boundaryId));
    if (!row) return undefined;
    if (row.version !== 1) throw new Error('Verification boundary record was rewritten.');
    const record = recordSchema.parse(row.value);
    const status = this.validate(record.status);
    if (
      record.runId !== this.runId ||
      status.execution_id !== executionId ||
      status.boundary_event_id !== boundaryId
    )
      throw new Error('Verification boundary record identity conflicts.');
    return status;
  }

  admit(previous: ExecutionStatus | undefined, value: ExecutionStatus): boolean {
    const status = this.validate(value);
    if (
      status.state !== 'ended' ||
      !status.device_confirmed ||
      !['policy_stop', 'episode_terminated', 'budget_exhausted'].includes(status.stop_reason ?? '')
    )
      throw new Error('Formal verification requires a confirmed completed execution boundary.');
    if (previous) {
      this.validator.parse('ExecutionStatus', previous);
      if (
        previous.execution_id !== status.execution_id ||
        !isDeepStrictEqual(previous.task_scope, status.task_scope) ||
        previous.state_version >= status.state_version
      )
        throw new Error('Verification boundary transition identity or version conflicts.');
    }
    const saved = this.read(status.execution_id, status.boundary_event_id!);
    if (saved) throw new Error('Execution must publish a fresh verification boundary.');
    if (previous?.boundary_event_id === status.boundary_event_id)
      throw new Error('Previously admitted verification boundary record is missing.');
    this.store.put(
      this.key(status.execution_id, status.boundary_event_id!),
      { format: 'edh.verification-boundary.v1', runId: this.runId, status },
      0,
    );
    if (!isDeepStrictEqual(this.read(status.execution_id, status.boundary_event_id!), status))
      throw new Error('Verification boundary publication did not preserve its source.');
    return true;
  }
}
