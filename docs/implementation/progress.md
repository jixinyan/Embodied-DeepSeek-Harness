# Implementation progress

Spec: v1.18. Current checkpoint: **runnable DSH upper application and CPU console**.
This page supersedes the pre-upper-runtime status at `d1fe6f4`. Historical evidence
remains in Git. [Capability map](features.md) separates working code from targets.

## Current delivery boundary

The latest delivery adds model/policy adapters and standalone action admission while
retaining the upper-first integration baseline. See the [adapter guide](model-policy-adapters.md).
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

- 89 runtime tests: original DSH seams, native tool schemas/timeouts, custom-role
  isolation and extensions, storage/configuration, full recovery, unknown/error,
  pause/resume/cancel, HTTP/SSE/idempotency, deployment admission and interrupted restart.
- 256 shared wire/lifecycle/physical-boundary cases in TypeScript and Python,
  plus non-JSON rejection tests; generated contract types match the schema.
- 17 Python policy/action-gate tests use real localhost WebSockets and CPU devices.
- 122 pinned DSH source files and 25 referenced module bindings verified.
- Formatting, strict TypeScript, public English/local links, Python imports and SVG
  XML checks pass. Tests use fixtures; no live model, GPU policy or robot is evaluated.

Remaining: live VLM evaluation and sensor attachment binding; host-to-Python worker
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
preventing ID reuse. Cleanup is idempotent, attempts disposal after audit failure,
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

Remaining: key-index growth, journal/disk retention, browser history limits, recovery
trace retention, media cleanup, provider-backed criteria discovery,
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

Remaining: recovery trace retention and delivery batching, browser history limits,
key-index/disk retention, media cleanup, provider-backed criteria discovery, active-task
clarification, live VLM evaluation and local-server bootstrap. Full snapshot callers
still allocate their requested history. Physical integration keeps its separate scope.
