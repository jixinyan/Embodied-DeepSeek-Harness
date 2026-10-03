# Domain record retention

`DomainRetention` in `apps/server` validates an explicit set of journal records before
calling `LocalStore.retire`. It is exported for trusted application assembly. Every
stored namespace requires an owner that declares its references and retention rule.
`workspaceRecordOwners` composes the built-in namespace inventory with an explicit
deployment payload inspector. Configured HTTP and console operations archive request
identities and retire selected closed-session history after reference inspection.
See the [session-retention lifecycle](session-retention.md). Collection remains explicit.

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
| `session-open-request:` | The matching source session; retained until its identity is archived |
| `session-task-member:` | Source session and task; published membership also references the task's session ownership |
| `run-user-session:` | Source session, task and compact membership, with exact reverse ownership checks |
| `session-task-request:` | Source session; admitted requests also retain task, ownership and compact membership; retained until its identity is archived |
| `session-task-catalog:` | The matching source session, with catalog identity, descriptor and content verification |
| `request:` | The admitted legacy task when present; retained until its identity is archived |

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
Workspace composition supplies event, submission, plan, file, clarification and native-audit
owners. Unarchived requests preserve their replay sources. Explicit immutable identity
archives allow selected closed-session history to enter reference inspection while
preserving identity reservation through reader admission and restart.

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

## Report and receipt owners

`reportRecordOwners(store, validator)` supplies four owners:

| Namespace | Declared dependencies |
| --- | --- |
| `report:` | Source run, sender/recipient assignment archives when present, evidence, predecessor, retained delivery/acknowledgement and its current immutable archive when available |
| `report-record:` | Source run, sender/recipient archives when present, evidence, predecessor and retained delivery/acknowledgement |
| `report-delivery:` | The matching immutable report, or the explicit legacy latest-report source |
| `report-ack:` | The matching report source with sender/recipient receipt identity checks |

The sender must match the report's native session, Team, task scope and fixed recipient.
A role recipient must belong to the same run and Team. Evidence must be retained,
agent-visible and scoped to the report's run. Recovery identities in report scopes are
also dependencies. Report predecessors preserve actor, recipient and scope, decrease
the version by exactly one, and have `insufficient_context` status. A final report
cannot acquire a later revision. Custom semantic references in result bodies or text
remain the deployment's responsibility.

The owners reuse AssignmentReports readers and its predecessor inspection. Those
readers validate stored report/receipt shapes, immutable versions and the latest
report's logical/CAS version. An existing current archive must match its published
body exactly. Legacy latest-only records remain readable and retain their explicit
source; missing earlier history is not synthesized. Archived reports outside the
published chain remain outside acknowledgement admission.

Delivery and acknowledgement records refer back to their report. The report retains
existing receipts, so they form a deletion group. No acknowledgement or delivery
state establishes physical success. Native DSH delivery behavior is unchanged.

## Assignment and recovery owners

`taskRecordOwners(store, validator)` supplies three owners:

| Namespace | Declared dependencies |
| --- | --- |
| `assignment-history:` | Source run, archived caller/recipient when applicable, brief and known-fact evidence, last observation, report, formal verification context and scoped recovery |
| `recovery:` | Source run, failed and successful accepted verdicts, their verifier archives/evidence, decision owner, failed request/execution sources, stopped boundary and every published recovery event index/source event |
| `recovery-event:` | Explicit source recovery and run, plus the referenced published run event when stored separately |

Assignment inspection uses AssignmentHistory and checks the run's published identity,
native session, member, model, tools, status, caller and observation. Role callers and
recipients must belong to the same Team; the caller's native identity must agree.
Archived reports must agree with the current published report and version. A published
verification-context marker requires its matching scoped record. Evidence from briefs,
known facts, reports and last observations must remain available and agent-visible.
An archive written before the compact run summary can be inspected when its complete
assignment still agrees with the run's inline assignment.

Recovery inspection requires an explicit source run and original goal. Its failed
verdict must match exactly one accepted run verdict. A successful result, when present,
must refer to the same goal and criteria, another attempt and this recovery identity.
Pending or interrupted recovery retains failed provenance without requiring a successful
result. Decision-owner, failed-request and failed-execution fields are validated when
present; older documents can omit those context fields. A request must agree with the
stored request, its decision owner and the failed goal/attempt. Execution snapshots
must preserve execution identity and task scope. Archived verdicts and verifier
assignments retain their source records.
Execution telemetry can reference debug-only samples; retaining those sources does
not grant agent access. Briefs, known facts, reports and verdict evidence still require
agent-visible samples.

Each published recovery index must have immutable version 1, an increasing sequence
and an existing published run event with immutable version 1. Inline histories retain
their source run and must agree with the corresponding run-event bodies. Their original
representation remains unchanged. A recovery without an explicit run identity requires
source restoration before retention admission. Unpublished index suffixes are excluded
from the recovery's published dependency set; each suffix still declares its own source
recovery and event. Canonical keys distinguish recovery IDs containing colons from the
final numeric event index.

These owners declare typed framework references. Custom semantic references inside
context, event detail, report results, free text or agent files require deployment-owned
declarations. Workspace composition includes event-body and native audit ownership.

## Run, configuration and restart owners

`runRecordOwners(store, validator, options?)` supplies three owners:

| Namespace | Declared dependencies |
| --- | --- |
| `run:` | Published event bodies, assignment archives, evidence, reports, verification contexts/results/boundaries, recovery, SKILLs, current clarification, selected historical tasks, session membership and retained configuration/submission/plan/audit records |
| `run-config:` | Source run and its published session ownership/membership when present |
| `run-interruption:` | Source run, with immutable restart annotation identity checks |

