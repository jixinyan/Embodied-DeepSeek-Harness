import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { ContractValidator, type SkillMetadata } from '@edh/contracts';
import { SkillLibrary } from '@edh/memory';
import { LocalStore } from '@edh/storage';
import {
  defineTool,
  CORE_TOOL_PARAMETERS,
  CORE_TOOL_OPTIONAL_PARAMETERS,
  assertObjectJsonSchema,
  validateJsonSchemaValue,
} from '@edh/tools';
import { createDshHost } from '../../apps/server/src/runtime.js';
import { createDshSession } from '../../harness/agent-runtime/agents/src/runtime.js';

const markdown = await readFile('tests/runtime/support/skill-document.md', 'utf8');
const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const metadata: SkillMetadata = {
  schema_version: 'physical.skill_metadata.v1',
  skill_id: 'document-sections',
  version: '1',
  task_semantics: ['Markdown document inspection'],
  required_capabilities: ['document-reading'],
  source_configurations: ['authored-document'],
  evidence_refs: ['document-reference'],
  recovery_id: 'document-record',
  verdict_ref: 'document-result-reference',
  origin: 'test_fixture',
  limitations: ['Authored document-reader input; no model or physical experiment.'],
  validation_status: 'test_fixture',
  validated_configurations: [],
};

