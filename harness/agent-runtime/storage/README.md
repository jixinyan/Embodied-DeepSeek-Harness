# Durable domain records

[LocalImageStore](../../../docs/implementation/image-storage.md) provides the native
DSH attachment service for encoded-image storage and model request projection.
Its deployment context owns storage limits and shutdown. Application evidence grants
remain separate from byte access; the server injects image services into deployments
and supplies scoped console image reads. Image inventory and explicit request-cache
cleanup preserve original objects, require a current provider revision and exclude
concurrent image mutations. Custom providers can expose the optional maintenance API.

`collectUnreferencedObjects` provides explicit local original-image collection using a
complete caller-supplied retained-ID set. It excludes active readers/writers and checks
all retained objects before deletion. `inspectStoredImageReferences` inventories nested
structured attachment IDs across current journal documents, with bounded example keys.
External/prose-only references require additional owner declarations. The server's
configured retention controller uses source leases and journal write holds for
preview and collection through idle admission. See
the [collection semantics](../../../docs/implementation/image-storage.md#original-object-collection-and-recorded-references).

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
publishes a durable count index and reads historical full-array snapshots. Native
publication uses `appendNative` with fixed sequence boundaries and individual event
reads. V2 indexes retain the native Session identity; older indexed/inline histories
can be adopted after complete published-prefix validation. Each event is subject to
the journal's 8 MiB record limit. Resumable model sessions
and automatic stale-lock takeover remain unimplemented.

`SessionAudits.index`, `page` and `before` provide bounded assignment/event reads for
the console. The published event count is the visibility boundary; clients can retain
that count while navigating a growing audit. Legacy arrays remain readable. Complete
in-process `read` retains its explicit full-history allocation cost. See the
[audit API and limits](../../../docs/implementation/session-audits.md).

[session-history.ts](src/session-history.ts) publishes native events and verifies the
durable prefix before releasing older resident bodies. Deployment-defined count and
encoded-byte budgets retain a recent suffix; archived reads preserve native sequence,
surface and projection behavior. Keep the store open through native assignment cleanup.
Current model context, caller snapshots, key indexes and application projections have
separate costs. See [policy and acceptance](../../../docs/implementation/session-history.md).

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
in an idle workspace with a fresh inspected sequence. Distinct-key deletion and
automated retention scheduling remain pending.

`holdWrites()` returns a sequence-bound read hold and idempotent release. Nested holds
reject `put` and `compact` until all releases complete. The retention controller uses
this guard while image-reference snapshots and collection are active. It does not
replace the store writer lock or coordinate external filesystem changes.

`pnpm test:storage` exercises real journal files and checks write/reopen/scan behavior
in a child process with a 64 MiB V8 old-space limit and more than 64 MiB of journal
data. This checks record-body retention and startup reading. The key index still
grows with distinct keys, and caller-owned results, active runs, full list/audit reads
and browser history have separate memory costs. Total RSS and disk usage are not
bounded by that heap test.
