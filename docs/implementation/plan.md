# Step-by-step implementation plan

Version: v1.95 · 2026-10-08

Use the [code map](../development/code-map.md) to locate implementation owners,
the [progress record](progress.md) for verified checkpoints and the
[v1 register](v1-delivery.md) for remaining acceptance. The
[project specification](../project-spec.md) defines the required behavior.

## Current development scope

Complete CPU-accessible implementation and debugging, including configuration,
role/tool admission, independent contexts, original-record inspection, transport,
resource ownership, shutdown and release preparation. GPU-dependent providers
receive source, protocol, preallocation and lifecycle checks during this phase.
Models, policy inference and simulator tasks remain stopped during CPU work.

The consolidated native campaign must independently validate loaded-model and
device behavior, original task success and complete installed workflows. On
`jd_B300`, that campaign may use one physical GPU selected from GPUs 2–4;
all model, policy, CUDA and graphics processes must use that same device.
Framework device selection remains configuration-driven.

Evolver development is paused and SceneState implementation is deferred. Existing
SKILL storage, explicit search and selective loading remain available. Hardware
interfaces are in scope; real robot experiments require their selected deployment.

## Sequence and gates

| Step | Owner and capability | Existing evidence | Remaining gate |
| --- | --- | --- | --- |
| 00 | Selected DSH source and host assembly | Exact provenance; actual model/tool Sessions | Preserve source/API boundaries through changes |
| 01 | Shared wire schema and semantic admission | Production TS/Python checks and original records | Provider-specific native faults and complete release matrix |
| 02 | Teams, role definitions and tool parameters | Ten authored Teams; 36 core tools; actual custom-role workflow | Additional configured Team/provider workflows |
| 03 | Independent native role contexts | Original role journals and source-bound context reads | Additional live model/context configurations |
| 04 | Explicit communication and evidence access | Actual context requests, reports, acknowledgements and scoped sources | Integrated multi-goal communication |
| 05 | Plans, native TODOs and private files | Original plan/execution admissions and completed native TODOs | Multi-goal completion with actual providers |
| 06 | Worker transport, ActionGate and resource ownership | Actual CPU subprocess/thread/socket checks and native stop evidence | Current-code loaded-model/device cancellation |
| 07 | Perception and active observation | Native SAM3.1/YOLO26, calibrated RGB-D and R1Pro observation | Additional measured geometry and motion concurrency |
| 08 | Independent post-execution verification | Native failed/successful outcomes and confirmed boundaries | Complete provider boundary matrix |
| 09 | Planner retry/replan and recovery linkage | Native retained-scene recovery on three providers | Tower prerequisite/recovery completion |
| 10 | Experience retrieval and Evolver | Failure-aware SKILL storage/search/section reads | Evolver paused; future transfer acceptance |
| 11 | CPU release preparation | Source-bound diagnostics on macOS and isolated Linux | Keep current-source checks passing |
| 12 | Console, launcher and retained Sessions | Packaged two-task Desktop; four-provider readiness | Full allocated switching and distribution validation |
| 13 | Native simulator/policy configurations | RoboDojo/RoboTwin/RoboCasa success; BEHAVIOR failure evidence | Tower, BEHAVIOR success and complete native campaign |
| 14 | Reproducible v1 release | Campaign preparation and original-source audits | Pass every active v1 gate before tagging |
| 15 | Additional configurations and experience transfer | Four simulator adapters share the same upper runtime | New compatible task/body/checkpoint and transfer evaluation |
| 16 | Physical robot deployment | Hardware interface, device watchdog and resource declarations | Selected robot with actual action/stop/task evidence |

For each change, read its owner and current source, implement the required
behavior, exercise production paths and relevant failures, inspect the result,
update its documentation and commit a coherent verified checkpoint. Use real
files, processes, sockets, provider records and native functions in CPU checks.
Recorded inspection preserves input hashes and performs no physical replay.
Native acceptance retains its original model, checkpoint, task and device sources.

## Step 00 — Establish the baseline and prove DSH integration

1. Inspect Git state, selected source provenance and current dependency bindings.
2. Mount the original DSH model, Session, tools, loop and context services through
   [runtime.ts](../../apps/server/src/runtime.ts).
