import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  AttachmentId,
  ImageVariantId,
  type ImageAttachmentRef,
  type RequestImageAttachment,
} from '@deepseek-ai/dsh-attachment';
import { ToolCallId, type LlmAdapter } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { ContractValidator } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { FileTeamLoader } from '@edh/teams';
import { OpenAICompatibleAdapter } from '@edh/models';
import { admitSensorSample, sensorImages } from '@edh/perception';
import type { SensorSample } from '@edh/execution';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { UpperRun, CORE_TOOLS } from '../../apps/server/src/application.js';
import { FixtureBackend, FIXTURE_GOAL } from '../../apps/server/src/fixture-backend.js';
import type { ContextManagementOptions } from '@edh/memory';
import { imageReferences } from '../../harness/agent-runtime/memory/src/visual-history.js';
import { ScriptedModel, textResponse, toolResponse } from './scripted-model.js';

const attachment: ImageAttachmentRef = {
  attachmentId: AttachmentId('sensor-fixture'),
  mediaType: 'image/png',
  bytes: 68,
  width: 1,
  height: 1,
};
const data = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=',
  'base64',
);
const image: RequestImageAttachment = {
  variantId: ImageVariantId('sensor-preview'),
  attachment,
  data,
  mediaType: 'image/png',
  bytes: 68,
  width: 1,
  height: 1,
  depth: 'uchar',
  space: 'srgb',
  hasAlpha: true,
};

