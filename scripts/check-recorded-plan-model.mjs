import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import * as Todo from '@deepseek-ai/dsh-tool-todo';
import { ContractValidator } from '@edh/contracts';
import { readModelConfiguration, OpenAICompatibleAdapter } from '@edh/models';
import { CORE_TOOL_DESCRIPTIONS, validateJsonSchemaValue } from '@edh/tools';
import {
  coreModelToolParameters,
  modelToolContractSchema,
} from '../apps/server/src/model-tool-schema.ts';
import { createDshHost } from '../apps/server/src/runtime.ts';

const { values } = parseArgs({
  options: {
    events: { type: 'string' },
    configuration: { type: 'string' },
    models: { type: 'string' },
    profile: { type: 'string' },
    member: { type: 'string' },
    output: { type: 'string' },
  },
});
assert(
  values.events &&
    values.configuration &&
    values.models &&
    values.profile &&
    values.member &&
    values.output,
);
const output = resolve(values.output);
await mkdir(output, { recursive: false });
const events = JSON.parse(await readFile(values.events, 'utf8'));
const configuration = JSON.parse(await readFile(values.configuration, 'utf8'));
const role = configuration.launchTeams[values.profile].roles[values.member];
assert(role.definition.tools.includes('planning.update'));
const receipt = events.find(
  (event) => event.type === 'tool.completed' && event.detail.tool === 'planning.read',
).detail.result;
assert(receipt.planWrite);
const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const planSchema = await modelToolContractSchema(validator, 'PlanDocument');
const tools = role.definition.tools
  .filter((logical) => logical !== 'todo_write')
  .map((logical) => ({
    name: logical.replaceAll('.', '__'),
    description: CORE_TOOL_DESCRIPTIONS[logical],
    parameters: coreModelToolParameters(logical, {
      planSchema,
      ...(role.outputSchema ? { roleOutputSchema: role.outputSchema.schema } : {}),
    }),
  }));
assert(tools.every((tool) => tool.description));
if (role.definition.tools.includes('todo_write')) {
  const host = await createDshHost([]);
  try {
    await host.plugin(Todo, { allowParallelInProgress: true });
    const todo = host.tools.schemas().find((tool) => tool.name === 'todo_write');
    assert(todo);
    tools.push(todo);
  } finally {
    await host.fiber.dispose();
  }
}
const parameters = tools.find((tool) => tool.name === 'planning__update').parameters;
assert.deepEqual(validateJsonSchemaValue(parameters, receipt.planWrite, 'arguments'), []);
const modelConfiguration = await readModelConfiguration(values.models);
const binding = modelConfiguration.models[role.model];
assert(binding);
const endpoint = modelConfiguration.endpoints[binding.endpoint];
assert.equal(endpoint.protocol, 'chat_completions');
const credential =
  endpoint.authentication.type === 'environment'
    ? process.env[endpoint.authentication.variable]
    : undefined;
if (endpoint.authentication.type === 'environment')
  assert(credential && !/[\u0000-\u0020\u007f]/.test(credential));
const question = `The following is an actual planning.read receipt from recorded task ${receipt.taskId}. Return exactly one planning__update call using its planWrite. Preserve every admitted identity, version, item and criterion. This diagnostic captures model output without executing any tool.\n${JSON.stringify(receipt)}`;
const results = [];
for (const toolChoice of ['auto', 'required']) {
  const options = {
    ...endpoint,
    models: [
      {
        id: binding.model,
        inputModalities: binding.inputModalities,
        contextWindow: binding.contextWindow,
        maxTokens: binding.maxTokens,
      },
    ],
    strictTools: true,
    toolChoice,
    ...(credential ? { apiKey: () => credential } : {}),
  };
  const request = {
    ...endpoint.extraBody,
    model: binding.model,
    messages: [
      { role: endpoint.systemRole, content: role.instructions },
      { role: 'user', content: question },
    ],
    tools: tools.map((tool) => ({ type: 'function', function: { ...tool, strict: true } })),
    tool_choice: toolChoice,
    max_tokens: binding.maxTokens,
    return_token_ids: true,
    stream: false,
  };
  await writeFile(resolve(output, `${toolChoice}-request.json`), JSON.stringify(request, null, 2));
  const response = await fetch(`${endpoint.baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(endpoint.timeoutMs),
  });
  const body = await response.json();
  await writeFile(
    resolve(output, `${toolChoice}-response.json`),
    JSON.stringify({ status: response.status, body }, null, 2),
  );
  assert(response.ok, JSON.stringify(body));
  const calls = body.choices[0].message.tool_calls;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].function.name, 'planning__update');
  const argumentsValue = JSON.parse(calls[0].function.arguments);
  assert.equal(typeof argumentsValue.plan, 'object');
  assert.deepEqual(validateJsonSchemaValue(parameters, argumentsValue, 'arguments'), []);
  const adapter = new OpenAICompatibleAdapter(options);
  const chunks = [];
  try {
    for await (const chunk of adapter.stream({
      provider: binding.endpoint,
      model: binding.model,
      system: role.instructions,
      messages: [
        createUserMessage({
          source: { kind: 'user' },
          content: [{ type: 'text', text: question }],
        }),
      ],
      tools,
      maxTokens: binding.maxTokens,
      signal: AbortSignal.timeout(endpoint.timeoutMs),
    }))
      chunks.push(chunk);
  } finally {
    await writeFile(
      resolve(output, `${toolChoice}-dsh-stream.json`),
      JSON.stringify(chunks, null, 2),
    );
  }
  const blocks = chunks.filter(
    (chunk) => chunk.type === 'block-end' && chunk.block.type === 'tool-call',
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].block.name, 'planning__update');
  const parsed = JSON.parse(blocks[0].block.arguments);
  assert.deepEqual(validateJsonSchemaValue(parameters, parsed, 'arguments'), []);
  assert.equal(chunks.findLast((chunk) => chunk.type === 'finish').reason.kind, 'tool-calls');
  const reasoning = chunks
    .filter((chunk) => chunk.type === 'reasoning-delta')
    .reduce((size, chunk) => size + chunk.text.length, 0);
  assert(reasoning > 0, 'The configured Qwen thinking response must be retained.');
  results.push({
    toolChoice,
    tools: tools.length,
    strict: true,
    objectPlan: true,
    validationIssues: 0,
    reasoningCharacters: reasoning,
  });
  console.log(JSON.stringify(results.at(-1)));
}
await writeFile(
  resolve(output, 'result.json'),
  JSON.stringify(
    {
      results,
      scope:
        'Actual configured model and native DSH streaming transport; recorded production role schemas and planning receipt; tools are not executed.',
    },
    null,
    2,
  ),
);
