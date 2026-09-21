import type { LocalStore } from '@edh/storage';
import type { UserSessionRecord } from '../../../apps/server/src/user-sessions.js';
import { assignmentDocuments } from './assignment-documents.js';

export async function workspaceDocuments(store: LocalStore, count = 75) {
  const { state } = await assignmentDocuments();
  const runs = [];
  const sessions: (UserSessionRecord & { runIds: string[] })[] = [];
  for (let index = 0; index < count; index++) {
    const id = `document-${String(index).padStart(5, '0')}`;
    const session: UserSessionRecord = {
      id: `session-${id}`,
      profileId: 'documentation-review',
      requestId: `request-${id}`,
      deploymentDigest: 'authored-document-records',
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      state: 'closed',
      resources: 'released',
      configuration: {
        launchProfile: {
          source: 'test_fixture',
          environment: 'document-records',
          embodiment: 'not-connected',
          checkpoint: 'not-connected',
          defaultModel: 'not-connected',
          tasks: ['documentation-review'],
        },
      },
      runIds: [],
    };
    store.put(`user-session:${session.id}`, session, 0);
    sessions.push(session);
    const run = {
      ...structuredClone(state),
      id,
      assignments: {},
      decisionAssignmentId: '',
      instruction: `Review document ${index}.`,
    };
    store.put(`run:${id}`, run, 0);
    runs.push(run);
    if (index % 2 === 0) {
      store.put(`run-user-session:${id}`, { sessionId: sessions[0]!.id }, 0);
      sessions[0]!.runIds.push(id);
    }
  }
  if (sessions[0]) store.put(`user-session:${sessions[0].id}`, sessions[0], 1);
  return { runs, sessions };
}
