import assert from 'node:assert/strict';
import { LocalStore } from '@edh/storage';
import { VerdictHistory } from '@edh/tasks';
import { verdictDocuments } from './verdict-documents.js';

const store = new LocalStore(process.argv[2]!);
try {
  const { state, result, validator } = await verdictDocuments();
  const history = new VerdictHistory(store, validator);
  let documentBytes = 0;
  let count = 0;
  while (documentBytes <= 100 * 1024 * 1024) {
    const id = `document-verdict-${count++}`;
    const document = {
      ...result,
      verdict_id: id,
      verification_request_id: `request-${id}`,
      verifier_assignment_id: `assignment-${id}`,
    };
    state.verdicts.push(history.retain(state.id, document));
    documentBytes += Buffer.byteLength(JSON.stringify(document));
  }
  const projectionBytes = Buffer.byteLength(JSON.stringify(state.verdicts));
  store.put(`run:${state.id}`, state, 0);
  let loaded = 0;
  for (const summary of state.verdicts) {
    assert.equal(history.resolve(state.id, summary).checks[0]!.reason, result.checks[0]!.reason);
    loaded++;
  }
  console.log(JSON.stringify({ documentBytes, count, projectionBytes, loaded }));
} finally {
  store.close();
}