async function setup(adapter: LlmAdapter, contextManagement?: ContextManagementOptions) {
  const directory = await mkdtemp(resolve(tmpdir(), 'edh-sensor-'));
  const store = new LocalStore(directory);
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const host = await createDshHost([{ providers: ['sensor-test'], adapter }], contextManagement);
  await writeFile(
    resolve(directory, 'team.yaml'),
    `schema_version: physical.team.v1
team_id: image-test
entrypoint: lead
learning_enabled: false
members:
  lead: builtin:planner
  verifier: builtin:verifier
  analyst: analyst.md
bindings:
  decision_owner: lead
  final_verifier: verifier
tool_bindings: {}
`,
  );
  await writeFile(
    resolve(directory, 'analyst.md'),
    `---
role_id: image-analyst
description: Inspect explicitly supplied images.
tools: [evidence.read]
---
Use only the caller's explicit image evidence.
`,
  );
  const team = await new FileTeamLoader({
    validator,
    builtinDirectory: resolve('harness/agent-runtime/agents/roles'),
    roleRoot: directory,
    defaultModel: 'fixture',
    models: ['fixture'],
    tools: CORE_TOOLS,
    providers: [],
  }).inspect(resolve(directory, 'team.yaml'));
  const backend = new FixtureBackend(validator, 'first-pass', 50);
  const original = backend.capture.bind(backend);
  let sample: SensorSample | undefined;
  backend.capture = () => sample ?? { ...original(), images: [attachment] };
  const run = new UpperRun({
    host,
    team,
    validator,
    store,
    backend,
    goal: FIXTURE_GOAL,
    instruction: 'Inspect the admitted camera image.',
    scenario: 'sensor-fixture',
    model: () => ({ provider: 'sensor-test', model: 'fixture' }),
  });
  const invoke = (assignmentId: string, name: string, args: object = {}) =>
    host.tools.execute({
      agent: host.agents.get(SessionId(run.state.assignments[assignmentId]!.sessionId))!,
      callId: ToolCallId(randomUUID()),
      name,
      arguments: args,
      signal: new AbortController().signal,
    });
  return {
    run,
    host,
    validator,
    backend,
    invoke,
    setSample(value: SensorSample) {
      sample = value;
    },
    async close() {
      try {
        await run.close();
      } finally {
        await host.fiber.dispose();
        store.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

test(
  'upper capture returns a native DSH image through the actual HTTP model request',
  { timeout: 10000 },
  async () => {
    const requests: any[] = [];
    const server = createServer(async (req, res) => {
      const buffers: Buffer[] = [];
      for await (const part of req) buffers.push(Buffer.from(part));
      requests.push(JSON.parse(Buffer.concat(buffers).toString()));
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const delta =
        requests.length === 1
          ? {
              tool_calls: [
                {
                  index: 0,
                  id: 'capture-call',
                  type: 'function',
                  function: { name: 'perception__capture', arguments: '{}' },
                },
              ],
            }
          : { content: 'The admitted test image is available.' };
      res.write(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`,
      );
      res.end(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: requests.length === 1 ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`,
      );
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    let resolved = 0;
    const adapter = new OpenAICompatibleAdapter({
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
      models: [{ id: 'fixture', inputModalities: ['text', 'image'] }],
      resolveImage: async (ref) => {
        assert.deepEqual(ref, attachment);
        resolved++;
        return image;
      },
    });
    const f = await setup(adapter);
    try {
      await f.run.start();
      await f.run.settle();
      assert.equal(requests.length, 2);
      assert.equal(resolved, 1);
      assert.match(JSON.stringify(requests[1].messages), /data:image\/png;base64,/);
      assert.equal(f.run.state.latestSensor?.images?.[0]?.attachmentId, attachment.attachmentId);
      assert.doesNotMatch(JSON.stringify(f.run.snapshot()), /iVBORw0KGgo|data:image/);
      assert(f.run.snapshot().events.some((e) => e.type === 'observation.consumed'));
    } finally {
      await f.close();
      await new Promise<void>((done) => {
        server.close(() => done());
        server.closeAllConnections();
      });
    }
  },
);

test(
  'explicit image handoff preserves fresh contexts and prevents evidence or attachment rebinding',
  { timeout: 10000 },
  async () => {
    const model = new ScriptedModel([
      textResponse('Planner ready.'),
      textResponse('No image granted.'),
      textResponse('Explicit image received.'),
    ]);
    const f = await setup(model);
    try {
      await f.run.start();
      await f.run.settle();
      const owner = f.run.state.decisionAssignmentId;
      const capture = await f.invoke(owner, 'perception__capture');
      assert.equal(capture.isError, false);
      const sample = structuredClone(f.run.state.latestSensor!);
      assert(capture.content.some((part) => part.type === 'image'));
      await f.invoke(owner, 'team__delegate', {
        member: 'analyst',
        objective: 'Inspect only explicit context.',
        context: '',
        evidenceRefs: [],
      });
      await f.run.settle();
      const first = Object.values(f.run.state.assignments).find((a) => a.member === 'analyst')!;
      assert.equal(
        (await f.invoke(first.id, 'evidence__read', { evidenceId: sample.evidence.id })).isError,
        true,
      );
      assert.equal(
        model.requests[1]!.messages.some((m) => m.content.some((p) => p.type === 'image')),
        false,
      );
      await f.invoke(owner, 'team__delegate', {
        member: 'analyst',
        objective: 'Inspect this exact image.',
        context: 'Explicit image handoff.',
        evidenceRefs: [sample.evidence.id],
      });
      await f.run.settle();
      assert(
        model.requests[2]!.messages.some((m) =>
          m.content.some(
            (p) => p.type === 'image' && p.attachment.attachmentId === attachment.attachmentId,
          ),
        ),
      );
      const second = Object.values(f.run.state.assignments).find(
        (a) => a.member === 'analyst' && a.id !== first.id,
      )!;
      assert.equal(
        (await f.invoke(second.id, 'evidence__read', { evidenceId: sample.evidence.id })).isError,
        false,
      );
      f.setSample({ ...sample, description: 'A different scene under the same evidence ID.' });
      assert.equal((await f.invoke(owner, 'perception__capture')).isError, true);
      assert.deepEqual(f.run.state.latestSensor, sample);
      f.setSample({
        ...sample,
        evidence: { ...sample.evidence, id: randomUUID() },
        images: [{ ...attachment, width: 2 }],
      });
      assert.equal((await f.invoke(owner, 'perception__capture')).isError, true);
      f.setSample({
        ...sample,
        evidence: { ...sample.evidence, id: randomUUID(), visibility: 'debug_only' },
      });
      assert.equal((await f.invoke(owner, 'perception__capture')).isError, true);
      assert.equal(f.run.state.latestSensor?.evidence.id, sample.evidence.id);
      assert.doesNotMatch(JSON.stringify(f.run.snapshot()), /iVBORw0KGgo|data:image/);
      const extraEvidence: string[] = [];
      for (let batch = 0; batch < 2; batch++) {
        const id = randomUUID();
        f.setSample({
          ...sample,
          evidence: { ...sample.evidence, id },
          images: Array.from({ length: 9 }, (_, index) => ({
            ...attachment,
            attachmentId: AttachmentId(`extra-${batch}-${index}`),
          })),
        });
        assert.equal((await f.invoke(owner, 'perception__capture')).isError, false);
        extraEvidence.push(id);
      }
      const assignmentsBefore = Object.keys(f.run.state.assignments).length;
      assert.equal(
        (
          await f.invoke(owner, 'team__delegate', {
            member: 'analyst',
            objective: 'Too many images',
            context: '',
            evidenceRefs: extraEvidence,
          })
        ).isError,
        true,
      );
      assert.equal(Object.keys(f.run.state.assignments).length, assignmentsBefore);
      assert.equal(
        (
          await f.invoke(owner, 'team__send', {
            assignmentId: first.id,
            message: 'Too many images',
            evidenceRefs: extraEvidence,
          })
        ).isError,
        true,
      );
      assert.equal(
        (await f.invoke(first.id, 'evidence__read', { evidenceId: extraEvidence[0] })).isError,
        true,
      );
    } finally {
      await f.close();
    }
  },
);

test('sensor metadata admission rejects embedded bytes, invalid references and foreign source', async () => {
  const validator = new ContractValidator(
    JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
  );
  const backend = new FixtureBackend(validator, 'first-pass');
  try {
    const sample = { ...backend.capture(), images: [attachment] };
    const admitted = admitSensorSample(validator, sample, 'test_fixture');
    sample.description = 'Changed after admission';
    assert.notEqual(admitted.description, sample.description);
    for (const bad of [
      { ...sample, data: 'raw-image-bytes' },
      { ...sample, sequence: NaN },
      { ...sample, source: 'hardware' },
      { ...sample, images: [{ ...attachment, attachmentId: 'https://example.test/private' }] },
      { ...sample, images: [{ ...attachment, bytes: -1 }] },
      { ...sample, images: [{ ...attachment, data: 'raw-image-bytes' }] },
      { ...sample, images: [attachment, attachment] },
      { ...sample, visualization: { position: Infinity } },
    ])
      assert.throws(() => admitSensorSample(validator, bad as SensorSample, 'test_fixture'));
    assert.deepEqual(sensorImages([admitted, admitted]), [attachment]);
    assert.throws(() =>
      sensorImages([{ ...admitted, evidence: { ...admitted.evidence, visibility: 'debug_only' } }]),
    );
  } finally {
    await backend.close();
  }
});

test(
  'Planner perceives, plans and acts, then receives the verifier image before the next decision',
  { timeout: 10000 },
  async () => {
    const { FixtureModel } = await import('../../apps/server/src/fixture-model.js');
    const { setTimeout } = await import('node:timers/promises');
    let plannerObserved = false;
    let plannerReceivedVerdictImage = false;
    let monitorObserved = false;
    class ObservingModel extends FixtureModel {
      override async *stream(options: import('@deepseek-ai/dsh-llm').GenerateOptions) {
        const incoming = options.messages.filter((m) => m.source.kind === 'plugin').at(-1);
        const text = incoming?.content.find((p) => p.type === 'text');
        const payload = text?.type === 'text' ? JSON.parse(text.text).payload : undefined;
        if (
          payload?.kind === 'initial' &&
          options.messages.some((m) =>
            m.content.some(
              (p) => p.type === 'tool-result' && p.content.some((c) => c.type === 'image'),
            ),
          )
        )
          plannerObserved = true;
        if (payload?.kind === 'verdict') {
          assert(incoming!.content.some((p) => p.type === 'image'));
          assert.equal(payload.evidence[0].evidence.id, payload.result.evidence_refs[0]);
          plannerReceivedVerdictImage = true;
        }
        if (payload?.kind === 'monitor') {
          assert(incoming!.content.some((p) => p.type === 'image'));
          monitorObserved = true;
        }
        yield* super.stream(options);
      }
    }
    const f = await setup(new ObservingModel(0));
    try {
      await f.run.start();
      const deadline = Date.now() + 7000;
      while (!['succeeded', 'failed'].includes(f.run.state.state) && Date.now() < deadline)
        await setTimeout(10);
      await f.run.settle();
      assert.equal(f.run.state.state, 'succeeded', f.run.state.error ?? undefined);
      assert(plannerObserved);
      assert(plannerReceivedVerdictImage);
      assert(monitorObserved);
      const tools = f.run
        .snapshot()
        .events.filter(
          (e) =>
            e.type === 'tool.started' && e.detail.assignmentId === f.run.state.decisionAssignmentId,
        )
        .map((e) => e.detail.tool);
      assert(tools.indexOf('perception.capture') < tools.indexOf('planning.update'));
      assert(tools.indexOf('planning.update') < tools.indexOf('execution.start'));
      assert.equal(
        f.run.state.agentSeen[f.run.state.decisionAssignmentId]?.evidence.id,
        f.run.state.verdicts.at(-1)?.evidence_refs[0],
      );
    } finally {
      await f.close();
    }
  },
);

test('upper visual maintenance is visible in console events without duplicating tool executions', async () => {
  const model = new ScriptedModel([
    ...Array.from({ length: 6 }, (_, i) => toolResponse('perception__capture', {}, `view-${i}`)),
    textResponse('Six observations received.'),
  ]);
  const f = await setup(model, { compaction: { auto: false }, visualHistory: { maxImages: 2 } });
  try {
    await f.run.start();
    await f.run.settle();
    assert.equal(model.requests.length, 7);
    assert(
      model.requests.every(
        (r) => r.messages.flatMap((m) => imageReferences(m.content)).length <= 2,
      ),
    );
    const events = f.run.snapshot().events;
    assert.equal(events.filter((e) => e.type === 'dsh.tool-result').length, 6);
    const visual = events.filter(
      (e) => e.type === 'agent.context' && e.detail.type === 'edh/visual-history',
    );
    assert.equal(visual.length, 4);
    assert(visual.every((e) => e.detail.assignmentId === f.run.state.decisionAssignmentId));
    assert.match(JSON.stringify(visual), /attachmentIds/);
    assert.doesNotMatch(JSON.stringify(visual), /data:image|iVBOR/);
  } finally {
    await f.close();
  }
});
