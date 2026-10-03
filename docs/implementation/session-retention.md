# Closed-session history retention

Configured applications expose an explicit closed-session history lifecycle:
select sessions, archive their request identities, inspect all references, and delete
the inspected records. Each operation reserves application admission and requires
an idle workspace. The server settles and disposes its retained terminal task scope
before maintenance. Startup and task completion preserve history without archival
or deletion.

## Application configuration

`LocalServerOptions.domainRetention` requires a policy `version`, an explicit array
of leased external `sources`, and a versioned `references` inspector. The inspector
receives each detached `{ key, value }` and returns additional journal reference keys.
It declares semantic dependencies in custom tool results, reports, native DSH messages,
plan text, assignment files and extension payloads. An empty declaration is valid only
when the deployment has established that the payload has no additional dependencies.
An empty source array declares that no external consumer retains journal references.
Changing reference interpretation requires changing the inspector version.

The shared native deployment factory supplies
`storageRetention: nativeWorkspaceRetention`. Application startup invokes this factory
with the actual journal, validator, provider identities and tool bindings. Both
standalone and desktop launchers receive the resulting record and original-image
policies. Explicit `startServer` policy options override the corresponding deployment
binding.

The native binding supports the built-in RoboTwin, RoboCasa, BEHAVIOR and RoboDojo
environments and EDH core tools. It validates native DSH message envelopes with the
DSH Session reader, checks supported event payload schemas and tool names, preserves
compaction/prune source sequences, and declares complete originating-run dependencies.
Record text, model streams, reports and assignment files preserve additional cited
journal keys and generated source identities. Source records shared by multiple runs
remain dependencies of each run. Referenced history must be included in the deletion
selection or remain retained. Archived request input reserves identifiers independently
of source records.

The `native-workspace-exports` lease checks the complete SKILL export inventory against
immutable journal documents and holds their original file descriptors until inspection
finishes. SKILL exports retain their journal sources and full recovery provenance.
The native runtime stores assignment files, message audits and policy audit sources
in this same exclusively owned journal. Record maintenance requires closed sessions,
released environments and disposed runtime scopes. Image leases validate the full
record owner inventory and retain structured native attachments, including those
in raw streams and visual-history source markers. Text references additionally retain
existing original objects in the owned local attachment directory. SKILL provenance
retains its original evidence attachments. Original-image
collection uses the separate immutable object inventory and its inspected revision.

Unknown record namespaces, native event schemas, tool extensions, file attachments
and conflicting exports stop inspection. Custom image providers supply their own image
retention policy. Extension deployments supply their own
complete `storageRetention` factory or explicit `startServer` policies. Applications
without a binding display `Record retention ownership is not configured.`, disable
history controls and return 501 for direct record maintenance requests.

`workspaceRecordOwners` composes every built-in namespace owner: sessions, requests,
evidence, reports and receipts, assignment/recovery history, runs and restart annotations,
events, submissions, plans, clarifications, assignment files, native audits, archived
request identities and SKILLs. Unknown namespaces, missing dependencies and inconsistent
source identities fail inspection. SKILLs and their complete original-goal recovery
provenance remain mandatory retained roots. Deployment-owned payload inspection applies
to every owner. Native/free-text sources require an explicit inspector.

Submission inspection reconstructs admission from its retained session task catalog,
validates immutable criteria and identity, and preserves selected historical tasks.
Older submissions without a retained task catalog require source restoration before
retention. Plans validate their record version, decision owner, dependency graph,
executed criteria and accepted verdict references. Clarifications validate canonical
question identities and decision-owner scope; pending questions and queued responses
remain retained. Assignment files validate their logical path, content size and unique
source assignment. Run records retain their assignment files.

Native audit indexes validate assignment ownership and the v2 native Session identity.
Published events require immutable version 1 and their original zero-based sequence.
Audit inspection reads bounded pages, retains preceding native source events and applies
payload ownership to every event. Legacy inline arrays remain inspectable. Unpublished
event suffixes retain their assignment source and preceding events without becoming
part of the index's published dependency set. A live assignment retains its audit.
SAM segmentation events retain their generated overlay/masks; depth events retain
the input SAM mask independently from their generated depth result.

## Immutable request identities

`RequestIdentityArchives.archive(requestKeys, expectedSequence)` accepts supported
original request keys, their current global sequence and confirmed terminal/released
sources. It validates the complete selection before writing immutable records under
`archived-request:`. Each record stores the original request key, version, admitted
input and archival time. Its original journal request remains available until explicit
retirement. The archive reserves the identity independently from source history.

