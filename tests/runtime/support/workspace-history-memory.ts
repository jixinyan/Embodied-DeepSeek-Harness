import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LocalStore } from '@edh/storage';
import { readRunList, readSessionList } from '../../../apps/server/src/workspace-history.js';
import { workspaceDocuments } from './workspace-documents.js';
import { assignmentDocuments } from './assignment-documents.js';
import { UserSessions } from '../../../apps/server/src/user-sessions.js';
import { WorkspaceHistoryIndex } from '../../../apps/server/src/workspace-history-index.js';

const store = new LocalStore(process.argv[2]!);
let index: WorkspaceHistoryIndex | undefined;
try {
  const { runs, sessions } = await workspaceDocuments(store, 1);
  const { state: assignmentState, assignment } = await assignmentDocuments();
  let documentBytes = 0;
  let count = 1;
  let lastSessionId = sessions[0]!.id;
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
        requestId: `request-${id}`,
        runIds: [id],
        configuration: { ...sessions[0]!.configuration, document },
      },
      0,
    );
    store.put(`run-user-session:${id}`, { sessionId: id }, 0);
    lastSessionId = id;
    documentBytes += Buffer.byteLength(document) * 2;
  }
  let runsRead = 0;
  let sessionsRead = 0;
  const lifecycle = new UserSessions(store);
  const lastSession = lifecycle.get(lastSessionId);
  let replayedRequests = 0;
  for (let i = 0; i < 16; i++) {
    assert.deepEqual(lifecycle.replaySession(sessions[0]!), sessions[0]);
    assert.deepEqual(lifecycle.replaySession(lastSession), lastSession);
    replayedRequests += 2;
  }
  await lifecycle.close();
  index = new WorkspaceHistoryIndex(store);
  const sourceReads = index.statistics().sourceReads;
  let before: string | null = null;
  do {
    const page = readRunList(index, new URLSearchParams(before ? { before } : {}), null);
    assert(Buffer.byteLength(JSON.stringify(page)) < 256 * 1024);
    runsRead += page.runs.length;
    before = page.nextBeforeId;
  } while (before);
  do {
    const page = readSessionList(index, new URLSearchParams(before ? { before } : {}), null);
    assert(Buffer.byteLength(JSON.stringify(page)) < 256 * 1024);
    sessionsRead += page.sessions.length;
    before = page.nextBeforeId;
  } while (before);
  assert.equal(index.statistics().sourceReads, sourceReads);
  index.close();
  index = new WorkspaceHistoryIndex(store);
  assert.equal(index.statistics().sourceReads, 0);
  console.log(JSON.stringify({ documentBytes, count, runsRead, sessionsRead, replayedRequests }));
} finally {
  index?.close();
  store.close();
}
