import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { defineTool } from '@edh/tools';
import { LocalImageStore } from '@edh/storage';
import { OpenAICompatibleAdapter } from '@edh/models';
import { contextManagementOptions } from '@edh/memory';
import { createDshHost } from '../../apps/server/src/runtime.ts';
import { createDshSession } from '../../harness/agent-runtime/agents/src/runtime.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const baseURL = process.env.EDH_MODEL_BASE_URL;
const model = process.env.EDH_MODEL;
const cameraPath = process.env.EDH_CAMERA_PATH;
const contextWindow = 32768;
const maxTokens = 2048;
const contextManagement = contextManagementOptions({
  compaction: { thresholdRatio: 0.7, retainRatio: 0.15, headroomTokens: 4096, maxTokens: 8192 },
  visualHistory: { maxImages: 12 },
});
if (!baseURL || !model || !cameraPath)
  throw new Error('Set EDH_MODEL_BASE_URL, EDH_MODEL and EDH_CAMERA_PATH.');

const directory = resolve(root, '.local/work/live-robocasa-vlm');
await mkdir(directory, { recursive: true });
const host = await createDshHost([], contextManagement);
try {
  const images = new LocalImageStore(host, { directory });
  const camera = await images.saveImage({
    data: await readFile(cameraPath),
    mediaType: 'image/png',
    name: 'RoboCasa PandaOmron agentview left',
  });
  assert.equal(camera.width, 256);
  assert.equal(camera.height, 256);
  const adapter = new OpenAICompatibleAdapter({
    baseURL,
    models: [{ id: model, inputModalities: ['text', 'image'], contextWindow, maxTokens }],
    timeoutMs: 180_000,
    resolveImage: (ref, signal) =>
      images.readImageRequest(ref, { maxPixels: 1024 * 1024, maxBytes: 2 * 1024 * 1024 }, signal),
  });
  host.llm.registerAdapter(['local-vlm'], adapter);

  async function runRole(role, toolName, instructions, question) {
    let calls = 0;
    const tool = defineTool({
      name: toolName,
      description: 'Read the actual RoboCasa PandaOmron agentview_left camera frame.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { source: { type: 'string', required: true } },
        },
        render: (_args, value) => [
          { type: 'text', text: JSON.stringify(value) },
          { type: 'image', attachment: camera },
        ],
      },
      async execute() {
        calls++;
        return { source: 'RoboCasa OpenCabinet, PandaOmron, agentview_left' };
      },
    });
    const handle = await createDshSession(host, {
      sessionId: `live-${role}-${randomUUID()}`,
      provider: 'local-vlm',
      model,
      instructions,
      tools: [tool],
    });
    handle.agent.followup(
      createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: question }] }),
    );
    await handle.agent.whenIdle();
    const events = handle.agent.session.snapshotEvents();
    const end = events.findLast((event) => event.type === 'turn/end');
    assert.equal(calls, 1, `${role} must call its camera tool exactly once.`);
    assert.equal(end?.data.reason.kind, 'completed', `${role} turn must complete.`);
    const toolCall = events.find((event) => event.type === 'tool/call');
    assert.equal(toolCall?.data.name, toolName);
    const toolResults = events.filter((event) => event.type === 'tool/result');
    assert.equal(toolResults.length, 1, `${role} must receive one camera tool result.`);
    const result = toolResults[0].data.message.content[0];
    assert.equal(result.type, 'tool-result');
    assert.equal(result.toolCallId, toolCall.data.callId);
    assert.equal(result.isError, false);
    const imageBlocks = result.content.filter((block) => block.type === 'image');
    assert.equal(imageBlocks.length, 1, `${role} must receive the real camera image.`);
    assert.equal(imageBlocks[0].attachment.attachmentId, camera.attachmentId);
    const messages = events
      .filter((event) => event.type === 'assistant/message')
      .map((event) => event.data.message.content)
      .filter(Boolean);
    await handle.dispose();
    return {
      role,
      camera_tool_calls: calls,
      tool_call_id: toolCall.data.callId,
      image_attachment_id: imageBlocks[0].attachment.attachmentId,
      turn_reason: end.data.reason.kind,
      messages,
    };
  }

  const planner = await runRole(
    'planner',
    'perception__capture',
    'You are the Planner. You must call perception__capture exactly once, inspect its camera image, and state one concrete visual observation. Do not claim that the cabinet was opened.',
    'Inspect the current RoboCasa OpenCabinet camera frame and state what action could be planned from visible evidence.',
  );
  const verifier = await runRole(
    'verifier',
    'verification__check',
    'You are the Verifier. You must call verification__check exactly once and inspect its image. Report whether opening the cabinet is visually proven, with the evidence and uncertainty. Do not infer task success from the instruction.',
    'Review the current RoboCasa camera frame. Is the cabinet door visibly open?',
  );
  console.log(
    JSON.stringify(
      {
        evaluation: 'Two independent DSH turns over a static RoboCasa reset camera frame',
        camera: cameraPath,
        model,
        context_window: contextWindow,
        max_completion_tokens: maxTokens,
        context_management: contextManagement,
        planner,
        verifier,
      },
      null,
      2,
    ),
  );
} finally {
  await host.fiber.dispose();
}
