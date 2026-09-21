import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { LocalImageStore } from '@edh/storage';
import {
  createConfiguredModels,
  parseModelConfiguration,
  readModelConfiguration,
  type ModelConfiguration,
} from '@edh/models';
import { createDshHost } from '../../apps/server/src/runtime.js';

const variable = `EDH_MODEL_BINDING_ACCEPTANCE_${process.pid}`;
const local = await readModelConfiguration('examples/models/local-vllm.yaml');
const cloud = await readModelConfiguration('examples/models/cloud-api.yaml');
cloud.endpoints.cloud!.authentication = { type: 'environment', variable };

async function withImages(action: (images: LocalImageStore, directory: string) => Promise<void>) {
  await mkdir('.local/work', { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/model-configuration-'));
  const context = new Context();
  const original = process.env[variable];
  process.env[variable] = randomUUID();
  try {
    await context.plugin(LocalImageStore, { directory });
    await action(context.attachments as LocalImageStore, directory);
  } finally {
    if (original === undefined) delete process.env[variable];
    else process.env[variable] = original;
    await context.fiber.dispose();
    await rm(directory, { recursive: true, force: true });
  }
}

test('cloud and vLLM configurations bind image-capable models to the actual native DSH runtime', async () => {
  await withImages(async (images) => {
    const input = {
      version: 1,
      defaultModel: 'local-brain',
      endpoints: { ...local.endpoints, ...cloud.endpoints },
      models: { 'local-brain': local.models.brain, 'cloud-brain': cloud.models.brain },
    };
    const bindings = createConfiguredModels(input, { images });
    assert.deepEqual(
      { ...bindings.models },
      {
        'local-brain': { provider: 'local', model: 'local-vlm' },
        'cloud-brain': { provider: 'cloud', model: 'your-vision-model' },
      },
    );
    const host = await createDshHost(bindings.adapters);
    try {
      for (const route of Object.values(bindings.models)) {
        const info = await host.llm.resolveModelInfo(route.provider, route.model);
        assert.equal(info.provider, route.provider);
        assert.equal(info.id, route.model);
        assert.deepEqual(info.inputModalities, ['text', 'image']);
        assert.equal((await host.llm.listModels(route.provider)).length, 1);
      }
    } finally {
      await host.fiber.dispose();
    }
    assert.equal(bindings.defaultModel, 'local-brain');
    assert(!JSON.stringify(bindings.models).includes(process.env[variable]!));
  });
});

test('YAML and JSON configuration files receive the same strict validation', async () => {
  await withImages(async (_images, directory) => {
    const file = resolve(directory, 'models.json');
    await writeFile(file, JSON.stringify(local));
    assert.deepEqual(await readModelConfiguration(file), local);
    await writeFile(file, 'version: 1\nversion: 2\n');
    await assert.rejects(readModelConfiguration(file), /unique/);
    for (const patch of [
      { version: 2 },
      { defaultModel: 'missing' },
      { endpoints: {} },
      { apiKey: 'disallowed-inline-value' },
      { models: { brain: { ...local.models.brain, endpoint: 'missing' } } },
    ])
      assert.throws(() => parseModelConfiguration({ ...local, ...patch }));
    for (const baseURL of [
      'file:///models',
      'https://user:password@example.com/v1',
      'https://example.com/v1?key=value',
      'https://example.com/v1#key',
    ])
      assert.throws(() =>
        parseModelConfiguration({
          ...local,
          endpoints: { local: { ...local.endpoints.local, baseURL } },
        }),
      );
  });
});

test('image support and endpoint-specific request fields fail configuration before inference', async () => {
  assert.throws(() => createConfiguredModels(local), /requires the application image service/);
  await withImages(async (images) => {
    for (const extraBody of [{ model: 'override' }, { messages: [] }, { tools: [] }]) {
      const config = structuredClone(local);
      config.endpoints.local!.extraBody = extraBody;
      assert.throws(() => createConfiguredModels(config, { images }), /cannot override/);
    }
    const config = structuredClone(local);
    config.endpoints.local!.extraBody = { chat_template_kwargs: { enable_thinking: false } };
    config.models.brain!.contextWindow = 65536;
    config.models.brain!.maxTokens = 4096;
    const bindings = createConfiguredModels(config, { images });
    const info = await bindings.adapters[0]!.adapter.resolveModel('local', 'local-vlm');
    assert.deepEqual(info.context, { contextWindow: 65536 });
    assert.equal(info.defaultMaxTokens, 4096);
    config.models.brain!.contextWindow = 1;
    assert.deepEqual(
      (await bindings.adapters[0]!.adapter.resolveModel('local', 'local-vlm')).context,
      { contextWindow: 65536 },
    );
  });
});

test('credential presence is checked during assembly and on later actual adapter calls', async () => {
  await withImages(async (images) => {
    delete process.env[variable];
    assert.throws(() => createConfiguredModels(cloud, { images }), /credential environment/);
    process.env[variable] = 'invalid\nheader';
    assert.throws(() => createConfiguredModels(cloud, { images }), /credential environment/);
    process.env[variable] = randomUUID();
    const bindings = createConfiguredModels(cloud, { images });
    delete process.env[variable];
    const stream = bindings.adapters[0]!.adapter.stream({
      provider: 'cloud',
      model: cloud.models.brain!.model,
      messages: [],
    });
    await assert.rejects(
      async () => {
        for await (const _chunk of stream)
          assert.fail('No request can start without its credential.');
      },
      { code: 'MISSING_CREDENTIAL' },
    );
    assert.doesNotThrow(() => createConfiguredModels(local, { images }));
    const securedLocal = structuredClone(local);
    securedLocal.endpoints.local!.authentication = { type: 'environment', variable };
    assert.throws(() => createConfiguredModels(securedLocal, { images }), /credential environment/);
    process.env[variable] = randomUUID();
    assert.doesNotThrow(() => createConfiguredModels(securedLocal, { images }));
  });
});

test('both endpoint bindings resolve actual image files before enforcing request byte limits', async () => {
  await withImages(async (images) => {
    const attachment = await images.saveImage({
      data: await readFile('apps/console/public/logo.png'),
      mediaType: 'image/png',
    });
    for (const source of [local, cloud]) {
      const config = structuredClone(source);
      const endpoint = Object.values(config.endpoints)[0]!;
      endpoint.maxRequestBytes = 1;
      const bindings = createConfiguredModels(config, { images });
      const route = bindings.models.brain!;
      await assert.rejects(
        async () => {
          for await (const _chunk of bindings.adapters[0]!.adapter.stream({
            ...route,
            messages: [
              createUserMessage({
                source: { kind: 'user' },
                content: [{ type: 'image', attachment }],
              }),
            ],
          }))
            assert.fail('Oversized image requests must stop before network dispatch.');
        },
        { code: 'INVALID_REQUEST', message: 'Request image bytes exceeded.' },
      );
    }
    const inspection = await images.inspectStorage();
    assert.equal(inspection.state, 'ready');
    if (inspection.state === 'ready') assert(inspection.requestCache.files > 0);
  });
});

test('configuration identity follows endpoint and request options while credential rotation stays private', async () => {
  await withImages(async (images) => {
    const original = createConfiguredModels(cloud, { images });
    process.env[variable] = randomUUID();
    assert.equal(
      createConfiguredModels(cloud, { images }).modelConfigurationDigest,
      original.modelConfigurationDigest,
    );
    const changes: ((config: ModelConfiguration) => void)[] = [
      (config) => {
        config.endpoints.cloud!.baseURL = 'https://second.example/v1';
      },
      (config) => {
        config.endpoints.cloud!.maxTokensField = 'max_tokens';
      },
      (config) => {
        config.endpoints.cloud!.imageRequest.maxPixels = 512 * 512;
      },
      (config) => {
        config.models.brain!.model = 'another-served-model';
      },
    ];
    for (const change of changes) {
      const config = structuredClone(cloud);
      change(config);
      assert.notEqual(
        createConfiguredModels(config, { images }).modelConfigurationDigest,
        original.modelConfigurationDigest,
      );
    }
  });
});

test('aliases may share a served model only with identical capability declarations', async () => {
  await withImages(async (images) => {
    const config = structuredClone(local);
    config.models.verifier = structuredClone(config.models.brain!);
    assert.equal(createConfiguredModels(config, { images }).adapters.length, 1);
    config.models.verifier.maxTokens = 256;
    assert.throws(() => createConfiguredModels(config, { images }), /Conflicting capabilities/);
  });
});
