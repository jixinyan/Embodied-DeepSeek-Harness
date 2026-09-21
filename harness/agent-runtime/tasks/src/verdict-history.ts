import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { ContractValidator, VerificationResult } from '@edh/contracts';
import type { LocalStore } from '@edh/storage';

export type VerdictSummary = Omit<VerificationResult, 'checks' | 'explanation'> & {
  detailsStored: true;
  checkCount: number;
  explanationPreview: string;
  explanationTruncated: boolean;
};
export type RunVerdict = VerificationResult | VerdictSummary;
const identifier = z.string().min(1).max(128);
const archiveSchema = z
  .object({
    format: z.literal('edh.verdict-history.v1'),
    runId: identifier,
    result: z.unknown(),
  })
  .strict();

export class VerdictHistory {
  constructor(
    private readonly store: LocalStore,
    private readonly validator: ContractValidator,
  ) {}

  private key(runId: string, verdictId: string): string {
    return `verdict-history:${JSON.stringify([identifier.parse(runId), identifier.parse(verdictId)])}`;
  }

  private summary(result: VerificationResult): VerdictSummary {
    const { checks, explanation, ...identity } = result;
    let preview = '';
    for (const character of explanation) {
      if (preview.length + character.length > 512) break;
      preview += character;
    }
    return {
      ...identity,
      detailsStored: true,
      checkCount: checks.length,
      explanationPreview: preview,
      explanationTruncated: preview.length !== explanation.length,
    };
  }

  read(runId: string, verdictId: string): VerificationResult | undefined {
    const row = this.store.get(this.key(runId, verdictId));
    if (!row) return undefined;
    if (row.version !== 1) throw new Error('Accepted verdict archive was rewritten.');
    const archive = archiveSchema.parse(row.value);
    const result = this.validator.parse('VerificationResult', archive.result);
    if (
      archive.runId !== runId ||
      result.task_scope.task_id !== runId ||
      result.verdict_id !== verdictId
    )
      throw new Error('Accepted verdict archive identity conflicts.');
    return result;
  }

  retain(runId: string, value: VerificationResult): VerdictSummary {
    const result = this.validator.parse('VerificationResult', value);
    if (result.task_scope.task_id !== runId)
      throw new Error('Accepted verdict belongs to another run.');
    const previous = this.read(runId, result.verdict_id);
    if (!previous)
      this.store.put(
        this.key(runId, result.verdict_id),
        {
          format: 'edh.verdict-history.v1',
          runId,
          result,
        },
        0,
      );
    const stored = previous ?? this.read(runId, result.verdict_id);
    if (!isDeepStrictEqual(stored, result))
      throw new Error('Accepted verdict archive is immutable.');
    return this.summary(result);
  }

  resolve(runId: string, value: RunVerdict): VerificationResult {
    if ('detailsStored' in value) {
      const result = this.read(runId, value.verdict_id);
      if (!result) throw new Error('Published verdict archive is missing.');
      if (!isDeepStrictEqual(value, this.summary(result)))
        throw new Error('Accepted verdict summary conflicts with its archive.');
      return result;
    }
    const result = this.validator.parse('VerificationResult', value);
    if (result.task_scope.task_id !== runId)
      throw new Error('Accepted verdict belongs to another run.');
    return result;
  }
}
