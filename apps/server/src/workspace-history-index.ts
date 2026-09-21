import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { LocalStore, StoreChange } from '@edh/storage';
import type { RunState } from '@edh/tasks';
import type { UserSessionRecord } from './user-sessions.js';
import { runSummary, sessionSummary, workspacePageLimits } from './workspace-history.js';

type Summaries = {
  run: ReturnType<typeof runSummary>;
  session: ReturnType<typeof sessionSummary>;
};
type Kind = keyof Summaries;
const prefixes = { run: 'run:', session: 'user-session:' } as const;
const identifier = z.string().regex(/^[A-Za-z0-9-]{1,128}$/);
const rowSchema = z
  .object({
    kind: z.enum(['run', 'session']),
    id: identifier,
    created_ms: z.number().int().safe(),
    session_id: identifier.nullable(),
    source_version: z.number().int().positive().safe(),
    source_hash: z.string().regex(/^[a-f0-9]{64}$/),
    owner_version: z.number().int().nonnegative().safe(),
    owner_hash: z.string(),
    summary: z.string(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
type Row = z.infer<typeof rowSchema>;
const checksum = (row: Omit<Row, 'checksum'>) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        row.kind,
        row.id,
        row.created_ms,
        row.session_id,
        row.source_version,
        row.source_hash,
        row.owner_version,
        row.owner_hash,
        row.summary,
      ]),
    )
    .digest('hex');

export class WorkspaceHistoryIndex {
  private readonly database: DatabaseSync;
  private unsubscribe: (() => void) | undefined;
  private closed = false;
  private failed = false;
  private sourceReads = 0;
  private summaryReads = 0;

  constructor(private readonly store: LocalStore) {
    store.assertCurrent();
    this.database = new DatabaseSync(resolve(store.directory, 'workspace-history.sqlite'));
    try {
      this.database.exec(
        'PRAGMA temp_store=MEMORY; PRAGMA cache_size=-4096; PRAGMA synchronous=FULL;',
      );
      const version = this.database.prepare('PRAGMA user_version').get()!.user_version;
      if (version === 0) {
        if (
          this.database.prepare("SELECT name FROM sqlite_schema WHERE type='table' LIMIT 1").get()
        )
          throw new Error('Unrecognized workspace history index.');
        this.transaction(() => {
          this.database.exec(`
            CREATE TABLE summaries (
              kind TEXT NOT NULL CHECK(kind IN ('run', 'session')),
              id TEXT NOT NULL,
              created_ms INTEGER NOT NULL,
              session_id TEXT,
              source_version INTEGER NOT NULL,
              source_hash TEXT NOT NULL,
              owner_version INTEGER NOT NULL,
              owner_hash TEXT NOT NULL,
              summary TEXT NOT NULL,
              checksum TEXT NOT NULL,
              PRIMARY KEY (kind, id)
            ) STRICT;
            CREATE INDEX summary_order ON summaries(kind, created_ms DESC, id DESC);
            CREATE INDEX summary_scope ON summaries(kind, session_id, created_ms DESC, id DESC);
            PRAGMA user_version=1;
          `);
        });
      } else if (version !== 1) throw new Error('Unsupported workspace history index version.');
      const check = this.database.prepare('PRAGMA quick_check').get();
      if (check?.quick_check !== 'ok') throw new Error('Workspace history index corruption.');
      this.reconcile();
      this.unsubscribe = store.observe((change) => this.committed(change));
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  statistics() {
    return { sourceReads: this.sourceReads, summaryReads: this.summaryReads };
  }

  private access<T>(action: () => T): T {
    if (this.closed || this.failed) throw new Error('Workspace history index is unavailable.');
    this.store.assertCurrent();
    try {
      return action();
    } catch (error) {
      this.failed = true;
      throw error;
    }
  }

  private transaction(action: () => void) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      action();
      this.database.exec('COMMIT');
    } catch (error) {
      try {
        this.database.exec('ROLLBACK');
      } catch (failure) {
        throw new AggregateError([error, failure], 'Workspace index transaction cleanup failed.');
      }
      throw error;
    }
  }

  private readSource<T>(key: string) {
    this.sourceReads++;
    return this.store.get<T>(key);
  }

  private update(kind: Kind, id: string) {
    const key = prefixes[kind] + id;
    const revision = this.store.revision(key);
    if (!revision) throw new Error('Workspace source record is missing.');
    let summary: Summaries[Kind];
    if (kind === 'run') {
      const record = this.readSource<RunState>(key)!.value;
      if (record.id !== id) throw new Error('Stored task identity conflicts with its key.');
      const owner = this.readSource<{ sessionId: string }>(`run-user-session:${id}`);
      const sessionId = owner ? identifier.parse(owner.value.sessionId) : null;
      summary = runSummary(record, sessionId);
    } else {
      const record = this.readSource<UserSessionRecord>(key)!.value;
      if (record.id !== id) throw new Error('Stored session identity conflicts with its key.');
      summary = sessionSummary(record);
    }
    const owner = kind === 'run' ? this.store.revision(`run-user-session:${id}`) : undefined;
    const row: Omit<Row, 'checksum'> = {
      kind,
      id,
      created_ms: Date.parse(summary.createdAt),
      session_id: 'userSessionId' in summary ? summary.userSessionId : null,
      source_version: revision.version,
      source_hash: revision.hash,
      owner_version: owner?.version ?? 0,
      owner_hash: owner?.hash ?? '',
      summary: JSON.stringify(summary),
    };
    const digest = checksum(row);
    rowSchema.parse({ ...row, checksum: digest });
    this.database
      .prepare(
        `INSERT INTO summaries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(kind, id) DO UPDATE SET
        created_ms=excluded.created_ms, session_id=excluded.session_id,
        source_version=excluded.source_version, source_hash=excluded.source_hash,
        owner_version=excluded.owner_version, owner_hash=excluded.owner_hash,
        summary=excluded.summary, checksum=excluded.checksum`,
      )
      .run(
        row.kind,
        row.id,
        row.created_ms,
        row.session_id,
        row.source_version,
        row.source_hash,
        row.owner_version,
        row.owner_hash,
        row.summary,
        digest,
      );
  }

