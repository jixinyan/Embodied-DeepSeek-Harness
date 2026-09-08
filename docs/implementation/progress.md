# Implementation progress

Spec: v1.7. Architecture: [ownership](decisions/0001-edh-owned-skeleton.md) and
[unified harness layout](decisions/0002-unified-harness.md).

**Current checkpoint: Steps 00–01 complete. F1 complete. Next: Team/Role binding onto DSH (F2).**

The latest accepted priority is to harden all MVP-critical mechanisms (agents, tools, communication, execution,
verification, experience, persistence and application lifecycle),
then deliver a runnable simulation-to-console MVP. Read
[foundation acceptance](mvp-foundation.md) before continuing. F1 has passed its local boundary acceptance; F2–F7 remain unimplemented. The historical
step statuses below are unchanged because runtime integration is still outstanding.

See the [current capability map](features.md) for a visual split between reused DSH,
standalone EDH helpers and remaining implementation.

## Delivered capabilities

- Original DSH loop, model/tool services, sessions and scoped lifecycle selectively
  absorbed into EDH. No independent replacement loop or full upstream product.
- Trusted host assembly and explicit scoped-session creation. Nine keyless runtime
  tests check actual model inputs/results, wake-up, cancellation and teardown.
- Shared schema and generated TypeScript; Python interfaces; role/team/tool/skill
  examples; English specification, SVG figures, module map and implementation plan.
- Matching TS/Python wire validators and pure execution, verification and recovery
  gates; 77 shared wire cases and 69 shared lifecycle cases pass in both languages.
- F1 typed message registration, shared ToolCall/ToolOperation and selected-tool
  input/output/replay gates; 84 additional cross-language cases.
- Per-file source hashes, original MIT notices and documented compatibility patches.

Still unimplemented: Team/Role loading, validated assignment briefs, durable EDH
communication, physical providers/jobs, async Verifier, owner retry coordination,
Evolver/SKILL services, live console, simulator adapters and real robot support.
The host uses an in-memory session store and a scripted model in tests. It does
not yet implement the Team-level AgentFactory contract or physical execution.

## Functional plan status

| Step | Status | Next concrete work |
| --- | --- | --- |
| 00 | done | Original DSH loop, scoped sessions, structured tool, wake-up and cancellation verified |
| 01 | done | Versioned wire schemas, TS/Python validation and state/attempt/evidence gates verified |
| 02 | not_started | Implement Team/Role loader and tool binding validation |
| 03 | not_started | Implement fresh scoped role sessions; inspect actual model inputs |
| 04 | not_started | Implement scoped communication, durable delivery and evidence access |
| 05 | not_started | Implement planning and private workspace tools |
| 06 | not_started | Implement CPU worker jobs, budgets and resource coordination |
| 07 | not_started | Implement CPU perception and active-observation tool slice |
| 08 | not_started | Implement async verifier and mandatory post-budget verification |
| 09 | not_started | Implement owner-only retry/replan and original-goal recovery linkage |
| 10 | not_started | Implement Evolver lifecycle and versioned SKILL storage/retrieval |
| 11 | not_started | Run the full CPU recovery acceptance scenario |
| 12 | not_started | Implement the live console on authoritative events |
| 13 | not_started | Integrate real BEHAVIOR, compatible policy and limited GT |
| 14 | not_started | Complete v1 acceptance, reproduction and evaluation |
| 15 | not_started | Add a second real configuration and assess transfer |
| 16 | not_started | Bind and verify actual hardware |

## Verification evidence

Local verification on 2026-09-08: Node v25.4.0, pnpm 11.19.0, Python 3.14.0.

| Check | Observed result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; all 19 workspace projects resolve |
| `pnpm check` | Passed: formatting, schema, provenance, TypeScript, structure, Python, runtime and shared contract suites |
| `pnpm check:provenance` | 90 source files, source import closure, 20 referenced module bindings and runtime metadata path checked |
| `pnpm check:contracts` | Generated types current; 6 example wire fixtures and structural rejection cases |
| `pnpm typecheck` | Three foundation declaration builds plus strict EDH/non-foundation DSH checks |
| `pnpm check:structure` | 18 private source workspaces; English public text and local links |
| `pnpm check:python` | 15 CPU modules compile/import; repository SVG XML valid |
| `pnpm test:runtime` | 9 runtime tests pass; no skipped cases |
| `pnpm test:contracts` | 230 shared wire/lifecycle/boundary cases pass in each language, plus non-JSON rejection tests |

