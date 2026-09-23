# Architecture and module ownership

EDH is the product and repository owner. Selected runtime implementations are absorbed
from DSH into these modules. Step 00 verifies the original loop and scoped lifecycle;
upper Team, planning, verification and experience services now run with CPU fixtures.
OpenAI-compatible model transport, WebSocket policy transport and action admission
are executable with local protocol/CPU tests. The RoboCasa native adapter and action device
also pass GPU rendering and manual-control boundary checks. The native worker passes
actual reset, image transport and connection-failure checks. A console-driven
Planner task records 64 GR00T controls and formal native GT failure; its replay
preserves the camera frames and agent events. RoboTwin native task reset also
passes. BEHAVIOR-1K, RoboTwin learned controls and successful upper task/recovery
acceptance remain under integration.
See the [adapter boundaries](../implementation/model-policy-adapters.md).

![Architecture](assets/framework-overview.svg)

The diagram shows the target architecture. The minimal DSH host/session integration
is verified; consult the [capability map](../implementation/features.md) for implemented upper services and pending providers. No separate upstream
application is copied. See [runtime integration](../implementation/dsh-integration.md).

## One harness, two runtime responsibilities

Both sides are under [harness](../../harness/README.md). `agent-runtime` coordinates
agents, tasks, tools, verification and experience; `physical-runtime` advances policies
and interacts with simulators/devices. Shared `contracts` define their communication.
They may run on one host while retaining independent process and dependency boundaries.

For a cup-placement task, the upper side supplies the subgoal/budget and makes the
formal verification/retry decisions; the physical side returns real frames, control
steps, device acknowledgement and limited fact checks. Folder placement does not grant
the physical worker decision ownership or cause agent contexts to be shared.

## Working directories

| Module | Owns | Does not own | Main boundary / next step |
| --- | --- | --- | --- |
| `apps/server` | EDH application assembly, local HTTP/SSE API and startup | Agent loop implementation | startServer + ServerDeployment; Step 00/12 |
| `apps/console` | Sensors, team/agent/robot state, tools, verdicts and timeline | Device truth or planner decisions | ConsoleProjection; Step 12 |
| `apps/desktop` | Native configuration selection, owned service process, console window and shutdown | Models, agent loops or physical allocation | Default deployment factory into existing startServer |
| `harness/agent-runtime/agents` | Independent assignments, DSH session lifecycle, built-in role definitions | Implicit parent context or another loop | AgentFactory; Step 03 |
| `harness/agent-runtime/foundation` | Plugin context, schemas and selected runtime support | Another agent loop or physical policy | Pinned source and compiler boundaries; Step 00 |
| `harness/agent-runtime/teams` | Team/member definitions and immutable role/provider bindings | Hard-coded role enum | TeamLoader; Step 02 |
| `harness/agent-runtime/models` | Model capabilities and DSH model binding | Planning or tool orchestration | ModelRegistry; Step 00 |
| `harness/agent-runtime/tools` | Logical tools, role exposure, provider selection and invocation boundary | Every concrete perception/robot implementation | Native DSH tools + PhysicalToolCatalog/PhysicalToolProvider; Step 02/07 |
| `harness/agent-runtime/communication` | Explicit briefs, scoped messages, delivery and subscriptions | Shared conversation memory | TeamRouter; Step 04 |
| `harness/agent-runtime/planning` | Persistent PlanDocument and progress projection | Authoritative success | PlanStore; Step 05 |
| `harness/agent-runtime/files` | Private assignment files and controlled search | Shared unrestricted filesystem | AgentFiles; Step 05 |
| `harness/agent-runtime/tasks` | Goals, attempts, decision ownership and recovery linkage | Policy action generation | TaskCoordinator; Step 09 |
| `harness/agent-runtime/execution` | Host/worker bridge, job status and resource coordination | TS control loop or autonomous retry | ExecutionClient; Step 06 |
| `harness/agent-runtime/perception` | Model-facing capture/segmentation/depth/localization tool adapters | Shared global scene state | PerceptionProvider; Step 07 |
| `harness/agent-runtime/observation` | Active-view intent, resource effects and achieved pose | Assumption that turn-view only moves a camera | ActiveObservation; Step 07 |
| `harness/agent-runtime/verification` | Monitoring and formal-verdict coordination | Retry, replan or ground-truth fabrication | VerificationCoordinator; Step 08 |
| `harness/agent-runtime/memory` | Authorized evidence access, skills and recovery experience | Automatic shared prompts or VLA training | SkillStore/EvidenceReader; Step 10 |
| `harness/agent-runtime/storage` | Persistence primitives used through scoped service boundaries | Bypass of evidence visibility | EventStore/AssetStore; Step 04 |
| `harness/contracts` | Authoritative wire schema and generated declarations | Runtime semantic authorization | physical.schema.json; Step 01 |
| `harness/physical-runtime/src/physical_harness/execution` | Actual action progression, budget and device job handling | Upper-level retry decision | ExecutionWorker; Step 06 |
| `harness/physical-runtime/src/physical_harness/policies` | Subgoal-to-action policy adapter | Agent orchestration | SubgoalPolicy; Step 13 |
| `harness/physical-runtime/src/physical_harness/environments` | Simulator observation/action/task mapping | Environment-specific host protocol | EnvironmentAdapter; Step 13/15 |
| `harness/physical-runtime/src/physical_harness/embodiments` | Capabilities, units, frames and action/observation specifications | Simulator lifecycle | EmbodimentAdapter; Step 06/13 |
| `harness/physical-runtime/src/physical_harness/backends` | Device connection, commands and confirmed state | Agent-mediated emergency response | DeviceBackend; Step 06/16 |
| `harness/physical-runtime/src/physical_harness/perception` | Optional model/provider execution | Host role permissions | PerceptionProvider; Step 07/13 |
| `harness/physical-runtime/src/physical_harness/verification` | Limited GT/device fact checks | Final agent verdict | VerificationProvider; Step 08/13 |

