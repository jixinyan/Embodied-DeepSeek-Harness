import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { Module } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import { ContractValidator } from '@edh/contracts';
import { LocalStore } from '@edh/storage';
import { DomainRetention, DomainRetentionConflict } from '../apps/server/src/domain-retention.ts';
import { nativeWorkspaceRetention } from '../apps/server/src/native-workspace-retention.ts';
import { workspaceRecordOwners } from '../apps/server/src/workspace-record-owners.ts';
import { RequestIdentityArchives } from '../apps/server/src/request-identity-archives.ts';
import { sessionRetirementSelection } from '../apps/server/src/session-retention.ts';
import { UserSessions } from '../apps/server/src/user-sessions.ts';
import { SessionTaskCatalogs } from '../apps/server/src/session-task-catalog.ts';

const { values } = parseArgs({
  options: {
    'data-directory': { type: 'string' },
    'baseline-revision': { type: 'string' },
    'retire-session-id': { type: 'string' },
    output: { type: 'string' },
  },
});
assert(values['data-directory'] && values['baseline-revision'] && values.output);
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output);
const child = relative(resolve(root, '.local/work'), output);
assert(child && !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const path = 'apps/server/src/native-workspace-retention.ts';
const filename = resolve(root, path);
const baselineRevision = execFileSync(
  'git',
  ['rev-parse', '--verify', '--end-of-options', `${values['baseline-revision']}^{commit}`],
  { cwd: root, encoding: 'utf8' },
).trim();
const original = execFileSync('git', ['show', `${baselineRevision}:${path}`], { cwd: root });
const compiled = ts.transpileModule(original.toString('utf8'), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics.length, 0);
const production = new Module(filename);
production.filename = filename;
production.paths = Module._nodeModulePaths(dirname(filename));
production._compile(compiled.outputText, filename);
assert.equal(typeof production.exports.nativeWorkspaceRetention, 'function');
const sources = [];
for (const name of [
  path,
  'apps/server/src/native-record-references.ts',
  'apps/server/src/native-audit-payloads.ts',
  'apps/server/src/workspace-record-owners.ts',
  'apps/server/src/domain-retention.ts',
  'apps/server/src/request-identity-archives.ts',
  'apps/server/src/session-retention.ts',
  'apps/server/src/event-record-owners.ts',
  'apps/server/src/run-record-owners.ts',
  'apps/server/src/task-record-owners.ts',
  'apps/server/src/report-record-owners.ts',
  'apps/server/src/evidence-record-owners.ts',
  'apps/server/src/session-record-owners.ts',
  'apps/server/src/application-record-owners.ts',
  'apps/server/src/native-audit-record-owners.ts',
  'harness/agent-runtime/storage/src/local-store.ts',
  'harness/agent-runtime/storage/src/session-audits.ts',
  'harness/contracts/schema/physical.schema.json',
  'scripts/check-native-reference-graph.mjs',
]) {
  const current = await readFile(resolve(root, name));
  sources.push({ path: name, sha256: hash(current) });
  if (
    ![
      path,
      'apps/server/src/native-record-references.ts',
      'scripts/check-native-reference-graph.mjs',
    ].includes(name)
  )
    assert.equal(
      hash(execFileSync('git', ['show', `${baselineRevision}:${name}`], { cwd: root })),
      hash(current),
    );
}
const source = resolve(values['data-directory'], 'records.jsonl');
const sourceDigest = hash(await readFile(source));
await mkdir(output, { recursive: false });
const directory = resolve(output, 'data');
await mkdir(directory);
await copyFile(source, resolve(directory, 'records.jsonl'));
const skillDirectory = resolve(values['data-directory'], 'skills');
if (existsSync(skillDirectory))
  await cp(skillDirectory, resolve(directory, 'skills'), { recursive: true, errorOnExist: true });
const validator = new ContractValidator(
  JSON.parse(
    await readFile(resolve(root, 'harness/contracts/schema/physical.schema.json'), 'utf8'),
  ),
);
let store = new LocalStore(directory);
const checks = [];
const phases = [];
let removedRecords = 0;
let remainingSessions;
let preservedRecords;
let remainingSessionIds;
const context = () => ({
  store,
  validator,
  providers: ['robotwin', 'robocasa', 'behavior', 'robodojo'],
  additionalTools: [],
});
function compare(name, binding, baseline) {
  const owners = workspaceRecordOwners(store, validator, binding.domainRetention.references);
  const priorOwners = workspaceRecordOwners(store, validator, baseline.domainRetention.references);
  const roots = new Map();
  for (const row of store.scan('run:')) {
    const owner = owners.find((item) => row.key.startsWith(item.prefix));
    roots.set(row.key, new Set(owner.inspect(row).references));
  }
  let priorReferences = 0;
  let currentReferences = 0;
  let twoStepPaths = 0;
  let records = 0;
  let priorMs = 0;
  let currentMs = 0;
  const declarations = createHash('sha256');
  for (const row of store.scan('')) {
    const before = JSON.stringify(row);
    const owner = owners.find((item) => row.key.startsWith(item.prefix));
    const priorOwner = priorOwners.find((item) => row.key.startsWith(item.prefix));
    assert(owner && priorOwner);
    const start = performance.now();
    const prior = priorOwner.inspect(row);
    priorMs += performance.now() - start;
    const middle = performance.now();
    const current = owner.inspect(row);
    currentMs += performance.now() - middle;
    assert.equal(current.retain, prior.retain);
    const priorKeys = new Set(prior.references);
    const currentKeys = new Set(current.references);
    const runRoots = current.references.filter((key) => roots.has(key));
    for (const key of currentKeys) {
      assert(store.revision(key));
      assert(priorKeys.has(key), `A new direct edge lacks its original edge: ${row.key} -> ${key}`);
    }
    for (const key of priorKeys) {
      if (currentKeys.has(key)) continue;
      assert(
        runRoots.some((rootKey) => roots.get(rootKey).has(key)),
        `A source path is missing: ${row.key} -> ${key}`,
      );
      twoStepPaths++;
    }
    assert.equal(JSON.stringify(row), before);
    declarations.update(
      JSON.stringify([row.key, row.version, current.retain, [...currentKeys].sort()]),
    );
    priorReferences += priorKeys.size;
    currentReferences += currentKeys.size;
    records++;
  }
  phases.push({
    name,
    records,
    priorReferences,
    currentReferences,
    twoStepPaths,
    priorMs,
    currentMs,
    declarationsSha256: declarations.digest('hex'),
  });
  checks.push({ name: `${name}:all-new-edges-exist-in-original`, records });
  checks.push({ name: `${name}:all-original-edges-have-current-paths`, paths: twoStepPaths });
  checks.push({ name: `${name}:retention-flags-and-source-inputs-unchanged`, records });
}
try {
  assert.equal(hash(await readFile(resolve(directory, 'records.jsonl'))), sourceDigest);
  const binding = nativeWorkspaceRetention(context());
  const baseline = production.exports.nativeWorkspaceRetention(context());
  assert.equal(binding.domainRetention.references.version, 'edh-native-payload-sources-v4');
  assert.equal(baseline.domainRetention.references.version, 'edh-native-payload-sources-v3');
  compare('original', binding, baseline);
  assert(phases[0].currentReferences < phases[0].priorReferences);
  const signal = new AbortController().signal;
  const retention = new DomainRetention(store, validator, {
    version: binding.domainRetention.version,
    owners: workspaceRecordOwners(store, validator, binding.domainRetention.references),
    sources: binding.domainRetention.sources,
  });
  const baselineRetention = new DomainRetention(store, validator, {
    version: baseline.domainRetention.version,
    owners: workspaceRecordOwners(store, validator, baseline.domainRetention.references),
    sources: baseline.domainRetention.sources,
  });
  const runKeys = [...store.revisions('run:')].map((item) => item.key);
  for (const key of runKeys) {
    await assert.rejects(retention.inspect([key], signal), DomainRetentionConflict);
    await assert.rejects(baselineRetention.inspect([key], signal), DomainRetentionConflict);
    checks.push({ name: `reject-incomplete-run:${key}` });
  }
  if (values['retire-session-id']) {
    const selected = sessionRetirementSelection(store, [values['retire-session-id']]);
    const catalogs = new SessionTaskCatalogs(store, validator);
    const sessions = new UserSessions(store, catalogs);
    const originals = sessions.list();
    assert(originals.some((item) => item.id === values['retire-session-id']));
    remainingSessions = originals.length - 1;
    remainingSessionIds = originals
      .filter((item) => item.id !== values['retire-session-id'])
      .map((item) => item.id)
      .sort();
    const selectedKeys = new Set(selected.keys);
    const preserved = [...store.scan('')]
      .filter((row) => !selectedKeys.has(row.key))
      .map((row) => ({ key: row.key, sha256: hash(JSON.stringify(row)) }));
    preservedRecords = preserved.length;
    const verifyPreserved = () => {
      for (const row of preserved) {
        const current = store.get(row.key);
        assert(current, `A retained source is missing: ${row.key}`);
        assert.equal(hash(JSON.stringify({ key: row.key, ...current })), row.sha256);
      }
    };
    await assert.rejects(retention.inspect(selected.keys, signal), DomainRetentionConflict);
    await assert.rejects(baselineRetention.inspect(selected.keys, signal), DomainRetentionConflict);
    checks.push({ name: 'request-identities-protect-selected-history' });
    new RequestIdentityArchives(store).archive(selected.requestKeys, store.statistics().sequence);
    compare('archived', binding, baseline);
    const oldPreview = await baselineRetention.inspect(selected.keys, signal);
    const preview = await retention.inspect(selected.keys, signal);
    assert.deepEqual(preview.selected, oldPreview.selected);
    checks.push({
      name: 'complete-selection-matches-original-preview',
      records: preview.selected.length,
    });
    const retired = await retention.retire(preview.token, signal);
    removedRecords = retired.removedRecords;
    assert.equal(removedRecords, selected.keys.length);
    await assert.rejects(retention.retire(preview.token, signal), DomainRetentionConflict);
    checks.push({
      name: 'actual-private-retirement-and-token-consumption',
      records: removedRecords,
    });
    verifyPreserved();
    compare('retired', binding, baseline);
    store.close();
    store = new LocalStore(directory);
    assert.equal(
      new UserSessions(store, new SessionTaskCatalogs(store, validator)).list().length,
      remainingSessions,
    );
    assert.deepEqual(
      new UserSessions(store, new SessionTaskCatalogs(store, validator))
        .list()
        .map((item) => item.id)
        .sort(),
      remainingSessionIds,
    );
    verifyPreserved();
    compare(
      'reopened',
      nativeWorkspaceRetention(context()),
      production.exports.nativeWorkspaceRetention(context()),
    );
    checks.push({ name: 'reopen-preserves-other-sessions', sessions: remainingSessions });
    checks.push({
      name: 'other-records-preserve-exact-revisions-and-values',
      records: preservedRecords,
    });
  }
} finally {
  store.close();
}
assert(!existsSync(resolve(directory, 'writer.lock')));
assert.equal(hash(await readFile(source)), sourceDigest);
for (const item of sources)
  assert.equal(hash(await readFile(resolve(root, item.path))), item.sha256);
const report = {
  schemaVersion: 'edh.native_reference_graph.cpu.v1',
  baseline: {
    revision: baselineRevision,
    path,
    sha256: hash(original),
    compilerVersion: ts.version,
    compiledSha256: hash(compiled.outputText),
  },
  sources,
  original: { path: source, sha256: sourceDigest },
  checks,
  phases,
  removedRecords,
  ...(remainingSessions === undefined ? {} : { remainingSessions }),
  ...(preservedRecords === undefined ? {} : { preservedRecords, remainingSessionIds }),
  privateJournal: {
    path: 'data/records.jsonl',
    sha256: hash(await readFile(resolve(directory, 'records.jsonl'))),
  },
  sourceUnchanged: true,
  writerReleased: true,
  gpuAllocations: 0,
  modelResponses: 0,
  simulatorAllocations: 0,
  scope:
    'Actual retained source journals, complete production owner graphs and private-copy maintenance. Immutable Git baseline is compiled with installed TypeScript. Edge/path equivalence preserves every selection cut; no physical task is executed.',
};
await writeFile(resolve(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`, {
  flag: 'wx',
});
console.log(
  JSON.stringify({ output, checks: checks.length, phases, removedRecords, writerReleased: true }),
);
