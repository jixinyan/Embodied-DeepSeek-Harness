# Step-by-step implementation plan

This is the construction sequence. Section references point to the
[project specification](../project-spec.md). Work packages group responsibilities;
these steps define executable slices, prerequisites and acceptance gates.

**Step 00 has passed its local runtime acceptance. Steps 01–16 remain unimplemented.**
Skeleton interfaces and examples are implementation inputs, not completed behavior.
[Progress](progress.md) records actual state. Steps 00–14 deliver v1; 15–16 extend it.
A checklist or document change never substitutes for execution evidence.

## Sequence and gates

| Step | Capability | Prerequisite | Work package / milestone | Enables |
| --- | --- | --- | --- | --- |
| 00 | Pin and selectively absorb DSH; prove its runtime entry | None | Preparation | Runtime-backed contracts and modules |
| 01 | Shared protocol and state contracts | 00 | W01 | Consistent TypeScript/Python boundaries |
| 02 | Team/Role loader and tool catalog | 01 | W02 | Inspectable configuration snapshots |
| 03 | Independent DSH role sessions | 02 | W03 | User-authored role execution |
| 04 | Explicit communication, durable events and evidence | 03 | W03 | Asynchronous cooperation and handoff |
| 05 | Planning/files and default roles | 04 | W04 | Persistent upper-level work |
| 06 | CPU worker, resources and hardware contracts | 05 | W05 / M0 | Nonblocking jobs and confirmed device state |
| 07 | Perception, active observation and provider replacement | 06 | W05 | Tool-based observation tasks |
| 08 | Async Verifier and mandatory formal checking | 07 | W06 | Authoritative post-budget outcomes |
| 09 | Owner retry/replan and recovery linkage | 08 | W06 | Original-goal recovery tracking |
| 10 | Evolver and skill storage/retrieval | 09 | W06 | Traceable recovery knowledge |
| 11 | Full CPU acceptance slice | 10 | W01–W06 integration gate | Stable target for console and simulator integration |
| 12 | Console on live framework events/streams | 11 | W07 / UI portion of M3 | Operable and explainable task process |
| 13 | Real BEHAVIOR and policy compatibility | 12 + actual resources | W07 / real-environment M1–M2 | First actual simulation configuration |
| 14 | v1 acceptance and reproducible handoff | 13 | M0–M3 | Evidence-backed release candidate |
| 15 | Second environment/body and transfer evaluation | 14 | M4 | Tested replaceability and transfer claims |
| 16 | Specific real robot integration | 14 + hardware binding | M5 | Separate real-device evidence |

Milestones are capability groups, not code-writing order. Develop recovery and memory
on CPU test backends before real simulator acceptance. Step 11 proves the framework
protocol loop; Step 14 establishes the v1 simulation delivery.

For each step: inspect prerequisite evidence → implement a minimal working slice →
exercise normal and important failure paths → update progress → continue. Re-run affected
checks after changes; do not repeat broad checks without a reason. Default to sequential
construction; any later work split must preserve the dependency gates. Commit coherent,
verified checkpoints frequently within a step.

## Step 00 — Establish the baseline and prove DSH integration

**Prerequisite:** Source assets in spec Section 0 can be located. Continue the existing
EDH checkout and preserve user changes.

1. Verify DSH revision, source instructions, dependency declarations and workspace state.
   Locate optional legacy/demo assets. Record spec v1.4 and initial step states in progress.
2. Selectively absorb necessary DSH source into EDH, inspect imports/dependencies and
   preserve provenance. Run relevant type/integration checks and separate baseline
   failures. Do not copy the entire upstream product or install robot/GPU dependencies.
3. Run a minimal DSH-native loop with a scripted model adapter, one tool returning a
   structured result, and one subsequent host-delivered message.
4. Verify scoped factory, target prompt/tools, background wake-up and cancellation/event
   hooks. Record actual API signatures, internal assembly and necessary patches in
   `docs/implementation/dsh-integration.md`.

**Deliver:** Working DSH integration experiment, baseline results and concrete EDH
assembly points.

**Gate:** Actual tool calls and follow-up inputs advance through DSH's original loop.
No new model loop exists. If APIs differ from the researched baseline, fix and document
the bridge before Step 01.

## Step 01 — Fix shared schemas and state contracts

**Prerequisite:** Step 00. Primary locations: `harness/contracts/`, `tests/contracts/`.

1. Refine the single schema source for teams, roles, tools, briefs, envelopes, reports,
   plans, observations/media, subgoals, execution, verification, recovery and skills.
