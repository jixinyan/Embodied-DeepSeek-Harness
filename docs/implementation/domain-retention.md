# Domain record retention

`DomainRetention` in `apps/server` validates an explicit set of journal records before
calling `LocalStore.retire`. It is exported for trusted application assembly. Every
stored namespace requires an owner that declares its references and retention rule.
There is no automatic collection, complete built-in EDH ownership policy, HTTP record
deletion route or console deletion control at this checkpoint.

## Owner and source configuration

`DomainRetentionPolicy` contains a version, a nonempty `owners` array and an explicit
`sources` array. An empty source array declares that the deployment has no external
record references. Deployments must establish that claim before using it.

Each `DomainRecordOwner` has a unique ID, version and nonoverlapping key prefix.
Its synchronous `inspect({ key, version, value })` validates the stored format and
returns `{ references, retain }`. References are complete journal keys. `retain: true`
prohibits deleting the inspected record. Every current record, including selected
records, must have an owner; missing owners, missing referenced records and invalid
declarations fail inspection. A retained record referencing a selected record prevents
deletion. A complete selected cycle can be deleted together.

Owners must declare every dependency, including references inside extension payloads,
agent files and text. The controller cannot infer semantic references from arbitrary
prose. Owner versions must change when reference interpretation changes. Owners receive
detached record values and immutable record identity fields. They must not mutate the
journal or perform asynchronous work during inspection.

Each `DomainReferenceSource` has a unique ID and an asynchronous `acquire(signal)`
method. Acquisition returns `{ revision, keys, release }`. The lease must stabilize all
external references until release completes. Source revisions describe the complete
reference state. The controller acquires sources in ID order and releases them in
reverse order. `journal`, `skills` and `requests` are reserved source IDs. A declaration
without an actual stabilization mechanism is insufficient for a changing source.

## Session and request owners

`sessionRecordOwners(store, validator)` supplies seven owners for application assembly:

| Namespace | Declared dependencies |
| --- | --- |
| `user-session:` | Its open-request record, every published task, each task's session ownership, compact membership records and its published task catalog |
| `session-open-request:` | The matching source session; always retained |
| `session-task-member:` | Source session and task; published membership also references the task's session ownership |
| `run-user-session:` | Source session, task and compact membership, with exact reverse ownership checks |
| `session-task-request:` | Source session; admitted requests also retain task, ownership and compact membership; always retained |
| `session-task-catalog:` | The matching source session, with catalog identity, descriptor and content verification |
| `request:` | The admitted legacy task when present; always retained |

Session inspection consumes the complete published membership inventory. Missing
intermediate positions, duplicate positions, rewritten immutable entries and conflicting
record identities fail. Legacy inline task IDs declare direct task/ownership dependencies
without requiring compact membership records. Valid membership suffixes beyond the
published count remain outside the session's dependency set. They still have their own
owner and must satisfy their declared references if selected for inspection.

An open-request record and its source session must agree in both directions. A published
task must resolve to the same source session through its ownership record. Failed task
admission retains its null-run request identity. Request readers support the retained
legacy accepted format and the current two-write publication sequence.

These owners describe framework-defined relationships. Deployments with custom record
references inside configuration/catalog text must extend the corresponding owner or
declare those references through an external source. Owner prefixes cannot overlap.
Run, assignment, recovery, report, file and native-audit owners remain required
for a complete application journal. This pack does not authorize deleting a session:
the retained request record continues to require its replay source. Removing such
history requires an explicit archived-identity lifecycle and corresponding reader support.

## Evidence and verification owners

`evidenceRecordOwners(store, validator)` supplies five additional owners:

| Namespace | Declared dependencies |
| --- | --- |
| `sensor-sample:` | Source run, recovery identity when present, and every referenced sensor-image metadata record |
| `sensor-image:` | Source run; attachment identity, immutable version and complete metadata are validated |
| `verification-boundary:` | Source run, recovery identity when present and every recorded observation |
| `verification-context:` | Source run, archived assignment when applicable, stopped boundary, captured evidence and recovery identity when present |
| `verdict-history:` | Verification context and its dependencies, with exact verdict-to-context agreement |