Archival uses durable journal appends. An interrupted batch can leave a completed
prefix of archives; all original history remains. Repeating the operation validates
existing archives and completes the remaining identities. Archives cannot be rewritten
or selected for retirement. Session/task replay and legacy run admission reject archived
identities, including after their source history has been deleted and the application
has restarted. No archived identity allocates a model Session or physical environment.

An unarchived original request protects its source history. Once archived, the retained
archive protects identity reuse and the original request can join the selected history
graph. Every remaining journal dependency, SKILL source and leased external source still
blocks deletion of its referenced records. Archives retain historical identifier values
without granting source-data access.

## HTTP and console

The console's **Closed session history** controls list only sessions whose resources
are confirmed released. It shows profile, creation time, task count and record count.
Selection changes invalidate the displayed deletion preview. The delete button requires
a successful current preview and submits that preview's single-use token.

| Route                                | Input                              | Behavior                                                                  |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------- |
| `GET /api/storage/retention`         | No query parameters                | Ownership capability, current sequence, blockers and eligible sessions    |
| `POST /api/storage/archive-requests` | `{ sessionIds, expectedSequence }` | Preserve request identities for the selected closed sessions              |
| `POST /api/storage/inspect-records`  | `{ sessionIds }`                   | Capture exact selected record revisions and the complete reference graph  |
| `POST /api/storage/retire-records`   | `{ token }`                        | Recheck versions/references and atomically retire the inspected selection |

Inputs are strict. A selection contains 1–64 distinct session identities. Invalid
input returns 400; active admission or conflicting/stale references return 409;
unconfigured record ownership returns 501. Archival requires the inspected global
sequence. Deletion requires a current token and consumes it on every attempt.
Selected history includes published session tasks and their events, native audits,
plans, files, clarifications, reports, recovery and evidence metadata. A related source
outside the selection causes inspection to refuse deletion. Source history is never
expanded into additional sessions implicitly.

Retirement publishes the existing synchronized journal checkpoint and updates the
SQLite history index through its store observer. Restart reconciles SQLite from the
authoritative journal. Original image objects remain available until their separate
reference inspection and explicit collection operation. Every returned success requires
the underlying journal operation to complete.

## Actual retained-history acceptance

`scripts/check-retained-storage.ts --data-directory <retained-directory>` copies an
actual journal into a private ignored workspace and validates all namespace owners.
`--retire-private-copy` additionally checks request protection, stale archival input,
explicit archival/preview/retirement, token replay rejection, SQLite reconciliation,
and archived request rejection after reopening. SHA-256 confirms that the original
journal remains unchanged. Acceptance outputs stay beside each private copy.

`--native-binding` validates the production native payload inspector and owned export
leases. Without this option, the private acceptance policy conservatively declares
every original journal record as a payload source. That complete-source declaration
is confined to the private copy. No model or provider executes during these checks.
`--native-binding --retire-private-copy --session-id <retained-session-id>` selects
one existing session while preserving other sessions and their restart history.

Verified original histories include native custom-role recovery/success (918 selected
records, two retained identities), recorded SAM/YOLO grounding and five clarifications
(859 records, nine identities), native BEHAVIOR active observation with an assignment
file and clarification (141 records, two identities), and Qwen/Pi0.5 workflow history
(658 records, four identities). An actual Chrome DOM check through the production HTTP
server completes selection, archival, inspection and deletion of the private custom-role
copy with zero browser errors. The owned browser/server close after validation.

These checks establish storage/reference behavior for those retained histories.
The native binding additionally passed the current RoboDojo v1 journal: 626 selected
records, two preserved request identities, and reconciled restart history.
Independent session selection also passed the four-session grounding journal:
455 selected records were retired while three other sessions remained available
after reopening. Native generated source identities and explicit journal addresses
declare text references; benchmark criterion names remain scoped task metadata.
The default native factory also passed the Chrome DOM history and image lifecycle
against a private journal and attachment copy: 626 retired records, two reserved request
identities and 180 explicitly collected image objects (69,077,537 bytes). The original
journal and all 180 original image SHA-256 values remained unchanged. The owned browser
and local HTTP server closed after validation.
Provider task success and image-byte integrity retain their independent evidence.
Incomplete stored verification boundaries, missing source catalogs, undeclared custom
references and external reference leases require complete source declarations before
their histories can pass deletion admission.
