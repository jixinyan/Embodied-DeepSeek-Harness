# Workspace storage maintenance

`LocalStore.statistics()` reports record count, global write sequence, journal bytes,
current-record bytes, checkpoint-header bytes and superseded bytes. Superseded bytes
include replaced record versions and legacy blank lines. The exact space reclaimed
is reported after compaction, including the checkpoint header cost.

`LocalStore.compact()` retains every current key/value and its CAS version. This
includes independently stored events, sensor evidence, audit records, recovery
references, configuration snapshots and SKILL documents. An event outside a run's
published boundary remains outside that boundary. Public history sequences and the
store's global write sequence are preserved. No task/session/physical command resumes.

## Publication and format

Compaction reads and validates one current record at a time. It writes a new file
in the store directory with exclusive creation and private permissions. The complete
file is synchronized before atomic rename to `records.jsonl`; the directory is then
synchronized. The live index and file descriptor move to the published checkpoint.
The writer lock remains held throughout. A checkpoint that would not reduce journal
size is discarded and the current journal remains authoritative.

Checkpoints without prior retirement use a v1 header when nonempty:

- `format`: `edh-domain-checkpoint-v1`.
- `sequence`: the preserved global write sequence.
- `records`: the number of current records.
- `hash`: SHA-256 of the JSON array `[format, sequence, records]`.

The next `records` lines use the existing entry shape (`sequence`, `key`, `record`,
`hash`). Their sequences end at the header sequence, and each key occurs once. Their
stored versions are positive safe integers whose sum equals the header sequence.
All entry checksums are verified. Ordinary appends after this prefix require the
next sequence and the previous key version plus one. Parsing uses `n-readlines`,
`JSON.parse` and Zod validation.

The reader accepts existing headerless journals. A completed compaction introduces
the checkpoint format; older application versions cannot read that format. Keep the
application version and data-format support together when moving a data directory.
Compaction retains the public latest-record API and independently stored history;
superseded values of mutable keys are removed from the journal.

An incomplete checkpoint or incomplete first record fails opening without truncation.
A torn append suffix after a complete record/checkpoint is excluded before further
writes. Unpublished staging files are never promoted during startup. An interrupted
process can leave one such file and the writer lock: confirm the old process has
terminated before reconciling that lock. Automatic stale-lock takeover and staging-file
collection are not implemented.

Detected read, write, integrity or cleanup failure stops the current store instance.
Failures before publication retain the previous authoritative journal. Failures after
rename retain the published checkpoint and report the failure. A returned success
requires publication and synchronization to complete. Process-termination acceptance
does not establish protection against every filesystem or power failure.

## Record retirement

`LocalStore.retire(keys, expectedSequence)` is a trusted storage-owner API. It accepts
a nonempty array of distinct existing keys and the inspected global sequence. Invalid
keys, duplicate/missing records and stale sequences fail before mutation. All write
holds must be released, and observers cannot call it recursively.

The operation validates current record bodies and atomically publishes a checkpoint
containing the remaining records. Retained values, CAS versions and iteration order
are preserved. One successful batch advances the global sequence once, regardless of
the number of removed keys. Reopen and later appends retain that sequence even when
every key was removed. A deleted key has no current revision and can be created again
at version 1. Application request identities that must never be reused need separate
retained records or tombstones established by their lifecycle owner.

The return value contains `removedRecords`, `before`, `after` and `byteDifference`.
The byte difference is `before.journalBytes - after.journalBytes`; it can be negative
when the checkpoint header costs more than the removed records. Retirement always
publishes the selected deletion, including in that case. Compaction still publishes
only when it reduces size and never removes current keys.

After any retirement, checkpoints use `edh-domain-checkpoint-v2`:

- `sequence` is the global write/retirement sequence, a positive safe integer.
- `records` is the retained count and may be zero.
- `sequenceOffset` is positive and satisfies
  `sum(retained record versions) + sequenceOffset === sequence`.
- `hash` is SHA-256 of `[format, sequence, records, sequenceOffset]` encoded as JSON.

The offset accounts for removed version histories and retirement transactions. Normal
appends and compaction preserve this accounting; further retirement updates it. Entry
sequences are contiguous and end at the header sequence. Record checksums, unique keys,
version totals and complete prefix checks apply. An empty checkpoint requires
`sequenceOffset === sequence`. V1 and headerless journals remain readable. Application
versions without v2 support cannot open a retired journal.

