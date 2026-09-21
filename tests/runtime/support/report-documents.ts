import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ContractValidator } from '@edh/contracts';
import type { Assignment, ReportInput } from '@edh/communication';

export async function documentReports() {
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const document = await readFile('docs/project-spec.md', 'utf8');
  const assignmentId = randomUUID();
  const runId = randomUUID();
  const assignment: Assignment = {
    id: assignmentId,
    member: 'document-reviewer',
    sessionId: randomUUID(),
    brief: {
      schema_version: 'physical.invocation.v1',
      assignment_id: assignmentId,
      team_run_id: randomUUID(),
      caller_agent_id: 'review-owner',
      caller_assignment_id: 'review-owner',
      objective: 'Review the project specification and request deployment evidence.',
      task_scope: { task_id: runId, goal_id: 'documentation-review', attempt_id: 'attempt-1' },
      expected_output: { schema: 'builtin:AgentReport.v1', recipient: 'review-owner' },
      success_contract: {
        id: 'documentation-review',
        version: '1',
        all: [{ check_id: 'review', check: 'review_available', args: [] }],
        source: { kind: 'user', reference: 'Project documentation review' },
      },
      entities: {},
      known_facts: [],
      history_summary: '',
      changes: [],
      evidence_refs: [],
      tools_and_limits: { allowed_tools: [], allowed_actions: [] },
    },
  };
  validator.parse('InvocationBrief', assignment.brief);
  function input(expectedVersion: number, includeDocument = false): ReportInput {
    return {
      expectedVersion,
      status: 'insufficient_context',
      summary: `Documentation review ${expectedVersion + 1}: deployment evidence is required.`,
      result: includeDocument
        ? { path: 'docs/project-spec.md', excerpt: document.slice(0, 45000) }
        : null,
      evidenceRefs: [],
      requestedContext: ['Provide the deployment validation results referenced by the document.'],
    };
  }
  return { validator, assignment, runId, input };
}
