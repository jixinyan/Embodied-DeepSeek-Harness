import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { LocalStore } from '@edh/storage';
import { AssignmentHistory } from '@edh/tasks';
import { assignmentDocuments } from './assignment-documents.js';

const { state, assignment, validator } = await assignmentDocuments();
state.assignments = {};
const store = new LocalStore(process.argv[2]!);
try {
  const history = new AssignmentHistory(store, validator);
  let documentBytes = 0;
  let firstId: string | undefined;
  while (documentBytes <= 100 * 1024 * 1024) {
    const id = randomUUID();
    firstId ??= id;
    const document = await readFile('docs/project-spec.md', 'utf8');
    state.assignments[id] = {
      ...assignment,
      id,
      sessionId: randomUUID(),
      brief: { ...assignment.brief, assignment_id: id, history_summary: document },
      status: 'retired',
      model: 'deployment-model',
      tools: [],
    };
    documentBytes += Buffer.byteLength(document);
    history.retain(state, id);
  }
  assert(
    history.read(state.id, firstId!)!.assignment.brief.history_summary.startsWith('# Embodied'),
  );
  console.log(
    JSON.stringify({
      documentBytes,
      projectionBytes: Buffer.byteLength(JSON.stringify(state)),
      assignments: Object.keys(state.assignments).length,
      fullBriefs: Object.values(state.assignments).filter((row) => row.brief).length,
    }),
  );
} finally {
  store.close();
}
