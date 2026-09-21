# Durable domain records

[LocalImageStore](../../../docs/implementation/image-storage.md) provides the native
DSH attachment service for encoded-image storage and model request projection.
Its deployment context owns storage limits and shutdown. Application evidence grants
remain separate from byte access; the server injects image services into deployments
and supplies scoped console image reads.

[local-store.ts](src/local-store.ts) implements a single-writer CAS journal with checksum validation, fsync and incomplete-tail recovery. The application stores events, plans, files, recovery, skills and read-only DSH audits.

The in-memory index retains each key's latest version, sequence, byte position,
record length and checksum. Record bodies stay in `records.jsonl`. Opening the store
streams LF-delimited records through the pinned `n-readlines` reader and validates
sequence, versions and checksums while rebuilding the index. JSON decoding uses
`JSON.parse`. UTF-8 byte positions, CRLF records and empty LF lines are preserved.

`get` reads the indexed byte range and verifies its identity/version/checksum before
returning a detached value. A read failure prevents further reads or writes through
that store instance. Writes verify the journal size, append and fsync before updating
the index. The journal remains the durable source. Explicit compaction writes the
versioned checkpoint format described in the [maintenance guide](../../../docs/implementation/storage-maintenance.md).

`scan(prefix)` yields one decoded record at a time. Startup run reconciliation and
SKILL export use this iterator. Experience search stops after 20 matching metadata
records. `list(prefix)` explicitly collects all selected values. Iterators observe
records as keys are visited; historical readers use published count/version boundaries
when they need a fixed view. Keep the store open while consuming an iterator.
[session-audits.ts](src/session-audits.ts) appends native audit events separately,
publishes a durable count index and reads historical full-array snapshots. Entire
audit histories no longer need to fit one 8 MiB journal record. Resumable model sessions
and automatic stale-lock takeover remain unimplemented.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).


RunHistory in the tasks module reconstructs published run events and appends a separate
restart annotation. It never promotes an uncommitted suffix to successful task state.
Journal-open failure releases only the lock acquired during that initialization.
Session/run/server shutdown attempts all cleanup stages and reports aggregate failures.
`statistics()` exposes current/superseded byte counts. `compact()` atomically publishes
all latest records with unchanged versions, ordering and global write sequence. It
retains independent event/evidence/history keys. The console admits this operation only
in an idle workspace with a fresh inspected sequence. Distinct-key deletion and media
retention policies remain pending.

`pnpm test:storage` exercises real journal files and checks write/reopen/scan behavior
in a child process with a 64 MiB V8 old-space limit and more than 64 MiB of journal
data. This checks record-body retention and startup reading. The key index still
grows with distinct keys, and caller-owned results, active runs, full list/audit reads
and browser history have separate memory costs. Total RSS and disk usage are not
bounded by that heap test.