  private reconcile() {
    this.access(() =>
      this.transaction(() => {
        this.database.exec(
          'CREATE TEMP TABLE expected (kind TEXT, id TEXT, PRIMARY KEY(kind, id));',
        );
        const expected = this.database.prepare('INSERT INTO expected VALUES (?, ?)');
        const lookup = this.database
          .prepare(`SELECT source_version, source_hash, owner_version, owner_hash
        FROM summaries WHERE kind=? AND id=?`);
        for (const kind of ['run', 'session'] as const) {
          for (const revision of this.store.revisions(prefixes[kind])) {
            const id = identifier.parse(revision.key.slice(prefixes[kind].length));
            expected.run(kind, id);
            const row = lookup.get(kind, id);
            const owner =
              kind === 'run' ? this.store.revision(`run-user-session:${id}`) : undefined;
            if (
              !row ||
              row.source_version !== revision.version ||
              row.source_hash !== revision.hash ||
              row.owner_version !== (owner?.version ?? 0) ||
              row.owner_hash !== (owner?.hash ?? '')
            )
              this.update(kind, id);
          }
        }
        this.database.exec(`DELETE FROM summaries WHERE NOT EXISTS
        (SELECT 1 FROM expected WHERE expected.kind=summaries.kind AND expected.id=summaries.id);
        DROP TABLE expected;`);
      }),
    );
  }

  private committed(change: StoreChange) {
    if (change.type === 'compact') {
      this.reconcile();
      return;
    }
    const key = change.key;
    for (const kind of ['run', 'session'] as const) {
      if (key.startsWith(prefixes[kind])) {
        this.access(() =>
          this.transaction(() => this.update(kind, key.slice(prefixes[kind].length))),
        );
        return;
      }
    }
    if (key.startsWith('run-user-session:')) {
      const id = key.slice('run-user-session:'.length);
      if (this.store.revision(`run:${id}`))
        this.access(() => this.transaction(() => this.update('run', id)));
    }
  }

  private decode<K extends Kind>(kind: K, value: unknown): Summaries[K] {
    const row = rowSchema.parse(value);
    const source = this.store.revision(prefixes[kind] + row.id);
    const owner = kind === 'run' ? this.store.revision(`run-user-session:${row.id}`) : undefined;
    if (
      row.kind !== kind ||
      row.checksum !== checksum(row) ||
      row.source_version !== source?.version ||
      row.source_hash !== source.hash ||
      row.owner_version !== (owner?.version ?? 0) ||
      row.owner_hash !== (owner?.hash ?? '')
    )
      throw new Error('Workspace summary integrity or source revision conflict.');
    const summary = JSON.parse(row.summary) as Summaries[K];
    if (
      summary.id !== row.id ||
      Date.parse(summary.createdAt) !== row.created_ms ||
      (kind === 'run' && (summary as Summaries['run']).userSessionId !== row.session_id)
    )
      throw new Error('Workspace summary identity conflict.');
    this.summaryReads++;
    return summary;
  }

  get<K extends Kind>(kind: K, id: string): Summaries[K] | undefined {
    return this.access(() => {
      const row = this.database
        .prepare('SELECT * FROM summaries WHERE kind=? AND id=?')
        .get(kind, id);
      if (row) return this.decode(kind, row);
      if (this.store.revision(prefixes[kind] + id))
        throw new Error('Workspace summary is missing.');
      return undefined;
    });
  }

  page<K extends Kind>(
    kind: K,
    before?: { id: string; createdAt: string },
    sessionId?: string | null,
  ) {
    return this.access(() => {
      const filters = ['kind=?'];
      const args: (string | number | null)[] = [kind];
      if (sessionId !== undefined) {
        filters.push('session_id IS ?');
        args.push(sessionId);
      }
      if (before) {
        filters.push('(created_ms, id) < (?, ?)');
        args.push(Date.parse(before.createdAt), before.id);
      }
      args.push(workspacePageLimits.records + 1);
      const statement = this.database
        .prepare(`SELECT * FROM summaries WHERE ${filters.join(' AND ')}
        ORDER BY created_ms DESC, id DESC LIMIT ?`);
      const records: Summaries[K][] = [];
      let bytes = 2;
      let more = false;
      for (const value of statement.iterate(...args)) {
        const summary = this.decode(kind, value);
        const size = Buffer.byteLength(JSON.stringify(summary)) + (records.length ? 1 : 0);
        if (
          records.length === workspacePageLimits.records ||
          (records.length > 0 && bytes + size > workspacePageLimits.bytes)
        ) {
          more = true;
          break;
        }
        records.push(summary);
        bytes += size;
      }
      return { records, nextBeforeId: more ? records.at(-1)!.id : null };
    });
  }

  configuration(id: string) {
    return this.access(() => {
      const record = this.readSource<UserSessionRecord>(`user-session:${id}`)?.value;
      if (!record || record.id !== id)
        throw new Error('Active session source is missing or invalid.');
      return record.configuration;
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribe?.();
    this.database.close();
  }
}
