import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LocalStore } from '@edh/storage';
import { readRunList, readSessionList } from '../../../apps/server/src/workspace-history.js';
import { workspaceDocuments } from './workspace-documents.js';
import { assignmentDocuments } from './assignment-documents.js';
import { UserSessions } from '../../../apps/server/src/user-sessions.js';

const store = new LocalStore(process.argv[2]!);
try {
  const { runs, sessions } = await workspaceDocuments(store, 1);
  const { state: assignmentState, assignment } = await assignmentDocuments();
  let documentBytes = 0;
  let count = 1;
  while (documentBytes <= 100 * 1024 * 1024) {
    const id = `document-${String(count++).padStart(6, '0')}`;
    const document = await readFile('docs/project-spec.md', 'utf8');
    const assignmentId = `assignment-${id}`;
    store.put(
      `run:${id}`,
      {
        ...runs[0],
        id,
        decisionAssignmentId: assignmentId,
        assignments: {
          [assignmentId]: {
            ...assignmentState.assignments[assignment.id],
            id: assignmentId,
            sessionId: `native-${id}`,
            brief: {
              ...assignment.brief,
              assignment_id: assignmentId,
              task_scope: { ...assignment.brief.task_scope, task_id: id },
              history_summary: document,
            },
          },
        },
      },
      0,
    );
    store.put(
      `user-session:${id}`,
      {
        ...sessions[0],
        id,
        runIds: [id],
        configuration: { ...sessions[0]!.configuration, document },
      },
      0,
    );
    store.put(`run-user-session:${id}`, { sessionId: id }, 0);
    documentBytes += Buffer.byteLength(document) * 2;
  }
  let runsRead = 0;
  let sessionsRead = 0;
  const lifecycle = new UserSessions(store);
  await lifecycle.close();
  let before: string | null = null;
  do {
    const page = readRunList(store, new URLSearchParams(before ? { before } : {}), null);
    assert(Buffer.byteLength(JSON.stringify(page)) < 256 * 1024);
    runsRead += page.runs.length;
    before = page.nextBeforeId;
  } while (before);
  do {
    const page = readSessionList(store, new URLSearchParams(before ? { before } : {}), null);
    assert(Buffer.byteLength(JSON.stringify(page)) < 256 * 1024);
    sessionsRead += page.sessions.length;
    before = page.nextBeforeId;
  } while (before);
  console.log(JSON.stringify({ documentBytes, count, runsRead, sessionsRead }));
} finally {
  store.close();
}
