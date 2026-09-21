# Journal maintenance

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

Nonempty checkpoints start with a JSON object containing:

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

## Console and HTTP

The console's **Workspace storage** section shows journal size, record count and
superseded bytes. **Refresh storage** reads current values. **Compact journal** submits
the inspected sequence and reports the reclaimed bytes.

- `GET /api/storage` returns `{ statistics, blockedBy }`.
- `POST /api/storage/compact` accepts only `{ expectedSequence }`.
- Invalid input returns 400; a stale sequence or busy workspace returns 409.
- An open user session, active task, session/admission operation or shutdown blocks
  maintenance. End the session or finish/stop a legacy task before requesting it.
- Accepted maintenance reserves the same server admission guard used for task/session
  allocation. It waits for a retained terminal task to settle and close, rechecks
  shutdown, then compacts the journal. The response contains updated statistics and
  `{ compacted, before, after, reclaimedBytes }` under `result`.

Maintenance is synchronous while the workspace is idle. Large stores can temporarily
delay HTTP/SSE responses. It requires temporary disk space for the complete checkpoint.
No maintenance runs automatically on a user's data directory.

## Acceptance and remaining work

`pnpm test:storage` runs 15 tests using real journals, processes and admission inputs.
Coverage includes versions/order/sequence preservation, reopen and further writes,
incomplete/corrupt checkpoints, external journal changes, unpublished staging files,
stale/busy admission, and actual process termination during checkpoint publication.
A child with a 64 MiB V8 old-space limit compacts a journal exceeding 96 MiB and rereads
all 96 latest documents. This limits neither total RSS nor the distinct-key index.

Additional history and HTTP-image checks verify published-history boundaries and
associated image reads after compaction. Browser component acceptance uses the actual
markup, controller and renderer with a separate document journal and production
admission/storage functions. Full application maintenance while draining live model
and provider scopes remains unverified. No scripted model or physical backend is used
by these acceptance checks.

Distinct-key retention, run/session archival, image/cache reference accounting and
collection, native context/audit lifetime, and automated retention scheduling remain
separate upper-runtime work. Compaction alone does not impose a total disk quota.