2. Specify required fields, scope, units/frames/time, errors and version compatibility.
   Distinguish defaults from references that must resolve during assembly.
3. Define checkable execution/verification/recovery transition tables. Reject completion
   based only on job termination, automatic budget renewal, or unknown treated as success.
4. Validate identical positive/negative JSON fixtures in TypeScript and Python. Cross-file
   unknown-tool/member errors belong to Step 02 semantic loading, not pure JSON shape.

**Deliver:** Authoritative schemas, cross-language fixtures, transition tables and versions.

**Gate:** Both sides accept the same valid values and reject invalid identity, units and
versions. Old-attempt verdicts cannot advance new attempts. Resolve missing protocol
fields here rather than allowing each side to invent them independently.

## Step 02 — Implement Team/Role loading and the tool catalog

**Prerequisite:** Step 01. Locations: `harness/agent-runtime/teams/`, `harness/agent-runtime/tools/`, `examples/`.

1. Read team.yaml, ROLE.md and tool packs; resolve relative paths, built-ins, toolsets,
   provider bindings and documented defaults.
2. Check aliases, responsibilities, schemas, model/media capabilities and device
   compatibility. Diagnostics identify the file, field and missing capability.
3. Freeze a TeamRunSnapshot with effective instructions, tools, provider bindings and
   versions. Loading/preflight must not initiate physical motion.
4. Provide a documented, tested preflight command. Adding a role with existing providers
   requires only a role file and team member entry.

**Deliver:** Loader, catalog, snapshots, examples and actionable preflight diagnostics.

**Gate:** Load the minimal team; add roles without changing a core enum. Reject missing
providers/responsibilities and incompatible models before startup. CPU defaults never
import SAM, torch or simulator packages.

## Step 03 — Create genuinely independent DSH role sessions

**Prerequisite:** Step 02. Locations: `harness/agent-runtime/agents/`, `harness/agent-runtime/teams/` and DSH bridge.

1. Build instances from snapshots, assigning a fresh assignment/session for every new
   delegation and explicitly selecting that role's prompt, tools and resource view.
2. Inject validated InvocationBrief and a private workspace. Continue the same assignment
   with its own messages; never automatically reuse old context for new work.
3. Connect structured reports, cancellation and failure results. Publish instance lifecycle
   and current work through events.
4. Inspect actual model inputs using a recording adapter for unintended parent composition,
   history, workspace or tool leakage.

**Deliver:** Role factory, independent-session lifecycle and model-input acceptance checks.

**Gate:** A withheld Planner marker is absent from scene inputs until explicitly handed
over. Scene cannot see or invoke execution.start unless authorized in its effective
role. A prompt instruction alone is not permission enforcement.

## Step 04 — Implement explicit communication and evidence access

**Prerequisite:** Step 03. Locations: `harness/agent-runtime/communication/`, `harness/agent-runtime/storage/`,
`harness/agent-runtime/tasks/` and scoped evidence services.

1. Implement nonblocking delegation, send/reply, context.request/response and scoped
   subscriptions. The caller continues after acceptance rather than awaiting a long rollout.
2. Verify real identity/permissions; assign IDs, causation/correlation and task sequences.
   Persist formal requests/results before delivery and deduplicate redelivery.
3. Resolve authorized evidence references. Separate raw media, critical events and
   actual agent-seen messages/frames; a reference grants no blanket access to task data.
4. Handle reconnect delivery, status queries, timeouts/cancellation and missing context.
   Frame coalescing must not discard budget or stopping events.

**Deliver:** Router, recoverable event records, evidence interface and cross-role traces.

**Gate:** Authorized non-parent/child members communicate; duplicates do not create new
assignments. Missing context prompts explicit requests. No sender impersonation or GT
visibility bypass. Trace acceptance, processing and actual model-visible input separately.

## Step 05 — Add upper-level tools and default roles

**Prerequisite:** Step 04. Locations: `harness/agent-runtime/planning/`, `harness/agent-runtime/files/`, `harness/agent-runtime/agents/`.

1. Implement durable PlanDocument, expected-version updates and DSH todo/UI projection.
   Keep plan progress distinct from authoritative goal/verdict state.
2. Add private file read/write/edit/list/search and explicit artifact handoff. Ensure
   subprocess search obeys the same scope as file-provider access.
3. Register individual schema-bearing planning, file, communication and evidence tools;
   avoid an opaque arbitrary-string tool dispatcher.
4. Adapt useful legacy top_agent planning/context practices into default role instructions.
   Remove fixed manipulation/navigation trees, robot constants and lower-level autonomous
   retry. Clearly disable bindings to providers that do not yet exist.