async function withLibrary(
  work: (library: SkillLibrary, store: LocalStore) => Promise<void> | void,
) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/skill-sections-'));
  const store = new LocalStore(directory);
  try {
    await work(new SkillLibrary(store, validator), store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('selected skill sections preserve context, limits and source while full documents remain immutable', async () => {
  await withLibrary(async (library, store) => {
    library.save(metadata, markdown);
    const sequence = store.statistics().sequence;
    const matches = library.search('document', true);
    assert.equal(matches.length, 1);
    assert.equal('markdown' in matches[0]!, false);
    const selected = library.load(metadata.skill_id, ['Verification guidance']);
    assert.deepEqual(selected.metadata, metadata);
    assert.deepEqual(selected.selection!.includedSections, [
      'When to use',
      'Verification guidance',
      'Limits',
      'Source',
    ]);
    assert.equal(selected.selection!.fullDocument, false);
    assert(selected.selection!.omittedSections.includes('Planning guidance'));
    assert(selected.selection!.returnedBytes < selected.selection!.sourceBytes);
    assert(selected.markdown.startsWith('# Inspecting a selected document section'));
    assert(selected.markdown.includes('No model or physical provider'));
    assert(!selected.markdown.includes('This heading belongs to the example code block.'));
    assert.equal(library.load(metadata.skill_id).markdown, markdown);
    assert.equal(library.load(metadata.skill_id).selection, undefined);
    assert.equal(store.statistics().sequence, sequence);
    const exported = await readFile(
      resolve(store.directory, 'skills', metadata.skill_id, 'SKILL.md'),
      'utf8',
    );
    assert(exported.endsWith(markdown + '\n'));
    assert.throws(
      () => library.save({ ...metadata, skill_id: 'partial' }, selected.markdown),
      /requires section/,
    );
    assert.equal(store.get('skill:partial'), undefined);
    store.put('inspection', { revision: 1 }, 0);
    store.put('inspection', { revision: 2 }, 1);
    assert.equal(store.compact().compacted, true);
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      assert.deepEqual(
        new SkillLibrary(reopened, validator).load(metadata.skill_id, ['Verification guidance']),
        selected,
      );
    } finally {
      reopened.close();
    }
  });
});

test('code fences and quoted headings do not satisfy required skill sections', async () => {
  await withLibrary((library, store) => {
    for (const replacement of [
      '```markdown\n## When to use\n```',
      '> ## When to use',
      '<!--\n## When to use\n-->',
    ]) {
      assert.throws(
        () => library.save(metadata, markdown.replace('## When to use', replacement)),
        /requires section: When to use/,
      );
      assert.equal(store.get(`skill:${metadata.skill_id}`), undefined);
    }
    assert.throws(
      () => library.save(metadata, markdown + '\n## Limits\nDuplicate text.\n'),
      /Duplicate skill section/,
    );
    assert.throws(
      () => library.save(metadata, markdown.replace('## When to use', '## **When to use**')),
      /plain section name/,
    );
    assert.throws(
      () =>
        library.save(
          metadata,
          markdown.replace(
            'Use this guidance when selecting part of a Markdown document for a focused question.',
            '',
          ),
        ),
      /section is empty/,
    );
  });
});

test('CommonMark headings, nested content, custom sections and CRLF text support selective reads', async () => {
  await withLibrary((library) => {
    const text = (
      markdown.replace('## Planning guidance', 'Planning guidance\n-----------------') +
      '\n## Additional context\nCustom document content.\n'
    ).replaceAll('\n', '\r\n');
    library.save(metadata, text);
    const selected = library.load(metadata.skill_id, ['Planning guidance', 'Additional context']);
    assert(selected.markdown.includes('Planning guidance\r\n-----------------'));
    assert(selected.markdown.includes('### Example content'));
    assert(selected.markdown.includes('```markdown\r\n## Verification guidance'));
    assert(selected.markdown.includes('Custom document content.'));
    assert(!selected.markdown.includes('Compare the excerpt'));
    assert.equal(library.load(metadata.skill_id).markdown, text);
  });
});

test('selected references retain the first CommonMark definition even when it belongs to an omitted section', async () => {
  await withLibrary((library) => {
    const text = markdown
      .replace(
        '## Planning guidance',
        '## Planning guidance\n\n[document]: ../README.md "Original source"',
      )
      .replace(
        '## Verification guidance\n\nCheck',
        '## Verification guidance\n\nConsult [the source][document].\n\nCheck',
      )
      .replace('## Source', '## Source\n\n[document]: ../OTHER.md "Later duplicate"');
    library.save(metadata, text);
    const selected = library.load(metadata.skill_id, ['Verification guidance']);
    assert(selected.markdown.includes('Consult [the source][document].'));
    assert(selected.markdown.indexOf('../README.md') < selected.markdown.indexOf('../OTHER.md'));
    assert(!selected.markdown.includes('Read the document outline'));
    assert.equal(library.load(metadata.skill_id).markdown, text);
  });
});

test('section selection and stored identity validation reject invalid requests without writes', async () => {
  await withLibrary((library, store) => {
    library.save(metadata, markdown);
    const sequence = store.statistics().sequence;
    for (const sections of [[], ['unknown'], ['Limits', 'Limits'], Array(33).fill('Limits')])
      assert.throws(() => library.load(metadata.skill_id, sections), /distinct section names/);
    assert.equal(store.statistics().sequence, sequence);
    store.put('skill:another', { metadata, markdown }, 0);
    assert.throws(() => library.load('another'), /identity does not match/);
    store.put(`skill:${metadata.skill_id}`, { metadata, markdown }, 1);
    assert.throws(() => library.load(metadata.skill_id, ['Limits']), /record was rewritten/);
  });
});

test('native DSH tool execution returns selected document content with optional section arguments', async () => {
  await withLibrary(async (library) => {
    library.save(metadata, markdown);
    const properties = CORE_TOOL_PARAMETERS['skills.load']!;
    const schema = {
      type: 'object',
      properties,
      additionalProperties: false,
      required: Object.keys(properties).filter(
        (key) => !CORE_TOOL_OPTIONAL_PARAMETERS['skills.load']!.includes(key),
      ),
    };
    assertObjectJsonSchema(schema);
    assert.deepEqual(
      validateJsonSchemaValue(schema, { skillId: metadata.skill_id }, 'arguments'),
      [],
    );
    assert.deepEqual(
      validateJsonSchemaValue(
        schema,
        { skillId: metadata.skill_id, sections: ['Limits'] },
        'arguments',
      ),
      [],
    );
    assert(
      validateJsonSchemaValue(
        schema,
        { skillId: metadata.skill_id, sections: 'Limits' },
        'arguments',
      ).length,
    );
    const host = await createDshHost([]);
    try {
      const handle = await createDshSession(host, {
        sessionId: 'document-section-reader',
        provider: 'unconfigured',
        model: 'unconfigured',
        instructions: 'Read selected project document sections through an explicit tool call.',
        tools: [
          defineTool({
            name: 'read_skill_document',
            description: 'Read the persisted authored document.',
            parameters: {
              skillId: { type: 'string', required: true },
              sections: { type: 'array', items: { type: 'string' } },
            },
            output: {
              schema: { type: 'object', additionalProperties: true },
              render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
            },
            async execute(args) {
              const bundle = library.load(args.skillId, args.sections);
              return {
                metadata: { ...bundle.metadata },
                markdown: bundle.markdown,
                ...(bundle.selection
                  ? {
                      selection: {
                        ...bundle.selection,
                        requestedSections: [...bundle.selection.requestedSections],
                        includedSections: [...bundle.selection.includedSections],
                        omittedSections: [...bundle.selection.omittedSections],
                      },
                    }
                  : {}),
              };
            },
          }),
        ],
      });
      try {
        const result = await host.tools.execute({
          agent: handle.agent,
          callId: ToolCallId('selected-document'),
          name: 'read_skill_document',
          arguments: { skillId: metadata.skill_id, sections: ['Verification guidance'] },
          signal: new AbortController().signal,
        });
        assert.equal(result.isError, false);
        const output = JSON.stringify(result);
        assert(output.includes('includedSections'));
        assert(output.includes('Compare the excerpt'));
        assert(!output.includes('Read the document outline'));
      } finally {
        await handle.dispose();
      }
    } finally {
      await host.fiber.dispose();
    }
  });
});
