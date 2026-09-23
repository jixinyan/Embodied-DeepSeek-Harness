# Implementation progress

Spec: v1.55. Current checkpoint: **live model, worker and three-simulator integration**.
This page supersedes the pre-upper-runtime status at `d1fe6f4`. Historical evidence
remains in Git. [Capability map](features.md) separates working code from targets.

## Current delivery boundary

Active work covers the DSH-backed upper loop, a real physical worker, BEHAVIOR-1K,
RoboCasa, RoboTwin, and actual VLM/policy services. Implementations must preserve
independent role contexts, Planner decision ownership, asynchronous verification,
ActionGate admission and verified recovery experience. The
[live integration acceptance plan](live-integration.md) distinguishes provider
installation, native execution and complete application acceptance. No new live
integration is considered verified until its actual checks pass.

RoboCasa 1.0.1, robosuite 1.5.2 and MuJoCo 3.3.1 are installed in an isolated
Python 3.11.16 environment on the GPU host. All 139 installed distributions pass
dependency consistency. A real MuJoCo check advances 100 physics steps and renders
a nonuniform RGB frame using the NVIDIA GPU. GLVND libraries use a deployment-owned
prefix; system Python, global libraries and drivers remain unchanged. Node.js and
pnpm also use a dedicated prefix, and remote TypeScript checking passes.
The installation checker reports Python isolation and actual renderer identity. Vendor
assertions are optional; device selection comes from the deployment environment.
An explicit GPU 1 selection passes the same native rendering check. Shared runtime
code has no host path, GPU model or CUDA device binding. Other GPU models remain
unverified. The `489edc3` checkpoint passed GitHub Framework checks.
The official kitchen asset downloader completed successfully. A real RoboCasa
`OpenCabinet` task reset passed with PandaOmron, the pretrain split and seed 0.
Three native 256 × 256 RGB camera observations passed shape, type and nonuniformity
checks; the checker recorded the task instruction, initial success value, 12-dimensional
action limits, controller layout and 20 Hz control frequency. The native RoboCasa adapter
and ActionGate device now also pass actual manual-control checks: pause and resume,
budget exhaustion, consecutive executions within one retained scene, and interruption
of an action sequence with stable simulation time after confirmed stop. Actual completed
actions and internal physics steps are recorded on the simulator owner thread, including
when an asynchronous caller is cancelled. These checks use explicit manual controls.
Learned-policy inference, worker transport and end-to-end task acceptance remain pending.
[Deployment isolation, source pins and actual checks](gpu-integration.md).

RoboTwin's pinned SAPIEN renderer passes native GPU rendering and 100 physics
steps on the allocated device, with matching reported PCI identity. Its actual
task reset and learned-policy control remain pending. The selected RoboTwin pi0.5
checkpoint and processor weights are downloaded under `checkpoints/`; their
SHA256 values match the fixed upstream revision. All three simulators use dedicated
`data/` directories, and RoboCasa's native reset/render checks pass after relocation.
RoboCasa camera preprocessing matches the official evaluation wrapper exactly:
all three decoded EDH PNG arrays pass numerical equality against the same native
reset observations. Actual learned-policy inference remains a separate gate.