Run inspection validates the stored projection and traverses every published event
through bounded RunHistory pages. Missing events and rewritten immutable bodies fail.
Unpublished event suffixes remain outside the run's published dependency set and
require their own owner. Running, paused and verifying run records are mandatory
retentions. Host idle/drain admission remains required for the complete lifecycle.

Assignment sources can be inline or archived. Their identity, caller/recipient Team,
evidence, published report and formal verification context must agree. Requests retain
their decision owner and evidence. Each execution requires a unique admitted request
for its goal/attempt/recovery; each verdict retains its verifier and matching execution
scope. Last sensor snapshots must equal their retained SensorSamples. Debug-only
execution observations remain valid; consumed agent observations require agent visibility.

Stored configurations have immutable version 1 and must match run source mode, Team ID
and Team source digest. Recorded members and the decision owner must exist in that Team.
A session task's entire configuration must equal its source session configuration.
Standalone runs remain supported, including library-created runs without an HTTP
configuration record. Existing restart annotations require immutable version 1, the
next sequence after ordinary run history and `run.interrupted` type with a reason.

Explicitly selected task context retains its source run, same-session ownership and
published membership, selected verdict archive and referenced SKILLs. Its source
revision cannot be newer than the current journal record; later cleanup revisions
remain compatible. Instruction, origin and selected verdict contents must agree with
their retained sources. A context snapshot remains a historical observation; it does
not certify the environment's current state.

Legacy inline events have no separate event-body owner. Nonempty inline history therefore
requires `options.inlineEventReferences`, containing an explicit `version` and synchronous
`inspect(event, runId)` callback returning complete journal keys. The inspector version
contributes to the run owner's policy version. This preserves inline event payload
references without rewriting history. The inspector must handle every event type and
extension payload present in that deployment. Missing or malformed declarations fail.
`RunEventReferences` supplies built-in payload inspection and a separately stored event owner.
Custom references inside configuration or free text still require deployment declarations.

## Event and message owners

`RunEventReferences(store, validator, extension?)` exposes `owner()` for `event:` records
and an own `inspect(event, runId)` function for `runRecordOwners`'s
`inlineEventReferences` option. Its version includes a digest of the extension version.
Event keys, sequence numbers and immutable versions must agree. Published legacy inline
bodies must match their indexed copies; an unpublished assignment-created suffix can
retain its supplied context before the assignment is published in the run projection.

Typed references include assignment archives, brief and observation evidence, execution
boundaries, verdict archives, reports and acknowledgements, recovery records/indexes,
plan sources, clarification questions and SKILL provenance. Report delivery can resolve
an explicit current-only legacy report source. Observation metadata and message sensor
snapshots must match their retained sources. Historical clarification events compare
stable question identity because the source's response/delivery lifecycle can advance.
Recovery-start context and recovery-progress page contents must match retained history;
progress retains the preceding index needed to validate its page boundary.

Unknown event types or message kinds require a versioned extension. The extension runs
for every event and returns complete journal keys, including any application-defined
references inside tool arguments/results, model content, custom message data or free
text. Built-in inspection does not infer those references from arbitrary strings.
The deployment owns extension completeness and version changes. Registered sensor-image
metadata is retained when present; image byte ownership remains with the image service.
These owners compose with the application/native-audit inventory and idle HTTP/console
admission described in [session retention](session-retention.md).

## Mandatory retained records

Both preview and deletion apply these checks:

- Every stored user session must be closed with resources confirmed released.
- Every SKILL must have complete, valid provenance. Its source record keys, including
  recovery event indexes and published events, are retained.
- Unarchived records under `request:`, `session-open-request:` and `session-task-request:`
  protect source history. Archived identities are immutable retained roots; their
  original requests can join an explicitly selected closed-session history graph.
- Every configured external root must exist and remain outside the selected set.
- Every unselected record's declared dependencies must remain outside the selected set.

Request owners declare source history and validate their immutable archive when present.
Configured HTTP operations reserve idle application admission and dispose retained terminal
task scopes before inspecting or modifying records. Deployment external leases and
payload reference declarations remain necessary for complete source ownership.

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

`pnpm test:domain-retention` runs forty-nine checks with real journals, exclusive file locks,
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
Six report-owner checks cover sender/recipient archives, explicit evidence, report
history, receipts, current-only legacy sources, changed identities, invalid persisted
formats and final-report history boundaries. Seven report-history checks additionally
exercise actual HTTP and a child process with more than 100 MiB of authored reports
under a 64 MiB V8 old-space limit. No model or physical provider executes.
Nine task-owner checks cover brief/known-fact evidence, caller archives, reports,
formal contexts, failed-to-successful recovery provenance, pending recovery, missing
or rewritten intermediate records, explicit legacy history, unpublished suffixes,
canonical identities, debug-only execution telemetry, compaction and reopen. These
checks use authored documents and actual journal operations; no model or physical
provider executes.
Eight run-owner checks cover 130 published events across multiple pages, immutable
source failures, unpublished suffixes, inline and archived assignments, request and
verdict sources, configuration/session agreement, selected historical task context,
membership migration, restart annotations, inline payload declarations, clarification,
compaction and reopen. They use authored documents and actual journal operations.
Seven event checks cover delegation, evidence and verdict sources, conflicting identities,
immutable events, current-only and historical reports, exact recovery pages, clarification
lifecycle changes, versioned extensions, legacy inline composition, unpublished suffixes,
compaction and reopen. They execute no model or physical provider.

Actual copied histories verify complete owner composition, archived identity reservation,
explicit closed-session retirement, restart reconciliation and production HTTP/Chrome DOM
selection. Deployment external ownership and semantic payload declarations remain explicit
configuration requirements. The [acceptance guide](session-retention.md#actual-retained-history-acceptance)
records the tested histories and evidence boundaries.