3. Keep absorbed source in the module that owns its responsibility: loop in
   `agents`, dispatch in `tools`, model transport in `models`, context measurement
   and compaction in `memory`, shared registration scopes in `foundation`.
4. Verify exact source hashes, declarations and actual retained Session behavior.

**Gate:** DSH owns model turns, tool dispatch, follow-ups and cancellation.
The [import map](../provenance/dsh-imports.json) identifies every selected source.

## Step 01 — Maintain shared schemas and state boundaries

1. Edit the authoritative [physical schema](../../harness/contracts/schema/physical.schema.json)
   and regenerate declarations with `pnpm generate:contracts`.
2. Validate scope identities, units, frames, budgets, immutable task criteria,
   attempt lineage and device confirmation on both runtime sides.
3. Apply semantic authority checks through the domain owners before effects.
4. Inspect actual requests, status transitions, verdicts and recorded action receipts.

**Gate:** Unknown state, stale identities and invalid wire values fail at their
admission boundary. Job termination and TODO completion grant no task-success authority.

## Step 02 — Implement Team/Role loading and the tool catalog

1. Resolve `team.yaml`, role files, selected schemas, tools, models and provider bindings
   through [teams](../../harness/agent-runtime/teams/README.md).
2. Validate supported media, responsibilities and embodiment capabilities before allocation.
3. Freeze the effective Team snapshot and its digest for the chosen launch profile.
4. Generate detached model-visible parameters through
   [model-schema.ts](../../harness/agent-runtime/tools/src/model-schema.ts).

**Gate:** A custom role uses configuration and supported tools without a core role enum
change. Planner/Verifier tool authority and required nested parameter types remain explicit.

## Step 03 — Create independent DSH role Sessions

1. Create a new assignment and native Session for each new delegation.
2. Deliver its explicit InvocationBrief, prompt, tools and authorized evidence.
3. Continue an existing assignment through its own native follow-up delivery.
4. Inspect original model inputs and native histories for role identity and visibility.