These owners use SensorSamples, AssignmentHistory, VerificationBoundaries,
VerificationContexts and VerdictHistory to read their authoritative records. Shared
image-reference validation is exported by `@edh/perception` and used by both sensor
admission and metadata ownership inspection. It validates metadata; actual attachment
bytes remain the image provider's responsibility.

Evidence must belong to its key's run and source mode. A verification context must
match its assignment brief, boundary and observation scope. Contexts with recorded
facts require agent-visible evidence. Accepted verdicts must agree with the verifier
session, request, execution, boundary, task scope, exact facts, evidence list and goal
criteria identity/version. References to missing required records or conflicting scopes
stop inspection. JSON tuple keys must retain their canonical encoding.

The verification owners require the persisted context and boundary sources. Legacy
records lacking those sources require an explicit migration or restoration before
retention admission; this pack does not create evidence or infer an absent verification
history. Custom semantic dependencies in arbitrary text still require deployment-owned
reference declarations. Original-image collection remains a separate operation and
continues to retain images referenced by the remaining journal.

## Mandatory retained records

Both preview and deletion apply these checks:

- Every stored user session must be closed with resources confirmed released.
- Every SKILL must have complete, valid provenance. Its source record keys, including
  recovery event indexes and published events, are retained.
- Records under `request:`, `session-open-request:` and `session-task-request:` are
  retained to preserve accepted request identities.
- Every configured external root must exist and remain outside the selected set.
- Every unselected record's declared dependencies must remain outside the selected set.

Request records still need owners to declare their own dependencies. Session state is
only one admission check: application assembly must also exclude active native scopes,
task admission and shutdown races. That host lifecycle integration remains pending.

## Preview and deletion

`inspect(keys, signal)` accepts distinct existing keys. It acquires source leases,
holds journal writes and checks the complete declared graph. Its returned preview
contains a random token, global store sequence, reference digest, source IDs, selected
key/version/hash records, retained record count and SKILL count. The returned object
is detached from the controller's internal preview.

`retire(token, signal)` consumes the pending preview, reacquires all sources and repeats
every check. The global sequence and reference digest must match. The digest covers
policy/owner versions, external revisions, retained roots, record revisions and all
declared edges. Changed data requires another preview. Tokens are single-use; concurrent
operations on one controller fail, and a new inspection replaces the prior preview.

After validation the controller releases its own write hold and synchronously invokes
atomic journal retirement without an intervening asynchronous step. External leases
remain held through publication and synchronous index observers. Other journal write
holds continue to prohibit retirement. Cancellation before publication prevents deletion.
The synchronous journal publication itself has no cancellation point.

All acquired leases are released on success and failure. Release failures propagate;
multiple failures are reported together. A release or observer failure after publication
can accompany an already committed deletion. Inspect the authoritative journal before
continuing; retrying a consumed token never repeats the deletion. See the storage guide
for [publication and recovery semantics](storage-maintenance.md#record-retirement).

## Acceptance and integration work

`pnpm test:domain-retention` runs nineteen checks with real journals, exclusive file locks,
file revisions, cancellation and reopen. Authored documents exercise reference cycles,
retained incoming edges, mandatory SKILL/request roots, incomplete provenance, changed
previews, malformed configuration and external-source cleanup. No model response or
physical provider executes, and no user workspace record is deleted.
Six session-owner checks additionally cover exact dependency sets, all published
membership positions, unchanged request replay after rejected deletion, reverse identity
conflicts, catalog integrity, legacy inline history, compaction and reopen.
Five evidence-owner checks use the actual stored project PNG and authored verification
documents. They exercise exact dependency sets, archived assignment sources, missing
references, changed actor/scope/facts/visibility, immutable versions, image metadata,
compaction and reopen. Eight sensor-record checks cover shared admission validation,
including a file-backed child process under a 64 MiB heap limit.

Application delivery still requires a complete EDH record-owner inventory, external
ownership declarations, host idle admission and reviewed console selection. Session
and task identity preservation must be defined before deleting their history. This
controller provides the reference admission mechanism for that integration; the storage
primitive remains restricted to trusted application owners.
