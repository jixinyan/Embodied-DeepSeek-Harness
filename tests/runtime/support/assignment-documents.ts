import type { RunState } from '@edh/tasks';
import { documentReports } from './report-documents.js';

export async function assignmentDocuments() {
  const source = await documentReports();
  const state: RunState = {
    id: source.runId,
    instruction: source.assignment.brief.objective,
    scenario: 'documentation-review',
    source: 'test_fixture',
    state: 'cancelled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamDigest: 'authored-document-review',
    teamId: 'document-review',
    decisionAssignmentId: source.assignment.id,
    attempt: 1,
    recoveryId: null,
    retryChanges: [],
    assignments: {
      [source.assignment.id]: {
        ...source.assignment,
        status: 'retired',
        model: 'deployment-model',
        tools: [],
        todos: [{ content: 'Read the project specification.', status: 'completed' }],
        todoSequence: 0,
        todoTurn: 0,
        turn: 0,
        step: 0,
      },
    },
    events: [],
    eventCount: 0,
    executions: [],
    requests: [],
    verdicts: [],
    latestSensor: null,
    agentSeen: {},
    skillIds: [],
    error: null,
  };
  return { ...source, state };
}
