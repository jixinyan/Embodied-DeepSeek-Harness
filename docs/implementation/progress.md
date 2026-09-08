# Implementation progress

Spec: v1.8. Current checkpoint: **runnable DSH upper application and CPU console**.
This page supersedes the pre-upper-runtime status at `d1fe6f4`. Historical evidence
remains in Git. [Capability map](features.md) separates working code from targets.

## Current delivery boundary

The user prioritizes the upper application before physical runtime integration.
`pnpm demo` starts a local console at `http://127.0.0.1:4317`. A scripted model emits
native DSH tool calls; a CPU fixture backend supplies labeled synthetic observations
and execution states. This validates orchestration, not model intelligence or robotics.

UI design is deferred. Its next design pass must show agent activity, TODOs, sensors,
execution, verification and recovery together in one workspace without page/tab
switching for key state. Existing inspector tabs are provisional. Continue core work.

## Implemented and exercised

| Area | Current behavior |
| --- | --- |
| DSH runtime | Original loop, native tools/validation, model services, scoped sessions, inbox/followup, cancellation and cooperative timeout plugin |
| Teams | YAML/ROLE.md preflight, frozen configuration, explicit model/tool bindings, independent assignment contexts; concurrent duplicate admission rejected |
| Communication | Explicit briefs, authenticated caller identity from tool scope, delegation/send/context exchange, evidence grants, native DSH delivery and audit exports |
| Tools | Native tool API, role exposure and owner checks; trusted custom native tools share run lifetime and activity tracking |
| Planning/files | Original DSH TODO plugin, session-local history; durable versioned plans and private assignment files; TODO completion cannot establish success |
| Execution boundary | Replaceable EmbodiedBackend port, nonblocking fixture jobs, budgets, pause/confirmed fixture stop and owner-only resume |
| Verification | Async independent monitor sessions and mandatory formal verification at execution boundaries; unknown cannot become success |
| Recovery | Formal failure followed by Planner replan/retry opens one recovery and Evolver; explicit progress batches continue until original-goal success |
| Experience | Versioned SKILL export/search/load; failure signals, possible causes, avoid rules, success/verification guidance and provenance; fixture skills labeled and separated |
| Persistence | Single-writer CAS journal, fsync, integrity checks, torn-tail recovery, separate immutable events and run projections; read-only historical session audits |
| Server/console | Local HTTP/SSE, request admission deduplication, one active run, reconnect snapshots, history/restart interruption, output/tool/TODO/brief/recovery inspection |

## Acceptance and limits

Local environment: Node 25.4, pnpm 11.19.0, Python 3.14. CI uses Node 22/Python 3.11.
The complete check command is `pnpm check`.

- 18 runtime tests: original DSH seams, native tool schemas/timeouts, custom-role
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
currently coordinates one original goal/recovery chain per run. Multi-goal scheduling,
configurable role-report schemas, distributed delivery guarantees, resumable DSH
sessions, long-horizon retention/compaction and multi-user hosting remain open.
Native delivery completion means session quiescence, not exactly-once business execution.
Cooperative cancellation cannot forcibly stop an uncooperative external device/tool.

## Step status and next implementation sequence

| Step | Status in this checkout |
| --- | --- |
| 00–01 | DSH integration and shared contract acceptance complete |
| 02–05 | Upper configuration, roles, explicit handoff, plans/files implemented; report-schema extensibility and distributed delivery remain open |
| 06–07 | Upper port and CPU fixture implemented; physical worker/resources/perception providers deferred |
| 08–10 | Upper verification/recovery/experience loop exercised with fixtures; actual provider evidence still required |
| 11 | Recovery and custom-role CPU scenarios pass; full physical-provider replacement scenario remains open |
| 12 | Runnable debugging console; visual design deferred, simultaneous key-state visibility required |
| 13–16 | Real simulation, release/transfer evaluation and hardware not started |

1. Harden upper configuration and lifecycle at remaining deployment boundaries;
   configure a live DSH model adapter only against an explicit available binding.
2. Extend the single-goal coordinator to plan-driven multi-subgoal progression,
   preserving verifier identity, original-goal recovery and owner-only decisions.
3. Define versioned role reports and validate configurable result handoffs without
   replacing the native DSH inbox; exercise delivery failures and cancellation.
4. Add bounded retention/checkpoints and recovery reconciliation appropriate to
   longer runs. Historical sessions must never silently resume physical commands.
5. Bind the physical worker transport, action gate and resource coordination, then
   one actual simulation/policy/perception configuration. Run physical acceptance.
6. Refine the unified console after these underlying states stabilize.

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
