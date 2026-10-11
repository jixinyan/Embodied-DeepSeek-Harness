import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { BlockAssembler, expandAssistantStream, LlmError } from '@deepseek-ai/dsh-llm';
import { LocalStore } from '@edh/storage';
import {
  ResponsesFunctionCalls,
  responsesEventType,
  responsesReplayOutput,
} from '../harness/agent-runtime/models/src/responses-function-calls.ts';

const { values } = parseArgs({
  options: {
    'data-directory': { type: 'string', multiple: true },
    output: { type: 'string' },
  },
});
assert(values['data-directory']?.length && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const implementation = await Promise.all(
  [
    'harness/agent-runtime/models/src/openai-responses.ts',
    'harness/agent-runtime/models/src/model-failures.ts',
    'harness/agent-runtime/models/src/responses-function-calls.ts',
    'harness/agent-runtime/models/src/dsh/llm/assembler.ts',
    'harness/agent-runtime/models/src/dsh/llm/assistant-stream.ts',
    'harness/agent-runtime/agents/src/dsh/loop/agent.ts',
    'harness/agent-runtime/storage/src/local-store.ts',
    'scripts/check-recorded-responses.mjs',
  ].map(async (path) => ({ path, sha256: hash(await readFile(resolve(root, path))) })),
);
const sources = await Promise.all(
  values['data-directory'].map(async (directory) => {
    const path = resolve(directory, 'records.jsonl');
    return { path, sha256: hash(await readFile(path)) };
  }),
);
await mkdir(output, { recursive: false });
const checks = [];
const responses = [];
let sample;
let parallel;
const project = (response, stream, finish = true) => {
  const calls = new ResponsesFunctionCalls();
  const assembler = new BlockAssembler();
  let sequence = 0;
  const items = response.output
    .map((item, outputIndex) => ({ item, outputIndex }))
    .filter(({ item }) => item.type === 'function_call');
  for (const { item, outputIndex } of items) {
    const deltas = stream.filter(
      ({ chunk }) => chunk.type === 'tool-call-delta' && chunk.id === item.call_id,
    );
    assert(deltas.length);
    const index = deltas[0].chunk.index;
    const added = {
      type: 'response.output_item.added',
      sequence_number: sequence++,
      output_index: outputIndex,
      item: { ...item, arguments: '' },
    };
    for (const chunk of calls.added(added, index)) assembler.push(chunk);
    for (const { chunk } of deltas) {
      const value = {
        type: 'response.function_call_arguments.delta',
        sequence_number: sequence++,
        output_index: outputIndex,
        item_id: item.id,
        delta: chunk.argumentsDelta,
      };
      for (const admitted of calls.append(value)) assembler.push(admitted);
    }
    for (const admitted of calls.argumentsDone({
      type: 'response.function_call_arguments.done',
      sequence_number: sequence++,
      output_index: outputIndex,
      item_id: item.id,
      arguments: item.arguments,
    }))
      assembler.push(admitted);
    for (const admitted of calls.closed({
      type: 'response.output_item.done',
      sequence_number: sequence++,
      output_index: outputIndex,
      item,
    }))
      assembler.push(admitted);
  }
  const terminal = {
    type: 'response.completed',
    sequence_number: sequence++,
    response,
  };
  if (finish) assert.deepEqual(calls.terminal(terminal), response);
  return { calls, assembler, terminal };
};
for (const [sourceIndex, source] of sources.entries()) {
  const directory = resolve(output, `journal-${sourceIndex}`);
  await mkdir(directory);
  await copyFile(source.path, resolve(directory, 'records.jsonl'));
  const store = new LocalStore(directory);
  try {
    for (const { key, value } of store.list('session-audit-event:')) {
      if (value.type !== 'assistant/message') continue;
      const message = value.data.message;
      const response = message.source.replayState?.response;
      if (!response) continue;
      assert.equal(response.status, 'completed');
      assert(Array.isArray(value.data.stream));
      const before = hash(JSON.stringify(value));
      const stream = expandAssistantStream(value.data.stream);
      const original = new BlockAssembler();
      for (const { chunk } of stream) original.push(chunk);
      assert.deepEqual(original.blocks(), message.content);
      const projected = project(response, stream);
      assert.deepEqual(
        responsesReplayOutput(
          response,
          message.content.filter((block) => block.type === 'tool-call'),
        ),
        response.output,
      );
      assert.deepEqual(
        projected.assembler.blocks(),
        message.content.filter((block) => block.type === 'tool-call'),
      );
      const callCount = projected.assembler.blocks().length;
      responses.push({
        key,
        model: message.source.model,
        calls: callCount,
        source: source.path,
        sha256: before,
      });
      checks.push({ name: 'original-output-and-durable-deltas', key, result: 'admitted' });
      if (!sample && callCount)
        sample = {
          response,
          stream,
          item: response.output.find((item) => item.type === 'function_call'),
        };
      if (!parallel && callCount > 1) parallel = { response, stream };
      assert.equal(hash(JSON.stringify(value)), before);
    }
  } finally {
    store.close();
  }
  assert.equal(hash(await readFile(source.path)), source.sha256);
  assert.equal(hash(await readFile(resolve(directory, 'records.jsonl'))), source.sha256);
  await assert.rejects(access(resolve(directory, 'writer.lock')), { code: 'ENOENT' });
}
assert(responses.length && sample && parallel);
const protocolError = (error) =>
  error instanceof LlmError && error.code === 'PROVIDER_PROTOCOL_ERROR';
const reject = (name, operation) => {
  assert.throws(operation, protocolError);
  checks.push({ name, result: 'rejected-invalid-derivative' });
};
const index = sample.response.output.indexOf(sample.item);
const added = {
  type: 'response.output_item.added',
  output_index: index,
  sequence_number: 0,
  item: sample.item,
};
const delta = {
  type: 'response.function_call_arguments.delta',
  output_index: index,
  sequence_number: 1,
  item_id: sample.item.id,
  delta: '',
};
const argumentsDone = {
  type: 'response.function_call_arguments.done',
  output_index: index,
  sequence_number: 1,
  item_id: sample.item.id,
  arguments: sample.item.arguments,
};
const closed = {
  type: 'response.output_item.done',
  output_index: index,
  sequence_number: 2,
  item: sample.item,
};
const started = () => {
  const calls = new ResponsesFunctionCalls();
  calls.added(added, 0);
  return calls;
};
for (const [field, invalidValues] of [
  ['output_index', [-1, 0.5, '0', null, undefined, Number.MAX_SAFE_INTEGER + 1]],
  ['sequence_number', [-1, 0.5, '0', null, undefined, Number.MAX_SAFE_INTEGER + 1]],
])
  for (const value of invalidValues)
    reject(`invalid-${field}-${String(value)}`, () =>
      new ResponsesFunctionCalls().added({ ...added, [field]: value }, 0),
    );
for (const field of ['call_id', 'name', 'arguments', 'id', 'status'])
  reject(`invalid-item-${field}`, () =>
    new ResponsesFunctionCalls().added(
      { ...added, item: { ...sample.item, [field]: field === 'status' ? 'unknown' : 2 } },
      0,
    ),
  );
for (const field of ['call_id', 'name', 'arguments'])
  reject(`missing-item-${field}`, () =>
    new ResponsesFunctionCalls().added(
      { ...added, item: { ...sample.item, [field]: undefined } },
      0,
    ),
  );
reject('missing-payload-type', () => responsesEventType(added.type, { ...added, type: undefined }));
reject('event-type-mismatch', () => responsesEventType('response.completed', added));
assert.equal(responsesEventType('message', added), added.type);
checks.push({
  name: 'unnamed-sse-event-uses-payload-type',
  result: 'admitted-record-derived-boundary',
});
reject('duplicate-output-index', () => started().added({ ...added, sequence_number: 1 }, 1));
reject('duplicate-call-id', () =>
  started().added({ ...added, sequence_number: 1, output_index: index + 1 }, 1),
);
reject('duplicate-item-id', () =>
  started().added(
    {
      ...added,
      sequence_number: 1,
      output_index: index + 1,
      item: { ...sample.item, call_id: `${sample.item.call_id}-invalid` },
    },
    1,
  ),
);
reject('unstarted-delta', () => new ResponsesFunctionCalls().append(delta));
reject('unstarted-arguments-done', () => new ResponsesFunctionCalls().argumentsDone(argumentsDone));
reject('unstarted-item-done', () => new ResponsesFunctionCalls().closed(closed));
reject('changed-delta-item-id', () =>
  started().append({ ...delta, item_id: `${sample.item.id}-invalid` }),
);
reject('missing-delta-item-id', () => started().append({ ...delta, item_id: undefined }));
reject('invalid-delta', () => started().append({ ...delta, delta: 1 }));
reject('out-of-order-sequence', () => started().append({ ...delta, sequence_number: 0 }));
reject('arguments-done-mismatch', () =>
  started().argumentsDone({ ...argumentsDone, arguments: `${sample.item.arguments} ` }),
);
for (const field of ['call_id', 'name', 'id', 'arguments'])
  reject(`changed-final-${field}`, () =>
    started().closed({
      ...closed,
      item: { ...sample.item, [field]: `${sample.item[field]}-invalid` },
    }),
  );
reject('duplicate-arguments-done', () => {
  const calls = started();
  calls.argumentsDone(argumentsDone);
  calls.argumentsDone({ ...argumentsDone, sequence_number: 2 });
});
reject('delta-after-arguments-done', () => {
  const calls = started();
  calls.argumentsDone(argumentsDone);
  calls.append({ ...delta, sequence_number: 2 });
});
reject('duplicate-item-done', () => {
  const calls = started();
  calls.closed(closed);
  calls.closed({ ...closed, sequence_number: 3 });
});
reject('delta-after-item-done', () => {
  const calls = started();
  calls.closed(closed);
  calls.append({ ...delta, sequence_number: 3 });
});
reject('unclosed-terminal-call', () =>
  started().terminal({ type: 'response.completed', sequence_number: 3, response: sample.response }),
);
for (const [name, rewrite] of [
  [
    'missing-terminal-call',
    (value) => {
      value.response.output = value.response.output.filter((item) => item.type !== 'function_call');
    },
  ],
  [
    'changed-terminal-arguments',
    (value) => {
      value.response.output.find((item) => item.type === 'function_call').arguments += ' ';
    },
  ],
  [
    'unfinished-terminal-call',
    (value) => {
      value.response.output.find((item) => item.type === 'function_call').status = 'in_progress';
    },
  ],
  [
    'terminal-status-mismatch',
    (value) => {
      value.response.status = 'incomplete';
    },
  ],
  [
    'invalid-terminal-output',
    (value) => {
      value.response.output = null;
    },
  ],
  [
    'missing-terminal-sequence',
    (value) => {
      value.sequence_number = undefined;
    },
  ],
])
  reject(name, () => {
    const projected = project(parallel.response, parallel.stream, false);
    const invalid = structuredClone(projected.terminal);
    rewrite(invalid);
    projected.calls.terminal(invalid);
  });
reject('event-after-terminal', () => {
  const projected = project(sample.response, sample.stream);
  projected.calls.append({ ...delta, sequence_number: projected.terminal.sequence_number + 1 });
});
const truncated = project(sample.response, sample.stream, false);
truncated.calls.terminal({
  ...truncated.terminal,
  type: 'response.incomplete',
  response: {
    ...sample.response,
    status: 'incomplete',
    incomplete_details: { reason: 'max_output_tokens' },
  },
});
truncated.assembler.push({ type: 'finish', reason: { kind: 'max-tokens' } });
assert.deepEqual(truncated.assembler.blocks(), []);
assert.deepEqual(
  responsesReplayOutput(sample.response, truncated.assembler.blocks()),
  sample.response.output.filter((item) => item.type !== 'function_call'),
);
checks.push({
  name: 'native-assembler-drops-truncated-calls',
  result: 'admitted-record-derived-boundary',
});
assert.deepEqual(project(sample.response, sample.stream, false).assembler.interruptedBlocks(), []);
checks.push({
  name: 'native-assembler-omits-interrupted-calls',
  result: 'admitted-record-derived-boundary',
});
const retainedCalls = project(parallel.response, parallel.stream).assembler.blocks();
const retained = retainedCalls[0];
assert.deepEqual(
  responsesReplayOutput(parallel.response, [retained]),
  parallel.response.output.filter(
    (item) => item.type !== 'function_call' || item.call_id === retained.id,
  ),
);
checks.push({ name: 'selected-retained-replay-calls', result: 'admitted-record-derived-boundary' });
reject('duplicate-retained-replay-call', () =>
  responsesReplayOutput(parallel.response, [retained, retained]),
);
reject('changed-retained-replay-arguments', () =>
  responsesReplayOutput(parallel.response, [{ ...retained, arguments: `${retained.arguments} ` }]),
);
reject('changed-retained-replay-name', () =>
  responsesReplayOutput(parallel.response, [{ ...retained, name: `${retained.name}-invalid` }]),
);
reject('missing-retained-replay-call', () =>
  responsesReplayOutput(parallel.response, [{ ...retained, id: `${retained.id}-invalid` }]),
);
reject('duplicate-source-replay-call', () =>
  responsesReplayOutput(
    {
      ...parallel.response,
      output: [
        ...parallel.response.output,
        parallel.response.output.find((item) => item.type === 'function_call'),
      ],
    },
    retainedCalls,
  ),
);
reject('invalid-source-replay-output', () =>
  responsesReplayOutput({ ...parallel.response, output: null }, retainedCalls),
);
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
const acceptance = {
  schemaVersion: 'edh.recorded_responses.v1',
  scope: 'original Responses output and durable DSH argument admission',
  providerWireEventsRetained: false,
  derivedBoundaries:
    'Event envelopes and sequence numbers project recorded output identities and exact durable DSH argument deltas; malformed derivatives are explicit. No provider response is supplied.',
  providerRequests: 0,
  toolDispatches: 0,
  modelAllocations: 0,
  simulatorAllocations: 0,
  gpuAllocations: 0,
  implementation,
  sources,
  responses,
  checks,
  originalJournalsUnchanged: true,
  diagnosticWritersReleased: true,
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(acceptance, null, 2)}\n`, {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    output,
    responses: responses.length,
    calls: responses.reduce((sum, item) => sum + item.calls, 0),
    cases: checks.length,
    providerRequests: 0,
    gpuAllocations: 0,
  }),
);
