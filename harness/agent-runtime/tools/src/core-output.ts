import type { EvidenceRef } from '@edh/contracts';

type EvidenceSample = { evidence: Pick<EvidenceRef, 'id'> };

export function coreToolEvidenceIds(
  logical: string,
  value: unknown,
  verificationSample?: EvidenceSample,
): string[] {
  switch (logical) {
    case 'perception.capture':
    case 'observation.turn_view':
    case 'observation.rotate':
    case 'evidence.read':
      return [(value as EvidenceSample).evidence.id];
    case 'perception.inspect_simulator':
      return [(value as { sample: EvidenceSample }).sample.evidence.id];
    case 'perception.segment_objects':
    case 'perception.estimate_depth':
      return [(value as { overlayEvidenceId: string }).overlayEvidenceId];
    case 'verification.check':
      return verificationSample ? [verificationSample.evidence.id] : [];
    default:
      return [];
  }
}
