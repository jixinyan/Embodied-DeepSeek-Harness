import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Context } from '@deepseek-ai/cordis';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { ContractValidator, type SkillMetadata, type VerificationResult } from '@edh/contracts';
import { SkillLibrary, type SkillBundle } from '@edh/memory';
import { SensorSamples } from '@edh/perception';
import { RecoveryHistory, VerdictHistory, type RecoveryTrace } from '@edh/tasks';
import { LocalStore, LocalImageStore } from '@edh/storage';
import {
  inspectSkillProvenance,
  readWorkspaceSkills,
  skillSourceLimitations,
} from '../../apps/server/src/skill-provenance.js';
import { assertLocalRequest, HttpError } from '../../apps/server/src/local-http.js';
import { SessionTaskHistory, sessionTaskKey } from '../../apps/server/src/session-task-history.js';

const validator = new ContractValidator(
  JSON.parse(await readFile('harness/contracts/schema/physical.schema.json', 'utf8')),
);
const at = '2026-09-21T00:00:00.000Z';

async function withStore(work: (store: LocalStore) => Promise<void> | void) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/skill-provenance-'));
  const store = new LocalStore(directory);
  try {
    await work(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function documents(
  store: LocalStore,
  options: {
    omit?: string;
    image?: ImageAttachmentRef;
    session?: boolean;
    origin?: SkillMetadata['origin'];
  } = {},
) {
  const origin = options.origin ?? 'test_fixture';
  const verdict = (status: 'failed' | 'passed'): VerificationResult =>
    validator.parse('VerificationResult', {
      schema_version: 'physical.verification.v1',
      verdict_id: `${status}-verdict`,
      verification_request_id: `${status}-request`,
      execution_id: `${status}-execution`,
      verifier_id: `${status}-verifier`,
      verifier_assignment_id: `${status}-assignment`,
      task_scope: {
        task_id: 'run',
        goal_id: 'goal',
        attempt_id: status === 'failed' ? 'attempt-1' : 'attempt-2',
        ...(status === 'passed' ? { recovery_id: 'recovery' } : {}),
      },
      status,
      goal_contract_id: 'document-contract',
      goal_contract_version: '1',
      boundary_event_id: `${status}-boundary`,
      checks: [
        {
          check_id: 'document-check',
          value: status === 'passed',
          evidence_refs: [`${status}-evidence`],
        },
      ],
      evidence_refs: [`${status}-evidence`],
      explanation: 'Authored provenance document; no model, sensor or environment executed.',
      observed_at: at,
      clock_id: 'document-clock',
    });
  const failed = verdict('failed');
  const passed = verdict('passed');
  if (options.omit !== 'recovery') {
    const recovery = new RecoveryHistory(store);
    recovery.create('recovery', 'run', { failedVerdict: failed, originalGoalId: 'goal' });
    recovery.update('recovery', passed, null);
  }
  if (options.omit !== 'run')
    store.put(
      'run:run',
      { id: 'run', source: origin, verdicts: [failed, passed], skillIds: [] },
      0,
    );
  if (options.omit !== 'configuration')
    store.put('run-config:run', { description: 'Authored source configuration document' }, 0);
  if (options.session) {
    store.put('run-user-session:run', { sessionId: 'conversation' }, 0);
    if (options.omit !== 'session')
      store.put('user-session:conversation', { id: 'conversation', runIds: ['run'] }, 0);
  }
  const samples = new SensorSamples(store, validator, 'run', origin);
  for (const id of ['failed-evidence', 'passed-evidence']) {
    if (options.omit === id) continue;
    samples.retain({
      evidence: {
        id,
        kind: 'event',
        source: 'authored-provenance-document',
        created_at: at,
        observed_at: at,
        clock_id: 'document-clock',
        visibility: 'agent',
        task_scope: { task_id: 'run', goal_id: 'goal' },
      },
      sequence: 0,
      source: origin,
      description: 'Authored evidence metadata; no sensor executed.',
      visualization: {},
      ...(options.image ? { images: [options.image] } : {}),
    });
  }
  const metadata: SkillMetadata = {
    schema_version: 'physical.skill_metadata.v1',
    skill_id: 'skill',
    version: '1',
    task_semantics: ['document inspection'],
    required_capabilities: ['read-documents'],
    source_configurations: ['document-config'],
    evidence_refs: ['failed-evidence', 'passed-evidence'],
    recovery_id: 'recovery',
    verdict_ref: 'passed-verdict',
    origin,
    limitations: skillSourceLimitations(origin),
    validation_status: origin === 'test_fixture' ? 'test_fixture' : 'source_validated',
    validated_configurations: origin === 'test_fixture' ? [] : ['document-config'],
  };
  const markdown = [
    'When to use',
    'Failure signals',
    'Possible causes',
    'Avoid',
    'Planning guidance',
    'Verification guidance',
    'Limits',
    'Source',
  ]
    .map((section) => `## ${section}\nAuthored documentation for provenance-reader acceptance.\n`)
    .join('\n');
  return new SkillLibrary(store, validator).save(metadata, markdown);
}

test('skill provenance resolves recovery ownership and shared original-image roots without run skill indexes', async () => {
  await withStore(async (store) => {
    const context = new Context();
    try {
      await context.plugin(LocalImageStore, { directory: store.directory });
      const images = context.attachments as LocalImageStore;
      const ref = await images.saveImage({
        data: new Uint8Array(await readFile('apps/console/public/logo.png')),
        mediaType: 'image/png',
      });
      const original = await images.readImage(ref);
      documents(store, { image: ref, session: true });
      const sequence = store.statistics().sequence;
      const source = inspectSkillProvenance(store, validator, 'skill');
      assert.equal(source.state, 'available');
      assert.equal(source.runId, 'run');
      assert.equal(source.userSessionId, 'conversation');
      assert.equal(source.goalId, 'goal');
      assert.equal(source.failedVerdictId, 'failed-verdict');
      assert.equal(source.successfulVerdictId, 'passed-verdict');
      assert.deepEqual(source.images, [
        { attachmentId: ref.attachmentId, evidenceIds: ['failed-evidence', 'passed-evidence'] },
      ]);
      assert.ok(source.records.some((record) => record.key === 'user-session:conversation'));
      assert.equal(
        source.records.filter((record) => record.key.startsWith('sensor-image:')).length,
        1,
      );
      assert.equal(source.storeSequence, sequence);
      assert.equal(store.statistics().sequence, sequence);
      source.images[0]!.evidenceIds.length = 0;
      assert.equal(
        inspectSkillProvenance(store, validator, 'skill').images[0]!.evidenceIds.length,
        2,
      );
      const library = readWorkspaceSkills(store, validator);
      assert.equal(library.skills[0]!.runId, 'run');
      assert.equal(library.skills[0]!.userSessionId, 'conversation');
      store.compact();
      assert.deepEqual(await images.readImage(ref), original);
      store.close();
      const reopened = new LocalStore(store.directory);
      try {
        assert.equal(inspectSkillProvenance(reopened, validator, 'skill').state, 'available');
      } finally {
        reopened.close();
      }
    } finally {
      await context.fiber.dispose();
    }
  });
});

test('missing source records are reported explicitly and retain every known ownership identity', async () => {
  for (const omit of ['recovery', 'run', 'configuration', 'session', 'failed-evidence']) {
    await withStore((store) => {
      documents(store, { omit, session: true });
      const source = inspectSkillProvenance(store, validator, 'skill');
      assert.equal(source.state, 'incomplete', omit);
      assert.ok(source.missing.length > 0, omit);
      assert.equal(source.recoveryId, 'recovery');
      if (omit !== 'recovery') assert.equal(source.runId, 'run');
      if (omit === 'failed-evidence')
        assert.deepEqual(
          source.evidence.map((item) => item.evidenceId),
          ['passed-evidence'],
        );
    });
  }
});

test('skill sources retain compact session membership identity and report absent membership documents', async () => {
  await withStore((store) => {
    documents(store, { session: true });
    const row = store.get<{ id: string; runIds: string[] }>('user-session:conversation')!;
    new SessionTaskHistory(store).migrate(row.value, row.version);
    const result = inspectSkillProvenance(store, validator, 'skill');
    const key = sessionTaskKey('conversation', 'run');
    assert.equal(result.state, 'available');
    assert(result.records.some((record) => record.key === key && record.version === 1));
    store.put(key, store.get(key)!.value, 1);
    assert.throws(
      () => inspectSkillProvenance(store, validator, 'skill'),
      /membership identity or version/,
    );
  });
  await withStore((store) => {
    documents(store, { session: true });
    store.put(
      'user-session:conversation',
      {
        id: 'conversation',
        taskHistory: { format: 'edh.session-task-history.v1', count: 1, lastRunId: 'run' },
      },
      1,
    );
    const result = inspectSkillProvenance(store, validator, 'skill');
    assert.equal(result.state, 'incomplete');
    assert(result.missing.some((record) => record.key === sessionTaskKey('conversation', 'run')));
  });
});

test('legacy recovery records expose missing explicit ownership without guessing another run', async () => {
  await withStore((store) => {
    documents(store);
    const record = store.get<RecoveryTrace>('recovery:recovery')!;
    const { runId: _runId, eventCount: _count, ...legacy } = record.value;
    store.put('recovery:recovery', legacy, record.version);
    const source = inspectSkillProvenance(store, validator, 'skill');
    assert.equal(source.state, 'incomplete');
    assert.equal(source.runId, null);
    assert.match(source.missing[0]!.reason, /explicit source run/);
  });
});

test('inconsistent goal, origin, verdict and evidence references stop provenance inspection', async () => {
  for (const change of [
    'goal',
    'verdict',
    'origin',
    'references',
    'session',
    'visibility',
    'scope',
  ]) {
    await withStore((store) => {
      documents(store, { session: true });
      if (change === 'goal' || change === 'verdict') {
        const record = store.get<RecoveryTrace>('recovery:recovery')!;
        if (change === 'goal') record.value.result!.task_scope.goal_id = 'different-goal';
        else record.value.result!.status = 'unknown';
        store.put('recovery:recovery', record.value, record.version);
      } else if (change === 'origin') {
        const record = store.get<{ source: string }>('run:run')!;
        record.value.source = 'hardware';
        store.put('run:run', record.value, record.version);
      } else if (change === 'references') {
        const record = store.get<SkillBundle>('skill:skill')!;
        record.value.metadata.evidence_refs = ['other-evidence'];
        store.put('skill:skill', record.value, record.version);
      } else if (change === 'session') {
        const record = store.get<{ runIds: string[] }>('user-session:conversation')!;
        record.value.runIds = ['other-run'];
        store.put('user-session:conversation', record.value, record.version);
      } else {
        const run = store.get<{ verdicts: VerificationResult[] }>('run:run')!;
        const metadata = store.get<SkillBundle>('skill:skill')!;
        const recovery = store.get<RecoveryTrace>('recovery:recovery')!;
        const replacement = 'replacement-evidence';
        run.value.verdicts[0]!.evidence_refs = [replacement];
        run.value.verdicts[0]!.checks[0]!.evidence_refs = [replacement];
        recovery.value.context.failedVerdict = run.value.verdicts[0];
        metadata.value.metadata.evidence_refs = [replacement, 'passed-evidence'];
        store.put('run:run', run.value, run.version);
        store.put('recovery:recovery', recovery.value, recovery.version);
        store.put('skill:skill', metadata.value, metadata.version);
        new SensorSamples(store, validator, 'run', 'test_fixture').retain({
          evidence: {
            id: replacement,
            kind: 'event',
            source: 'authored-provenance-document',
            created_at: at,
            observed_at: at,
            clock_id: 'document-clock',
            visibility: change === 'visibility' ? 'debug_only' : 'agent',
            task_scope: { task_id: change === 'scope' ? 'other-run' : 'run' },
          },
          source: 'test_fixture',
          sequence: 0,
          description: 'Authored boundary document.',
          visualization: {},
        });
      }
      assert.throws(() => inspectSkillProvenance(store, validator, 'skill'), /Skill/);
    });
  }
});

test('workspace library retains the latest 100 bundles and reports source gaps without loading other runs', async () => {
  await withStore((store) => {
    const bundle = documents(store, { omit: 'recovery' });
    for (let index = 0; index < 101; index++)
      store.put(
        `skill:item-${index}`,
        { ...bundle, metadata: { ...bundle.metadata, skill_id: `item-${index}` } },
        0,
      );
    store.put('run:unrelated', null, 0);
    const result = readWorkspaceSkills(store, validator);
    assert.equal(result.skills.length, 100);
    assert.equal(result.skills[0]!.metadata.skill_id, 'item-1');
    assert.equal(result.skills.at(-1)!.metadata.skill_id, 'item-100');
    assert.ok(result.skills.every((skill) => skill.provenance.state === 'incomplete'));
  });
});

test('workspace inspection rejects a skill stored under another identity', async () => {
  await withStore((store) => {
    const bundle = documents(store);
    store.put('skill:other', bundle, 0);
    assert.throws(() => readWorkspaceSkills(store, validator), /identity does not match/);
  });
});

test('source inspection requires both exact accepted verdicts in the source run', async () => {
  for (const change of ['missing-failure', 'different-success']) {
    await withStore((store) => {
      documents(store);
      const record = store.get<{ verdicts: VerificationResult[] }>('run:run')!;
      if (change === 'missing-failure') record.value.verdicts.shift();
      else record.value.verdicts[1]!.boundary_event_id = 'another-boundary';
      store.put('run:run', record.value, record.version);
      assert.throws(() => inspectSkillProvenance(store, validator, 'skill'), /accepted verdicts/);
    });
  }
});

test('skill provenance reads immutable archived verdicts and identifies missing or conflicting sources', async () => {
  for (const mode of ['complete', 'missing', 'conflicting', 'rewritten']) {
    await withStore(async (store) => {
      documents(store);
      const row = store.get<{ verdicts: VerificationResult[] }>('run:run')!;
      const history = new VerdictHistory(store, validator);
      const summaries = row.value.verdicts.map((verdict) => history.retain('run', verdict));
      if (mode === 'conflicting') summaries[0]!.checkCount++;
      store.put('run:run', { ...row.value, verdicts: summaries }, row.version);
      const key = 'verdict-history:["run","failed-verdict"]';
      if (mode === 'missing') {
        await withStore((incomplete) => {
          for (const record of store.scan('')) {
            if (record.key !== key) incomplete.put(record.key, record.value, 0);
          }
          const source = inspectSkillProvenance(incomplete, validator, 'skill');
          assert.equal(source.state, 'incomplete');
          assert(source.missing.some((record) => record.key === key));
          assert(
            source.records.some(
              (record) => record.key === 'verdict-history:["run","passed-verdict"]',
            ),
          );
        });
        return;
      }
      if (mode === 'rewritten') store.put(key, store.get(key)!.value, 1);
      if (mode === 'complete') {
        const source = inspectSkillProvenance(store, validator, 'skill');
        assert.equal(source.state, 'available');
        assert(source.records.some((record) => record.key === key && record.version === 1));
      } else {
        assert.throws(
          () => inspectSkillProvenance(store, validator, 'skill'),
          /summary conflicts|archive was rewritten/,
        );
      }
    });
  }
});

test('real HTTP library reads expose durable provenance while preserving bundle and source scope', async () => {
  await withStore(async (store) => {
    const bundle = documents(store, { session: true });
    const server = createServer((req, res) => {
      try {
        assertLocalRequest(req, (server.address() as AddressInfo).port);
        const result = readWorkspaceSkills(store, validator);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(error instanceof HttpError ? error.status : 500);
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/skills`;
      const response = await fetch(url);
      assert.equal(response.status, 200);
      const { skills } = await response.json();
      assert.deepEqual(skills[0].metadata, bundle.metadata);
      assert.equal(skills[0].markdown, bundle.markdown);
      assert.equal(skills[0].provenance.state, 'available');
      assert.equal(skills[0].userSessionId, 'conversation');
      assert.equal(
        (await fetch(url, { headers: { Origin: 'http://foreign.example' } })).status,
        403,
      );
    } finally {
      await new Promise<void>((done, reject) => {
        server.close((error) => (error ? reject(error) : done()));
        server.closeIdleConnections();
      });
    }
  });
});

test('source limitation metadata reflects simulation and hardware declarations without claiming transfer validation', () => {
  for (const source of ['simulation', 'hardware'] as const) {
    const limits = skillSourceLimitations(source);
    assert.ok(limits[0]!.includes(`source ${source} configuration`));
    assert.ok(limits[0]!.includes('has not been validated'));
  }
  assert.ok(skillSourceLimitations('test_fixture')[0]!.includes('CPU fixture'));
  assert.throws(() => skillSourceLimitations('unknown' as SkillMetadata['origin']));
});