**Deliver:** Persistent upper-level work tools, default roles and async-turn work state.

**Gate:** Same-named files in two assignments do not collide; plans survive follow-ups;
writing todos cannot fabricate success. A custom scene role can receive context, request
missing information, use tools and return a report.

## Step 06 — Implement CPU execution and physical resource contracts

**Prerequisite:** Step 05. Locations: `harness/agent-runtime/execution/` and Python execution,
embodiment and backend modules.

1. Connect TypeScript host and Python CPU worker through versioned requests/events.
   Begin with test policies/devices declaring capabilities, step semantics and pause/stop support.
2. Implement submit/query/pause/resume/stop job lifecycle. Return execution_id promptly,
   advance actions in the background and measure control-step/wall-time budgets separately.
3. Schedule actual actuator/base/head resources exclusively where required. Transfer
   resources only after confirmed release/stop, never based on model prose.
4. Implement idempotent acceptance, duplicate queries and reconciliation after disconnection.
   Budget expiry stops new actions and emits a durable boundary event.
5. Test at least two capability profiles: independent gimbal and base-dependent viewpoint
   change. Include a backend that cannot resume in place.

**Deliver:** Nonblocking worker bridge, resource coordination and hardware-contract doubles.

**Gate:** One idempotency key starts one job; request differs from confirmed pause;
reconnect does not replay motion; action chunks do not create new attempts; exhausted
budgets stop control. These tests do not establish real-hardware support.

## Step 07 — Connect perception and active observation tools

**Prerequisite:** Step 06. Locations: `harness/agent-runtime/perception/`, `harness/agent-runtime/observation/`
and Python providers.

1. Implement capture, segmentation and depth/localization contracts with readable images
   and known calibration fixtures. Check observation, mask, overlay, entity and frame linkage.
2. Bind two CPU test segmentation providers to the same logical tool. Change only the
   provider binding, keeping role and observation fixed; label them as test implementations.
3. Map active-view intent to actual device actions/resources. Return achieved pose and
   a new observation; “look left” can require different resources on different bodies.
4. Store/report perception evidence without global cross-task scene-memory side effects.
   Preserve native TS, Python RPC and MCP boundaries; heavy actual providers arrive in Step 13.

**Deliver:** Pluggable perception, active-view path and a complete scene-role tool assignment.

**Gate:** Swapping provider leaves the role unchanged. Missing calibration/frames produce
explicit unavailability. Conflicting base observation/policy control cannot run together.
Every candidate can be traced to the input frame and output evidence.

## Step 08 — Implement async Verifier and mandatory formal checking

**Prerequisite:** Step 07. Locations: `harness/agent-runtime/verification/`, `harness/agent-runtime/tasks/`
and Python fact providers.

1. Start Verifier as an independent DSH agent with its brief. Coalesce latest frames/clips,
   allow one in-flight model request and retain critical execution events separately.
2. Implement feedback and authorized pause requests with observation time/sequence/attempt.
   Do not grant retry/replan authority.
3. Persist verification requests at budget expiry and other execution boundaries even
   when Planner does not call a verification tool. An old in-flight monitor response
   cannot substitute for fresh formal evidence.
4. Connect limited GT tools and formal reports. Check final owner, version, coverage and
   factual consistency. Preserve unknown for missing evidence, unsupported checks or
   uncertain device state.

**Deliver:** Concurrent monitoring, pause feedback, forced verification and verdict gates.

**Gate:** Feedback arrives during execution; budget expiry always creates a formal request;
stale frames/attempts or non-owner verdicts are rejected. Explicit GT false cannot become
passed. A pending monitor request must not swallow a termination/verification event.

## Step 09 — Implement Planner decisions and recovery linkage

**Prerequisite:** Step 08. Locations: `harness/agent-runtime/tasks/`, `harness/agent-runtime/communication/`
and Planner decision tools.

1. Add resume/retry/replan/finish/abandon with current decision-owner validation. Only
   an explicit upper decision creates a new attempt; providers cannot retry independently.
2. After accepting retry, create recovery_id with original goal, criterion version,
   failed attempt, evidence and changes. Persist retry.started for Step 10.
3. Link any prerequisite goals introduced by replanning. Close successful recovery only
   when the original goal formally passes; record failure/abandonment distinctly.
4. Handle delayed feedback, duplicate requests, cancellation and unconfirmed prior stops.
   Prevent overlapping new attempts on the same physical resource.

**Deliver:** Decision tools, recovery correlator and traceable multi-attempt records.

