import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { LocalStore, SessionAudits } from '@edh/storage';
import { readSessionAudit } from '../../apps/server/src/session-audit-view.js';
import { assertLocalRequest, HttpError } from '../../apps/server/src/local-http.js';

async function withStore(run: (store: LocalStore) => void | Promise<void>) {
  await mkdir(resolve('.local/work'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/work/audit-pages-'));
  const store = new LocalStore(directory);
  try {
    await run(store);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('audit pages traverse both directions with an immutable published frontier', async () => {
  await withStore((store) => {
    const audits = new SessionAudits(store);
    const events = Array.from({ length: 300 }, (_, offset) => ({
      offset,
      text: `Document ${offset}`,
    }));
    audits.append('run', 'agent', events);
    const first = audits.page('run', 'agent');
    assert.equal(first.events.length, 128);
    audits.append('run', 'agent', [...events, { offset: 300, text: 'Later document' }]);
    const second = audits.page('run', 'agent', first.throughOffset, first.eventTotal);
    const third = audits.page('run', 'agent', second.throughOffset, first.eventTotal);
    assert.deepEqual([...first.events, ...second.events, ...third.events], events);
    const latest = audits.before('run', 'agent', 300, 300);
    const middle = audits.before('run', 'agent', latest.afterOffset, 300);
    const oldest = audits.before('run', 'agent', middle.afterOffset, 300);
    assert.deepEqual([...oldest.events, ...middle.events, ...latest.events], events);
    assert.equal(audits.before('run', 'agent').throughOffset, 301);
    assert.equal(audits.page('run', 'agent', 300, 300).events.length, 0);
    assert.deepEqual(audits.before('run', 'agent', 0).events, []);
    store.compact();
    store.close();
    const reopened = new LocalStore(store.directory);
    try {
      assert.deepEqual(new SessionAudits(reopened).before('run', 'agent', 300, 300), latest);
    } finally {
      reopened.close();
    }
  });
});

test('audit byte budgets retain oversized individual events and exact UTF-8 values', async () => {
  await withStore((store) => {
    const audits = new SessionAudits(store);
    const events = [
      { text: 'é'.repeat(150000) },
      { text: 'é'.repeat(100000) },
      null,
      { text: 'End' },
    ];
    audits.append('run', 'agent', events);
    const first = audits.page('run', 'agent');
    assert.deepEqual(first.events, events.slice(0, 1));
    assert.deepEqual(audits.page('run', 'agent', 1).events, events.slice(1));
    const last = audits.before('run', 'agent');
    assert.deepEqual(last.events, events.slice(1));
    assert.deepEqual(audits.before('run', 'agent', last.afterOffset).events, events.slice(0, 1));
    (first.events[0] as { text: string }).text = 'Changed caller value';
    assert.deepEqual(audits.page('run', 'agent').events, events.slice(0, 1));
  });
});

test('audit assignment index is bounded, scoped and remains usable across compaction', async () => {
  await withStore((store) => {
    const audits = new SessionAudits(store);
    for (let index = 0; index < 65; index++) audits.append('run', `agent-${index}`, [{ index }]);
    audits.append('other', 'private-agent', [{ text: 'Other run document' }]);
    const first = audits.index('run');
    assert.equal(first.sessions.length, 64);
    assert.equal(first.nextAfter, 'agent-63');
    assert.deepEqual(audits.index('run', first.nextAfter!), {
      runId: 'run',
      sessions: [{ assignmentId: 'agent-64', eventTotal: 1 }],
      nextAfter: null,
    });
    assert.ok(!JSON.stringify(first).includes('private-agent'));
    audits.append('run', 'agent-65', [{ text: 'New assignment' }]);
    assert.equal(audits.index('run', first.nextAfter!).sessions.length, 2);
    store.compact();
    assert.deepEqual(audits.index('run'), first);
    assert.throws(() => audits.index('run', 'private-agent'), /Unknown audit assignment/);
    assert.throws(() => audits.index('run:other'), /Invalid/);
  });
});

test('audit pages expose only published events and fail at requested missing or invalid data', async () => {
  await withStore((store) => {
    const audits = new SessionAudits(store);
    audits.append('run', 'agent', [{ text: 'Published' }]);
    store.put('session-audit-event:run:agent:1', { text: 'Unpublished' }, 0);
    assert.equal(audits.page('run', 'agent').events.length, 1);
    assert.throws(() => audits.page('run', 'agent', 0, 2), /Invalid audit page/);
    store.put('session-audit:run:broken', { format: 'edh.session-audit.v1', count: 129 }, 0);
    for (let index = 0; index < 128; index++)
      store.put(`session-audit-event:run:broken:${index}`, { index }, 0);
    assert.equal(audits.page('run', 'broken').events.length, 128);
    assert.throws(() => audits.page('run', 'broken', 128), /Incomplete session audit/);
    for (const offset of [-1, NaN, Infinity, 1.5, 2])
      assert.throws(() => audits.page('run', 'agent', offset), /Invalid audit page/);
    assert.throws(() => audits.page('run', 'missing'), /not found/);
    store.put('session-audit:run:invalid', { format: 'edh.session-audit.v1', count: -1 }, 0);
    assert.throws(() => audits.page('run', 'invalid'));
  });
});

test('legacy audit arrays support the same published page boundaries', async () => {
  await withStore((store) => {
    const events = Array.from({ length: 140 }, (_, index) => ({ index }));
    store.put('session-audit:run:legacy', events, 0);
    const audits = new SessionAudits(store);
    assert.equal(audits.index('run').sessions[0]!.eventTotal, 140);
    assert.deepEqual(audits.page('run', 'legacy').events, events.slice(0, 128));
    assert.deepEqual(audits.before('run', 'legacy', 140).events, events.slice(12));
    audits.append('run', 'legacy', [...events, { index: 140 }]);
    assert.deepEqual(audits.page('run', 'legacy', 128, 140).events, events.slice(128));
  });
});

test('real HTTP audit reads return bounded pages and reject invalid or foreign selections', async () => {
  await withStore(async (store) => {
    store.put('run:run', { id: 'run', state: 'cancelled' }, 0);
    const audits = new SessionAudits(store);
    const events = Array.from({ length: 300 }, (_, offset) => ({
      offset,
      text: `Audit document ${offset}`,
    }));
    audits.append('run', 'agent', events);
    audits.append('other', 'foreign', [{ text: 'Other run document' }]);
    const server = createServer((req, res) => {
      try {
        assertLocalRequest(req, (server.address() as AddressInfo).port);
        const result = readSessionAudit(
          store,
          'run',
          new URL(req.url!, 'http://localhost').searchParams,
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(error instanceof HttpError ? error.status : 500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/audit`;
    try {
      const summary = await (await fetch(url)).json();
      assert.deepEqual(summary.sessions, [{ assignmentId: 'agent', eventTotal: 300 }]);
      assert.ok(!JSON.stringify(summary).includes('Audit document'));
      const page = await (await fetch(url + '?assignment=agent')).json();
      assert.equal(page.afterOffset, 172);
      assert.deepEqual(page.events, events.slice(172));
      const first = await (await fetch(url + '?assignment=agent&after=0&through=300')).json();
      assert.deepEqual(first.events, events.slice(0, 128));
      for (const query of [
        'after=0',
        'assignment=agent&after=-1',
        'assignment=agent&after=301',
        'assignment=agent&through=301',
        'assignment=agent&after=1&before=2',
        'assignment=agent&after=1&after=2',
        'assignment=agent&after=',
        'assignment=agent&after=1e2',
        'assignment=agent&through=Infinity',
        'assignment=agent&afterAssignment=agent',
        'unknown=value',
      ])
        assert.equal((await fetch(url + '?' + query)).status, 400, query);
      assert.equal((await fetch(url + '?assignment=foreign')).status, 404);
      assert.equal((await fetch(url + '?afterAssignment=foreign')).status, 404);
      assert.equal(
        (await fetch(url, { headers: { Origin: 'http://foreign.example' } })).status,
        403,
      );
      assert.throws(
        () => readSessionAudit(store, 'missing', new URLSearchParams()),
        (error) => error instanceof HttpError && error.status === 404,
      );
    } finally {
      await new Promise<void>((done, reject) => {
        server.close((error) => (error ? reject(error) : done()));
        server.closeIdleConnections();
      });
    }
  });
});

test(
  'audit browsing reads more than 96 MiB of documents within a 64 MiB old-space limit',
  { timeout: 60000 },
  async () => {
    await withStore(async (store) => {
      store.close();
      const result = await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=64',
          '--import',
          'tsx',
          'tests/runtime/support/audit-pages-memory.ts',
          store.directory,
        ],
        { cwd: process.cwd(), env: { ...process.env, TMPDIR: resolve('.local/work') } },
      );
      const report = JSON.parse(result.stdout);
      assert.equal(report.events, 193);
      assert.ok(report.journalBytes > 96 * 1024 * 1024);
    });
  },
);
