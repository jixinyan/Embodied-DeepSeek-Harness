import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { AssignmentFiles } from '@edh/files';
import { LocalStore } from '@edh/storage';
import { createCoreToolDefinition, renderCoreToolResult } from '@edh/tools';
import { UserClarifications } from '../apps/server/src/clarifications.ts';
import { createDshHost } from '../apps/server/src/runtime.ts';

const { values } = parseArgs({ options: { output: { type: 'string' } } });
assert(values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = await Promise.all(
  [
    'harness/agent-runtime/tools/src/core-definition.ts',
    'harness/agent-runtime/tools/src/tool-names.ts',
    'harness/agent-runtime/tools/src/index.ts',
    'harness/agent-runtime/tools/src/core-inputs.ts',
    'harness/agent-runtime/tools/src/core-output.ts',
    'harness/agent-runtime/tools/src/model-schema.ts',
    'harness/agent-runtime/tools/src/dsh/tools/index.ts',
    'harness/agent-runtime/tools/src/dsh/tools/json-schema.ts',
    'harness/agent-runtime/tools/src/dsh/timeout-policy/index.ts',
    'harness/agent-runtime/files/src/workspace.ts',
    'harness/agent-runtime/storage/src/local-store.ts',
    'apps/server/src/clarifications.ts',
    'apps/server/src/runtime.ts',
    'apps/server/src/application.ts',
    'scripts/check-core-tools-offline.mjs',
  ].map(async (name) => ({
    path: resolve(root, name),
    sha256: hash(await readFile(resolve(root, name))),
  })),
);
const content = await readFile(sources[0].path, 'utf8');
await mkdir(output, { recursive: false });
const store = new LocalStore(resolve(output, 'data'));
const assignmentId = randomUUID();
const runId = randomUUID();
const files = new AssignmentFiles(store);
const notifications = [];
const clarifications = new UserClarifications(store, runId, (record) => notifications.push(record));
let host;
const disposers = [];
const checks = [];
const path = 'memory/tool-source.ts';
const call = (tool, args, signal = new AbortController().signal, callId = randomUUID()) =>
  host.tools.execute({
    name: tool.replaceAll('.', '__'),
    arguments: args,
    signal,
    callId,
  });
const accept = (name, result) => {
  assert.equal(result.isError, false);
  assert.deepEqual(result.content, renderCoreToolResult(result.value, []));
  checks.push({ name, isError: result.isError, concludesTurn: result.concludesTurn === true });
  return result.value;
};
const reject = (name, result, expectedMessage, expectedCode) => {
  assert.equal(result.isError, true);
  assert.notEqual(result.concludesTurn, true);
  assert.match(result.error.message, expectedMessage);
  assert.equal(result.error.info?.code, expectedCode);
  checks.push({ name, isError: result.isError, error: result.error });
};
try {
  host = await createDshHost([]);
  for (const [logical, invoke] of [
    [
      'files.write',
      async (args) => files.write(assignmentId, args.path, args.content, args.expectedVersion),
    ],
    ['files.read', async (args) => files.read(assignmentId, args.path)],
    ['files.search', async (args) => ({ files: files.search(assignmentId, args.query) })],
    [
      'user.ask',
      async (args, exec) =>
        clarifications.request({
          ...args,
          assignmentId,
          callId: exec.callId,
          goalId: 'cpu-core-tool-inspection',
          attemptId: 'local-inspection',
        }),
    ],
  ]) {
    const definition = createCoreToolDefinition(logical, {
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => renderCoreToolResult(value, []),
      },
      invoke,
    });
    disposers.push(host.tools.register(definition));
  }
  const written = accept(
    'write-original-source',
    await call('files.write', { path, content, expectedVersion: 0 }),
  );
  assert.equal(written.content, content);
  assert.equal(written.version, '1');
  const read = accept('read-private-source', await call('files.read', { path }));
  assert.deepEqual(read, written);
  const search = accept(
    'search-private-source',
    await call('files.search', { query: 'createCoreToolDefinition' }),
  );
  assert.deepEqual(search.files, [written]);
  accept(
    'write-empty-content',
    await call('files.write', { path: 'memory/empty.md', content: '', expectedVersion: 0 }),
  );
  const journal = resolve(output, 'data/records.jsonl');
  const beforeRejectedCalls = hash(await readFile(journal));
  for (const [name, args, message, code] of [
    [
      'additional-parameter',
      { path, content, expectedVersion: 1, unknown: true },
      /arguments\.unknown.*not a declared property/,
      'INVALID_ARGS',
    ],
    [
      'string-version',
      { path, content, expectedVersion: '1' },
      /arguments\.expectedVersion.*must be an integer/,
      'INVALID_ARGS',
    ],
    [
      'unsafe-version',
      { path, content, expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
      /^expectedVersion must be a nonnegative safe integer\.$/,
    ],
    [
      'version-conflict',
      { path, content, expectedVersion: 0 },
      /Version conflict.*expected 0, found 1$/,
    ],
    [
      'invalid-private-path',
      { path: '../tool-source.ts', content, expectedVersion: 0 },
      /^Invalid workspace path\.$/,
    ],
    [
      'oversized-content',
      {
        path,
        content: content.repeat(Math.ceil(131073 / Buffer.byteLength(content))),
        expectedVersion: 1,
      },
      /^Invalid length for content\.$/,
    ],
  ])
    reject(name, await call('files.write', args), message, code);
  const aborted = new AbortController();
  aborted.abort(new Error('CPU inspection cancellation.'));
  reject(
    'caller-abort-before-write',
    await call('files.write', { path, content, expectedVersion: 1 }, aborted.signal),
    /^tool call aborted before dispatch$/,
    'ABORTED_BEFORE_DISPATCH',
  );
  assert.equal(hash(await readFile(journal)), beforeRejectedCalls);
  assert.deepEqual(files.read(assignmentId, path), written);
  const updated = accept(
    'update-current-version',
    await call('files.write', { path, content: `${content}\n`, expectedVersion: 1 }),
  );
  assert.equal(updated.version, '2');
  assert.equal(updated.content, `${content}\n`);
  const questionCallId = randomUUID();
  const questionArgs = {
    question: 'Which configured environment should this task use?',
    reason: 'The environment selection is required for the task.',
    options: ['RoboDojo', 'RoboTwin'],
  };
  const asked = await call('user.ask', questionArgs, undefined, questionCallId);
  const question = accept('persist-question-and-conclude-turn', asked);
  assert.equal(asked.concludesTurn, true);
  assert.equal(question.state, 'pending');
  assert.equal(notifications.length, 1);
  assert.equal(store.get(`clarification:${runId}:${question.id}`).value.id, question.id);
  const repeated = await call('user.ask', questionArgs, undefined, questionCallId);
  assert.deepEqual(accept('same-call-question-identity', repeated), question);
  assert.equal(repeated.concludesTurn, true);
  assert.equal(notifications.length, 1);
  const beforeQuestionConflict = hash(await readFile(journal));
  reject(
    'conflicting-question-identity',
    await call(
      'user.ask',
      { ...questionArgs, question: 'Which checkpoint should this task use?' },
      undefined,
      questionCallId,
    ),
    /^A tool-call identity cannot change its question\.$/,
  );
  assert.equal(hash(await readFile(journal)), beforeQuestionConflict);
} finally {
  try {
    for (const dispose of disposers.reverse()) dispose();
  } finally {
    try {
      await host?.fiber.dispose();
    } finally {
      store.close();
    }
  }
}
await assert.rejects(access(resolve(output, 'data/writer.lock')), { code: 'ENOENT' });
const persisted = new LocalStore(resolve(output, 'data'));
try {
  assert.equal(new AssignmentFiles(persisted).read(assignmentId, path).version, '2');
  assert.equal(persisted.list(`clarification:${runId}:`).length, 1);
} finally {
  persisted.close();
}
await assert.rejects(access(resolve(output, 'data/writer.lock')), { code: 'ENOENT' });
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
await writeFile(
  resolve(output, 'acceptance.json'),
  `${JSON.stringify(
    {
      schemaVersion: 'edh.core_tools_cpu.v1',
      recordedAt: new Date().toISOString(),
      sources,
      checks,
      journalSha256: hash(await readFile(resolve(output, 'data/records.jsonl'))),
      writerReleased: true,
      hostDisposed: true,
      modelInferencePerformed: false,
      environmentAllocationPerformed: false,
      physicalControlPerformed: false,
      scope:
        'Actual native DSH dispatch, private file operations and local clarification persistence.',
    },
    null,
    2,
  )}\n`,
  { flag: 'wx' },
);
console.log(JSON.stringify({ checks: checks.length, writerReleased: true, hostDisposed: true }));
