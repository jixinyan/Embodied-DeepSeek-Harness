import { readFile } from 'node:fs/promises';
import { assignmentDocuments } from './assignment-documents.js';

export async function verdictDocuments() {
  const source = await assignmentDocuments();
  const result = source.validator.parse('VerificationResult', {
    schema_version: 'physical.verification.v1',
    verdict_id: 'document-verdict',
    verification_request_id: 'document-request',
    execution_id: 'document-execution',
    boundary_event_id: 'document-boundary',
    verifier_id: source.assignment.sessionId,
    verifier_assignment_id: source.assignment.id,
    task_scope: source.assignment.brief.task_scope,
    status: 'unknown',
    goal_contract_id: source.assignment.brief.success_contract.id,
    goal_contract_version: source.assignment.brief.success_contract.version,
    checks: [
      {
        check_id: 'review',
        value: null,
        reason: await readFile('docs/project-spec.md', 'utf8'),
        evidence_refs: ['document-evidence'],
      },
    ],
    evidence_refs: ['document-evidence'],
    explanation:
      'Authored unknown-result document. No model or physical provider executed. ' +
      (await readFile('README.md', 'utf8')),
    observed_at: source.state.createdAt,
    clock_id: 'document-clock',
  });
  return { ...source, result };
}
