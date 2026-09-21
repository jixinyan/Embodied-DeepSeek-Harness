# Native Session event residency

Native DSH Sessions preserve their complete logical event sequence while older event
bodies are read from the existing durable SessionAudits records. Model context, tool
dispatch, event identities and surface replacement remain native DSH responsibilities.

## Deployment policy

`ServerDeployment.sessionHistory` configures the retained event-body suffix:

```ts
sessionHistory: {
  maxResidentEvents: 256,
  maxResidentBytes: 8 * 1024 * 1024,
}
```

These are the defaults. Both values must be positive safe integers; unknown fields
fail validation. Deployment preparation copies and freezes the policy and includes it
in the deployment digest, public configuration and historical configuration. Direct
UpperRun construction uses the same defaults when no policy is supplied.

TeamSessions invokes its audit hook before each native agent step, after delivery and
during retirement. UpperRun publishes new immutable events through SessionAudits,
selects the newest suffix within both limits, then releases the preceding resident
bodies. The byte limit measures JSON-encoded event bytes. An event larger than the
budget can be archived without retaining a resident copy. Successful release emits
`agent.history-retained` with assignment identity, logical event count, archive
boundary and retained event/byte counts.

The limits apply at those checkpoints. A single step or delivery batch can grow the
resident log before the next checkpoint. Current model messages, derived-message
caches, token-meter state, application projections, caller-owned snapshots and the
LocalStore key index have separate memory costs. These settings do not bound process
RSS, model context or journal size. Every persisted event must also fit LocalStore's
individual record limit.

## Publication and native reads

`Session.residentStartSeq` identifies the first resident event. Its logical `seq`
continues to count all accepted events. `releaseEvents(beforeSeq, archive)` validates
the boundary, native Session identity and stable archive reader. It compares every
candidate event with its published durable value before removing any resident copy.
Missing, conflicting or unreadable records fail before release. Release cannot occur
during native event publication or another release, and append cannot reenter release.

`SessionAudits.archive` supplies the reader. Each read requires a v2 index with the
matching Session identity, a published sequence and an immutable version-1 event
record. LocalStore checks record identity, version and checksum. Archived `eventAt`
reads validate the native envelope and exact sequence and return deeply frozen values.
An unavailable or rewritten archive fails explicitly. Keep the store open until all
native assignments and their cleanup have finished.

SurfaceManager addresses the same absolute event sequence through an indexed reader.
Tool-result replacement validates the archived original. Request header/context folds
remain current across release boundaries. Release clears internally retained complete
event snapshots and derived-message caches; subsequent derivation follows the current
native surface. Previously returned snapshots remain stable and are owned by callers.
Explicit complete snapshots and forks can still allocate complete history. Archived
full snapshots are not cached internally.

Late native projection registration uses the existing incremental fold with individual
event reads. It preserves projection semantics without constructing a full historical
event array. Archived access performs synchronous journal reads; workload-dependent
latency needs evaluation with a live model deployment.

The scoped source changes are in native Session, SurfaceManager and
SessionProjectionRegistry. Original and modified hashes are recorded in
[DSH provenance](../provenance/README.md). Existing audit formats remain readable;
this feature does not resume model sessions after restart.

## Acceptance

`pnpm test:session-history` runs eleven native/file/process checks:

- Count and byte budgets, stable sequences, historical reads and immutable snapshots.
- Native tool-result replacement, request metadata and context derivation after release.
- Actual write exclusion, publication identity, invalid boundaries, rewritten records
  and release attempted during native event publication.
- Native token measurement, late projection registration and surface compaction with
  archived source events; replay agrees with the live projection.
- A child process with a 64 MiB V8 old-space limit stores over 100 MiB of actual project
  specification documents in one active Session while retaining two event bodies and
  one current surface node; it also reads the earliest archived document.

Assignment-lifecycle checks connect the policy to actual native delivery, including
the failure produced by an unavailable model adapter and its retained final audit.
These checks use native services, actual files and authored documents. They do not
evaluate model reasoning, summary accuracy or physical execution.

Remaining work includes live model/provider throughput and shutdown acceptance,
active-context and application-projection lifetime, distinct-key retention and
domain-aware archival that preserves SKILL provenance.