An isolated Qwen VLM served by vLLM now passes actual image/tool checks on an available
GPU. Native API completion returns `tool_calls` followed by `stop`. Independent native
DSH Planner and Verifier sessions each call one camera tool, receive the actual RoboCasa
image attachment and finish with `turn/end=completed`. The checks validate matching
call/result identifiers and image identity. They use a static native reset frame;
model-driven robot execution and formal GT verification remain pending.
[Live VLM evidence](gpu-integration.md#live-vlm-image-and-tool-checks).

The latest upstream DSH release review targets `dsh-v0.1.7-rc.1`
(`46a7f68b0922371ce7144b668b90e377d8e799f4`, 2026-09-23 prerelease).
Serial agent initialization, output-aware compaction, cancellation records and nested
secret redaction are implemented with exact source provenance. Native initialization,
disposal, HTTP cancellation, secret traversal and budget-admission checks pass.
An oversized initial or dynamically selected output cap fails before HTTP transport;
disabling automatic compaction retains direct transport behavior. Actual GPU VLM
image/tool checks also pass with native context management enabled at `1a571e2`;
these short rounds do not exercise automatic summarization. The complete GitHub
Framework checks pass at `4b1fd1d`, including all 387 runtime checks. The
[release adaptation guide](dsh-release-adaptation.md) records the model, image and
stored-history compatibility boundaries and required acceptance checks.

RunEventReferences declares event and message dependencies using the existing domain
readers. It covers delegation, observations, reports, verification, recovery pages,
clarification identities and versioned custom reference inspection. The same inspector
composes with legacy inline run history. Forty-nine retention checks pass using authored
documents and actual journals, including compaction and reopen. TypeScript and changed
source formatting pass. No model or physical provider executes in these checks.
The preceding `81e6e90` checkpoint passed GitHub Framework checks.
[Event source rules](domain-retention.md#event-and-message-owners).

The user has authorized GPU-host inspection and simulation integration. The next delivery
priority is a real simulator-to-console workflow through the existing policy transport
and action gate, with explicit environment, embodiment and checkpoint compatibility.
BEHAVIOR-1K, RoboCasa and RoboTwin remain required targets. Complete simulator preparation,
worker integration and real provider acceptance are pending. Remaining upper retention
owners and reviewed deletion admission remain tracked separately.

Three run owners now declare the run projection, configuration and restart annotation
dependencies. Published events, typed task sources, exact sensor snapshots, selected
historical task context and same-session ownership are checked. Nonempty legacy inline
events require versioned payload reference inspection. Forty-two retention checks pass
using authored documents and real journals, including 130-event history, missing or
rewritten sources, configuration conflicts, membership migration and reopen. No model
or physical provider executes. Event/submission/plan/file/clarification/native-audit
owners, archived identity lifecycle and reviewed host/console admission remain pending.
[Run source rules](domain-retention.md#run-configuration-and-restart-owners).
TypeScript, changed-source formatting and 577 local documentation links pass. The
preceding `546be3e` checkpoint passed GitHub Framework checks.

Three task owners now declare assignment archive, recovery and recovery-event sources.
Brief facts, last observations, callers, reports and verification contexts retain their
explicit dependencies. Recovery retains accepted failed/successful verdicts and every
published event index/source, with original-goal, actor and immutable-version checks.
Pending recovery and explicit legacy inline sources remain inspectable. Thirty-four
retention checks pass using authored documents and real journals; no model or physical
provider executes. The preceding `a957c9c` checkpoint passed GitHub Framework checks.
TypeScript, changed-source formatting and 574 local documentation links pass.
Event/submission/plan/file/clarification/native-audit owners, archived identity lifecycle and
reviewed host/console admission remain pending.
[Task source rules](domain-retention.md#assignment-and-recovery-owners).

Four report owners now declare sender/recipient, evidence, history and receipt
dependencies. AssignmentReports validates persisted shapes, immutable archives and
receipts, latest logical/CAS versions and predecessor identity/status. Retention and
history readers share that predecessor check. Current-only legacy report sources
remain readable. Twenty-five retention checks and seven report-history checks pass
using authored documents, real journals, HTTP and constrained-heap processes. No model
or physical provider executes. Complete event/submission/plan/file/clarification/audit ownership,
archived identity lifecycle and reviewed host/console admission remain pending.
[Report source rules](domain-retention.md#report-and-receipt-owners).
TypeScript, changed-source formatting and 571 local documentation links pass. The
preceding `068fca2` checkpoint passed GitHub Framework checks.

Five evidence/verification owners declare sensor metadata, stopped boundaries, formal
contexts and verdict dependencies. They reuse existing scoped readers, validate exact
verifier/context/fact agreement and protect archived assignment sources. Shared image
reference validation is exported by perception and reused by ownership inspection.
Nineteen domain-retention and eight sensor-record checks pass with real journals, the
project PNG and authored documents. No model or physical provider executes. TypeScript
and changed-source formatting pass. The preceding `c4e12aa` checkpoint passed GitHub
Framework checks. Complete event/submission/plan/file/clarification/audit ownership, archived
identity lifecycle and reviewed host/console admission remain pending.
[Evidence ownership and acceptance](domain-retention.md#evidence-and-verification-owners).

Session/request retention now has seven explicit namespace owners. They cover open
requests, task requests, task catalogs, published membership and reverse run ownership.
SessionTaskHistory enumerates complete published history with immutable identity and
position checks, including missing intermediate records. Legacy inline histories remain
readable. Retained request records continue to protect replay sources. Fourteen domain
retention checks pass using authored documents, real journals and file locks. Event,
submission, plan, file, clarification and audit ownership plus reviewed host/console
admission remain pending. [Owner inventory](domain-retention.md#session-and-request-owners).
Seven session-history and seven request-replay checks also pass, including 2,000
stored task memberships, SQLite history consistency and journal reopen. TypeScript,
changed-source formatting and local documentation links pass. The preceding `1ac9e40`
checkpoint passed GitHub Framework checks; live model/provider acceptance remains separate.

DomainRetention accepts versioned record owners and leased external reference sources.
It checks every declared edge, retains SKILL provenance and durable request identities,
requires closed/released sessions, and binds atomic deletion to a single-use preview.
Unknown owners, incomplete sources, changed revisions, retained incoming references
and concurrent operations fail. External leases remain held through journal publication.
Eight actual journal/file-lock checks pass, including cancellation, source changes and
reopen. No model or physical provider executes. A complete EDH ownership policy, host
idle admission and console selection remain pending.
[API, ownership responsibilities and acceptance](domain-retention.md).

Shutdown acceptance uses a real native pre-step cancellation and an actual journal
write hold to check retirement cleanup and deduplicated audit failures. No model
adapter is registered for that check. Budget rejection asserts the structured
ContractValidationError and offending field. These checks do not establish live
model/provider task acceptance.

SKILL source inspection now reads every published recovery event index and its source
run event individually. Returned dependencies include their keys/versions. Missing
indexes or event bodies mark the source incomplete; rewritten versions, unordered or
unpublished references and conflicting event identities fail. Inline recovery/run
histories remain readable with exact event-body agreement. Unpublished suffixes are
excluded. Existing image-retention admission therefore requires intact recovery
history alongside verdict, session and sensor sources.

Fifteen provenance checks and eight image-retention checks pass using authored
documents, actual journals, image files and HTTP. New checks exercise actual record
retirement, reopen, missing intermediate records, conflicting references and inline
source formats. TypeScript and changed-source formatting pass. No model or physical
provider executes. [Source inspection rules](skill-provenance.md). Domain retention
still needs a complete built-in record ownership policy and reviewed console admission;
these references alone do not authorize deletion.

Tool inventory validation compares all implemented logical IDs against `CORE_TOOLS`,
including `user.ask`, before checking role references. Generated-schema equality and
all six authored wire documents, roles/team/tool references and rejection checks pass
through `pnpm check:contracts`. This establishes structural consistency; live runtime
acceptance remains separate.

LocalStore now supports explicit batch retirement under a current global sequence.
It validates the selected keys, preserves retained values/CAS versions/order, and
publishes one synchronized checkpoint atomically. Retirement advances the global
sequence once. V2 checkpoints preserve sequence accounting after deletion, including
an empty store; headerless journals and v1 checkpoints remain readable. Write holds
and observer mutation guards cover retirement. The workspace SQLite index reconciles
removed records and ownership after publication; an index failure stops the writer
and is recovered from the durable source on reopen.

Twenty-seven storage/admission checks and fourteen workspace journal/SQLite/HTTP/process
checks pass. New cases cover stale/missing/duplicate selections, empty-store restart,
corrupt/incomplete v2 checkpoints, actual SQLite contention, actual process termination
and more than 96 MiB of journal input under a 64 MiB V8 old-space limit. No model or
physical backend executes. This is a trusted storage primitive with no HTTP deletion
route. Domain ownership, preserved request identities, SKILL-source closure, external
reference leases and reviewed console selection remain required for application
retention. [Retirement API, format and acceptance](storage-maintenance.md#record-retirement).
TypeScript, changed-source formatting, 128 pinned DSH source checks and 551 local
documentation-link checks pass. Domain retention admission and interrupted-session
continuation remain open alongside live provider/model acceptance.

Upper model configuration now loads YAML/JSON for cloud OpenAI-compatible APIs and
vLLM servers. One configuration can contain both, with stable role aliases, explicit
environment credentials or unauthenticated access, image capability/capacity declarations
and endpoint request options. Assembly reuses the existing native adapter and image service.
Unknown fields/routes, conflicting capabilities and missing credentials fail before
inference. Credential rotation remains private; endpoint/request configuration contributes
to deployment admission identity and recorded HTTP/run metadata.

Seven configuration/native-service checks use actual files, environment lookups, DSH
registration and attachment services. They cover both hosting modes, authenticated vLLM,
the project PNG's request-image path and byte-limit rejection before network dispatch.
No generated model response or physical backend executes. Live cloud/vLLM inference
and complete task acceptance remain pending, as requested until services are available.
[Model configuration API and examples](model-configuration.md).
TypeScript, formatting, pinned DSH source verification and 547 local documentation
links pass. Domain retention admission remains the next upper capability.

The desktop application selects a versioned local launch configuration, executes its
trusted deployment factory in a fresh owned process and opens the existing console.
It reuses `startServer`, tsx runtime aliases and the checkout's installed dependencies.
Configuration paths, optional environment-file loading, remembered selection, loopback
readiness, output inspection and graceful stop/quit are implemented. A startup failure
remains visible and a subsequent launch waits for the prior child to exit. Unexpected
exit never certifies physical resource release. The local application package includes
Electron/Node and uses an external prepared checkout. Signed distribution remains open.

Six actual file/process checks and one actual Electron DOM/IPC check pass. They cover
path validation, secret-free configuration metadata, missing module exports, repeated
launch, startup cancellation, saved selection and isolated window capabilities. These
checks execute no model or physical backend. Successful live deployment startup,
console task execution and provider cleanup still need acceptance with configured
services. [Launcher configuration and ownership](../../apps/desktop/README.md).
The macOS arm64 application builds successfully, and the same DOM/IPC acceptance
passes against both development Electron and the packaged executable. TypeScript,
formatting, 128 pinned-source checks and 533 local documentation links pass.

Follow-up work prioritizes missing upper-runtime capabilities before retrieval,
performance or appearance refinements. Live model evaluation is deferred until a
service is available. Domain retention, interrupted-session continuation and actual
provider discovery/execution acceptance remain open.

New sessions capture a task catalog from registered deployment definitions or the
allocated environment's `describeTasks`. The host validates complete task definitions,
stores immutable ownership/revision/content records and publishes a compact descriptor.
The console reads that session's tasks and criteria, disables submission during failed
or pending reads, and confirms the catalog digest on submission. Backend task creation
receives the selected definition and digest. Startup validates retained catalogs without
allocating providers. Four authored catalog/journal checks, fourteen task/session request
checks and twenty-five console checks pass (43 total). The console catalog check uses
actual HTTP and stored documents. TypeScript, formatting, pinned-source provenance and
523 documentation-link checks pass. No model or environment allocation executes in these
checks. Actual provider discovery/task execution, catalog scale limits and full console
acceptance with those providers remain open, alongside upper lifecycle/retention.
[Catalog interface and acceptance](session-task-catalogs.md).

Configured and Planner-created goals use complete GoalBinding validation. Entity maps,
capabilities, task semantics, identity and configuration are checked alongside the shared
wire success-condition and budget definitions. Construction, preparation and batch admission
enforce the 64-goal task limit; existing bindings are immutable. UpperRun prepares validated
goals before its plan journal write, then admits detached copies. Invalid batches leave
the catalog unchanged. Four authored document/journal checks and seven task-admission checks
pass. TypeScript, formatting, pinned-source provenance and 513 documentation-link checks
pass. No model or physical provider executes. Provider-backed criteria discovery, live-model
acceptance and upper-runtime lifecycle/retention work remain open.
[Goal admission API and tests](../../harness/agent-runtime/tasks/README.md#goal-binding-admission).

`skills.load` accepts optional section names and returns selected Markdown with full
metadata, included/omitted section lists and source/returned byte counts. Preamble,
applicability, limitations and source accompany every selected read. CommonMark parsing
preserves nested content and reference-link targets, including definitions in omitted
sections. Complete stored/exported SKILL documents remain unchanged. Built-in Planner
and Verifier prompts describe focused reads; the extension interface exposes the same
selection types. Six actual document/journal/native-tool checks and eleven provenance
checks pass. TypeScript, formatting, pinned-source provenance and 508 local documentation
links pass. These checks execute no model or physical provider. Semantic ranking,
live agent retrieval decisions and upper-runtime lifecycle/retention work remain open.
[Section API and acceptance](../../harness/agent-runtime/memory/README.md#selective-section-reads).

Formal verification admission persists the original stopped status under a run,
execution and boundary identity. Continuous paused updates reuse that admission only
while preserving stopped facts. New stops and terminal transitions require fresh
identities; different executions may use the same boundary label. Publication failures
and identity conflicts propagate through the existing run failure/stop path. The service
has no separate resident history collection; LocalStore key-index and disk growth
remain open. Authored protocol documents and actual journals verify admission semantics;
live model/provider ordering and device stop acceptance remain separate requirements.
Seven boundary-admission, four verification-context and ten native role-lifecycle
checks pass (21 total). TypeScript, formatting, pinned-source provenance and 506 local
documentation-link checks pass. No model or physical provider executes in this checkpoint.
[Boundary rules and tests](verification-boundaries.md).

Accepted verification results are archived before their summaries enter run state.
Summaries preserve identity/status and a bounded explanation preview; Planner decisions,
assignment inspection, selected task context and SKILL provenance resolve full records.
The console loads one accepted result at a time with explicit selection and refresh.
Six actual journal/HTTP/process checks cover publication, immutability, scope,
missing/conflicting records and more than 100 MiB of authored verdict documents under
a 64 MiB V8 old-space limit. Nine assignment-history, seven task-admission and eleven
SKILL-provenance checks pass, alongside 24 console checks. No model or physical
provider executes. Browser DOM checks using production controls/readers cover selected
full results, literal HTML text, refresh, missing-record errors, empty selection and
close. TypeScript, formatting, pinned-source provenance and 500 local documentation
links pass. Cumulative summary metadata, domain retention and live provider
acceptance remain open. [Verdict history semantics](verdict-history.md).

Session records hold task count/latest identity and publish immutable per-task
membership records. Startup migrates legacy arrays while preserving their order and
configuration. Task admission/replay and SKILL source inspection read selected
memberships; missing SKILL membership is incomplete and conflicting records fail.
Seven actual journal/SQLite checks cover migration/reopen, publication order,
interrupted writes, stale source/head conflicts, indexed history/replay and 2,000
memberships in one compact session record. Six task-admission, ten SKILL-provenance,
seven session-request and twelve workspace checks cover the connected source paths.
The workspace pressure case still traverses over 100 MiB under a 64 MiB V8 old-space
limit. Twenty-four console checks, TypeScript, formatting, provenance and 490 local
documentation-link checks pass. No model or physical provider executes. Distinct-key/disk retention, cumulative
active run metadata and real provider lifecycle acceptance remain open.
[Task membership semantics](user-sessions.md#task-membership-history).

Session opening resolves repeated request IDs through immutable journal identities
and reads only the matching source session. Profile, deployment digest and the full
serialized configuration must agree. New admission publishes the session and request
identity before calling its environment factory. Startup reconciles missing identities,
rejects duplicate/conflicting sources and interrupts unfinished sessions without
activating resources. Seven actual journal/document checks and five task-admission
checks pass. Twelve workspace checks include more than 100 MiB of authored documents,
32 repeated old/new request lookups and full history traversal under a 64 MiB V8
old-space limit. No model or physical provider executes in these checks. Startup
source traversal, distinct request-key growth and provider-backed lifecycle acceptance
remain open. [Session request semantics](user-sessions.md#session-open-request-identity).

The Assignment inspector reads formal-check contexts, source observations and accepted
verdicts together. Waiting for facts, saved checks and settled verdicts have distinct
statuses; an accepted unknown result remains unknown. Scope, request, execution,
boundary, criteria, native role identity, facts and evidence references must agree.
A published-context marker survives assignment archival and makes missing records
explicit. UpperRun rejects further check publication after a formal verdict settles.
Nine actual assignment journal/HTTP/process checks, four context checks and ten native
lifecycle checks pass, alongside 24 console checks. TypeScript, formatting, source
provenance and 478 documentation-link checks pass. Browser DOM acceptance through
the production reader covers waiting/checked/unknown states, literal text, role changes,
missing-context errors, refresh, empty selection and close. These checks use authored
documents; live model/provider verification remains required.
[Inspection API](assignment-history.md#read-api-and-console).

VerificationContexts stores check identities, scopes, facts and evidence references in
versioned records. Its active registry retains only assignment IDs and record versions;
UpperRun releases them on native retirement and after task shutdown drains. Referenced
observations remain available through SensorSamples. Reopening retains inspection
without reactivating verification. Four actual journal/document checks and ten native
lifecycle checks pass, alongside eight evidence-storage checks. Full live-model/provider
verification, cumulative verdict metadata and domain retention remain separate work.
[Verification context ownership](../../harness/agent-runtime/verification/README.md).

WorkspaceHistoryIndex stores source-bound summaries in SQLite and updates them after
durable source writes. Ordered/scoped queries read at most 33 candidates and return at
most 32 summaries with a 256 KiB page target. Pages read no full source bodies; one active
session configuration remains an explicit source read. Startup and compaction reconcile
source revisions. Real SQLite lock failures stop admission after source publication and
recover on reopen. Source file changes and corrupt summary reads fail explicitly.
Twelve actual journal/SQLite/HTTP/process checks pass, including over 100 MiB of authored
documents indexed and traversed under a 64 MiB V8 old-space limit. Nineteen storage checks
cover source revisions/observers, file identity, compaction and recovery. Remaining
cumulative run metadata, startup costs and domain retention still need lifecycle work.
[Workspace history API and acceptance](workspace-history.md).

Retired assignment details are stored and read back before releasing their full brief,
TODO/report bodies, last observation and stream from the run projection. TeamSessions
uses a verified archive reader after native cleanup. The console reads selected role
details, historical TODOs and observations explicitly. Seven actual file/HTTP/process
checks and nine native lifecycle checks pass, including over 100 MiB of authored brief
documents under a 64 MiB V8 old-space limit. Compact metadata and remaining cumulative
run collections still need lifecycle limits. [Assignment history](assignment-history.md).

Role-report queries and the console inspector read bounded published-version pages.
Agents select earlier receipts and optionally load their report bodies through
`team.query`; native input validation keeps those controls optional. Acknowledgement
and startup reconciliation traverse stored reports individually. Seven actual
journal/HTTP/process checks pass, including report history exceeding 100 MiB under a
64 MiB V8 old-space limit. Retired report bodies are omitted from run updates and remain
available through explicit report inspection.
[Report API and remaining costs](report-acknowledgements.md#bounded-history-reads).

Planner `user.ask` persists a scoped question and concludes its native DSH turn.
Accepted answers are immutable, retain retry identity, and return to the same Planner
through native followup after the asking turn becomes idle. Execution must be absent
or confirmed stopped before asking; continued motion requires an explicit Planner
decision. The console preserves drafts and shows response/delivery status. Native/file,
HTTP and browser component acceptance is available; live-model/provider continuation
remains required. [Interaction guide](user-clarification.md).

Native audit publication and delivery-error inspection read the original DSH event
sequence directly. Published audits bind their native Session identity, and adopting
older unbound histories validates every published event. Audit export holds individual
event bodies. Native Session history now releases older resident event bodies after
verified publication, retaining absolute event identities and archived reads. Default
checkpoint limits are 256 events and 8 MiB of encoded bodies. Eleven native/file/process
checks cover this path, including an active Session storing over 100 MiB under a 64 MiB
V8 old-space limit. Active model surface and application projections have separate costs.
[Residency policy and acceptance](session-history.md).
[Publication semantics](session-audits.md#native-publication).

Native role retirement removes Agent/Session registry entries, includes scoped-cleanup
events in the final audit, and releases assignment evidence permissions. Creation
publication failures also dispose acquired handles. Late grant extensions fail, and
cleanup errors remain observable at shutdown. Nine native/file lifecycle checks
exercise this behavior without a model or physical backend. Active-context and retained
application-history limits remain open. [Lifecycle guide](assignment-lifetime.md).

Configured image retention connects original-image reference inspection and collection to
idle server admission and the console. Configured reference sources hold their own
images, journal writes pause during inspection/deletion, and every SKILL source and
stored session resource state is checked. Complete external ownership is a deployment
responsibility; unresolved resources or source records block collection.
SKILL source inspection uses recorded recovery ownership,
accepted failure/success verdicts and run/session/evidence/image references. Missing
source records are explicit; conflicting records fail. Bounded assignment/event audit browsing, image inventory,
explicit request-cache cleanup, atomic journal compaction and idle-only console
maintenance remain available.
Application-owned image storage and scoped HTTP reads support the observation renderer.
Durable evidence, paged history and incremental
transport support upper-first integration. Model/policy adapters and standalone action
admission are described in the [adapter guide](model-policy-adapters.md).
`pnpm demo` starts a local console at `http://127.0.0.1:4317`. A scripted model emits
native DSH tool calls; a CPU fixture backend supplies labeled synthetic observations
and execution states. This validates orchestration, not model intelligence or robotics.

The console now uses a unified workspace for agent activity, TODOs, sensors, execution,
verification and recovery. Desktop panels remain visible together without tabs; smaller
screens stack sections and long content scrolls. See the [console guide](../../apps/console/README.md).

## Implemented and exercised

| Area                | Current behavior                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context management  | Opt-in native compaction/token estimates, embodied summaries, scoped authoritative context and audited maintenance                                                                                                |
| DSH runtime         | Original loop, native tools/validation, model services, scoped sessions, inbox/followup, cancellation and cooperative timeout plugin                                                                              |
| Teams               | YAML/ROLE.md preflight, frozen configuration, explicit model/tool bindings, independent assignment contexts, completion at quiescence and retained report identity; concurrent duplicate admission rejected       |
| Communication       | Versioned role reports/query, configured result schemas, explicit briefs, authenticated caller identity from tool scope, delegation/send/context exchange, evidence grants, native DSH delivery and audit exports |
| Tools               | Native tool API, role exposure and owner checks; trusted custom native tools share run lifetime and activity tracking                                                                                             |
| Planning/files      | Original DSH TODO; versioned dependency plans, immutable executed/final criteria, registered subgoal checks, owner-selected goals and private files                                                               |
| Execution boundary  | Replaceable EmbodiedBackend port, nonblocking fixture jobs, budgets, pause/confirmed fixture stop and owner-only resume                                                                                           |
| Verification        | One independent monitor assignment per running segment, cancellation/retirement at pause/end and fresh mandatory formal verification at execution boundaries; unknown cannot become success                       |
| Recovery            | Formal failure followed by Planner replan/retry opens one recovery and Evolver; explicit progress batches continue until original-goal success                                                                    |
| Experience          | Versioned SKILL export/search/load; failure signals, possible causes, avoid rules, success/verification guidance and provenance; fixture skills labeled and separated                                             |
| Persistence         | Single-writer CAS journal, fsync, integrity checks, torn-tail recovery, separate immutable events and run projections; read-only historical session audits                                                        |
| Deployment assembly | Explicit task presets, native DSH model aliases/adapters, tools and backend factories; preflight, source checks, configuration-bound requests and historical snapshots                                            |
| Server/console      | Local HTTP/SSE, request admission deduplication, one active run, reconnect snapshots, history/restart interruption, output/tool/TODO/brief/recovery inspection                                                    |

## Acceptance and limits

Local environment: Node 25.4, pnpm 11.19.0, Python 3.14. CI uses Node 22/Python 3.11.
The complete check command is `pnpm check`.

Earlier CPU acceptance included 89 runtime tests and shared TS/Python cases using
explicit fixtures. Those results document orchestration behavior; current image and
storage acceptance uses actual files, HTTP sockets and authored documents:

- Historical runtime coverage: original DSH seams, native tool schemas/timeouts, custom-role
  isolation and extensions, storage/configuration, full recovery, unknown/error,
  pause/resume/cancel, HTTP/SSE/idempotency, deployment admission and interrupted restart.
- 256 shared wire/lifecycle/physical-boundary cases in TypeScript and Python,
  plus non-JSON rejection tests; generated contract types match the schema.
- 17 Python policy/action-gate tests use real localhost WebSockets and CPU devices.
- 128 pinned DSH source files and 25 referenced module bindings verified.
- Formatting, strict TypeScript, public English/local links, Python imports and SVG
  XML checks pass. Tests use fixtures; no live model, GPU policy or robot is evaluated.

Current focused checks: four verification-context checks, ten native assignment-lifecycle
checks and eight evidence-storage checks pass (22 total). Strict TypeScript, formatting,
source provenance and documentation links pass. The evidence is actual files, native
services and authored documents; no model or physical provider executes.

The workspace-index checkpoint passed twelve workspace-history checks, 19 storage checks and 24 console
tests pass (55 total). Actual HTTP checks preserve cursor, filter and active-record
semantics. The preceding browser component DOM checks cover session/task pagination,
scope selection, separate active metadata and retained task-context selections across
pages. Strict TypeScript, formatting, source provenance and local documentation checks
pass. No model/backend execution or new browser UI behavior is claimed.

The assignment-history checkpoint passed seven assignment-history checks, nine native
assignment-lifecycle checks and 24 console tests (40 total). The console selection check uses real HTTP
and stored assignment documents to exercise cancellation and missing-record errors.
Browser component DOM checks cover selected
archive details, role switching, empty selection and historical TODO/observation reads.
Strict TypeScript, formatting, provenance and structure checks pass. Scripted runtime
tests were not executed for this checkpoint.

The report-history checkpoint passed seven report-history checks and 23 console tests (30 total).
The preceding checkpoint passed eleven native history checks, nine clarification checks,
sixteen native audit checks, eight assignment-lifecycle checks and 23 console tests
(67 total). Prior checkpoints passed eight retention/admission checks,
nine original-image collection checks, 23 image/lifetime/HTTP checks, 16 storage/admission
checks, nine SKILL provenance checks, eight evidence-storage checks and 16 history tests.
Browser component DOM checks cover report-version paging, latest navigation, assignment
selection and empty report history. Earlier checks cover audit
assignment selection, event navigation and empty history; previous checks cover actual
image loading, cache cleanup and journal compaction. TypeScript, formatting, provenance
and structure checks pass. Scripted runtime tests were not executed for this checkpoint.

Remaining: live VLM and sensor-provider acceptance; host-to-Python worker
transport; actual simulator, learned policy, perception and hardware adapters; resource
arbitration/watchdog and real device acknowledgement. Model HTTP transport, policy
WebSocket transport and interruptible action admission are now locally exercised. The upper runner
coordinates plan-selected subgoals and one observing recovery chain at a time.
Concurrent physical subgoals, nested independent recovery chains, distributed delivery
guarantees, resumable DSH sessions, long-horizon evidence/event retention and multi-user hosting remain open. Native model-context
compaction, structured HTTP overflow recovery and whole-message visual retention are opt-in; semantic frame selection and live summary evaluation remain open.
Native delivery completion means session quiescence, not exactly-once business execution.
Cooperative cancellation cannot forcibly stop an uncooperative external device/tool.

## Step status and next implementation sequence

| Step  | Status in this checkout                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00–01 | DSH integration and shared contract acceptance complete                                                                                                         |
| 02–05 | Upper configuration, roles, explicit handoff, plans/files implemented; role result schemas now bind to native DSH validation; distributed delivery remains open |
| 06–07 | Upper port, CPU fixture and standalone action gate implemented; worker/resources/perception providers pending                                                   |
| 08–10 | Upper verification/recovery/experience loop exercised with fixtures; actual provider evidence still required                                                    |
| 11    | Recovery and custom-role CPU scenarios pass; full physical-provider replacement scenario remains open                                                           |
| 12    | Unified debugging console implemented and browser-checked with CPU fixtures                                                                                     |
| 13–16 | Real simulation, release/transfer evaluation and hardware not started                                                                                           |

1. Complete bounded evidence/events and idle/terminal cleanup for the upper runtime.
   Whole-message visual retention now runs through native DSH surface replacement. Evaluate model behavior against an available live
   endpoint; localhost protocol fixtures do not establish VLM task performance.
2. Extend goal/recovery acceptance to longer plans and deployment-specific evaluators.
   Plan-selected sequential goals and prerequisite recovery now run with CPU fixtures.
3. Extend the implemented report acknowledgements/startup reconciliation with durable
   business transactions only where needed; preserve the original DSH inbox.
4. After upper acceptance, connect the policy client/action gate to an owned Python
   worker and the upper EmbodiedBackend port; add resource/watchdog lifecycle and
   state events. Historical sessions must never silently resume physical commands.
5. Bind one actual simulation/policy/perception configuration after worker acceptance.
   Run physical execution, interruption and formal-verification acceptance.
6. Continue console usability refinement as live provider and sensor states become available.

These are follow-on tasks, not claims that all upper components are complete.
Read [extension guide](upper-runtime.md), [plan](plan.md), and decisions
[0003](decisions/0003-reuse-dsh-mechanisms.md) /
[0004](decisions/0004-recovery-observation-and-action-admission.md) before continuing.

## Version checkpoints

- `1d59ff4`: immutable teams and versioned upper-domain storage.
- `a4c0680`: DSH role workflow, formal recovery and explicit Evolver progress.
- `4fad838`: runnable HTTP/SSE console and durable history.
- `e36d210`: native output/tool/TODO observability and separate event persistence.
- `1212ca9`: custom extension lifetime, concurrent assignment admission and isolation acceptance.

Preserve these commits and push verified phase checkpoints. Do not rewrite published history.

## Role-report checkpoint (2026-09-08)

Added framework-provided agent.report and team.query tools. Role-authored result
schemas are loaded within the role root, checked using the original DSH object
schema subset and frozen into the team digest. AgentReport identity/scope/recipient
come from the assignment, not model-supplied fields. Missing-context reports can be
followed by explicit context and a completed result. Final reports are immutable;
exact retry returns a durable receipt without another caller message. Report delivery
state is inspectable and distinct from business acknowledgement.

Fixed a discovered raw ToolDefinition input-validation gap: unlike defineTool, raw
definitions must invoke the native validator explicitly. Upper tools now call DSH's
validator before domain effects and enforce EDH size/version admission limits.
Forged fields and malformed execution/report calls fail without creating physical work.

Twenty runtime tests pass, including actual native report calls and caller model
inputs, schema preflight, missing-context handoff, immutable replay and persisted
reports across restart. No generic dispatcher or agent loop was added.

- `c622252`: versioned role reports, native result schemas, query/receipts and raw-tool input validation fix.
- `77f6b5c`: immutable goal admission and current-verdict planning foundation.
- `0705381`: native plan-selected execution, original-subgoal recovery and independent learning failures.

## Multi-goal foundation checkpoint (2026-09-09)

TaskGoals now admits Planner-authored subgoals from deployment-registered checks,
retains immutable final task criteria and checks formally verified dependencies.
Plan updates retain executed goals and reject stale completion references. Two new
focused tests and strict TypeScript pass. This checkpoint supplies the domain
foundation only; selection and multi-goal execution are not yet wired into UpperRun.

## Multi-goal execution checkpoint (2026-09-09)

The foundation is now connected to native DSH tools. Planner selects admitted goals,
waits for verified dependencies, explicitly authorizes retries and retains per-goal
attempt budgets. Fresh verifier briefs use the selected goal's immutable contract;
stale verifier control is rejected. Final task completion requires the final goal's
latest stopped-boundary verdict and a completed plan.

The multi-goal CPU fixture runs placement failure, Planner replan, verified cabinet
opening, placement retry success and final cabinet closure. Opening cannot authorize
a recovery SKILL; placement success can, even before the final task completes.
Evolver model failures are persisted independently from task outcomes. The console
scenario selector exposes this fixture without changing the provisional layout.

Validation: `pnpm check` passes with 30 runtime tests, 230 shared TS/Python cases,
93 pinned DSH files, strict TypeScript, formatting, Python and document checks.

## Normal-speed audit regression and fix (2026-09-09)

A manual run at the demo defaults (140 ms model delay, 650 ms control ticks) completed
the physical fixture task but failed learning because a whole-session audit exceeded
the journal's 8 MiB per-record bound. The failed run remains preserved as evidence.
SessionAudits now appends individual native events and publishes a count index only
after the event writes. Audit reads reconstruct the same API payload and remain
compatible with historical array snapshots. A partially written suffix stays hidden
until its matching index is committed. This does not resume any model or motion.

The fixture Evolver also writes concise progress notes with event sequence references;
the original handoff and full evidence remain in the run/recovery records. Tests cover
an aggregate audit over 8 MiB, duplicate append, restart/legacy reads, conflicting
suffixes and the exact normal-speed multi-goal scenario. The manual rerun completed
all four verdicts, published one SKILL and returned readable audits with no learning
error. Retention and native model-context compaction remain separate future work.

## Caller acknowledgement and interrupted report delivery (2026-09-09)

Every role now has team.ack_report alongside agent.report and team.query. The native
caller explicitly accepts/rejects a particular published report ID; identity comes
from its assignment, the receipt is immutable, and exact replay emits no duplicate
event. This is a reported assessment, not physical verification or proof of exactly-once
business effects. New report versions require separate acknowledgements.

Report versions retain a published predecessor chain. Unpublished immutable records
cannot be acknowledged. On startup, queued/missing delivery receipts become
interrupted, preserving existing caller acknowledgements and settled/failed records.
No model turn or physical command is replayed. HTTP run projections include report
history, delivery state and caller confirmation, including after restart.

Validation: 30 runtime tests and the full shared contract/check suite pass.
See [report acknowledgement guide](report-acknowledgements.md) for exact semantics.

## Unified console checkpoint (2026-09-12)

The tabbed inspector was replaced with a single developer workbench: history and
agent sessions, goal plans/native TODOs, agent activity, and embodied telemetry.
Desktop sizes of 1440 × 900 and 1280 × 800 and a 390 × 844 mobile viewport were
inspected. Long panels scroll; mobile sections stack without page-wide overflow.
At shorter desktop heights, recovery's header reports its state even when detail
requires scrolling. This is a local fixture console, not a connected robot UI.

Browser checks exercised a new recovery run (failed first attempt, successful retry,
three completed TODOs, accepted verdict and one SKILL), pause/device confirmation,
resume-request submission, stop/read-only history, native TODO history, tool-name
search and full call/result inspection. Actual resumed motion was not separately
asserted in the UI check; runtime acceptance covers Planner-owned resume semantics.
Historical runs and evidence were preserved across preview server restarts.

Display fixes include request-derived budgets, numbered/selectable goals, actual
assignment status, distinct learning failures, source-correct synthetic cabinet
geometry, search empty states and protection against stale history responses.
Search accepts displayed dotted tool names as well as native records. No new agent
loop, backend, transport or simulator integration was added.

Validation: the full `pnpm check` suite passed (30 runtime tests and 230 shared
TS/Python cases); browser interaction checks complement the existing runtime suite.

## Asynchronous provider-read checkpoint (2026-09-12)

The upper EmbodiedBackend port now accepts asynchronous capture and GT checks and
forwards DSH cancellation into provider calls. Formal checks carry the expected
execution/boundary IDs. On return, the upper runner rechecks the current scope,
stopped boundary and device acknowledgement before storing facts or granting
observation evidence. Late cancelled reads cannot update the assignment, and a
late resume acknowledgement cannot resurrect a terminal run.

The immediate `query` method remains a client-side status projection; the future
transport must update it before delivering backend events. No Python worker,
network client, action gate or physical provider was implemented by this change.
See the [execution boundary guide](../../harness/agent-runtime/execution/README.md).

Three new native DSH acceptance cases cover asynchronous successful recovery,
late observation after stop, and stale verification after boundary replacement.
The runtime suite now contains 33 tests. Remaining priorities include deployable
model/backend assembly, storage retention and recovery, and real provider transport.

## Configurable local deployment checkpoint (2026-09-12)

`startServer` now accepts explicit ServerDeployment bindings. CPU fixtures are supplied
by a separate `createDemoDeployment` configuration, preserving `pnpm demo`. Task IDs,
instructions, final criteria, model aliases, native adapters and additional tools are
resolved before admission; invalid metadata/team bindings fail before opening the store.
Backend factories receive shutdown cancellation, and late returned instances are closed
without starting a task. A declared source must match the allocated backend.

Each run stores its public deployment/team snapshot. Request IDs are bound to the
configuration digest; changed configuration cannot silently replay an old admission.
The console reads task presets and source labels from the API, preserves historical
roles/configuration, and labels missing legacy snapshots explicitly. Provider imagery
is not implemented; the synthetic cabinet remains limited to fixture sources.

Validation: `pnpm check` passes with 37 runtime tests, 230 shared TS/Python cases,
93 pinned DSH files and 20 bindings. A browser run of the custom example completed
placement, three TODOs and formal verification. The original seven local demo histories
were preserved and their legacy snapshot labels inspected. See the
[deployment guide](deployments.md) and [runnable example](../../examples/deployments/local-cpu.mjs).
Implementation commit: `6a70456`.

Next: harden long-run retention/checkpoints and restart/shutdown error reconciliation;
bind a live DSH model only when an explicit provider configuration is available.
The server still admits configured task presets, one active run, and one observing
recovery chain. It does not yet accept unrestricted mission text or supply live model,
Python transport, camera rendering, policy, simulator or hardware providers.

## Restart and shutdown checkpoint (2026-09-13)

RunHistory restores only published event prefixes and stores restart annotations
separately. Startup migrates legacy inline history without rewriting the full event
array into one journal record. An ordinary event written before its projection remains
unpublished, including an orphan success event. Restart never replays model or physical
work. Missing published events are reported as corruption rather than silently omitted.

Cleanup now attempts all owned stages even when backend stop/close, session auditing
or host disposal fails. Repeated close calls share completion. Team shutdown drains
late session creation; native handles are disposed even after audit failure. Failed
journal initialization removes only the writer lock acquired by that constructor.
Errors are retained through AggregateError rather than reported as successful cleanup.

Validation: full `pnpm check`, 41 runtime tests and 230 shared TS/Python cases pass.
Acceptance includes a 9 MiB published event history with an unpublished success suffix,
legacy migration and interrupted annotation publication, failing stop plus close,
failed native audits, late native creation, and journal-open failure. Commit `e16c822`.
This fixes failure paths, not retention/compaction or automatic physical recovery.

The user next explicitly prioritizes OpenAI-compatible API/vLLM model bindings and
WebSocket policy client/server adaptation with an action gate before device execution.
Actual simulator/policy checkpoints and hardware acceptance remain separate integrations.

## Model and policy adapter checkpoint (2026-09-13)

- `8c5b473`: OpenAI-compatible adapter using four further pinned DSH serialization,
  SSE and tool translation files; local vLLM and remote compatible endpoints share
  the same native model boundary. Includes tool-result image replay and stream failure tests.
- `ea900b7`: optional WebSocket policy client/server, canonical chunk/segment/receipt/stop
  contracts, deterministic action admission and bounded rollout composition. Seventeen
  Python tests cover socket failures, budgets, stale chunks and pause/resume races.
- `e16c822` / `c11c864`: restart publication integrity and failure-tolerant shutdown
  implementation/documentation remain part of this delivered phase.

Acceptance: `pnpm check`; 44 upper/runtime tests, 248 shared contract cases, 17 additional
Python policy/gate tests; 97 pinned files and 20 bindings. The standalone CPU example
executes four actions, reports a confirmed budget stop and requires formal verification.
The new SVG was rendered and inspected. Public spec is v1.11.

No paid or local VLM endpoint, learned policy weights, simulator or real device was
used. The default console physical backend remains synthetic. The optional model
example can call an explicitly configured API but does not supply real sensor frames.
Next action: implement the host-to-worker execution bridge, device event mapping,
resource/watchdog lifetime and mandatory verifier wake-up using these tested components.
Do not claim that independent adapter tests establish a full simulation MVP.

## Planner perception and native image checkpoint (2026-09-13)

The Planner directly consumes images from perception tools, plans and owns decisions.
Verifier verdicts now carry the actual checked image references and sample metadata
back to the Planner. Async monitors receive native images; explicit optional specialist
handoff preserves independent contexts. Planner/verifier can read granted evidence.
The single-goal fixture observes before planning; this is a native DSH loop, not a
new ReAct implementation.

Added bounded sensor metadata admission and immutable evidence/attachment identity
checks. Raw bytes remain in a deployment-owned attachment store, resolved only for
model requests. A matching resolver and admitted refs are required; no live camera or
new console media endpoint is supplied. Four tests cover capture-to-HTTP image payload,
role isolation, bad metadata/rebinding and Planner image/plan/action/verdict flow.
Current acceptance is 48 runtime tests plus the preceding shared/Python suites.
Next integration remains the host-to-worker bridge, resource/watchdog and real providers.

## Execution authority checkpoint (2026-09-13)

Upper resume now requires a confirmed, admitted pause, a formal result for the exact
boundary and the Planner's native tool call. BackendResumeOptions carry execution,
boundary and state version. An ephemeral matching decision authorizes the transition;
the host no longer treats a backend's knowledge of the request owner ID as permission.
Concurrent resume calls are rejected before dispatch. Missing state acknowledgement
fails the run and requests stop. A newer pause during acknowledgement is preserved.

Provider admission also rejects a replacement execution ID for the same attempt,
foreign observation scope and an over-budget initial status. Six new upper tests
exercise these cases. `pnpm check` passes 54 runtime tests, the existing 248 shared
cases and 17 Python policy/gate cases. See the
[execution provider contract](../../harness/agent-runtime/execution/README.md).
The preceding image-loop checkpoint `02e2fe5` also passed GitHub CI.

Next: the host-to-worker bridge must map resume boundary preconditions to action-gate
control generations, reconcile transport updates and publish actual stop state.
Long-running monitor assignment lifetime and context retention still need refinement;
real simulator/policy and hardware acceptance remain open.

## Monitor lifetime checkpoint (2026-09-13)

Successive frames now continue one independent monitoring assignment through native
DSH followups. The Planner is its caller; goal, request, budget and image references
arrive explicitly. Pending frames coalesce rather than spawning a new agent for each
observation. Pause/end closes admission and requests native cancellation immediately;
formal verification proceeds in a fresh assignment. Resume creates a fresh monitor.
A monitor whose creation finishes after the boundary changes is retired without
receiving stale frames. Final role reports also end their monitor assignment.

TeamSessions retirement retains identity/audits while releasing native handles and
preventing ID reuse. Cleanup is idempotent, attempts final audit after native disposal,
and participates in shutdown error reporting. The console projection records retired
status. No DSH loop or pinned upstream source was changed.

Acceptance adds five tests: 70 observed frames share one monitor; pause cancels an
in-flight model request while a fresh formal verifier runs; resumed monitoring gets a
fresh session; late monitor creation receives no stale frame; and repeated retirement
releases capacity across 66 assignments. The pause/resume assertions share one test. A fifth test reproduces and fixes
self-cancellation of a Verifier-initiated stop acknowledgement: the run now owns and
tracks accepted pause requests independently of the monitor cancellation signal.
Providers still own bounded acknowledgement latency and actual device confirmation.
Full acceptance: 59 runtime tests, 248 shared cases and 17 Python policy/gate tests.
All use local CPU/transport fixtures, not a live VLM, simulator or hardware.

This fixes monitor handle lifetime, not context compaction or every role's retirement.
Long-run context/history budgets and other completed assignments still need bounded
lifecycle work. The host-to-worker bridge, resources/watchdog and provider acceptance
remain pending; do not infer a runnable physical MVP from this checkpoint.

## Completed assignment checkpoint (2026-09-13)

Normal completion now closes new message/domain-tool admission without cancelling
the final native turn. DSH can return the final receipt and output, then the existing
retirement path exports the audit and releases the handle. Shutdown still cancels
in-flight draining work; repeated completion/retirement share cleanup outcomes.
The native turn deadline remains active. No replacement loop or DSH source change.

Final role reports and accepted formal verdicts use this path. Recovery Evolvers
release after a settled success delivery with a published SKILL; failed learning
also retires its session without failing verified task completion. Missing-context
reports remain available, and the Planner stays live for report inspection until
shutdown. Caller query includes whether the assignment still accepts messages.

A late child report to a finished parent remains stored with failed delivery; it
neither reactivates the parent nor grants new evidence. Exact report replay is tested
inside the author's final native turn. The caller can query and acknowledge the
persisted report after handle disposal, and report storage remains idempotent.

Acceptance: 61 runtime tests, 248 shared cases and 17 Python policy/gate tests under
`pnpm check`. Two new tests cover normal final-output draining, repeated completion
across 66 assignments, and shutdown/audit failure while draining. Expanded native
role tests exercise missing context, final receipt/replay, late child reporting and
retired-parent inspection. Multi-goal recovery verifies all non-Planner handles are
released; obsolete live scopes still fail current-attempt authority checks.

Remaining upper work: model-context budgets/compaction, bounded long-run event and
evidence retention, abandoned/idle role policies and terminal task cleanup. The 64
live-session limit remains. Model requests, adapters and all execution
in this acceptance are fixtures/local protocol tests; real provider integration is
still pending. Keep the physical-worker bridge and watchdog as separate integration work.

## Native context management checkpoint (2026-09-14)

The host now optionally mounts absorbed DSH token measurement, basic compaction and
text pruning. The sole native behavior patch is the embodied summary instruction;
loop, transactional replacement, span balancing and cancellation remain upstream.
Deployment policy is immutable and public; automatic mode preflights model capacity
before opening run history. Compaction/usage events appear in the existing console feed.

Native dynamic context refresh restores assignment criteria/limits and scoped admitted
execution state after lossy summaries. Only the decision owner gets the selected goal
and current run state. No other role's conversation, private file or implicit evidence
is shared. Six added tests cover compaction failures/cancellation/continuation, dynamic
context restoration, configuration identity and a completed metered CPU server run.
See [context management](context-management.md) for exact configuration and limits.

An initial full run exposed an SSE connection reset under concurrent test load.
Socket tracing established that fetch reused a pooled connection after the server
idle timeout; no SSE request reached the route. The test now owns a dedicated event
stream connection and drains ordinary responses. It does not retry an uncertain
command. The full 72-test runtime suite passes with the regular concurrency setting.
Remaining work includes HTTP overflow classification, bounded visual/context/evidence
retention, idle/terminal role cleanup and live VLM evaluation. Physical workers and
providers are still pending.

## Provider configuration requirements (2026-09-19)

The upper system is now provider-independent at the profile boundary. `resolvePhysicalRuntimeProfile` validates immutable simulator, embodiment and policy metadata before allocation; role prompt context is injected during team preflight. See [physical profiles](physical-profiles.md). Upcoming simulation profiles target the
latest stable BEHAVIOR-1K, RoboCasa and RoboTwin releases, pinned to immutable source
revisions after an official release audit. R1Pro and arm-focused configurations are
separate embodiment selections, with capability-specific role context and tools.
Do not infer embodiment from simulator name or silently enable navigation tools.

Policy profiles prioritize pi0.5/openpi and GR00T, including fine-tuned checkpoints.
Checkpoint, normalization, camera/state mapping and action conventions must travel
together. Native transports are adapter-specific; arbitrary policy support means an
extensible adapter interface, not that one WebSocket JSON protocol fits every server.
All resulting actions must continue through the interruptible action-admission layer.
Configuration-only switching applies to installed compatible adapters and validated
profiles; it must reject missing providers or incompatible embodiment/action bindings.


## Profile acceptance checkpoint (2026-09-19)

Simulation/embodiment/policy profile schemas now share the contract source. Resolution
rejects placeholders, missing normalization or mappings, unsupported declared
embodiments and differing canonical ActionSpecs. Installed provider validators must
accept SDK-specific settings before any backend allocation or history mutation. No
real robot action dimensions or model compatibility are guessed from release names.

The snapshot reaches scoped role prompt additions, the backend factory and public/
historical deployment identity. Three profile tests and two server tests prove
mismatch rejection, member isolation, immutable snapshots and two synthetic config
selections through a completed DSH task. Eight new shared shape cases pass in both
languages. Official release references and actual remaining integrations are in the
[profile guide](physical-profiles.md); no real provider is marked supported.

Acceptance: full `pnpm check` passes with 72 runtime tests, followed by a passing
shared-contract rerun after adding the profile shape fixtures (256 shared cases total,
plus non-JSON cases and 17 Python policy/gate tests). 122 pinned DSH source files and
25 referenced module bindings pass provenance checks. SVGs are English; the profile
diagram was rendered and visually checked. No live VLM or robot was evaluated.

Next upper work: canonical HTTP context-overflow handling and bounded image history,
then long-run evidence/events, idle-role and terminal-run cleanup. Real providers
remain a separate implementation gate, with Action Gate mandatory between policy
inference and execution. The main goal is still open.


## HTTP context-overflow checkpoint (2026-09-19)

The OpenAI-compatible adapter now classifies explicit bounded JSON context overflow
and passes DSH its canonical error code. It reads at most 64 KiB (or the smaller
configured response bound), retains HTTP status/request identity and never includes
provider error-body text. Malformed/oversized bodies, prose-only matches, ordinary
400/413, auth, rate-limit and server failures do not become context overflow.
Cancellation and deadline remain active during error-body reads.

Three added local HTTP tests cover classification, cancellation/deadline, and the
native loop's success/repeated-error/no-reduction paths. The successful path executes
its scene tool once, summarizes historical context, retries the model request and
retains the original tool audit. A repeated overflow is bounded; a non-shrinking
summary cannot authorize a retry. No new retry loop or upstream source patch.

The console workflow test now uses explicit short-lived HTTP connections and a
dedicated SSE connection. This avoids a same-process test artifact where synchronous
journal writes delay idle-socket handling. A separate test asserts that sequential
API requests reuse the exact same keep-alive socket. No server timeout, production
retry or reduced test concurrency was introduced.

Acceptance: full `pnpm check` passes with 76 runtime tests, 256 shared cases and
17 Python policy/gate tests. Provenance still verifies 122 DSH source files and
25 referenced module bindings. No live model or simulator was evaluated. Remaining upper
work begins with explicit visual history selection, followed by bounded evidence/run
retention and idle/terminal cleanup. Physical providers remain separate. The previous
`ec072b8` checkpoint's GitHub CI is confirmed successful (run 35460671025).


## Visual history checkpoint (2026-09-19)

Optional `contextManagement.visualHistory.maxImages` now bounds incoming model image
blocks through the native pre-step and surface seams. Fresh input and unconsumed tool
images are protected; recent history keeps complete message groups. Older image blocks
become explicit reference markers without changing text, tool identities, evidence grants
or original audit events. Oversized fresh batches fail explicitly before inference.
Configuration is frozen into deployment identity; no upstream loop/source patch.

For a three-camera capture and six-image budget, the Planner receives the two most
recent complete captures. Repeated references still count as separate image blocks.
The console receives correlated visual-maintenance events and keeps original tool
results; replacement copies no longer overwrite tool execution cards.

Seven new runtime tests cover opt-in validation, forty observation batches, isolated
roles, native audit/meter replay, tool images without repeated execution, fresh-batch
failure, native pressure compaction, twenty localhost HTTP requests and upper console
projection. Deployment identity tests also verify the detached frozen visual policy.
Full `pnpm check` passes: 83 runtime tests, 256 shared cases and 17 Python policy/gate
tests. 122 pinned DSH files and 25 bindings still pass provenance validation. No live
VLM, learned policy or simulator was evaluated. Remaining work: bounded events and
evidence retention, idle/terminal cleanup, live VLM evaluation, and later the physical
worker/provider bridge. This is recency-based whole-message retention, not semantic
frame selection or evidence-store garbage collection. Real simulators and policies
remain unconnected; runtime-native persistence/resume remains a separate gate.

## User-session environment ownership checkpoint (2026-09-19)

User sessions now own a retained environment and multiple independent task runs.
Installed launch profiles are preflighted/frozen with role prompts, model bindings and
configuration identity. Native DSH continues to own agent execution. Each task receives
its own backend control scope; normal terminal cleanup drains Evolver publication and
role receipts before releasing that scope. Ending the session cancels active work and
releases the environment. Failed release is recorded as unknown; restart never replays
physical work. Legacy task admission cannot bypass an active session allocation.

Six new acceptance cases cover two-task CPU world continuity and recovery persistence,
rejected second-task port cleanup, active-task session cancellation, late allocation at shutdown, failed-release/restart state and launch preflight/immutable
configuration. The launcher/session guide distinguishes actual behavior from pending
free-form conversation, independent compatible selectors, desktop/service bootstrap and
real simulator/hardware ownership. See [user sessions](user-sessions.md) and the
[legacy migration audit](legacy-migration.md). CPU evidence does not establish robotics
or cross-embodiment transfer performance.


The console now groups runs beneath user sessions and displays the installed profile's
environment, embodiment, policy/checkpoint, model and resource state. New session,
Run task and End session are distinct controls. Workspace experience inspection retains
origin run/session links. Browser acceptance on the CPU preview exercised recovery,
a second task in the same session, session end and experience inspection without browser
errors. Installed profiles provide the authoritative complete configuration combinations.
Implementation ownership checkpoint: `c57106f`.


Validation: full `pnpm check` passes with 89 runtime tests, 256 shared cases and 17
standalone Python policy/action-gate tests (plus the shared Python acceptance classes).
Type checking, 122-file DSH provenance, public language/local links and SVG XML pass.
The new SVG was rendered and visually inspected. No live VLM, simulator, learned policy
or hardware was used. The temporary UI review uses its own data directory and preserves
the existing console history.

## Compatible launcher and branded coordination UI (2026-09-20)

Separate source, environment, embodiment, checkpoint, policy and default-model controls
resolve installed configuration combinations. Parent changes clear dependent choices;
sole valid values are selected automatically. Session ownership locks all six choices.
The same full-combination validator runs in the browser and at server admission, with a
deployment-revision check before environment allocation. Profile-only API callers remain
supported. Resolved per-profile Teams are available for configuration inspection.

The console includes the project logo and a blue/white theme, a locally rendered Mermaid
role graph, assignment-driven role animation, inspectable role/model/tool bindings and
separate observation, planning, execution, verification and experience states. Historical
tasks retain their recorded roles. Full logs, model output, native TODOs and payload
inspection remain available. Reduced-motion settings disable animation. Static asset
delivery restricts public files and installed Mermaid ESM files to their allowed directories.

Validation: `pnpm test:console` passes nine tests for declared catalog constraints,
full-tuple admission, malformed selections and actual static resources/path restrictions.
`pnpm exec tsc --noEmit`, `pnpm format:check`, `pnpm check:structure`,
`pnpm check:provenance` and `git diff --check` pass. Browser component checks use the
production selection controls and Mermaid renderer under the production CSP, with a
repository Team loaded by FileTeamLoader. Checks confirm checkpoint narrowing, dependent
selection updates, session-style input locking, role inspection, SVG nodes and logo loading, with no browser
errors. Catalog examples test selection rules only; no simulator, checkpoint or model was
executed. No end-to-end physical Session claim follows from these checks. The existing
fixture runtime suite was not rerun for this change.

Implementation checkpoints: `26d380b` (shared selection rules) and `64cfc75` (console and admission).

Remaining upper work includes new-criteria admission and active-task clarification,
bounded run/media retention, measured live VLM behavior and desktop/service bootstrap. Real provider
allocation, sensor rendering and the worker/action-admission bridge remain integration work.

## Editable instructions and scoped task history (2026-09-20)

Session task admission accepts a user instruction and explicit same-session history
selection against registered task criteria. It validates allowed presets, input limits,
context ownership and terminal state before allocating a task backend. Saved submissions
include detached goal/context snapshots and source record versions. The entry Planner
receives historical outcomes through its native InvocationBrief; tool evidence grants
and other roles' private contexts retain their existing scope. Request identity covers
the effective instruction and context selection. Replay requires a durable, owned run.
Core checkpoint: `11e08c3`.

The console adds a task composer, criteria/input inspection, actual instruction labels
in history, draft preservation and native browser storage for unconfirmed request IDs.
Changing criteria preserves edited text; resetting to preset text is explicit. Request
acknowledgements cannot clear a newer pending request. A successful run-detail load
releases the pending ID so another intentional task can use the same instruction.

Validation: `pnpm test:admission` passes five checks using the real LocalStore journal
and declared task/history data. They cover immutable criteria, canonical input identity,
invalid input, context ownership, projection limits, detached persistence and durable
request replay. `pnpm test:console` passes nine checks. Type checking, formatting,
DSH provenance, local documentation links and diff whitespace pass. Browser component
checks exercise production composer controls and native session storage: draft retention,
criteria reset, context filtering, session isolation, request retry identity and
acknowledgement ordering. No model or environment execution was performed in this checkpoint.

Remaining: provider-backed discovery of new criteria, active-task user clarification,
bounded event/media retention, live VLM evaluation and local-server bootstrap. These
remain required upper-system work; physical provider integration has separate acceptance.

## On-demand SKILL context (2026-09-20)

Planner and Verifier prompts now specify agent-directed search, applicability review,
selective loading, reuse of available guidance and explicit cross-role handoff. Native
DSH tool definitions describe the distinct search/load/save effects and their limits.
Search continues to return metadata only; load returns the selected immutable SKILL.
Publication persists knowledge without inserting it into other role contexts. The
memory guide and specification Section 8.6 document this context lifecycle.

Validation: the real FileTeamLoader resolves the repository Team and all three role
definitions; the native DSH schema validator accepts all three skill-tool schemas.
TypeScript, formatting, provenance, structure and whitespace checks pass. The existing
five admission and nine console checks pass. No model or physical environment was
executed. Retrieval quality and context savings require live-model evaluation. The
retriever still uses task-semantic keyword matching with a 20-result limit; semantic
ranking, embedding retrieval and section-level loading remain unimplemented.

## Incremental console delivery (2026-09-20)

The console uses an explicit SSE cursor and bounded contiguous event batches. Each
batch has at most 128 events and targets 256 KiB of encoded event bodies; larger
individual events remain atomic. Current projections are delivered when catch-up
completes. Text-only updates reuse browser history and transmit no historical bodies.
The server honors Last-Event-ID, writable backpressure, queued changes and connection
cleanup. Client validation rejects missing/duplicate sequences and conflicting run
identities. Default snapshot subscriptions remain available. Visible event counts
include restart annotations. UpperRun change notifications carry identity/state/time,
removing full-history clones solely for each notification.

Validation: 16 console checks pass, including seven incremental transport cases.
Native Node EventSource reads real HTTP from the production RunEventStream, reconnects
after connection closure and exercises actual write backpressure. Five task-admission
checks pass. TypeScript, formatting, JavaScript syntax, DSH provenance, documentation
links and whitespace checks pass. These checks use authored event documents and real
transport; they invoke no model or physical backend. The existing scripted runtime
suite was not rerun. [Protocol and limits](run-stream.md).

Remaining: bounded journal/browser retention, paginated initial history, retained media
cleanup, provider-backed criteria discovery, active-task clarification, live VLM
evaluation and local-server bootstrap. Physical integration retains its separate acceptance.

## Bounded history reads (2026-09-20)

RunHistory now reads bounded ranges directly from published event records. Initial
console loading fixes an event boundary, requests pages through that boundary and
then subscribes to later updates. Changing the selected run stops additional reads
for the previous selection. The console displays loading progress. SSE projection
construction uses UpperRun.projection plus the requested event page; text-only
updates read no historical event bodies. Explicit full snapshots remain available.
Startup interruption validates pages without collecting another full event array.

The page API preserves detached records, legacy inline data, immutable publication
boundaries and separately stored restart annotations. Unpublished suffixes stay
invisible; invalid cursors and missing requested records fail immediately. The
[stream guide](run-stream.md) documents request fields and remaining memory limits.

Validation: six `pnpm test:history` cases use real LocalStore files for concurrent
append, fixed boundaries, limited reads, UTF-8 size limits, oversized events, restart
annotations, legacy records and reopen behavior. Seventeen console checks pass,
including native HTTP reconnect using partial event windows and absolute cursors.
Five task-admission checks, TypeScript, formatting, JavaScript syntax, DSH provenance,
documentation links and whitespace checks pass. No model or physical provider was
executed; the existing scripted runtime suite was not rerun.

Remaining: cumulative journal/browser retention, media cleanup,
provider-backed criteria discovery, active-task clarification, live VLM
evaluation and local-server bootstrap. Physical provider integration remains separate.

## Indexed journal bodies (2026-09-20)

LocalStore retains latest record locations and integrity metadata; values are decoded
from indexed journal ranges when requested. Startup replay uses the pinned LF reader
incrementally. CAS versions, insertion order, fsync publication, writer exclusion,
incomplete-tail handling and the existing file format remain intact. Read failures
disable further access through that store instance. Writes reject external file-size
changes. Run startup reconciliation, SKILL export and experience search use lazy scans;
search stops after 20 metadata matches.

Validation: six new storage checks cover actual file operations, detached reads,
UTF-8/CRLF positions, blank LF lines, tail recovery, corruption, lazy scans and external
appends. A child process with a 64 MiB V8 old-space limit writes, reopens and scans
128 records whose journal exceeds 64 MiB. Two existing audit checks and two selected
original storage checks pass. Six history, five task-admission and 17 console checks
also pass, for 38 relevant checks. TypeScript, formatting, DSH provenance, structure
and whitespace checks pass. Test data stays under the ignored repository work directory.
No model or physical provider was executed; the scripted runtime suite was not rerun.

Remaining: key-index growth, journal/disk retention, browser history limits,
media cleanup, provider-backed criteria discovery,
active-task clarification, live VLM evaluation and local-server bootstrap. Caller-owned
full list/audit results retain their own memory costs. The storage test does not bound
whole-process RSS or the memory of all application consumers.

## Active event publication (2026-09-20)

UpperRun retains an empty event array and its published count. RunHistory publishes
immutable event records followed by a versioned projection, then advances in-memory
publication state. Complete snapshots reconstruct persisted history; incremental
HTTP/SSE reads retain their bounded page semantics. Event volume has no fixed
task-lifetime cutoff. The agent-authored message admission check uses a separate
delivery counter. Existing runtime history assertions use the explicit snapshot API.

Validation: nine history checks pass against real LocalStore files. Publication failure
leaves the previous count visible, returned bodies are detached, invalid counters fail
before writing, and immutable unpublished records cannot be overwritten. A child with
a 64 MiB V8 old-space limit publishes 4,097 events into a journal larger than 64 MiB,
reopens it and validates every event in pages. Seventeen console checks, TypeScript,
formatting, provenance, structure and whitespace checks pass. These checks execute
storage and transport code; they do not run a model or physical provider. Scripted
runtime tests were updated for explicit snapshot reads and were not executed.

Remaining: key-index/disk retention, media cleanup, provider-backed criteria discovery, active-task
clarification, live VLM evaluation and local-server bootstrap. Full snapshot callers
still allocate their requested history. Physical integration keeps its separate scope.

## Recovery event references and delivery pages (2026-09-20)

RecoveryHistory persists ordered references to published run events and a separate
projection containing the explicit failed-attempt context, result and learning error.
Active recovery observations keep counts and a delivery cursor. Progress pages carry
at most 32 events with a 64 KiB encoded-body target; a larger single event is preserved.
UpperRun reads one batch when native DSH delivery is ready, advances the cursor after
delivery settles, and orders the success notification after pending progress. Incoming
events do not enqueue arrays of event bodies. Learning errors retain the stored trace.

The existing recovery inspection endpoint reconstructs complete history on request,
including legacy inline traces. Evolver instructions describe batch indices, original
run sequences and concise working notes. The multi-goal guide documents storage,
publication, delivery and remaining resource boundaries.

Validation: all 13 history checks and 17 console checks pass. Four new recovery checks
use actual LocalStore journals and authored history documents to cover ordered selection,
fixed read boundaries, detached results, UTF-8 size targets, oversized events, legacy
records, reopening, invalid references, unpublished suffixes and recovery bodies totaling
more than the 8 MiB record limit. TypeScript, formatting, DSH provenance, structure and
whitespace checks pass. Existing scripted runtime assertions now use explicit recovery
restoration and were not executed. Live model delivery, guidance quality and physical
behavior remain unverified by this checkpoint.

Remaining: journal/index retention, media cleanup, provider-backed
criteria discovery, active-task clarification, live VLM evaluation and local-server
bootstrap. Complete inspection responses, native session audits/context and agent working
files retain their own memory/storage costs. No physical provider was added.

## Browser history windows (2026-09-20)

The console initially requests the newest bounded history page at a fixed event count.
Live retention keeps at most 500 events with a 2 MiB encoded-body target and preserves
a single oversized latest event. The absolute received sequence survives eviction and
EventSource reconnects. Projection-only updates preserve the retained array and cursor.

Event log has Earlier events, Later events and Recent events controls, a visible sequence
range and a TODO-updates filter. Historical browsing keeps one bounded page separate
from live activity. Switching tasks or returning to recent events invalidates pending
history responses. Current TODOs, plans and verdicts use projections; recovery status
reads its durable record and remains visible after its events leave the recent window.
The saved-experience indicator follows the selected recovery's skill identity.

RunHistory supports bounded backward reads through `history?before=N`. Forward/backward
parameters are mutually exclusive. Reverse traversal returns ascending sequences,
preserves oversized events and restart annotations, and retains the selected boundary
while later events are published. Recent activity search and TODO shortcuts identify
their scope; earlier records remain available through the event log.

Validation: 15 real-journal history checks and 19 console logic/transport checks pass.
Retention checks cover count and byte limits, absolute cursors, detached history views,
projection updates, invalid windows, and real HTTP/EventSource reconnection with 900
events. Backward history checks cover contiguous traversal, concurrent append, byte
limits, invalid boundaries, missing records, legacy history and restart annotations.
TypeScript, JavaScript syntax, formatting, provenance, structure and whitespace checks
pass. No browser interaction, live model or physical provider execution was performed
in this checkpoint; scripted runtime tests were not run.

Remaining: journal/index retention, media cleanup, provider-backed criteria discovery,
active-task clarification, live VLM evaluation and local-server bootstrap. Event-body
targets do not bound total browser memory, current projection size, full audit/recovery
inspection responses, or oversized individual records.

## Durable sensor metadata (2026-09-20)

UpperRun uses the perception module's SensorSamples catalog for admitted observations
and execution updates. Immutable samples and attachment metadata are stored in the
existing journal under unambiguous run-scoped identities. Exact replay adds no records;
conflicting evidence or attachment identities fail before new publication. Attachment
records precede the sample, so incomplete publication can reserve metadata without
publishing an observation. Reads validate the sample source, identity and referenced
metadata. JSON normalization preserves replay behavior after reopening the journal.

Assignment grants are checked before reading; debug-only evidence is rejected before
model delivery. Catalog persistence creates no new permissions or resumable sessions.
The application retains current sensor projections and reference sets while historical
sample bodies are read on demand. Historical runs retain their original records; missing
catalog entries are not reconstructed. The spec, module guide and perception README
describe the storage boundary and remaining media responsibilities.

Validation: eight `pnpm test:evidence` cases pass using authored metadata documents and
real LocalStore files. They exercise detached reads, immutable replay, conflict preflight,
namespace isolation, debug visibility, source/size/identity rejection, partial publication,
record consistency and reopening. A child process with a 64 MiB V8 old-space limit writes
and rereads 1,600 documents whose journal exceeds 64 MiB. All 15 history and 19 console
logic/transport checks pass, alongside TypeScript, formatting, provenance, structure and
whitespace checks. No model, image-byte resolver, sensor or physical provider was run;
scripted runtime tests were not executed. This acceptance does not bound whole-process RSS.

Remaining: binary media storage/resolution and console rendering; journal/index retention;
grant/reference and native audit/context lifecycle; provider-backed criteria discovery;
active-task clarification; live VLM evaluation and local-server bootstrap. Physical
worker/provider integration retains its separate scope. The next evidence step is the
deployment attachment provider and its authorized byte-resolution path.

## Native local image provider (2026-09-20)

LocalImageStore implements DSH's AttachmentStore using six attachment-local source
files from the existing pinned DSH revision. The provider validates encoded images,
normalizes orientation/color/dimensions, publishes immutable digest-addressed files,
verifies reads and generates deterministic model-request variants. Configuration uses
an explicit directory and frozen image/operation limits. Accepted operations own their
input copies; native Cordis disposal rejects new work and awaits accepted operations.

The source map records two patches: printable filename sanitization and full-decoded,
fail-fast request-cache reads. Sharp is pinned to 0.35.3. The service is available to
deployment-owned contexts and the existing model resolveImage callback. It does not
grant evidence access or mount an HTTP route. Default server assembly, environment
factory injection and console sensor images remain integration work.

Validation: ten `pnpm test:images` cases pass using the actual repository PNG logo and
real files, without model/backend substitutes. They cover native mounting, encoded
prompt admission, concurrent publication, reopen/detached reads, batch rejection,
byte/pixel limits, filename handling, normalized/request images, cache errors, corrupt
objects, invalid references, cancellation, operation limits and disposal during writes.
Eight evidence-storage tests and 19 console logic/transport tests pass. TypeScript,
formatting, 128 pinned source files, structure and whitespace checks pass. No live
model, sensor, simulator or browser was run; scripted runtime tests were not executed.

Next: bind image services into deployment/server lifetime and environment factories,
provide scoped image reads for the console, and validate the image-reference path with
an actual VLM. Binary object/cache retention and reference accounting, journal/index
retention, active-task clarification, new-criteria admission and local-server bootstrap
remain required upper-system work. Physical worker/provider work remains separate.

## Application image service and console reads (2026-09-21)

`startServer` owns a native attachment context, installs LocalImageStore by default,
and exposes its service to an optional deployment factory and the environment/task
factories. Custom mounting uses the same native interface and lifetime. Startup failures
dispose the context; shutdown releases it after consumers. The OpenAI-compatible
example binds request-image resolution through this service. Configuration publishes
image limits without exposing private filesystem locations.

The HTTP image route resolves persisted run/evidence/attachment associations, admits
only agent-visible samples and validates returned bytes against the recorded reference.
Local Host/Origin and browser Fetch Metadata restrictions apply before reading. Responses
use recorded media headers, no-store and same-origin resource policy; missing and corrupt
objects return explicit errors. Disconnect, timeout and shutdown cancel byte reads.

The observation panel renders latest or agent-seen images with multiple slots, loading
and dimension/error status. Identical refreshes preserve existing image elements.
Restricted or empty samples clear the viewer. Test images keep their explicit source
label. The spec, architecture, deployment and console/image guides describe these APIs.

Validation: 17 actual image file/HTTP/lifetime tests and 22 console logic/transport
tests pass. Startup checks exercise the production server entry with incomplete
deployment configuration, native image services and real pending file publication.
Browser component checks load the actual repository PNG through the production reader
and renderer, inspect decoded dimensions, multiple slots, DOM preservation, restricted
and empty states, and a real missing-evidence error. These checks use authored evidence
documents; no model or environment is executed. Full application/provider lifetime and
live VLM acceptance remain required; scripted runtime tests were not run. Eight
evidence-storage tests, TypeScript, formatting, provenance, structure and whitespace
checks pass.

Remaining upper work: binary object/cache retention and reference accounting;
journal/index retention; grant/reference and native audit/context lifetime; active-task
clarification; provider-backed criteria discovery; live VLM acceptance and CLI-free
bootstrap. Physical worker/provider integration remains a separate requirement.

## Atomic journal compaction and maintenance (2026-09-21)

LocalStore now reports current/superseded byte statistics and atomically publishes a
complete checkpoint containing every current record. CAS versions, insertion order,
global write sequence and independent history/evidence records are preserved. A smaller
checkpoint is synchronized before rename and directory synchronization. Headerless
journals remain readable; compacted journals require the versioned checkpoint reader.
Partial checkpoints and detected corruption fail without rewriting authoritative data.

The console's Workspace storage section displays statistics and submits explicit
compaction using the inspected sequence. Server admission excludes open user sessions,
active tasks, concurrent admission/lifecycle work and shutdown. Accepted maintenance
settles/closes retained terminal task scopes before compacting. This is synchronous
idle maintenance; distinct-key/media deletion and background retention are still open.

Validation: 15 storage/admission tests use real files and processes. A 64 MiB old-space
child compacts a journal exceeding 96 MiB, reopens it and reads every latest document.
A separate process is terminated during actual checkpoint publication; reopening
preserves complete current documents. Sixteen history checks include retained published
boundaries after compaction; 17 image checks include exact scoped HTTP reads afterward.
Eight evidence-storage and 22 console logic/transport checks pass. Browser component
acceptance uses actual documents and production markup/controller/storage functions.
No live model or physical provider is executed. Full application drain during live
provider/model work remains an acceptance requirement.

Remaining upper work: distinct-key/run/session retention; binary object/cache reference
accounting and collection; grant/reference and native audit/context lifetime; active-task
clarification; provider-backed criteria discovery; live VLM acceptance and CLI-free
bootstrap. Actual worker/provider integration retains its separate scope.

## Image inventory and explicit request-cache cleanup (2026-09-21)

LocalImageStore streams original/cache file counts and byte usage, returning a busy
state during overlapping mutations. Cleanup requires the current service revision and
excludes publication, model-request reads, inspection and other maintenance. Preflight
rejects unexpected entries and symbolic links before deletion. Recognized derived
variants and cache staging files are removed; original images and original staging
remain available. Subsequent model requests regenerate their variants from the originals.
Cancellation or filesystem failure during deletion can leave a partially cleared cache
and returns an error. Native shutdown waits for admitted cleanup.

The default server image provider exposes inventory and cleanup. Custom native mounts
may return an optional maintenance controller. Configuration reports that capability;
the console displays usage and a guarded cleanup action. HTTP admission uses the same
idle/session/task guard as journal compaction and requires an inspected image revision.
No user data is cleaned automatically.

Validation: 23 actual image-file/HTTP/lifetime tests, 16 storage/admission tests and
22 console logic/transport tests pass. Browser component checks use production markup,
controller and storage operations with an actual PNG and document journal. They verify
cache clearing, empty-cache button state, identical original-image SHA-256 before/after,
and subsequent journal compaction with the document's CAS version retained. TypeScript,
formatting, source provenance, structure and whitespace checks pass. No live model or
physical provider runs in these checks; full application maintenance while draining
live consumers remains unverified.

Next: complete domain-aware retention for run/session/evidence/audit records and original
media references; finish active-task clarification, provider-backed criteria discovery,
live VLM acceptance and CLI-free bootstrap. The actual worker/provider integrations
remain separate physical-runtime work. The upper-runtime objective remains incomplete.

## Bounded native audit browsing (2026-09-21)

SessionAudits exposes assignment-index and forward/backward event pages. Indexes return
at most 64 assignments; event pages contain at most 128 events and target 256 KiB of
encoded bodies, preserving one larger event intact. A fixed published event count
keeps navigation stable across later appends. Invalid indexes, missing published bodies
and foreign cursors fail explicitly. Legacy arrays, original event values and journal
compaction remain supported.

The audit HTTP route returns an assignment index and accepts an explicit assignment
with bounded event offsets. The console retains one index and event page, supports
earlier/later/latest navigation and clears its held contents when inspection closes.
Read-only text rendering, loading/empty/error states and stale-response suppression
belong to the inspector controller. Native DSH sessions and audit publication remain
unchanged. In-process complete-history reads retain their explicit allocation cost.

Validation: `pnpm test:audits` passes nine real-file/HTTP/process checks. A child with a
64 MiB V8 old-space limit writes, reopens and pages through more than 96 MiB of documents.
Twenty-two console logic/transport tests, TypeScript, formatting, provenance and
structure checks pass. Browser component acceptance uses production markup/controller
and query handling over actual stored documents: 300 events, 65 assignments, both
navigation directions, assignment changes, index continuation, empty history and
text-only rendering. No model or physical provider executes. Historical scripted
user-session tests were updated to consume the paged API and were not run.

Next: domain retention and reference accounting for run/session/evidence/audit records
and original media; native active-session and assignment-grant lifetime; active-task
clarification; provider-backed criteria discovery; live VLM acceptance and CLI-free
bootstrap. Audit paging limits browsing allocations and does not establish disk quotas
or complete the upper-runtime objective.

## SKILL source inspection (2026-09-21)

The workspace experience API includes read-only provenance resolved through explicit
recovery ownership. It checks the original-goal failed/passed relationship, the source
run's exact accepted verdicts and origin, optional user-session ownership and immutable
sensor/image metadata. Missing source records or legacy ownership are visible as
incomplete; conflicting present records fail. Source identity follows the recovery
even when the mutable run SKILL index does not list the bundle. Stored SKILL keys must
match their metadata identities. Shared image references are listed once with their
referring evidence identities.

The API scans bundles incrementally, retains the latest 100 and reads their referenced
source records without scanning unrelated runs. The existing Experience library
inspector displays provenance with each bundle. Newly published limitation metadata
uses the declared simulation, hardware or test-fixture origin and preserves explicit
transfer limits. Agent search/load behavior and evidence permissions remain unchanged.

Validation: nine `pnpm test:skill-provenance` checks pass using authored documents,
real LocalStore/image files, the repository PNG and local HTTP. They cover ownership,
detached reads, compaction/reopen, incomplete sources, legacy ownership, inconsistent
goals/verdicts/origins/scopes, exact accepted verdicts, SKILL identity, the latest-100
window, request-origin restrictions and source limitations. Eight evidence-storage and
23 image/lifetime/HTTP checks pass, alongside TypeScript, formatting, pinned DSH source
and structure/link checks. No live model, sensor or physical provider was executed;
scripted runtime tests were not run. HTTP acceptance invokes the production reader and
origin guard; complete live application acceptance remains required.

Source availability describes inspected metadata. It does not certify image bytes,
the complete event history or cross-environment transfer. The dependency list does not
authorize deletion or enumerate all task-owned data. Next: complete domain retention
for task/session/evidence/audit records and original media, preserving SKILL sources;
finish native active-session/grant lifetime, active-task clarification, provider-backed
criteria discovery, live VLM acceptance and CLI-free bootstrap. The upper-runtime
objective remains incomplete. [Source inspection guide](skill-provenance.md).

## Local original-image collection and reference inventory (2026-09-21)

LocalImageStore accepts an explicit complete retained-ID set and a current image
revision for original-object collection. It validates inventory and the presence of
retained originals before deletion, excludes pending readers/writers and rejects new
original consumers during collection. Retained roots are copied at admission. Native
disposal waits for accepted collection; failure and cancellation propagate. Successful
collection synchronizes affected directories and returns removed files/bytes and
retained-object counts. Request-cache files and original staging remain separate.

The storage module also inventories structured attachment IDs across current journal
records. It reads one record at a time, counts each referring record once and retains
at most four example ownership keys per image. Results include the inspected store
sequence. Nested arrays, historical records and extension namespaces are included;
malformed structured IDs fail. Prose-only references and external storage need their
own ownership declarations.

Validation: nine `pnpm test:image-collection` checks pass using actual PNG bytes, native
image transformations, real image files and domain journals. They cover retained-byte
identity, physical deletion, reopening, shared roots, cache independence, stale/missing
roots, reader/writer exclusion, links/invalid entries, cancellation, disposal, detached
inputs, empty roots, staging preservation and journal inventory after compaction.
Twenty-three image/lifetime/HTTP tests and nine SKILL provenance tests also pass.
TypeScript, formatting, pinned-source provenance and structure/link checks pass.
No model, sensor, physical provider or new browser behavior was exercised.

The collector is available to trusted local lifecycle owners. The HTTP API and console
do not invoke it. Complete application reference providers, frozen journal/image
admission and quiescence of external host-path consumers are required for integration.
Next: connect those ownership/lifecycle requirements to retention admission, preserve
SKILL sources during domain-record retention, and continue active-session/grant
lifetime, active-task clarification, criteria discovery, live VLM acceptance and
CLI-free bootstrap. The full upper-runtime objective remains incomplete.

## Configured image retention and console preview (2026-09-21)

LocalServerOptions accepts an explicit versioned image-ownership policy. Journal
references are combined with registered sources that acquire stable reference leases.
The controller checks every SKILL source and requires stored sessions to have confirmed
resource release. Journal write holds prevent new or changed roots during provider
inspection and collection. All acquired leases are released on success and failure.
Custom image providers can expose optional original-object inspection/collection methods.

Idle HTTP admission settles and closes retained task scopes before retention work.
Inspection returns retained/unreferenced file counts and bytes with a detached preview
token. Collection consumes that token and rechecks journal, image and source revisions.
The browser submits no root list or path. Local request checks apply. Scoped image reads
during original collection receive an explicit maintenance conflict. The console exposes
inspection and deletion controls, clears old previews on operations/failures and leaves
deletion disabled for unconfigured ownership or empty candidate sets.

Validation: eight `pnpm test:image-retention` checks pass with actual journals, original
PNG-derived files, external reference files held under filesystem locks and local HTTP.
They cover nested write holds, leased ownership, preview isolation, changed revisions,
single-use tokens, unresolved sessions, incomplete SKILL sources, acquisition/validation
failure cleanup, cancellation and idle/origin/input admission. Nine original-collection,
23 image/lifetime/HTTP, 16 storage/admission and 22 console tests pass. TypeScript and
formatting, pinned-source and structure/link checks pass. Browser component DOM
acceptance uses production markup/controller code, actual image/document files and
reference leases. It verifies retained/unreferenced counts, stale-preview rejection,
disabled controls after rejection, refreshed collection, unchanged hashes for both
retained originals and actual removal of the unreferenced file. No scripted
model/backend tests were run.

HTTP acceptance invokes production controller/admission functions in a component server.
Live application drain, provider-specific reference coverage and hardware resource
reconciliation remain separate acceptance requirements. Domain-record archival/deletion,
active-session/grant lifetime, active-task clarification, criteria discovery, live VLM
acceptance and CLI-free bootstrap remain open. [Retention guide](image-retention.md).

## Native assignment cleanup and evidence permissions (2026-09-21)

AssignmentEvidenceGrants opens from each explicit creation brief, copies incoming
references, and requires an existing scope for extensions. UpperRun releases the set
after role retirement cleanup, including failure, and closes remaining sets at run
shutdown. Historical evidence and briefs remain available through their own readers.
Observation completion extends only existing grant scopes.

TeamSessions disposes native handles acquired before an application publication
failure and preserves cleanup errors. Its final retirement audit follows native
disposal, including events committed by scoped cleanup. Repeated retirement/close
share completions; durable audits and assignment identities remain inspectable.

Validation: seven `pnpm test:assignment-lifetime` checks use actual DSH services,
native scopes, authored documents and LocalStore journals. They cover grant isolation
and release, sequential native capacity across 70 assignments, audit reopening,
cleanup-event publication, pending creation at shutdown, and actual write-hold
failures during publication/retirement. No model adapter or physical backend executes.
Nine audit checks, eight evidence-storage checks and 22 console checks also pass.
Strict TypeScript, formatting, 128 pinned DSH source files, 25 module bindings and
421 local documentation links pass verification. Scripted runtime tests were not run.
These checks do not certify in-flight VLM/provider shutdown or process-memory bounds.

Next: active native context/event retention and retained assignment projections;
domain-record archival preserving SKILL provenance; active-task clarification;
provider-backed criteria discovery; live VLM acceptance and CLI-free bootstrap.
Physical worker/provider integration remains separate. The upper-runtime objective
remains incomplete. [Lifecycle guide](assignment-lifetime.md).

## Incremental native audit publication (2026-09-21)

TeamSessions supplies its native Session to the synchronous audit hook. SessionAudits
captures its event count, reads original events individually, writes the unpublished
suffix and publishes the count after successful writes. Native delivery records its
sequence boundaries and checks that range for turn errors. Both application paths use
the original DSH sequence API without materializing a complete event-array snapshot.

Native audit indexes use v2 with an explicit Session identity. Another native Session
or an unbound array cannot extend them. Existing v1/inline histories remain readable;
native adoption validates the entire published prefix before binding the identity.
Conflicting unpublished events and oversized records fail with the previous published
boundary retained. Stored event versions remain immutable across repeated publication,
adoption, compaction and reopening.

Validation: sixteen audit checks and eight assignment-lifecycle checks pass using
actual native Session/Agent services, authored documents, real journals and HTTP.
The native delivery check exercises an unavailable adapter and verifies persisted
error events. Twenty-two console tests, strict TypeScript, formatting, 128 pinned DSH
source files, 25 module bindings and local documentation links pass. Scripted
model/backend suites were not run; no successful live model call is claimed.

Active native log/surface retention, retained assignment projections and domain-record
archival remain required. Continue those alongside active-task clarification,
provider-backed criteria discovery, live VLM acceptance and CLI-free bootstrap.
Physical worker/provider integration retains its separate scope. The upper-runtime
objective remains incomplete. [Audit publication guide](session-audits.md#native-publication).

## Active-task user clarification (2026-09-21)

UserClarifications records the requesting assignment, native call, goal and attempt,
permits one unanswered question per run, and stores immutable accepted response IDs.
Exact retries return the existing receipt. Question and delivery states distinguish
pending, cancellation, native quiescence, failure and restart interruption. The HTTP
reader resolves durable question state for both current and historical projections.

UpperRun exposes user.ask only through configured native tools and requires the decision
owner and a matching confirmed stopped execution. Native concludeTurn closes the asking
turn. Domain changes remain blocked until the answer is accepted and the original turn
drains. Native followup returns the answer to the requesting Planner. The built-in Planner
can request execution.pause; continuation retains all existing criteria and resume checks.

The console question panel provides suggestions, free text, persistent drafts and stable
retry identity. JSON transport is shared by console components. Response requests permit
96 KiB before field validation to support escaped/multibyte text; other routes retain
their existing default. Late/stale display updates preserve accepted response state.

Validation: nine native/file clarification checks and one actual HTTP check pass.
Together with assignment lifecycle, native audits and console regression checks, 56
checks pass. Strict TypeScript, formatting, 128 pinned source files, 25 module bindings
and 433 local documentation links pass verification.
Browser component DOM checks cover suggestion selection, literal content, refresh,
read-only input, actual journal write exclusion, preserved retry identity, accepted
response storage and stale pending updates. The component has no connected model or
device; delivery remains queued. A live VLM/provider clarification and pause/resume
scenario remains required. No scripted model/backend acceptance was run.

Continue active model-surface limits, compact metadata and remaining run collection
lifetimes, domain-record retention preserving SKILL provenance, provider-backed criteria discovery,
live VLM acceptance and CLI-free bootstrap. Physical worker/provider integration remains
separate. The upper-runtime objective remains incomplete.