Retirement uses the same synchronized staging file, atomic rename, directory sync and
failure handling as compaction. It emits one synchronous `retire` notification after
publication. WorkspaceHistoryIndex reconciles remaining sources and removes absent
summaries in a SQLite transaction. If index publication fails, the store stops; reopening
reconciles the index from the committed journal. Cross-file publication is recoverable
through this sequence and is not a distributed transaction.

There is no record-retirement HTTP route or console control. The configured
[DomainRetention controller](domain-retention.md) checks declared record ownership,
SKILL provenance, request identities and leased external references against a single-use
preview before calling this primitive. Complete built-in ownership and host/console
admission remain required. The primitive does not inspect arbitrary document relationships
or retire image objects. Only authored acceptance journals are deleted by the tests.

## Console and HTTP

The console's **Workspace storage** section shows journal size, record count and
superseded bytes, original-image usage and model-request-cache usage.
**Refresh storage** reads current values. **Compact journal** submits the inspected
sequence and reports reclaimed bytes. **Clear model image cache** submits the inspected
image revision and preserves original images and their evidence references.

- `GET /api/storage` returns `{ statistics, blockedBy, images }`. `images` contains
  `{ available: true, inspection }` for a maintenance-capable provider, or
  `{ available: false }` otherwise. An inspection is ready with usage/revision or busy.
- `POST /api/storage/compact` accepts only `{ expectedSequence }`.
- `POST /api/storage/clear-request-cache` accepts only `{ expectedRevision }`.
- Invalid input returns 400; a stale sequence or busy workspace returns 409.
- Cache cleanup returns 409 for a stale image revision or image-operation conflict;
  a provider without maintenance support returns 501. `/api/config.imageStorage`
  reports its `maintenance` capability alongside native image limits.
- An open user session, active task, session/admission operation or shutdown blocks
  maintenance. End the session or finish/stop a legacy task before requesting it.
- Accepted maintenance reserves the same server admission guard used for task/session
  allocation. It waits for a retained terminal task to settle and close, rechecks
  shutdown, then performs the requested maintenance. Compaction returns updated statistics
  and `{ operation: 'journal_compaction', compacted, before, after, reclaimedBytes }`
  under `result`. Cache cleanup returns updated statistics, the resulting image
  inspection and `{ operation: 'request_cache_clear', before, after, removedFiles,
  reclaimedBytes }` under `result`.

Maintenance is synchronous while the workspace is idle. Large stores can temporarily
delay HTTP/SSE responses. It requires temporary disk space for the complete checkpoint.
No maintenance runs automatically on a user's data directory. Image inspection and
cleanup stream file entries asynchronously. Cache cleanup validates recognized files
before deletion, excludes concurrent image mutations and preserves all original images.
Deletion is incremental: cancellation or I/O failure can leave a partially cleared cache.
See [image maintenance and ownership](image-storage.md#image-inventory-and-request-cache-maintenance).

## Acceptance and remaining work

`pnpm test:storage` runs 27 tests using real journals, processes and admission inputs.
Coverage includes versions/order/sequence preservation, reopen and further writes,
incomplete/corrupt checkpoints, external journal changes, unpublished staging files,
stale/busy admission, exact cache-cleanup inputs, and actual process termination during
checkpoint publication. Retirement adds eight real-file/process checks for selection
admission, retained versions/order, empty checkpoints, v2 corruption, write holds,
observer failures, external modifications, process termination and bounded body reads.
`pnpm test:workspace-history` runs fourteen checks, including immediate retirement
reconciliation and recovery after an actual SQLite writer lock blocks index publication.
A child with a 64 MiB V8 old-space limit compacts a journal exceeding 96 MiB and rereads
all 96 latest documents. This limits neither total RSS nor the distinct-key index.

Additional history and HTTP-image checks verify published-history boundaries and
associated image reads after compaction. Browser component acceptance uses the actual
markup, controller and renderer with a separate document journal and production
admission/storage functions. Full application maintenance while draining live model
and provider scopes remains unverified. No scripted model or physical backend is used
by these acceptance checks.

Application retention admission, run/session archival, application-wide original-image reference
ownership, native context/audit lifetime, and automated retention scheduling remain
separate upper-runtime work. Compaction alone does not impose a total disk quota.

Configured deployments expose original-object inspection and collection through idle
admission. The controller combines journal references and declared source leases,
checks all SKILL sources and closed/released sessions, holds journal writes and
revalidates the preview's journal/image/source versions. The console shows retained
and unreferenced counts before an explicit deletion request. Cache cleanup preserves
all originals; original collection preserves the complete declared root set. See
[ownership configuration and the collection API](image-retention.md).