The runtime tests are actual Step 00 acceptance, using a scripted model boundary.
They do not prove model intelligence, task success, GT verification or robot support.
No live model API, simulation, GPU policy or hardware test has been run. GitHub CI
uses Node 22 / Python 3.11; its result is reported by the workflow separately.

## Source and integration decisions

The selected graph contains 90 files from 21 upstream modules, mapped to agents,
models, tools, storage and foundation. The source audit added attachment definitions
missing from the earlier manifest closure and excluded unused optional peers.
The original agent-loop algorithms are unchanged. Local patches translate two
comment examples and bind provider attribution to EDH's root product metadata.
The original relative manifest lookup did not survive source relocation; its fix
and runtime asset are tracked alongside source hashes.

Native DSH module names remain internal local aliases. The application, CLI,
configuration Loader, presets and console are not copied. Original runtime module
relationships include cyclic type/service references; source workspaces declare
them explicitly instead of rewriting the upstream loop to force an artificial DAG.
No published package build is claimed.

[The integration guide](dsh-integration.md) provides exact API signatures,
composition, acceptance tests, compiler boundaries and remaining limits.

## Handoff

Read [decision 0003](decisions/0003-reuse-dsh-mechanisms.md) first: native loop, tools,
validation, sessions, inbox/followup and cancellation are reused from DSH. Continue F2
in [the foundation plan](mvp-foundation.md): minimum Team/Role loading,
model capability preflight, frozen assignment/tool bindings and authenticated routing
through existing DSH sessions. Read [boundary APIs and migration](boundaries.md).
Bind identity to the actual caller, enforce destination/assignment lifetime and make
explicit context requests. Preserve cancellation/cleanup and inspect actual model
inputs. Do not expose a raw arbitrary-envelope sender to model tools.

F1's pure functions do not perform live authorization, deduplication, scheduling or
network communication. F2–F7 must implement and verify the complete core coverage
matrix before the real-simulation MVP, without marking interface declarations complete.

Do not create another loop, regenerate from a full DSH clone or install robot/GPU
dependencies for CPU work. Example YAML is not yet a working Team loader. Current
contract gates are pure functions: later services must supply authoritative state,
identities and facts and enforce transitions atomically. They do not run a verifier,
communicate across processes, execute a policy or publish SKILL files.

Version checkpoints: `1109790` records the unified skeleton; `cd5e032` records source
absorption; `56ea601` records Step 00 assembly and acceptance; `c062126` records shared
wire validation. The subsequent Step 01 commit records lifecycle acceptance and this
handoff. Preserve published history and commit each verified work slice.

## Step 01 decisions and evidence

One JSON Schema owns versioned fields and transition tables. Generated TypeScript is
only a static projection; runtime validators retain conditional branches and check
local field relations. Python loads the same source via an explicit path. Both reject
unsupported versions, malformed identity/time/unit values and non-JSON input.

Pure lifecycle gates reject old attempts, executions, verification requests,
assignments and criteria, stale/cross-clock/debug evidence, unauthorized resume,
budget violations and unknown-as-success. A recovery can resolve only against the
original goal and its retry lineage; prerequisite success is insufficient. A supplied
recovery verdict must already pass the formal verdict gate. These checks assume a
trusted service supplies identity and provider facts; runtime integration is future work.

CPU dependencies are pinned in the pnpm lockfile and Python constraints. The setup
and CI create a local Python environment; no simulator, GPU or model key is required.
See [contract APIs and exact limits](contracts.md) and the shared case corpora for
reproduction. Schema v1 remains a pre-release draft, not a deployed compatibility claim.

## F1 boundary acceptance

Typed messages resolve registered payload schemas and compare version/kind, task,
assignment, sender and correlation fields. Tools use a generated shared call schema;
selected input/output are checked, async identity survives completion and redelivery
cannot change the request or deadline. Unknown acceptance can be reconciled without
inventing an operation ID or treating timeout as stop. A custom message/schema path
is exercised in both languages. These are contract gates, not the services themselves.

`be72630` records the expanded core-first MVP plan. The following implementation
commit records F1 code, fixtures and guide. Existing source provenance is unchanged.

## DSH reuse alignment

Native `@edh/tools` now directly re-exports DSH authoring/types. Generic registry and
executor placeholders were replaced by explicitly physical provider ports. The standalone
F1 validator was renamed PhysicalBoundaryValidator; ordinary DSH tools/messages do not
require it. Three additional tests prove direct native API reuse, scalar output through
the original loop and DSH-owned input/output rejection. No upstream source was modified.

