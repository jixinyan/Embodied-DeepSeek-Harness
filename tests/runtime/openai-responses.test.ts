import assert from 'node:assert/strict';
import test from 'node:test';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { OpenAIResponsesAdapter } from '@edh/models';

test('Responses SSE translates text, reasoning and function calls into DSH chunks', async () => {
  const events: readonly [string, Record<string, unknown>][] = [
    ['response.reasoning_summary_text.delta', { delta: 'check' }],
    ['response.output_text.delta', { delta: 'done' }],
    [
      'response.output_item.added',
      {
        output_index: 0,
        item: { type: 'function_call', call_id: 'call-1', name: 'execution__start' },
      },
    ],
    [
      'response.function_call_arguments.delta',
      { output_index: 0, delta: '{"instruction":"move"}' },
    ],
    [
      'response.output_item.done',
      {
        output_index: 0,
        item: {
          type: 'function_call',
          call_id: 'call-1',
          name: 'execution__start',
          arguments: '{"instruction":"move"}',
        },
      },
    ],
    [
      'response.completed',
      {
        response: {
          status: 'completed',
          output: [{ type: 'function_call' }],
          usage: { input_tokens: 12, output_tokens: 7 },
        },
      },
    ],
  ];
  const sse = events
    .map(
      ([event, data]) => `event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`,
    )
    .join('');
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
  };
  try {
    const adapter = new OpenAIResponsesAdapter({
      baseURL: 'https://api.openai.com/v1',
      models: [{ id: 'gpt-6-astra', inputModalities: ['text', 'image'] }],
    });
    const chunks = [];
    for await (const chunk of adapter.stream({
      provider: 'openai',
      model: 'gpt-6-astra',
      messages: [
        createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'move' }] }),
      ],
      tools: [
        {
          name: 'execution__start',
          description: 'Start execution',
          parameters: { type: 'object' },
        },
      ],
    }))
      chunks.push(chunk);
    assert.equal(requestBody?.model, 'gpt-6-astra');
    assert.equal(
      chunks.some((chunk) => chunk.type === 'reasoning-delta'),
      true,
    );
    assert.equal(
      chunks.some((chunk) => chunk.type === 'text-delta'),
      true,
    );
    assert.equal(
      chunks.some((chunk) => chunk.type === 'tool-call-delta'),
      true,
    );
    const finish = chunks.at(-1);
    assert.equal(finish?.type, 'finish');
    if (finish?.type === 'finish') assert.equal(finish.reason.kind, 'tool-calls');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