**Gate:** For “cup outside cabinet → open cabinet → place cup,” opening the door does
not resolve the original goal. Verifier/Evolver/policy retries are rejected. Duplicate
acceptance does not create multiple chains.

## Step 10 — Implement Evolver and retrievable skills

**Prerequisite:** Step 09. Locations: `harness/agent-runtime/memory/`, `harness/agent-runtime/agents/` and DSH skill bridge.

1. On retry.started, create a fresh Evolver with original failure, recovery goal, changes
   and authorized evidence. Send subsequent attempts in the same chain explicitly.
2. Record while execution continues. Before formal original-goal success, save work
   records only, not successful-recovery skills.
3. Generate a versioned bundle with decision/verification knowledge, prerequisites,
   scope, sources and limitations. Validate and atomically save before experience.created.
4. Implement skills.search/load with task semantics and capability/criterion compatibility.
   Isolate fixture and real libraries; new agents retrieve explicitly rather than receiving
   the entire library in their prompts.

**Deliver:** Evolver lifecycle, skill persistence/versioning/retrieval and traceable reports.

**Gate:** Ordinary success does not start Evolver. Failed recovery or prerequisite success
cannot publish success skills. Duplicate completion does not produce duplicate versions.
Fresh compatible Planner/Verifier assignments can explicitly retrieve knowledge;
incompatible skills cannot become universal rules or change authoritative criteria.

## Step 11 — Pass the complete CPU acceptance slice

**Prerequisite:** Recorded gates for Steps 00–10. Locations: task integration tests,
`tests/contracts/`, `tests/integration/` and `examples/`.

1. Implement spec Section 16.3 as one reproducible run: custom scene role, perception,
   attempt_1 failure, Planner retry, independent Evolver, formal attempt_2 success,
   then skill retrieval in a fresh task.
2. Inspect actual DSH model-adapter briefs/tool schemas/messages. Save media references,
   the event chain and final report rather than checking only helper flags.
3. Add failure variants for duplication, stale verdicts, disconnect, unconfirmed pause,
   missing context, GT isolation and unresolved original goals.
4. Document actual installation/run commands, expected outputs and diagnostics. Run
   affected checks and separate upstream baseline issues from new failures.

**Deliver:** GPU-free framework demonstration, integration acceptance and readable evidence.

**Gate:** A fresh checkout reproduces the same states/events without model keys, SAM or
simulators. Label all results as test fixtures. Only then use the protocol as the stable
integration target for production UI and actual environments.

## Step 12 — Connect the physical console to framework data

**Prerequisite:** Step 11. Locations: `apps/console/`, server/gateway projections.

1. Map approved layout areas to spec Section 10 fields. Derive state from events/queries,
   not from parsing natural-language model claims.
2. Add team preflight/selection, tasks/constraints, pause/termination intent and Planner
   feedback. Distinguish accepted, processed and device-executed commands.
3. Display streams/overlays, private sessions, effective tools, device state, verdicts
   and recovery; compare current sensor frames with actual agent-seen evidence.
4. Add read-only history, stale/disconnected signals, skill sources and retrieval records.
   Clearly distinguish fixtures, replay and actual runs.

**Deliver:** Event-backed console on CPU fixtures/replay; actual sensors connect in Step 13.

**Gate:** Users operate and inspect the Step 11 scenario; a new scene member appears without
special UI code. Unconfirmed pause is not shown as paused. Replay emits no physical
commands and debug GT does not leak to agents. Refresh/reconnect restores state.

## Step 13 — Integrate BEHAVIOR and the first actual policy

**Prerequisite:** Step 12 plus actual simulator resources, robot configuration and
compatible policy. Locations: Python environment/policy/body/perception/verification
modules and deployment examples.

1. Inspect actual legacy environment/policy/perception/motion entry points and dependencies.
   Install selected locked simulator/checkpoint/providers in an isolated optional environment.
2. Validate adapters first: reset, observations, capabilities, entities, frames/units,
   frequency and success-contract mapping. Do not hide backend defects behind agents.
3. Verify that the policy consumes the intended subgoal instructions. Run a bounded job
   and check real steps, boundary observations and stop/pause acknowledgement. If it
   cannot follow subgoals, record the blocker; a scripted policy is not a substitute
   for real-policy acceptance. Training/fine-tuning is separate work.
4. Migrate perception/active observation and verify actual base/head effects. If SAM is
   selected, pin its code/checkpoint and run the tool contracts; otherwise keep it optional.
5. Run real simulated single/multiple subgoals, budget checks, asynchronous pause and
   recovery, with actual sensor/state data in the console and all three default roles.

