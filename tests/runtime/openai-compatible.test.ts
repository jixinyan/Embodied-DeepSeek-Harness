import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { OpenAICompatibleAdapter } from '@edh/models';
import { createUserMessage, LlmError, type GenerateOptions } from '@deepseek-ai/dsh-llm';
import {
  AttachmentId,
  ImageVariantId,
  type RequestImageAttachment,
} from '@deepseek-ai/dsh-attachment';
import { defineTool } from '@edh/tools';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { createDshSession } from '../../harness/agent-runtime/agents/src/runtime.js';

async function endpoint(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void,
) {
  const server = createServer((req, res) => {
    void Promise.resolve(handler(req, res)).catch(() => {
      res.writeHead(500);
      res.end();
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return {
    baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    close: () =>
      new Promise<void>((done) => {
        server.close(() => done());
        server.closeAllConnections();
      }),
  };
}
async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}
function sse(res: ServerResponse, payloads: unknown[], done = true) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const wire =
    ': keepalive\r\n\r\n' +
    payloads.map((payload) => `data: ${JSON.stringify(payload)}\r\n\r\n`).join('') +
    (done ? 'data: [DONE]\r\n\r\n' : '');
  const bytes = Buffer.from(wire);
  for (let index = 0; index < bytes.length; index += 7) res.write(bytes.subarray(index, index + 7));
  res.end();
}
const textFinish = [
  { choices: [{ index: 0, delta: { content: 'Cup observed ✓' }, finish_reason: null }] },
  { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
];
const image: RequestImageAttachment = {
  variantId: ImageVariantId('fixture-preview'),
  attachment: {
    attachmentId: AttachmentId('fixture-image'),
    mediaType: 'image/png',
    bytes: 68,
    width: 1,
    height: 1,
  },
  data: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=',
    'base64',
  ),
  mediaType: 'image/png',
  bytes: 68,
  width: 1,
  height: 1,
  depth: 'uchar',
  space: 'srgb',
  hasAlpha: true,
};
const request: GenerateOptions = {
  provider: 'local-vlm',
  model: 'fixture-vlm',
  messages: [
    createUserMessage({
      content: [{ type: 'text', text: 'Inspect this scene.' }],
      source: { kind: 'user' },
    }),
  ],
};

test('OpenAI-compatible HTTP runs native DSH tool calls, image input and tool-result images', async () => {
  const requests: any[] = [];
  const service = await endpoint(async (req, res) => {
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, 'Bearer test-only-token');
    requests.push(await body(req));
    if (requests.length === 1)
      sse(res, [
        {
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call-scene',
                    type: 'function',
                    function: { name: 'scene', arguments: '{"view":' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              index: 0,
              delta: { tool_calls: [{ index: 0, function: { arguments: '"front"}' } }] },
              finish_reason: 'tool_calls',
            },
          ],
        },
      ]);
    else
      sse(res, [
        ...textFinish,
        {
          choices: [],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 4,
            total_tokens: 24,
            prompt_tokens_details: { cached_tokens: 5 },
          },
        },
      ]);
  });
  const adapter = new OpenAICompatibleAdapter({
    baseURL: service.baseURL,
    apiKey: () => 'test-only-token',
    models: [{ id: 'fixture-vlm', inputModalities: ['text', 'image'] }],
    resolveImage: async () => image,
  });
  const host = await createDshHost([{ providers: ['local-vlm'], adapter }]);
  try {
    let called = 0;
    const handle = await createDshSession(host, {
      provider: 'local-vlm',
      model: 'fixture-vlm',
      sessionId: 'http-vlm-fixture',
      instructions: 'Inspect the scene.',
      tools: [
        defineTool({
          name: 'scene',
          description: 'Return an admitted camera fixture.',
          parameters: { view: { type: 'string', required: true } },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: () => [
              { type: 'text', text: 'Synthetic scene evidence.' },
              { type: 'image', attachment: image.attachment },
            ],
          },
          execute: async (args) => {
            called++;
            assert.equal(args.view, 'front');
            return {};
          },
        }),
      ],
    });
    handle.agent.followup(
      createUserMessage({
        source: { kind: 'user' },
        content: [
          { type: 'text', text: 'Observe the cup.' },
          { type: 'image', attachment: image.attachment },
        ],
      }),
    );
    await handle.agent.whenIdle();
    assert.equal(called, 1);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].tools[0].function.name, 'scene');
    assert.equal(requests[0].messages[0].role, 'system');
    assert.match(JSON.stringify(requests[0].messages), /data:image\/png;base64,/);
    assert.equal(
      requests[1].messages.find((message: any) => message.role === 'tool').tool_call_id,
      'call-scene',
    );
    assert(
      requests[1].messages.some(
        (message: any) =>
          message.role === 'user' &&
          JSON.stringify(message.content).includes('Attached image(s) from tool result:'),
      ),
    );
    const events = handle.agent.session.snapshotEvents();
    assert.match(JSON.stringify(events), /Cup observed ✓/);
    assert.doesNotMatch(JSON.stringify(events), /test-only-token|data:image\/png/);
  } finally {
    await host.fiber.dispose();
    await service.close();
  }
});

