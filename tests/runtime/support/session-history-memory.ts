import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { Session, SessionId, SessionSeq } from '@deepseek-ai/dsh-session';
import { LocalStore, SessionHistory } from '../../../harness/agent-runtime/storage/src/index.js';

const store = new LocalStore(process.argv[2]!);
try {
  const history = new SessionHistory(store, {
    maxResidentEvents: 2,
    maxResidentBytes: 1024 * 1024,
  });
  const session = Session.create(SessionId('bounded-document-review'));
  const document = await readFile('docs/project-spec.md', 'utf8');
  let count = 0;
  let status;
  while (store.statistics().journalBytes <= 100 * 1024 * 1024) {
    const previous = session.surface.nodes[0];
    const event = session.append(
      'user/message',
      createUserMessage({
        source: { kind: 'plugin', plugin: 'document-reader', form: 'relay' },
        content: [{ type: 'text', text: `Document review ${count}\n${document}` }],
      }),
      previous === undefined
        ? { surfaceOp: 'append' }
        : {
            surfaceOp: { op: 'replace', start: previous, end: previous },
            sourceEventSeqs: [previous],
          },
    );
    count++;
    status = history.retain('run', 'agent', session);
    assert.equal(session.deriveMessages()[0]!.id, event.data.id);
    assert(status.residentEvents <= 2);
  }
  const first = session.eventAt(SessionSeq(0))!;
  assert.equal(first.type, 'user/message');
  assert.match(JSON.stringify(first.data), /Document review 0/);
  assert.equal(session.seq, count);
  console.log(
    JSON.stringify({
      ...status,
      journalBytes: store.statistics().journalBytes,
      surfaceNodes: session.surface.nodes.length,
    }),
  );
} finally {
  store.close();
}