**Deliver:** One working BEHAVIOR/body/policy configuration, instructions, evidence and limits.

**Gate:** The simulator generates actual observations/control outcomes rather than replayed
CPU data. GT remains limited, budget checks are mandatory and resource/stop boundaries
are correct. Label intentionally injected faults and exclude them from natural success-rate claims.

## Step 14 — Complete v1 acceptance and reproducible handoff

**Prerequisite:** Step 13 and continued passage of affected earlier checks.

1. Map every spec Section 13.1 requirement to actual test/run evidence, including hardware
   contract doubles for disconnect/reconnect/stop; separate their coverage from real simulation.
2. Evaluate fixed tasks/policy/budgets/GT visibility with at least no-experience versus
   retrieved-skill conditions. Preserve raw results and metrics; a few demos do not prove transfer.
3. Provide complete default-team/custom-role/provider-swap/CPU/BEHAVIOR examples and
   replace hypothetical commands with verified ones.
4. Reproduce CPU quickstart on a fresh checkout and simulation in a suitable environment.
   Record config/dependency/model versions, attribution, limitations and next unfinished work.
5. Prepare acceptance and release-candidate records. Outstanding release/deployment choices
   follow spec Section 14; completion does not automatically publish packages or run hardware.

**Deliver:** v1 code, examples, tests, evidence, initial evaluation and self-contained documentation.

**Gate:** M0–M3 each have locatable evidence. Keep CPU fixtures, actual simulation and
unverified hardware separate. Without a real simulation loop, report partial delivery,
not completed v1.

## Step 15 — Add a second configuration and evaluate transfer

**Prerequisite:** Step 14 and resources for RoboCasa, RoboTwin or a second body.
Record the selected configuration rather than assuming all are available together.

1. Reuse adapter conformance tests for observations, entities, actions, capabilities and
   criteria; bind a compatible policy and run actual tasks.
2. Keep general core/protocols stable and record added files and unavoidable core changes.
   If an abstraction is missing, document it and regress the first configuration rather
   than hiding it in special-case branches.
3. Align semantic tasks, object roles and criteria; freeze source skills and compare target
   runs with/without them. Report target-side skill adaptation separately.
4. Attempt minimal DiMOS interoperability when dependencies permit. Track unavailable
   integration separately from the second environment's completion.

**Deliver/gate:** A second real configuration, core-change accounting, conformance results
and transfer evaluation. Schema/mock completion is not simulator support. Preserve neutral
and negative transfer results.

## Step 16 — Integrate and independently verify real hardware

**Prerequisite:** Step 14 and a specified robot/backend, compatible policy, operating
conditions and authorized test scope. This may follow Step 15 or proceed independently
when the second simulation configuration is unavailable.

1. Map DiMOS/SDK/ROS2 backend to existing capabilities/jobs. Validate real sensors,
   calibration, connection state and read-only observation first.
2. Within the agreed test scope, validate bounded actions, resource ownership, device-local
   stopping, disconnect behavior and reconnect queries before running subgoal policies.
3. Replace simulation GT with actual visual/device evidence and retain unknown when
   completion cannot be established.
4. Use the same team, messages, console and recovery records. Express hardware-specific
   limits through capabilities/adapters and submit a separate real-device report.

**Deliver/gate:** Reproducible hardware configuration, actual actions/stop acknowledgements,
tasks and evidence. Camera connection or mock-device tests are not complete robot-task acceptance.

## Progress records and interrupted-work handoff

`docs/implementation/progress.md` is the state entry point; this plan defines requirements.
Statuses are `not_started / in_progress / blocked / done`. Functional steps remain
not_started until implementation begins; Skeleton Bootstrap is recorded separately.
The next functional goal is Step 00.

Use this template; it does not contain passed checks:

```yaml
step: '00'
status: not_started
spec_version: '1.4'
base_commit: null
implementation_commit: null
changed_files: []
commands_run: []
acceptance_evidence: []
known_limitations: []
blocked_on: []
next_step: '01'
```

Done requires commands/results, artifact/log paths and gate-specific evidence. Blocked
records the missing item, affected gate, resolution and independent work already done.
For example, an absent checkpoint blocks Step 13 real execution, not a previously passed
CPU loop; CPU evidence cannot fill that real-run gap. Ask the user before entering work
that depends on an unspecified material configuration or constraint.

On resumption, compare progress with actual code/checks and continue the first unfinished
subtask. Do not recreate the repository or accept an unsupported “done” claim. Record
new decisions in `docs/implementation/decisions/` with rationale, affected spec clauses
and validation. Commit coherent verified checkpoints frequently and preserve published history.