**Gate:** New roles start with their own context. Source-bound measurement/projection
reads and Scope creation/disposal remain independent. See
[context checks](cpu-release-validation.md#native-context-and-scope-ownership).

## Step 04 — Maintain explicit communication and evidence access

1. Bind caller identity and authority to delegation, messages and context requests.
2. Persist versioned reports and immutable acknowledgement receipts before delivery.
3. Extend evidence grants only through authorized observation or handoff.
4. Preserve scoped delivery through missing-context continuation, cancellation and retirement.

**Gate:** Reports retain their original schema/version and caller. Historical references
grant no new evidence access. See [actual role workflows](role-context-acceptance.md).

## Step 05 — Maintain planning, native TODOs and private workspaces

1. Read the complete plan-write template from `planning.read`.
2. Commit structured plans with current version, actual owner and original criteria.
3. Select only ready goals whose prerequisite successes have accepted formal verdicts.
4. Keep native TODOs current and finish required plan/TODO rows before `tasks.finish`.
5. Preserve private assignment files and explicitly authorized artifact handoff.

**Gate:** Execution admission reads the committed plan and exact current attempt.
Prerequisite success requires its own verdict and completed plan row. See
[original plan checks](cpu-release-validation.md#model-visible-tool-schemas).

## Step 06 — Maintain worker transport and physical ownership

1. Validate worker configuration before optional SDK import or device allocation.
2. Own requests, bounded pipe input/output, response validation and subprocess shutdown
   in [native-worker-transport.ts](../../apps/server/src/native-worker-transport.ts).
3. Keep policy proposals behind the sole ActionGate; preserve scope, generation,
   control budgets, resource leases and confirmed device boundaries.
4. Own synchronous policy work and audit completion through caller cancellation
   and deadlines using [inference.py](../../harness/physical-runtime/src/physical_harness/policies/inference.py).
5. Share policy connection closure and complete client shutdown across concurrent
   or cancelled callers. Preserve caller-local cleanup and reject inference while
   connection closure is pending or failed.
6. Reject duplicate fields and non-finite numeric values during standard policy
   JSON decoding before inference, event handling or policy-tool delivery.
7. Bind JSON service ports before optional SDK/model initialization and start
   connection admission only after the selected policy is ready. Own bound
   listener cleanup through startup failure and normal shutdown.
8. Drain owned requests, threads, processes and listeners during shutdown.
   Managed services wait for their complete process group before clearing PID
   ownership. Preserve original graceful-deadline and forced-release failures.

**Gate:** Actual original errors remain observable. Unknown device state remains unknown;
transport loss cannot replay motion or create a confirmed stop. CPU and loaded-SDK
acceptance are identified separately in [CPU validation](cpu-release-validation.md).

## Step 07 — Maintain perception and active observation

1. Bind actual capture, SAM3.1 segmentation and YOLO26 detection providers.
2. Return source-linked images, masks and calibrated depth/range/coordinates to Planner.
3. Record the source observation, calibration, coverage, units and coordinate frame.
4. Map active-view intent to the embodiment's actual camera/head/base resources.
5. Keep SceneState outside the active implementation scope.

**Gate:** Every metric identifies its actual source and uncertainty. Unsupported
calibration or motion fails explicitly; competing motion respects resource ownership.
See [perception](../../harness/agent-runtime/perception/README.md).

## Step 08 — Maintain independent post-execution verification

1. Accept formal review only after eligible ended execution and confirmed device stop.
2. Preserve `policy_stop`, `planner_stop`, `episode_terminated` and `budget_exhausted`.
3. Create a fresh Verifier with the exact goal, attempt, criteria, boundary and evidence.
4. Preserve failed/unknown outcomes and enforce formal verdict coverage and ownership.

**Gate:** Running frames and ordinary pauses stay with Planner. Budget exhaustion
requires formal verification; cancellation/backend failure establishes no success.
See [verification boundaries](verification-boundaries.md).

## Step 09 — Maintain Planner decisions and recovery linkage

1. Admit resume, retry, replan, finish and abandon only from the current decision owner.
2. A failed formal attempt permits explicit retry with a factual summary and changes.
3. Retain the environment, original criterion and per-goal execution limits.
4. Capture new evidence and commit the plan before starting the admitted next attempt.
5. Resolve recovery only when its original goal formally succeeds.

**Gate:** Providers and other roles cannot create retry decisions. Repeated requests
preserve attempt identity. See [current Agent loop](current-agent-loop.md) and
[multi-goal admission](multi-goal-runtime.md).

## Step 10 — Maintain retrievable skills and deferred evolution

1. Persist immutable, failure-aware SKILL documents with original provenance and limits.
2. Return metadata from `skills.search`; load selected documents/sections only on request.
3. Preserve required scope, limitations and source sections on selective reads.
4. Keep recovery linkage while live Teams have `learning_enabled: false`.

**Gate:** Experience informs Planner/Verifier without changing current criteria or
evidence permissions. Evolver execution/publication remains paused. Future resumption
requires original-goal formal success and independent experience-transfer acceptance.
See [memory](../../harness/agent-runtime/memory/README.md).

## Step 11 — Complete CPU release preparation

1. Run full source, schema, role, provenance, dependency and Python checks,
   including all TypeScript diagnostic entries and configured endpoint admission.
   The [consolidated CPU campaign](cpu-release-validation.md#consolidated-cpu-campaign)
   runs source checks, real process/transport owners, original contexts and readiness
   from one explicit original-input configuration, including all four native CLI
   entries, initialization observers and configured scene/endpoint admission.
2. Exercise actual worker processes, original request recording, WebSocket transport,
   inference-thread ownership, scoped failure records and cleanup.
3. Inspect original native model schemas, plans, role histories and context projections.
   Exercise native visual-history pre-step admission with original image groups,
   retaining full audits, independent contexts and explicit over-budget failures.
4. Verify actual Console readiness, initialization/running signal ownership and
   foreground-service admission/shutdown. Exercise startup cancellation, global
   closure and independent shared service admissions with real owned processes.
5. Run the affected checks from committed source in isolated Linux dependencies.
6. Prepare the configured native campaign without allocating a model or environment.

**Gate:** Every CPU result records source identity, original inputs, observed outcomes
and released ownership. No model or simulator result is supplied by a diagnostic.
See [CPU release validation](cpu-release-validation.md).

## Step 12 — Maintain Console, launcher and retained user Sessions

1. Bind compatible environment, embodiment, policy/checkpoint, Team and model selectors.
2. Retain one environment across sequential tasks until explicit Session close.
3. Show actual role output, tools, plans, TODOs, verdicts and resource status on one interface.
4. Record headless simulator video on the worker; keep the Console focused on Agent trace.
5. Preserve historical-context selection, restart reconciliation and idle-only maintenance.
6. Validate packaged startup and complete owned Session/service shutdown.

**Gate:** UI state comes from actual events and scoped reads. Additional configured
roles require no special Console implementation. See [user Sessions](user-sessions.md),
[headless simulation](headless-simulation.md) and [Desktop](../../apps/desktop/README.md).

## Step 13 — Validate native simulator and policy configurations

1. Pin the installed BEHAVIOR, RoboCasa, RoboTwin and RoboDojo sources and compatible checkpoints.
2. Keep datasets in `data/`, weights in `checkpoints/` and isolated SDK/model dependencies.
3. Verify native reset, observations, calibration, capabilities, action specifications and task checks.
4. Exercise actual model-driven subgoal execution, ActionGate controls, formal verification and retry.
5. Independently verify task success, video decoding, unchanged-terminal continuity and shutdown.
6. Complete RoboDojo `build_tower`, original BEHAVIOR task success and the remaining matrix.

**Gate:** Each accepted configuration retains original source/checkpoint/task/model/device
identity and actual actions, verdicts and decoded video. Failed outcomes retain their
observed result. See the [native release campaign](native-release-campaign.md).

## Step 14 — Complete v1 acceptance and reproducible handoff

1. Run the consolidated campaign sequentially against the frozen installed configuration.
2. Verify every active row in the [v1 register](v1-delivery.md).
3. Preserve original source, policy request/response, action, trace, media and cleanup evidence.
4. Publish the exact supported configuration matrix and verified installation/run instructions.
5. Update architecture/module documentation and SVGs for the delivered behavior.
6. Tag v1 only after its required gates pass.

**Gate:** Current-code native workflows and failure boundaries have independent
acceptance. CPU preparation and old run inspection retain their stated scopes.
Paused/deferred work and subsequent hardware experiments remain explicitly identified.

## Step 15 — Extend configurations and evaluate experience transfer

1. Bind additional supported tasks, scenes, embodiments and policy checkpoints through configuration.
2. Validate their native observation/action/calibration/criteria interfaces and full workflows.
3. When experience evolution resumes, freeze source skills and compare target runs with and without retrieval.
4. Record target applicability, adaptation, neutral/negative outcomes and source evidence.

**Gate:** An additional configuration has its own task/device acceptance. Transfer
claims require source and destination evidence with comparable task semantics.

## Step 16 — Integrate and independently verify real hardware

1. Select the robot, SDK/ROS2/DiMOS binding, policy, operating limits and authorized scope.
2. Validate actual sensors, calibration, connection identity and read-only observations.
3. Verify bounded actions, resource ownership, device-local stopping and disconnect behavior.
4. Replace simulation fact checks with actual visual/device evidence; preserve uncertainty.
5. Run tasks through the existing Team, Console and independent verification services.

**Gate:** Retain actual action/stop acknowledgements, task outcomes, device identity
and a reproducible configuration. Hardware experiments follow simulation/interface acceptance.

## Progress records and interrupted-work handoff

Record exact source revision, configuration/input hashes, production commands,
observed results, private artifact paths, acceptance limits and next required work
in [progress](progress.md) and the appropriate capability guide. Preserve original
failure evidence and task outcomes. Keep public documentation in English and
architecture diagrams in SVG.

On resumption, inspect current Git/source state, read the progress/spec/module
owners and continue the first active unfinished requirement. Preserve user changes,
independent role contexts, Planner authority, formal verification and ActionGate.
Commit and push coherent verified checkpoints without rewriting published history.