## Direction of dependencies

Source interfaces depend on `contracts`; application assembly composes the modules.
Native runtime mechanisms remain DSH-owned; see [reuse decision](../implementation/decisions/0003-reuse-dsh-mechanisms.md).
Concrete runtime coupling is introduced only when implementing each step, with
explicit interfaces and tests. `contracts` must not import agents, apps or Python.
Communication uses storage for persistence; agents receive authorized evidence
through memory/tools, not direct unrestricted storage handles. Python optional
providers must not be imported by the base package at startup.

For example, a SAM tool is defined in `tools`, exposed through `perception`, and
executed by the Python perception provider. A verifier role lives in `agents`,
formal-verdict lifecycle enforcement in `verification`, and a simulator predicate
check in the Python verification provider. These are different responsibilities,
not three implementations of the same agent.

## Recovery sequence

![Async recovery](assets/async-recovery-sequence.svg)

## Wire contract maturity

The authoritative draft schema now has matching TypeScript/Python wire validation
and pure lifecycle gates for attempt identity, budgets, formal verdicts and recovery
lineage. See [contract integration](../implementation/contracts.md). Semantic context
sufficiency, authentication, event payload registration, evidence authorization and
runtime enforcement remain service work in Steps 02–10. Generated TypeScript and
Python Protocol annotations alone do not validate runtime data.


## User-session ownership

`apps/server/src/user-sessions.ts` owns the product conversation/environment lifecycle,
not an agent loop. A retained `SessionEnvironment` creates one fresh backend control
scope per task. `UpperRun` and the native DSH services continue to own task execution
and independent role contexts. Workspace SKILL storage outlives all three scopes.
`SessionTaskHistory` owns immutable task membership and the compact session history
count/latest reference. UserSessions admits tasks and invokes that publication before
run ownership and request completion. Startup migrates legacy inline task arrays;
task-context and SKILL-source readers resolve individual memberships explicitly.
See the [session guide and SVG](../implementation/user-sessions.md).

`apps/server/src/clarifications.ts` owns durable user questions and accepted responses.
UpperRun supplies assignment/goal/execution admission and delivers the answer through
native TeamSessions after the asking turn settles. The console owns drafts, explicit
submission and delivery-state presentation. Existing task criteria and device permissions
remain authoritative. See the [interaction guide](../implementation/user-clarification.md).

## Task catalog ownership

`TaskDefinition` and GoalBinding validation live in the tasks module.
`SessionTaskCatalogs` in the server owns immutable per-session catalog records and
their ownership/content checks. UserSessions captures the configured source during
environment admission; the HTTP service and console read the retained catalog.
Task admission confirms its digest before passing one definition to UpperRun and
the environment's task backend factory. See [task catalogs](../implementation/session-task-catalogs.md).

## Experience read ownership