test('model transport rejects truncated streams and reports bounded provider failures', async () => {
  let mode = 'truncated';
  const service = await endpoint(async (req, res) => {
    await body(req);
    if (mode === 'truncated') sse(res, textFinish, false);
    else if (mode === 'missing-finish') sse(res, [textFinish[0]]);
    else if (mode === 'oversized')
      sse(res, [{ choices: [{ delta: { content: 'x'.repeat(2048) }, finish_reason: 'stop' }] }]);
    else {
      res.writeHead(429, { 'retry-after': '2', 'x-request-id': 'provider-request-1' });
      res.end('Sensitive upstream detail');
    }
  });
  const adapter = new OpenAICompatibleAdapter({
    baseURL: service.baseURL,
    models: [],
    maxResponseBytes: 1024,
  });
  const consume = async () => {
    for await (const _ of adapter.stream(request)) {
    }
  };
  try {
    await assert.rejects(
      consume(),
      (error) => error instanceof LlmError && error.code === 'STREAM_CLOSED',
    );
    mode = 'missing-finish';
    await assert.rejects(
      consume(),
      (error) => error instanceof LlmError && error.code === 'STREAM_CLOSED',
    );
    mode = 'oversized';
    await assert.rejects(
      consume(),
      (error) => error instanceof LlmError && error.code === 'RESPONSE_TOO_LARGE',
    );
    mode = 'rate-limit';
    await assert.rejects(consume(), (error) => {
      assert(error instanceof LlmError);
      assert.equal(error.failure.providerRetryAfterMs, 2000);
      assert.equal(error.failure.requestId, 'provider-request-1');
      assert.equal(error.failure.status, 429);
      assert.doesNotMatch(error.message, /Sensitive/);
      return true;
    });
  } finally {
    await service.close();
  }
});

test('local model transport permits no credential and honors cancellation and request timeout', async () => {
  let received = false;
  const service = await endpoint(async (req) => {
    await body(req);
    assert.equal(req.headers.authorization, undefined);
    received = true;
  });
  const adapter = new OpenAICompatibleAdapter({
    baseURL: service.baseURL,
    models: [],
    timeoutMs: 1000,
  });
  try {
    const controller = new AbortController();
    const pending = (async () => {
      for await (const _ of adapter.stream({ ...request, signal: controller.signal })) {
      }
    })();
    const aborted = assert.rejects(pending, /Cancelled by test/);
    while (!received) await setTimeout(5);
    controller.abort(new Error('Cancelled by test'));
    await aborted;
    const timeoutAdapter = new OpenAICompatibleAdapter({
      baseURL: service.baseURL,
      models: [],
      timeoutMs: 30,
    });
    await assert.rejects(
      (async () => {
        for await (const _ of timeoutAdapter.stream(request)) {
        }
      })(),
      (error) => error instanceof LlmError && error.code === 'TIMEOUT',
    );
  } finally {
    await service.close();
  }
});