Timeout metadata is available upstream but its enforcement plugin is not mounted.
Disk persistence has an interface but no mounted backend. Full Team routing, Python
workers, verifier/evolver agents, simulation and console are still unimplemented.

### Upper-system-first checkpoint (2026-09-08)

The current user priority is to complete the upper application and a runnable
console before implementing physical runtime providers. A clearly labeled CPU
fixture will exercise the integration boundary; it is not simulation evidence.

Implemented configuration preflight with immutable role prompts, model/tool/provider
availability checks, duplicate YAML rejection and role path containment. Added a
single-writer local domain store with compare-and-swap versions, fsync, detached
reads, corruption refusal and recovery of an incomplete final record. Its lock
requires explicit removal after an unclean process exit; no automatic takeover.
This store does not replace DSH sessions or claim resumable session persistence.
Validation: 11 runtime tests, TypeScript and workspace structure checks pass.

### Runnable upper workflow checkpoint (2026-09-08)

The application now composes isolated DSH role sessions and assignment-bound native
tools. It runs explicit delegation/message delivery, versioned plans, private logical
files, permissioned evidence reads, formal boundary verification, owner-only retry,
and recovery skill publication. Goal criteria are deployment input, outside model
authority. Imported the unmodified upstream cooperative tool timeout policy.

A CPU fixture model emits native DSH tool-call chunks and a separate fixture backend
emits execution/sensor records. The full retry-success path, first-pass success,
unknown/backend-error outcomes, pause/formal-check/resume and cancellation pass 14
runtime tests. This is not a live model, simulator, learned policy or hardware test.
Session events are retained as read-only audit exports, not restartable DSH sessions.
Physical transport, shared device arbitration and deployment adapters remain deferred.
Console implementation and adversarial/restart acceptance checks follow this checkpoint.

The subsequent user clarification is now reflected in the workflow: the planner's
formal-failure replan/retry decision opens recovery, with a planner-supplied attempt
summary and proposed changes. The Evolver receives persisted, explicit progress
batches until original-goal success. Added decision 0004 with the VoLo reference and
physical action admission requirements. The physical chunk gate remains deferred.

### Console service checkpoint (2026-09-08)

Added `pnpm demo`: local HTTP/SSE console with actual DSH-backed fixture runs,
explicit fixture scenarios, pause/resume-request/stop, versioned plan display,
role/brief inspection, latest versus agent-seen observations, verification and
SKILL/recovery/session-audit inspectors. Historical runs are read-only. Admission
has request-key deduplication, one active run and interrupted-start refusal.
Restart preserves records and marks unfinished history interrupted without resubmission.
SSE backpressure coalesces snapshots until drain instead of disconnecting a reader.
Full checks pass with 17 runtime tests and the existing shared wire/lifecycle cases.

The user's next refinement prioritizes a debugging workbench over decorative
visualization: live agent output, detailed TODO status/history, correlated tool and
assignment inspection, and a simpler coding-agent-style layout. The initial console
is a verified checkpoint; that refinement is the active next action.

### Native observability checkpoint (2026-09-08)

Mounted the original DSH TODO plugin per authorized session and projected native
assistant output, streaming output, tool calls/results, turn/step identity and TODO
history into the console. TODO completion remains agent-reported progress; formal
physical success still requires an accepted verifier result. Event records are now
stored separately from run projections to avoid repeatedly persisting full histories.
Full checks pass with 17 runtime tests and 93 pinned DSH source files.

The user has deferred further UI design. The eventual console must expose key agent,
plan, execution, sensor, verification and recovery state together in one workspace,
without requiring page or tab switching. Current inspector tabs are provisional.
Next work is upper-runtime robustness and extension acceptance, not visual polish.

### Extension and assignment admission acceptance (2026-09-08)

A user-defined ROLE.md and native perception tool now have application-level
integration acceptance: explicit handoff reaches actual model inputs; parent
history/files remain private; evidence grants and decision ownership are enforced.
Custom tools retain native DSH schemas/dispatch while sharing EDH lifetime checks
and activity events. Cancellation rejects new custom invocations. Concurrent
creation of the same assignment now reserves admission before asynchronous setup.
TODO state is session-local and cannot imply physical success. Runtime coverage is
18 passing tests. Runtime data directories are excluded from public text linting.