SkillLibrary owns immutable experience documents and explicit full/section reads.
Its CommonMark reader preserves mandatory context and reference definitions while
reporting omitted sections. UpperRun binds the optional selection to the existing
native `skills.load` tool; each calling assignment receives its own tool result.
Role prompts own retrieval decisions. See the
[section API](../../harness/agent-runtime/memory/README.md#selective-section-reads).

## Sensor metadata ownership

`perception/SensorSamples` owns validation and immutable, run-scoped sensor metadata
publication through LocalStore. UpperRun owns assignment grants, visibility checks and
current sensor projections. AssignmentEvidenceGrants copies brief references at role
creation, accepts explicit extensions while that scope exists, and releases permissions
after role retirement cleanup or run shutdown. Retired brief references remain history.
The catalog reads requested records without accumulating
historical sample bodies. It stores image references; the deployment attachment provider
must supply and validate image bytes. The server owns its native attachment context,
injects `DeploymentServices.images` into deployment/environment/task factories, and
disposes it after consumers stop. Console image reads require persisted run ownership,
associated image references and agent-visible evidence. The browser image component
uses this scoped route for latest and agent-seen frames. See the
[perception guide](../../harness/agent-runtime/perception/README.md) and
[image-service boundary](../implementation/image-storage.md).

## Journal maintenance ownership

VerificationContexts owns persisted formal-check identities, scopes, facts and evidence
references. UpperRun owns active assignment admission/release and still applies shared
verdict gates. SensorSamples owns the referenced observations. Native retirement releases
active check identities while preserving the stored record for host inspection.

VerificationBoundaries owns immutable run/execution/boundary admission records and
continuous-pause identity checks. UpperRun applies lifecycle checks before admission,
then publishes the accepted status and schedules a native formal role. Shared lifecycle
validation continues to own budgets and resume authority. See
[verification boundaries](../implementation/verification-boundaries.md).

VerdictHistory owns immutable accepted results and exact summary-to-record validation.
UpperRun applies acceptance gates and publishes compact verdict entries after archive
read-back. Planner/recovery consumers, selected task context and source inspection
resolve complete results; the console uses the selected-result HTTP reader. See
[verdict history](../implementation/verdict-history.md).

WorkspaceHistoryIndex in `apps/server` owns the derived SQLite session/run summaries.
LocalStore supplies detached revisions, source-file checks and synchronous committed
change notifications. The application opens the index after startup reconciliation and
closes it before the journal. Index failure after source publication stops the current
store; reopening reconciles from the source. Page readers retain bounded candidates.
See [workspace index semantics](../implementation/workspace-history.md#persistent-summary-index).

LocalStore owns checkpoint format, record validation, atomic compaction and explicit
sequence-bound batch retirement. Retirement notifies derived readers to reconcile
removed keys and retained ownership. Application reference closure, preserved request
identities and SKILL sources must be established before exposing record deletion.
DomainRetention in `apps/server` owns configured reference inspection, source leases,
mandatory provenance/request retention and single-use versioned previews. Record owners
declare their namespaces and complete edges. A complete built-in ownership policy and
HTTP/console admission remain pending. See [domain retention](../implementation/domain-retention.md).
SessionTaskHistory owns full published membership enumeration. The server's
sessionRecordOwners declares Session/request/catalog dependencies and validates reverse
task ownership before retention admission. Request identity records retain their replay
sources; an archive/tombstone lifecycle remains required for deleting those sources.
`evidenceRecordOwners` in the same application layer composes sensor, assignment and
verification readers to declare run/evidence/boundary/context dependencies. Perception
owns shared image metadata validation; the image provider owns byte integrity. These
declarations do not authorize agent access or certify physical task completion.
`reportRecordOwners` composes AssignmentReports and assignment/evidence readers to
declare report and receipt dependencies. Communication owns stored report validation,
immutable receipts and predecessor checks; native DSH continues to own message delivery.
`taskRecordOwners` composes assignment, recovery, report, evidence and verdict readers
to declare archived delegation and recovery dependencies. It checks explicit failed
and successful sources and every published recovery index, preserving source histories
needed by retained assignments and experience. `runRecordOwners` declares run projection,
configuration and restart dependencies, including selected historical task context and
published session membership. Its inline event inspector is explicitly versioned.
`RunEventReferences` declares typed event/message dependencies, resolves historical
report/verdict sources and checks recovery page contents. Its versioned extension
inspects deployment payload references; the same inspector handles legacy inline events.
Submission/plan/file/clarification and native-audit owners remain required for a
complete application retention policy.
The server
owns idle-state and sequence admission, terminal-task drain and HTTP exposure. The
console owns statistics and operation status. Compaction preserves all current keys
and independent evidence/event records; it does not grant record access or set domain
retention policy. [Maintenance guide](../implementation/storage-maintenance.md).

SessionHistory owns publication and resident event-body budgets; native Session owns
the logical sequence and verifies archived values before release. TeamSessions supplies
pre-step, delivery and retirement checkpoints. Deployment policy records the count/byte
limits, and UpperRun emits release statistics. Active model context and application
projections remain separate owners. See [native history](../implementation/session-history.md).

AssignmentHistory owns immutable retired role payloads and compact run summaries.
UpperRun invokes it at native retirement; TeamSessions verifies its durable reader
before releasing the resident brief. The server checks run ownership for selected
detail reads, and the console keeps only selected historical payloads. See
[assignment history](../implementation/assignment-history.md).

LocalImageStore owns streamed image inventory, its mutation revision and exclusive
request-cache cleanup. The server owns idle admission and exposes an optional
maintenance controller for custom native image providers. Original objects remain
available after cache cleanup. Original-object collection uses configured reference
leases, journal write holds, SKILL source checks and confirmed session resource release.
The server validates a fresh inspection token before deletion; deployments must declare
complete external ownership. See [image retention](../implementation/image-retention.md).
