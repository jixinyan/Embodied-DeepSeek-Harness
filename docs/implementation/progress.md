# Implementation progress

Spec: v1.10. Current checkpoint: **runnable DSH upper application and CPU console**.
This page supersedes the pre-upper-runtime status at `d1fe6f4`. Historical evidence
remains in Git. [Capability map](features.md) separates working code from targets.

## Current delivery boundary

The user prioritizes the upper application before physical runtime integration.
`pnpm demo` starts a local console at `http://127.0.0.1:4317`. A scripted model emits
native DSH tool calls; a CPU fixture backend supplies labeled synthetic observations
and execution states. This validates orchestration, not model intelligence or robotics.

The console now uses a unified workspace for agent activity, TODOs, sensors, execution,
verification and recovery. Desktop panels remain visible together without tabs; smaller
screens stack sections and long content scrolls. See the [console guide](../../apps/console/README.md).

## Implemented and exercised

| Area | Current behavior |
| --- | --- |
| DSH runtime | Original loop, native tools/validation, model services, scoped sessions, inbox/followup, cancellation and cooperative timeout plugin |
| Teams | YAML/ROLE.md preflight, frozen configuration, explicit model/tool bindings, independent assignment contexts; concurrent duplicate admission rejected |
| Communication | Versioned role reports/query, configured result schemas, explicit briefs, authenticated caller identity from tool scope, delegation/send/context exchange, evidence grants, native DSH delivery and audit exports |
| Tools | Native tool API, role exposure and owner checks; trusted custom native tools share run lifetime and activity tracking |
| Planning/files | Original DSH TODO; versioned dependency plans, immutable executed/final criteria, registered subgoal checks, owner-selected goals and private files |
| Execution boundary | Replaceable EmbodiedBackend port, nonblocking fixture jobs, budgets, pause/confirmed fixture stop and owner-only resume |
| Verification | Async independent monitor sessions and mandatory formal verification at execution boundaries; unknown cannot become success |
| Recovery | Formal failure followed by Planner replan/retry opens one recovery and Evolver; explicit progress batches continue until original-goal success |
| Experience | Versioned SKILL export/search/load; failure signals, possible causes, avoid rules, success/verification guidance and provenance; fixture skills labeled and separated |
| Persistence | Single-writer CAS journal, fsync, integrity checks, torn-tail recovery, separate immutable events and run projections; read-only historical session audits |
| Server/console | Local HTTP/SSE, request admission deduplication, one active run, reconnect snapshots, history/restart interruption, output/tool/TODO/brief/recovery inspection |

## Acceptance and limits

Local environment: Node 25.4, pnpm 11.19.0, Python 3.14. CI uses Node 22/Python 3.11.
The complete check command is `pnpm check`.

- 30 runtime tests: original DSH seams, native tool schemas/timeouts, custom-role
  isolation and extensions, storage/configuration, full recovery, unknown/error,
  pause/resume/cancel, HTTP/SSE/idempotency and interrupted restart.
- 230 shared wire/lifecycle/physical-boundary cases in TypeScript and Python,
  plus non-JSON rejection tests; generated contract types match the schema.
- 93 pinned DSH source files and 20 referenced module bindings verified.
- Formatting, strict TypeScript, public English/local links, Python imports and SVG
  XML checks pass. Tests use fixtures; no live model, GPU policy or robot is evaluated.

Remaining: live VLM deployment configuration/evaluation; Python worker transport;
actual simulator, policy, perception and hardware adapters; resource arbitration;
interruptible action-chunk admission and device acknowledgement. The upper runner
coordinates plan-selected subgoals and one observing recovery chain at a time.
Concurrent physical subgoals, nested independent recovery chains, distributed delivery
guarantees, resumable DSH sessions, long-horizon retention/compaction and multi-user hosting remain open.
Native delivery completion means session quiescence, not exactly-once business execution.
Cooperative cancellation cannot forcibly stop an uncooperative external device/tool.

## Step status and next implementation sequence

| Step | Status in this checkout |
| --- | --- |
| 00–01 | DSH integration and shared contract acceptance complete |
| 02–05 | Upper configuration, roles, explicit handoff, plans/files implemented; role result schemas now bind to native DSH validation; distributed delivery remains open |
| 06–07 | Upper port and CPU fixture implemented; physical worker/resources/perception providers deferred |
| 08–10 | Upper verification/recovery/experience loop exercised with fixtures; actual provider evidence still required |
| 11 | Recovery and custom-role CPU scenarios pass; full physical-provider replacement scenario remains open |
| 12 | Unified debugging console implemented and browser-checked with CPU fixtures |
| 13–16 | Real simulation, release/transfer evaluation and hardware not started |

1. Harden upper configuration and lifecycle at remaining deployment boundaries;
   configure a live DSH model adapter only against an explicit available binding.
2. Extend goal/recovery acceptance to longer plans and deployment-specific evaluators.
   Plan-selected sequential goals and prerequisite recovery now run with CPU fixtures.
3. Extend the implemented report acknowledgements/startup reconciliation with durable
   business transactions only where needed; preserve the original DSH inbox.
4. Add bounded retention/checkpoints and recovery reconciliation appropriate to
   longer runs. Historical sessions must never silently resume physical commands.
5. Bind the physical worker transport, action gate and resource coordination, then
   one actual simulation/policy/perception configuration. Run physical acceptance.
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
