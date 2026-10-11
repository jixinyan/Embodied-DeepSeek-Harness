import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { LlmError } from '@deepseek-ai/dsh-llm';
import { deriveEventMessage, Session, SessionId } from '@deepseek-ai/dsh-session';
import { LocalImageStore, LocalStore, SessionAudits } from '@edh/storage';
import { createDshHost } from '../apps/server/src/runtime.ts';
import { resolveModelImage } from '../harness/agent-runtime/models/src/model-images.ts';
import { OpenAICompatibleAdapter } from '../harness/agent-runtime/models/src/openai-compatible.ts';
import { OpenAIResponsesAdapter } from '../harness/agent-runtime/models/src/openai-responses.ts';
import { responsesInputItems } from '../harness/agent-runtime/models/src/responses-input.ts';
import { serializeMessagesWithImages } from '../harness/agent-runtime/models/src/dsh/chat-completions/serialize.ts';

const { values } = parseArgs({
  options: {
    'data-directory': { type: 'string' },
    'images-directory': { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values['data-directory'] && values['images-directory'] && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = [];
const recordSource = async (path) => {
  const data = await readFile(path);
  sources.push({ path, sha256: hash(data) });
  return data;
};
const implementation = await Promise.all(
  [
    'apps/server/src/runtime.ts',
    'harness/agent-runtime/models/src/model-images.ts',
    'harness/agent-runtime/models/src/model-failures.ts',
    'harness/agent-runtime/models/src/responses-input.ts',
    'harness/agent-runtime/models/src/openai-compatible.ts',
    'harness/agent-runtime/models/src/openai-responses.ts',
    'harness/agent-runtime/models/src/responses-function-calls.ts',
    'harness/agent-runtime/models/src/dsh/chat-completions/serialize.ts',
    'harness/agent-runtime/storage/src/local-images.ts',
    'harness/agent-runtime/storage/src/dsh/attachment-local/request-image.ts',
    'harness/agent-runtime/storage/src/dsh/attachment-local/store.ts',
    'harness/agent-runtime/storage/src/local-store.ts',
    'harness/agent-runtime/storage/src/session-audits.ts',
    'scripts/check-recorded-model-images.mjs',
  ].map(async (path) => ({ path, sha256: hash(await readFile(resolve(root, path))) })),
);
const journal = resolve(values['data-directory'], 'records.jsonl');
await recordSource(journal);
const imageDirectory = resolve(values['images-directory']);
const names = (await readdir(imageDirectory)).sort();
assert(names.length > 1 && names.length <= 64 && names.every((name) => name.endsWith('.png')));
await mkdir(output, { recursive: false });
const copyDirectory = resolve(output, 'journal');
await mkdir(copyDirectory);
await copyFile(journal, resolve(copyDirectory, 'records.jsonl'));
const checks = [];
const contexts = [];
const references = new Map();
const imageRecords = [];
const imageRefs = (blocks) =>
  blocks.flatMap((block) =>
    block.type === 'image'
      ? [block.attachment]
      : block.type === 'tool-result'
        ? imageRefs(block.content)
        : [],
  );
const recordedContexts = [];
const store = new LocalStore(copyDirectory);
try {
  const audits = new SessionAudits(store);
  for (const run of store.scan('run:'))
    for (const audit of audits.read(run.value.id)) {
      const session = Session.create(SessionId(`model-image-read-${audit.key}`), audit.value);
      const messages = session.surface.nodes
        .map((sequence) => deriveEventMessage(session.eventAt(sequence)))
        .filter(Boolean);
      const refs = messages.flatMap((message) => imageRefs(message.content));
      if (refs.length) recordedContexts.push({ key: audit.key, messages, refs });
    }
} finally {
  store.close();
}
const host = await createDshHost([]);
let connections = 0;
const listener = createServer((socket) => {
  connections++;
  socket.destroy();
});
await new Promise((accept, reject) => {
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', accept);
});
const baseURL = `http://127.0.0.1:${listener.address().port}/v1`;
const policy = { maxPixels: 640 * 480, maxBytes: 2 * 1024 * 1024 };
const maximum = 32 * 1024 * 1024;
const invalid = (error) => error instanceof LlmError && error.code === 'INVALID_REQUEST';
const reject = async (name, operation, predicate = invalid) => {
  await assert.rejects(operation, predicate);
  checks.push({ name, result: 'rejected-declared-invalid-input' });
};
const admitted = (name) => checks.push({ name, result: 'admitted-original-record-boundary' });
const signal = () => new AbortController().signal;
let imageService;
try {
  await host.plugin(LocalImageStore, { directory: output });
  imageService = host.attachments;
  for (const name of names) {
    const data = await recordSource(resolve(imageDirectory, name));
    const ref = await host.attachments.saveImage({ data, mediaType: 'image/png' });
    assert.equal(ref.attachmentId, `sha256:${hash(data)}`);
    references.set(ref.attachmentId, ref);
    const request = await host.attachments.readImageRequest(ref, policy, signal());
    assert.equal(hash(request.data), hash(data));
    imageRecords.push({ ref, variantId: request.variantId, requestSha256: hash(request.data) });
  }
  const read = (ref, abort) => host.attachments.readImageRequest(ref, policy, abort);
  for (const original of recordedContexts) {
    if (!original.refs.every((ref) => references.has(ref.attachmentId))) continue;
    const before = hash(JSON.stringify(original.messages));
    const provenance = original.messages.find((message) => message.source.kind === 'model').source;
    const options = {
      provider: provenance.provider,
      model: provenance.model,
      messages: original.messages,
    };
    const unique = new Set(original.refs.map((ref) => ref.attachmentId));
    const resolved = new Map();
    const resolver = async (ref, abort) => {
      assert(!resolved.has(ref.attachmentId));
      const image = await read(ref, abort);
      resolved.set(ref.attachmentId, image);
      return image;
    };
    const responseItems = await responsesInputItems(
      options,
      { resolveImage: resolver, maxImagesPerRequest: 64, maxRequestBytes: maximum },
      signal(),
    );
    assert.equal(resolved.size, unique.size);
    const encoded = responseItems
      .flatMap((item) => (Array.isArray(item.output) ? item.output : (item.content ?? [])))
      .filter((part) => part.type === 'input_image');
    assert.equal(encoded.length, original.refs.length);
    for (const [index, ref] of original.refs.entries()) {
      const image = resolved.get(ref.attachmentId);
      assert.equal(
        encoded[index].image_url,
        `data:${image.mediaType};base64,${Buffer.from(image.data).toString('base64')}`,
      );
    }
    const calls = original.messages.flatMap((message) =>
      message.content.filter((block) => block.type === 'tool-call'),
    );
    assert.deepEqual(
      responseItems
        .filter((item) => item.type === 'function_call')
        .map((item) => [item.call_id, item.name, item.arguments]),
      calls.map((call) => [call.id, call.name, call.arguments]),
    );
    const results = original.messages.flatMap((message) =>
      message.content.filter((block) => block.type === 'tool-result'),
    );
    assert.deepEqual(
      responseItems
        .filter((item) => item.type === 'function_call_output')
        .map((item) => item.call_id),
      results.map((result) => result.toolCallId),
    );
    admitted(`original-responses-content-${original.key}`);
    for (const [name, Adapter] of [
      ['chat', OpenAICompatibleAdapter],
      ['responses', OpenAIResponsesAdapter],
    ]) {
      resolved.clear();
      const adapter = new Adapter({
        baseURL,
        models: [{ id: options.model }],
        resolveImage: resolver,
        maxImagesPerRequest: 64,
      });
      const body = JSON.parse(await adapter.request(options, signal()));
      assert.equal(resolved.size, unique.size);
      if (name === 'responses') assert.deepEqual(body.input, responseItems);
      else {
        const native = await serializeMessagesWithImages(original.messages, {
          representation: { kind: 'base64' },
          requestImages: resolved,
          maxRequestImageBytes: maximum,
        });
        for (const message of native)
          if (message.role === 'assistant') delete message.reasoning_content;
        assert.deepEqual(body.messages, native);
        assert.deepEqual(
          native
            .filter((message) => message.role === 'tool')
            .map((message) => message.tool_call_id),
          results.map((result) => result.toolCallId),
        );
      }
      assert.equal(hash(JSON.stringify(original.messages)), before);
      admitted(`original-${name}-request-${original.key}`);
    }
    contexts.push({
      key: original.key,
      model: provenance.model,
      messages: original.messages.length,
      images: original.refs.length,
      uniqueImages: unique.size,
      sha256: before,
    });
  }
  assert(contexts.length > 1);
  const original = recordedContexts.find((context) => context.key === contexts[0].key);
  const provenance = original.messages.find((message) => message.source.kind === 'model').source;
  const options = {
    provider: provenance.provider,
    model: provenance.model,
    messages: original.messages,
  };
  const reference = original.refs[0];
  const originalImage = await read(reference, signal());
  const imageDigest = hash(originalImage.data);
  for (const requestPolicy of [policy, { maxPixels: 224 * 224, maxBytes: 64 * 1024 }]) {
    const resolver = (ref, abort) => host.attachments.readImageRequest(ref, requestPolicy, abort);
    const actual = await resolver(reference, signal());
    const represented = Math.ceil(actual.bytes / 3) * 4;
    const snapshot = await resolveModelImage(reference, resolver, signal(), represented);
    assert.equal(hash(snapshot.data), hash(actual.data));
    assert.notEqual(snapshot.data, actual.data);
    assert.notEqual(snapshot.attachment, actual.attachment);
    assert(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.attachment));
    assert(snapshot.width * snapshot.height <= requestPolicy.maxPixels);
    admitted(`actual-native-request-version-${requestPolicy.maxPixels}`);
    await reject(`request-version-byte-budget-${requestPolicy.maxPixels}`, () =>
      resolveModelImage(reference, resolver, signal(), represented - 1),
    );
  }
  let returned;
  const snapshot = await resolveModelImage(
    reference,
    async (ref, abort) => {
      returned = await read(ref, abort);
      return returned;
    },
    signal(),
    maximum,
  );
  returned.data.fill(0);
  returned.attachment.width++;
  assert.equal(hash(snapshot.data), imageDigest);
  assert.equal(snapshot.attachment.width, reference.width);
  assert.equal(hash((await read(reference, signal())).data), imageDigest);
  admitted('resolver-result-snapshot-is-detached');
  let shared;
  const sharedSnapshot = await resolveModelImage(
    reference,
    async (ref, abort) => {
      const actual = await read(ref, abort);
      shared = new Uint8Array(new SharedArrayBuffer(actual.bytes));
      shared.set(actual.data);
      return { ...actual, data: shared };
    },
    signal(),
    maximum,
  );
  shared.fill(0);
  assert.equal(hash(sharedSnapshot.data), imageDigest);
  assert(!(sharedSnapshot.data.buffer instanceof SharedArrayBuffer));
  admitted('shared-memory-image-copy-is-detached');
  for (const alias of [
    { name: 'Agent camera' },
    { originalDimensions: { width: reference.width * 2, height: reference.height * 2 } },
  ]) {
    const snapshot = await resolveModelImage({ ...reference, ...alias }, read, signal(), maximum);
    assert.equal(hash(snapshot.data), imageDigest);
    admitted(`same-image-display-alias-${Object.keys(alias)[0]}`);
  }
  for (const [field, value] of [
    ['variantId', ''],
    ['mediaType', 'image/bmp'],
    ['bytes', 0],
    ['bytes', originalImage.bytes + 1],
    ['bytes', Number.MAX_SAFE_INTEGER + 1],
    ['width', 0],
    ['height', 0.5],
    ['depth', 'ushort'],
    ['space', 'cmyk'],
    ['hasAlpha', 1],
    ['data', new ArrayBuffer(originalImage.bytes)],
    ['extra', true],
  ])
    await reject(`invalid-request-image-${field}-${String(value).slice(0, 40)}`, () =>
      resolveModelImage(
        reference,
        async (ref, abort) => ({ ...(await read(ref, abort)), [field]: value }),
        signal(),
        maximum,
      ),
    );
  for (const field of ['attachmentId', 'mediaType', 'bytes', 'width', 'height'])
    await reject(`changed-resolved-reference-${field}`, () =>
      resolveModelImage(
        reference,
        async (ref, abort) => {
          const actual = await read(ref, abort);
          const value =
            field === 'attachmentId'
              ? `${reference.attachmentId}-invalid`
              : field === 'mediaType'
                ? 'image/jpeg'
                : reference[field] + 1;
          return { ...actual, attachment: { ...actual.attachment, [field]: value } };
        },
        signal(),
        maximum,
      ),
    );
  for (const [field, value] of [
    ['attachmentId', ''],
    ['mediaType', 'image/bmp'],
    ['bytes', 0],
    ['width', -1],
    ['height', NaN],
    ['name', 1],
    ['originalDimensions', { width: 0, height: 1 }],
  ]) {
    let reads = 0;
    await reject(`invalid-input-reference-${field}`, () =>
      resolveModelImage(
        { ...reference, [field]: value },
        async (ref, abort) => {
          reads++;
          return read(ref, abort);
        },
        signal(),
        maximum,
      ),
    );
    assert.equal(reads, 0);
  }
  for (const budget of [0, -1, 0.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    let reads = 0;
    await reject(`invalid-image-budget-${String(budget)}`, () =>
      resolveModelImage(
        reference,
        async (ref, abort) => {
          reads++;
          return read(ref, abort);
        },
        signal(),
        budget,
      ),
    );
    assert.equal(reads, 0);
  }
  await reject(
    'missing-image-resolver',
    () => resolveModelImage(reference, undefined, signal(), maximum),
    (error) => error instanceof LlmError && error.code === 'UNSUPPORTED_CONTENT',
  );
  for (const [field, value] of [
    ['maxImagesPerRequest', 0],
    ['maxImagesPerRequest', 1.5],
    ['maxRequestBytes', 0],
    ['maxRequestBytes', NaN],
  ])
    await reject(`invalid-responses-limit-${field}-${String(value)}`, () =>
      responsesInputItems(
        options,
        { resolveImage: read, maxImagesPerRequest: 64, maxRequestBytes: maximum, [field]: value },
        signal(),
      ),
    );
  const seen = new Set();
  const repeated = structuredClone(options);
  let changed = false;
  for (const message of repeated.messages)
    for (const ref of imageRefs(message.content)) {
      if (!changed && seen.has(ref.attachmentId)) {
        ref.width++;
        changed = true;
      }
      seen.add(ref.attachmentId);
    }
  assert(changed);
  for (const [name, Adapter] of [
    ['chat', OpenAICompatibleAdapter],
    ['responses', OpenAIResponsesAdapter],
  ]) {
    const adapter = (changes = {}) =>
      new Adapter({
        baseURL,
        models: [{ id: options.model }],
        resolveImage: read,
        maxImagesPerRequest: 64,
        ...changes,
      });
    const consume = async (model, input) => {
      for await (const chunk of model.stream(input))
        assert.fail(`Unexpected provider chunk: ${chunk.type}`);
    };
    await reject(`${name}-repeated-image-identity`, () => consume(adapter(), repeated));
    await reject(`${name}-image-count-before-http`, () =>
      consume(adapter({ maxImagesPerRequest: 1 }), options),
    );
    await reject(`${name}-image-budget-before-http`, () =>
      consume(adapter({ maxRequestBytes: Math.ceil(originalImage.bytes / 3) * 4 - 1 }), options),
    );
    await reject(`${name}-resolver-data-before-http`, () =>
      consume(
        adapter({
          resolveImage: async (ref, abort) => ({ ...(await read(ref, abort)), bytes: 0 }),
        }),
        options,
      ),
    );
    await reject(
      `${name}-empty-credential-before-http`,
      () => consume(adapter({ apiKey: () => ' ' }), options),
      (error) => error instanceof LlmError && error.code === 'MISSING_CREDENTIAL',
    );
    for (const stage of ['before-read', 'after-read', 'after-credential']) {
      const controller = new AbortController();
      const reason = new Error(`Original image preparation cancelled ${stage}.`);
      let reads = 0;
      if (stage === 'before-read') controller.abort(reason);
      const model = adapter({
        ...(stage === 'after-credential'
          ? {
              apiKey: async () => {
                controller.abort(reason);
                return ' ';
              },
            }
          : {}),
        resolveImage: async (ref, abort) => {
          reads++;
          const image = await read(ref, abort);
          if (stage === 'after-read') controller.abort(reason);
          return image;
        },
      });
      await reject(
        `${name}-cancelled-${stage}`,
        () => consume(model, { ...options, signal: controller.signal }),
        (error) => error === reason,
      );
      assert.equal(reads, stage === 'after-read' ? 1 : 0);
    }
    const corrupted = [];
    const prepare = adapter({
      resolveImage: async (ref, abort) => {
        for (const prior of corrupted) {
          prior.data.fill(0);
          prior.attachment.width++;
        }
        const image = await read(ref, abort);
        corrupted.push(image);
        return image;
      },
    });
    const body = JSON.parse(await prepare.request(options, signal()));
    const parts =
      name === 'responses'
        ? body.input.flatMap((item) =>
            Array.isArray(item.output) ? item.output : (item.content ?? []),
          )
        : body.messages.flatMap((message) =>
            Array.isArray(message.content) ? message.content : [],
          );
    const urls = parts
      .filter((part) => ['input_image', 'image_url'].includes(part.type))
      .map((part) => part.image_url.url ?? part.image_url);
    assert.equal(urls.length, original.refs.length);
    for (const [index, ref] of original.refs.entries()) {
      const actual = await read(ref, signal());
      assert.equal(
        urls[index],
        `data:${actual.mediaType};base64,${Buffer.from(actual.data).toString('base64')}`,
      );
    }
    admitted(`${name}-later-resolver-cannot-change-earlier-image`);
  }
  const uniqueBytes = (
    await Promise.all(
      [...new Set(original.refs.map((ref) => ref.attachmentId))].map((id) =>
        read(references.get(id), signal()),
      ),
    )
  ).reduce((sum, image) => sum + Math.ceil(image.bytes / 3) * 4, 0);
  await reject('responses-repeated-images-count-toward-byte-budget', () =>
    responsesInputItems(
      options,
      { resolveImage: read, maxImagesPerRequest: 64, maxRequestBytes: uniqueBytes },
      signal(),
    ),
  );
  for (const context of contexts) {
    const original = recordedContexts.find((item) => item.key === context.key);
    assert.equal(hash(JSON.stringify(original.messages)), context.sha256);
  }
  assert.equal(connections, 0);
} finally {
  try {
    await host.fiber.dispose();
  } finally {
    await new Promise((accept, reject) =>
      listener.close((error) => (error ? reject(error) : accept())),
    );
  }
}
for (const source of sources) assert.equal(hash(await readFile(source.path)), source.sha256);
assert.equal(hash(await readFile(resolve(copyDirectory, 'records.jsonl'))), sources[0].sha256);
await assert.rejects(access(resolve(copyDirectory, 'writer.lock')), { code: 'ENOENT' });
await assert.rejects(
  imageService.readImageRequest(references.values().next().value, policy, signal()),
  /closed/,
);
const acceptance = {
  schemaVersion: 'edh.recorded_model_images.v1',
  scope: 'original Agent contexts and actual DSH image request preparation',
  derivedBoundaries:
    'Declared malformed reference/resolver/limit/cancellation derivatives and detached memory checks. Preparation ends before HTTP; the audit socket supplies no response.',
  providerRequests: 0,
  providerConnections: connections,
  modelAllocations: 0,
  simulatorAllocations: 0,
  gpuAllocations: 0,
  implementation,
  sources,
  imageRecords,
  contexts,
  checks,
  originalInputsUnchanged: true,
  originalContextsUnchanged: true,
  diagnosticWriterReleased: true,
  imageServiceClosed: true,
  listenerClosed: !listener.listening,
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(acceptance, null, 2)}\n`, {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    output,
    images: imageRecords.length,
    contexts: contexts.length,
    imageOccurrences: contexts.reduce((sum, context) => sum + context.images, 0),
    cases: checks.length,
    providerRequests: 0,
    gpuAllocations: 0,
  }),
);
