# Embodied DeepSeek Harness — Project Specification

Version: v1.15 · 2026-09-20

Status: upper application and console run with CPU fixtures; real physical integration pending.

Project: Embodied DeepSeek Harness (EDH).

This specification records confirmed requirements and implementation boundaries.
Items marked “v1 default” are initial implementation choices that may evolve through
configuration or a documented decision. Model checkpoints, compute and robot models
are deployment bindings; they do not block the framework design.

This revision prioritizes all MVP-critical runtime mechanisms and foundation acceptance before
a runnable simulation-to-console MVP. It preserves the verified DSH and contract baseline. Confirmed product requirements remain unchanged. Detailed
wire payloads and validation rules are authoritative in the schema and
[contract guide](implementation/contracts.md); examples below are conceptual excerpts,
not complete copyable wire messages. Public documentation and SVG labels use English.

Reading order: start at Section 0; Sections 1–3 explain positioning and architecture;
4–8 define agents, communication, execution, verification and experience; 9–11 cover
adapters, tools and team authoring; 12–16 cover migration, acceptance and source entry
points. Section 17 links the canonical step-by-step implementation plan. All diagrams
are SVG assets; include their directory when handing over this document.

## 0. Handoff entry point

### 0.1 Current work and next action

The runtime choice is settled: reuse DSH, with EDH-owned composition and embodied
behavior. Upper Team/Role, tools, TODOs, plans/files, verification, recovery, SKILL
storage and a console now run with a scripted model and CPU fixture backend.
Plan-selected sequential goals and prerequisite recovery now run with CPU fixtures.
The local server accepts explicit deployment bindings for tasks, native DSH models,
tools and backend factories; see the [deployment guide](implementation/deployments.md).
This provides configuration assembly, not a connected physical provider.
OpenAI-compatible VLM transport now reuses native DSH serialization and streaming.
WebSocket policy transport and a deterministic action gate run independently with CPU
acceptance. Continue with the host-to-Python worker bridge, resource/watchdog lifecycle
and device event publication; do not replace the DSH loop. See the
[adapter guide and SVG](implementation/model-policy-adapters.md) for exact contracts,
commands, examples and unimplemented integration. The execution port requires a formally checked pause and explicit Planner resume,
with execution/boundary/state-version preconditions and a matching published backend
update. An owner ID in a prior subgoal is not a new authorization. See the
[execution contract](../harness/agent-runtime/execution/README.md).
The unified console now displays key
state without page/tab switching; further polish follows actual provider integration.
Native DSH [context management](implementation/context-management.md) is available
by explicit deployment policy, with scoped authoritative state after compaction.
Optional whole-message visual retention bounds historical image blocks while preserving
fresh observations and original evidence audits; oversized fresh batches fail explicitly.
[Physical profiles](implementation/physical-profiles.md) bind declared simulator,
embodiment, policy mappings and role context; installed adapter validation is required.
Read [progress](implementation/progress.md), [upper-runtime guide](implementation/upper-runtime.md)
and [capability map](implementation/features.md) for concrete code, checks and limits.
Do not install the simulator/GPU stack merely to run the upper acceptance suite.

### User-session and launcher clarification (v1.12)

A user conversation is a **User Session** containing multiple sequential task runs
on one retained environment. DSH role sessions remain independent assignment contexts.
Ending a task releases its control scope; ending the user session releases the environment.
The console is the primary launcher and status surface. CLI-free server bootstrap is a
separate packaging requirement. Launch selections must resolve installed environment,
embodiment, policy/checkpoint, upper model and role/tool configurations before allocation.
Experience is workspace-wide and explicitly retrieved across sessions, with source and
transfer-validation limits retained. Read the [session lifecycle and remaining steps](implementation/user-sessions.md)
and [legacy design migration audit](implementation/legacy-migration.md).

The console resolves dependent runtime-source, environment, embodiment, checkpoint,
policy and default-model selectors against installed complete launch profiles. Browser
and server validate the selected combination; stale catalog revisions fail before
allocation. An active session keeps its configuration fixed until it ends. Mermaid
Team relationships and status animations use configured roles and actual assignment
records, with separate execution and verification indicators. Branding uses the project
logo and a blue/white palette. Debug output remains directly inspectable.

Session task admission accepts an editable user instruction and up to four explicitly
selected historical outcomes from that session. Selected criteria remain immutable
deployment bindings. Ownership, terminal state, input limits and complete request
identity are checked before allocation. A saved submission records the criteria and
context snapshot. The entry Planner receives this context through its InvocationBrief;
delegated agents retain independent caller-provided briefs. Browser drafts survive
status refreshes, and unconfirmed submissions retain their request identity for retry.
Provider-backed discovery of new criteria and active-task user clarification remain open.

### 0.2 Repository and workspace

Repository: [Embodied-DeepSeek-Harness](https://github.com/jixinyan/Embodied-DeepSeek-Harness).
Paths are relative to this repository unless explicitly identified as upstream source
paths. EDH owns the architecture and selectively absorbs DSH; it does not copy the
entire upstream product. See [provenance](provenance/README.md) for the pinned source
and dependency audit. Legacy code and the old demo are optional migration assets;
confirmed design, diagrams and authoring examples are included here.

Continue the existing checkout rather than working in a temporary research clone.
See [progress](implementation/progress.md) for actual completion evidence. Directory
and type declarations do not satisfy Step 00's runtime-integration acceptance gate.

### 0.3 Decisions that do not require conversation history

- Use the DSH runtime, with a TypeScript host and optional Python workers. Do not add
  a second Deep Agents/LangGraph agent loop.
- User-defined teams and roles are the composition units. Planner, Verifier and
  Evolver are defaults, not a fixed enum of all possible agents.
- Every new delegation gets a fresh session, sufficient InvocationBrief, private
  working files, explicit tool view and independent message context.
- Register all tools through the catalog. Policy execution is one tool category;
  a perception model can be a provider without being an agent.
- The upper decision owner exclusively controls retry, replan and resume. Verifier
  may pause and verify; budget exhaustion must enter formal verification.
- Limited GT checks are agent-visible. Complete hidden state is debug-only;
  Evolver cannot bypass visibility through the evidence store.
- An explicit retry starts recovery recording. Publish successful experience only
  after the designated verifier confirms the original recovery goal.
- Simulation comes first. Test hardware interface contracts in v1; real hardware
  runs and policy fine-tuning follow separately.

### 0.4 First implementation report

Report the actual repository commit, working-tree changes, existing modules and spec
version. Identify the selected work item, target files and locally executable checks.
Missing checkpoints do not block protocol/team/tool work; record limitations that
prevent real execution instead of claiming completion.

Progress records include completed work, changed files, commands and results,
unexecuted checks with reasons, and the next item. Preserve unrelated work. Do not
start real hardware, publish software, upload private run data or overwrite the old
project without authorization. Commit verified, coherent checkpoints frequently.

## 1. Project positioning

Build an open-source embodied task framework using DSH runtime implementations.
Users organize agent teams with concise role definitions and team configuration,
then issue tasks through a physical control console. An upper VLM uses planning,
files, communication, perception, active observation and execution tools to complete
long-horizon tasks in simulation or on hardware. Verifier monitors execution and
checks outcomes; the upper decision owner chooses retries and replans. Evolver
tracks explicit recovery attempts and turns formally verified recovery into reusable
`SKILL.md` knowledge.

Primary users are embodied intelligence researchers, policy/environment adapter
developers, and operators who need to observe and debug long-horizon robot tasks.

Example: “Put the cup on the table into the cabinet.” The same semantic goal and
communication protocol can apply to different environments or robots. Adapters bind
objects, sensors, controls and success checks. Task organization and experience may
transfer, but policy/hardware compatibility still requires validation.

### 1.1 Highlights and claims to validate

| Highlight | Concrete design | Evidence required |
| --- | --- | --- |
| DSH-based physical task loop | Reuse the agent runtime; add asynchronous execution, device feedback, verification gates and physical events | Complete a long-horizon task and recovery without inventing another LLM loop |
| User-defined agent teams | ROLE.md specifies responsibility/tools; team.yaml binds members and decision roles | Add or replace a role through configuration without modifying fixed agent types or routing |
| Complete, open tool surface | One catalog covers planning/files, SAM-like perception, active observation, policies and checks | Compose a new role from existing tools; expose a new perception provider to compatible roles |
| Independent contexts and explicit cooperation | Fresh delegation sessions, complete task briefs, direct messaging and subscriptions | Actual model-input checks demonstrate that only explicitly delivered/read information is visible |
| Concurrent execution and verification | Monitor during policy execution, allow pause, require a verification round at budget expiry | Trace execution, monitor feedback, pause acknowledgement and final verdict on one timeline |
| Learning from successful retries | Retry starts Evolver; original-goal recovery success enables skill creation | Trace every skill to failure, changes, attempts and success evidence |
| Replaceable policies, environments and bodies | Separate semantic contracts from concrete adapters with declared compatibility | Add a second configuration without modifying the general core |
| Physical task observability | Console displays sensors, agents, devices, messages, evidence and experience | Explain why motion stopped, who requested a retry and which skill was used |

These are engineering goals and research claims to test, not assertions of academic
novelty or already demonstrated cross-environment generalization.

## 2. Scope and invariants

### 2.1 Confirmed principles

1. **Reuse the DSH core.** Agent creation, model loop, sessions, tools and lifecycle
   use selected DSH implementations. Domain modules and UI belong to EDH. Python
   workers do not implement a second agent core.
2. **Contexts are independent.** Do not fork the caller's history or copy its system
   prompt, conversation, working memory or other agents' contexts. Every new
   delegation begins with an explicit caller-provided brief.
3. **One assignment may accumulate its own inputs.** A continuing Verifier/Evolver
   keeps observations and messages received within that assignment. A new assignment
   or replacement instance needs an explicit handoff.
4. **The upper VLM owns retry, replan and resume.** Policy providers, Verifier,
   Evolver and event handlers cannot autonomously create a new task attempt.
5. **Verification belongs to an agent.** Simulation GT is the verifier's fact tool,
   not a hidden task decision that bypasses the verifier.
6. **Verifier monitors asynchronously and may pause.** Budget expiry forces formal
   verification. A pause request and confirmed device pause are distinct records.
7. **Retry triggers Evolver.** Skills require formal recovery-goal confirmation and
   serve the upper planner/verifier; VLA/VLN consumption of Markdown is not required.
8. **Agents compose through teams and roles.** Users define responsibilities, tools
   and output contracts. Routing must not hard-code planner/verifier/evolver or
   manipulation/navigation as the only possible role types.
9. **Cover simulation and hardware.** v1 runs simulation and validates hardware
   integration contracts; actual hardware trials follow later.
10. **Experience cannot rewrite success criteria.** Preserve the source and version
    of the user's task conditions and benchmark evaluator.
11. **Tools are first-class extension points.** Planning, files, perception, active
    observation, communication, execution, verification and memory are selectable.
    Schedule actual effects; a “perception” label does not imply no physical motion.

### 2.2 v1 delivery boundary

| v1 | Later extensions |
| --- | --- |
| DSH integration, Team/Role loader, independent sessions, generic task messages/events | More complex multi-host agent deployment and workflow recovery |
| Planning/files, pluggable perception/active observation, unified catalog | More perception providers, user tool packs and an extension marketplace |
| Default Planner, Verifier and one Evolver assignment per recovery chain | More roles, specialist verifiers and multi-robot cooperation |
| One real simulator task loop, prioritizing the legacy BEHAVIOR path | Full RoboCasa/RoboTwin and further environment adapters |
| A second configuration to test interfaces, with test/real status distinguished | Broader cross-environment and cross-embodiment transfer evaluation |
| Replaceable subgoal-policy interface, asynchronous jobs and hardware contract tests | Fine-tuning, real robot trials and other control policies |
| GT-assisted monitoring and formal verification | Real-device visual/sensor evidence providers |
| Retry → Evolver → evidenced SKILL → later retrieval | Larger-scale automated skill evaluation and transfer validation |
| Production console following the approved prototype direction | Teleoperation and additional robot-specific panels |

The upper layer initially focuses on embodied tasks, run analysis and experience
management while retaining general tool extensibility. A general coding assistant,
online training, direct SKILL injection into VLA, time-to-go prediction heads and
arbitrary hot-swapping are not v1 acceptance requirements.

## 3. Overall architecture

![EDH architecture](architecture/assets/framework-overview.svg)

[Open the architecture SVG](architecture/assets/framework-overview.svg)

Solid lines represent configuration, tasks or control; dashed lines represent
observations, feedback or experience. The numbered stages are team authoring,
independent role sessions and open tool capabilities. Physical execution and
experience return appear below. Every agent has its own context; connections denote
explicit calls and messages.

### 3.1 Deployment and responsibilities

| Layer | Owns | Boundary |
| --- | --- | --- |
| Control console | Instructions, run state, sensors, evidence and experience views | Uses structured facts, not agent prose, to display device state |
| EDH host with absorbed DSH capabilities | Model calls, independent sessions, tools, agent creation and inboxes | Does not advance high-frequency control steps |
| EDH domain modules | Team/Role loading, catalog, messages, routing, verification gates, recovery and capabilities | No second LLM loop or autonomous retry decisions |
| Python execution worker | Policy calls, actions, budgets and device-state reports | Cannot create new task attempts on its own |
| Environment/hardware backends | Simulator state, connections and sensor/actuator I/O | No environment-private types in general protocols |
| Evidence/memory providers | Run records, authorized facts, skill versions and retrieval | Stored information does not enter every agent context automatically |

The Planner directly perceives images, plans and makes execution decisions in a
ReAct-style observe/decide/act/observe loop using native DSH. Perception tool results
return images to that Planner; optional specialist agents are helpers, not a mandatory
visual interpretation stage. Verifier supplies checked images and authoritative results
for the Planner's next decision. See the [illustrated loop](implementation/model-policy-adapters.md).

v1 defaults to one Planner per task, owning its physical decisions. The user-facing
coordinator and physical planner may be the same instance. An optional reception or
task-coordination role must preserve one unambiguous execution decision owner.

DSH capabilities handle creation and wake-up; EDH task routing handles explicit
messages across the composable team. DiMOS is a candidate to evaluate for hardware
integration, not a required dependency or replacement agent system.

## 4. Teams, roles, instances and context handoff

A Team is a user-declared collaboration structure. A Role is reusable responsibility
and tool configuration. An AgentInstance is an independent session created for one
assignment. A TeamMember is a stable addressing alias and may correspond to different
instances across assignments. Team membership never implies shared context.

For example, a user adds a `scene_analyst` role with segmentation/depth tools. Planner
can delegate object identification and receive structured candidates without adding
a dedicated hard-coded subagent builder. Calls shown below are intended interfaces.

### 4.1 Role templates

RoleDefinition declares `role_id`, responsibility, model routing, instructions, tools,
optional output schema and lifecycle. TeamDefinition binds subscriptions and duties.
Instances carry `agent_id`, `session_id`, `assignment_id`, `team_run_id`, task scope
and caller relationship. Section 11 defines authoring.

| Default | Inputs | Output/capabilities | Excluded responsibility |
| --- | --- | --- | --- |
| Planner | User goal, capability catalog, explicit observations, verifier feedback and retrieved skills | Plans, files, perception/active observation, subgoals, execution decisions, delegation and reports | Fabricating formal verdicts |
| Verifier | Goal/criteria, current attempt, observation entry point, relevant skills and check permissions | Monitor feedback, pause requests, formal verdict and necessary facts | Retry, replan or autonomous resume |
| Evolver | Original failure, recovery goal, upper-level changes, related records/events | Evidenced skill bundle, version and summary | Robot control or changing task criteria |

The host builds an explicit verifier brief from the Planner-selected goal, admitted
execution request, criteria and current attempt. The monitor names the Planner as its
caller and receives explicit sensor updates. A stopped boundary creates a separate
formal-verification assignment with its own brief and boundary record; it does not
inherit either the Planner conversation or the monitor history.

A final role report closes new work admission and retires the native handle after
its current turn reaches quiescence, preserving the receipt, output, audit and report.
Accepted formal-verification assignments use the same completion path. Missing-context
reports remain open. An Evolver with a published SKILL is released after its final
success delivery settles; learning failures release the handle independently of task
success. The decision owner remains available through run shutdown for report inspection.

Retired identities are not reusable. Callers may query/acknowledge durable reports
after native disposal. A late child report to a finished caller is retained with
failed delivery, without reopening the caller or implicitly transferring new context.

Before retry, Planner prepares the Evolver handoff and recovery record. Starting the
experience agent must not block execution: durable events can be read later through
explicit authorized references if the model is slow.

### 4.2 InvocationBrief: minimum delegation context

| Field | Content | Example |
| --- | --- | --- |
| objective | What this assignment must accomplish | Monitor this placement and verify its criteria after execution |
| task_scope | Task, goal, attempt and relevant recovery IDs | `task_42 / goal_store / attempt_2` |
| expected_output | Output schema and recipient | `VerificationResult.v1 → planner_1` |
| entities | Object-role bindings and their sources | `object=cup_17; container=cabinet_2` |
| success_contract | Authoritative definition, version and scope | Task-sourced `inside(object, container)` |
| known_facts | Relevant facts with timestamps/evidence | Previous check false; observation `obs_101` |
| history_summary | Relevant preceding work | First attempt left the cup on the table; Planner chose a change |
| changes | What differs this time | Explicitly bind the left cup, rather than saying only “try again” |
| evidence_refs | Authorized records, frame/stream or event ranges | Failure clip, event interval and camera stream |
| tools_and_limits | Allowed tools/actions and budget | Observe, run checks and pause; no new subgoal execution |

The caller is responsible for semantic sufficiency. Schemas validate shape and
references, not whether context is enough. A recipient lacking information sends
`context.request`, waits, or reports insufficient context; it must not invent facts.
Tools may help the caller gather inputs, but the caller still forms an explicit brief.

Shared evidence storage is a source of referenced materials. Recipients can read
listed references or query within their assignment's authorization, with traceable
access. It is not a synchronized shared conversation. Other agents' opinions remain
reports or hypotheses until independently supported.

v1 uses fresh spawn, not a history-inheriting fork. Messages within one assignment
can accumulate. New assignments, tasks, replacement instances and crash recovery
require a new brief or explicit handoff.

**Fresh conversation does not prove role isolation.** The inspected DSH preset child
path may include parent composition. The EDH factory must explicitly build the target
scope, prompt, tools and resource view before publishing a session. Validate the actual
DSH scoped-factory/preset API and add a bridge if necessary. Acceptance checks actual
model inputs for absence of parent-only tools and instructions.

## 5. Generic communication protocol

### 5.1 MessageEnvelope

This is a proposed domain message, not an existing native DSH API:

```json
{
  "schema_version": "physical.message.v1",
  "message_id": "msg_120",
  "kind": "event",
  "type": "verification.completed",
  "sender": {"agent_id": "verifier_3"},
  "destination": {"topic": "task_42.verification"},
  "scope": {
    "task_id": "task_42",
    "goal_id": "goal_store",
    "attempt_id": "attempt_2",
    "recovery_id": "recovery_1"
  },
  "correlation_id": "verify_request_2",
  "causation_id": "execution_stopped_2",
  "sequence": 120,
  "created_at": "2026-09-06T12:00:00Z",
  "payload": {
    "status": "passed",
    "goal_contract_version": "1",
    "checks": [{"check_id": "inside_target", "value": true}]
  },
  "evidence_refs": ["obs_130", "gt_check_9"]
}
```

`kind` is command/event/request/response/artifact. `type` is a registrable namespaced
extension. A destination identifies one agent, service or task topic. Non-agent
senders use `service_id`. Required scope IDs depend on the event schema.

The runtime supplies or verifies identity, permissions and sequence. A model cannot
impersonate another sender or change its own authority through message content.
`correlation_id` groups an interaction; `causation_id` identifies its direct cause.
Timestamps support freshness, not a strict global order across devices.

### 5.2 Events and responsibilities

| Event | Producer | Consumers | Meaning |
| --- | --- | --- | --- |
| `agent.invoke` | Calling agent through validated runtime | New agent | Complete brief and independent context |
| `context.request / response` | Recipient/caller | Counterparty | Explicit missing information, not copied parent history |
| `execution.started / progress` | Execution service | Planner, Verifier, UI | Actual execution state |
| `execution.pause_requested / paused` | Requester/execution service | Planner, Verifier, UI | Intent and confirmed device state separately |
| `execution.budget_exhausted / ended` | Execution service | Verification trigger and relevant agents | Stop reason, not automatic task failure |
| `monitor.feedback` | Verifier | Planner, UI and authorized Evolver during recovery | Progress/deviation/possible completion linked to observations |
| `verification.requested / completed` | Lifecycle coordinator/Verifier | Verifier, then Planner/Evolver/UI | Formal checks and evidence |
| `retry.requested` | Planner | Execution/recovery coordination | Original goal, changes and failure source |
| `retry.started` | Runtime after accepting retry | Evolver, UI | Recovery-chain start, never inferred from prose |
| `recovery.resolved` | Correlator using the original-goal verdict | Evolver, Planner, UI | Original recovery goal passed or was abandoned |
| `experience.created` | Evolver after memory persistence | Planner, experience management, UI | Skill version, applicability and evidence references |

### 5.3 Routing, ordering and reconnection

v1 uses a typed host router with versioned worker requests and streaming events;
an independent message broker is optional. Direct messages and subscriptions share
the envelope. Persist formal requests/results before delivery, allow redelivery,
and deduplicate by ID. Each task stream has stable ordering; no global service order
is promised.

Acknowledgement means accepted, not processed by the agent or executed by the device.
Physical operations use execution IDs and idempotency keys. After an uncertain
connection failure, query the job before proceeding. If state cannot be established,
report unknown; do not blindly resend motion.

Do not broadcast every sensor frame to each LLM. Messages carry stream references,
selected frames or short clips. Dropping stale frames must not discard critical
execution events. Retain links between durable events and actual model-visible inputs
so audits distinguish what the system knew from what a particular agent saw.

## 6. Subgoals and execution contracts

### 6.1 Identity and ownership

- `task_id`: one user task run.
- `goal_id`: stable semantic subgoal, potentially retained across instruction changes.
- `attempt_id`: one upper-authorized attempt; every retry creates a new one.
- `execution_id`: the actual job accepted by the execution service.
- `recovery_id`: linkage between the original failure and subsequent retry/replan work.

An attempt may contain normal policy action chunks, not an autonomous provider retry.
Resuming the same instruction may consume the remaining budget of the same attempt.
Exhausted budgets are not automatically renewed. A changed instruction or new attempt
requires an explicit upper-level decision and a new attempt ID.

### 6.2 SubgoalRequest

Required semantics include IDs, natural-language instruction, entity-role bindings,
capabilities, success criteria, constraints and budgets. The upper layer may select a
provider, or assembly may bind one from a declared compatible set. Neither may silently
change the task meaning.

```yaml
goal_id: goal_store
attempt_id: attempt_2
instruction: Place the specified cup inside the already-open cabinet
entities:
  object: cup_17
  container: cabinet_2
required_capabilities: [object_manipulation]
success_contract:
  id: store_object
  version: '1'
  all:
    - check: inside
      args: [cup_17, cabinet_2]
budget:
  max_control_steps: 200
  max_wall_time_s: 60
context_refs: [observation_120, entity_binding_4]
```

200 steps and 60 seconds are examples, not universal defaults. Providers declare
control-step meaning and frequency. Record policy calls, actual control steps and
raw simulator steps separately; wall time is an independent boundary.

Success contracts support registered checks and simple all/any combinations. The
environment maps semantic checks to versioned evaluator definitions and parameters.
Unsupported checks are explicit; false differs from unknown. Required conditions
come from the task, not an extra universal preference such as releasing the gripper.

### 6.3 Execution reports and formal verdicts

| Data | States/content |
| --- | --- |
| ExecutionStatus | accepted / running / pausing / paused / ended; counts, device state, observation references |
| StopReason | policy_stop / budget_exhausted / verifier_pause / user_stop / backend_error / episode_terminated |
| VerificationResult | pending / running / passed / failed / unknown; checks, evidence, observation time, criterion version |
| PlannerDecision | resume / retry / replan / finish / abandon; cited feedback and new goals |

Policy self-reported success may be diagnostic only. Authoritative completion requires
the designated verifier's verdict for the correct attempt, criterion version and
execution-boundary evidence.

### 6.4 Budgets, pause and verification gates

1. Accept a request and return a job handle without blocking Planner for the rollout.
2. Advance policy actions and emit observations/status while Verifier monitors.
3. Translate authorized pause requests to supported device pause/stop behavior and
   acknowledgement. `pause_requested` must not be displayed as `paused`.
4. At budget expiry, stop issuing actions, record the boundary and force a formal
   verification request. Early stops, errors and pauses also enter state reconciliation
   and verification closeout.
5. Use observations/checks available after the boundary. Without reliable fresh
   evidence, return unknown rather than reusing an old monitor result as final truth.
6. Planner decides what follows. Pending/unknown verification cannot silently become
   passed; request more checks or explicitly handle uncertainty.
7. Only Planner resumes. A backend unable to resume in place reports stopped; restarting
   a policy requires Planner to create a new attempt.

Transport redelivery is not physical action retry. After process restart, query jobs
and devices first. Explicit user termination may cancel agents; record cancellation
or unknown verification rather than fabricated success.

## 7. Verifier: asynchronous monitoring and formal verification

Each new verifier assignment receives a fresh context with goal, criteria, execution
configuration, necessary history and authorized evidence. The current upper runner
continues one monitor assignment across explicit frame messages during a continuous
running segment. Pause/end cancels and retires that monitor. Formal verification is
a separate fresh assignment with an explicit stopped-boundary brief; resumed execution
creates a fresh monitor. No conversation history is implicitly shared. An accepted
pause request belongs to the run and outlives monitor cancellation; the provider must
bound its acknowledgement latency and report actual confirmed stop state.

### 7.1 Monitoring during execution

Support latest-frame, short-clip and execution-event triggers. v1 permits at most
one in-flight model request per verifier; merge subsequent frames into the next fresh
observation while retaining critical events. The current upper runner coalesces
pending frames to the latest available sample and rejects monitoring work whose
creation completes after its execution boundary has changed. It retires native handles
while preserving assignment identity and audits. Long-run context compaction remains
pending. Configurable intervals, observation-lag policies and model-budget displays
remain targets beyond this lifecycle implementation.

Feedback is progress/deviation/possibly_complete/insufficient_evidence with frame or
event references. Possible completion or clear deviation may trigger pause; formal
verification still determines success. Verifier does not create subgoals or choose retries.

“Real time” means monitoring concurrently with execution, not every-frame VLM inference
or hard-real-time control. Device-local control and connection-failure handling cannot
wait for an LLM network round trip.

### 7.2 Formal verification and GT visibility

In simulation, Verifier calls limited goal checks and receives per-check results and
necessary facts. Planner receives those results and useful explanations. Complete hidden
state is debug-only and must not enter Planner, Verifier or Evolver context automatically.
Enforce evidence visibility in the provider boundary.

Formal reports must agree with available authoritative GT facts. The gate validates
criterion version, required-check coverage and factual consistency; the agent still
chooses observations and explains uncertainty. Separate optional diagnostics from
required conditions. Skill preferences cannot alter benchmark success standards.

Real hardware uses visual/device-signal providers and retains unknown. A new view
requiring base/arm movement needs an upper-level decision unless specifically authorized
within the current observation scope. Read access alone grants no physical task changes.

Each goal/attempt has one final-verdict owner in v1. Multiple specialist verifiers need
an explicit aggregator and rules; conflicting reports cannot both become final truth.

## 8. Evolver and the skill experience loop

### 8.1 Trigger, inputs and completion

Always record ordinary run evidence, but do not start Evolver for every execution.
An explicit upper-level retry registers a recovery chain and sends a fresh Evolver
the failure, original recovery goal, changes, readable records and expected output.

v1 uses one Evolver assignment per chain. Subsequent attempts enter through explicit
messages/subscriptions. Different chains do not share context. A long chain may produce
a structured handoff for a replacement instance.

Recovery success means formal verification of the original goal. For example, a replan
may add “open the cabinet”; that prerequisite succeeding does not prove “cup inside
cabinet.” Planner requests a recheck of the original goal at the end of multi-step recovery.

Failed/abandoned recoveries remain records and do not produce successful-recovery
skills. Policy claims, exhausted budgets and human prose do not replace the verifier's
result. Evolver failure must not block task completion: preserve pending records and
later delegate summarization with a new explicit brief.

### 8.2 Skill content and generalization boundaries

Skills serve Planner and Verifier: triggering situations, observable evidence, decision
heuristics, verification pitfalls, prerequisites and counterexamples. Robot coordinates,
joint indices and environment-instance IDs stay in referenced evidence, not generic rules.

Skills may be retrieved within their declared scope without per-item manual approval.
Keep source, version and applicability complete. An entry without transfer evaluation
is source_validated / transfer_unvalidated, not proven universal. Incompatible retrieval
returns a mismatch reason; matching a task name alone is insufficient.

Success after a change supports a hypothesis, not proof of a unique cause. Record
multiple simultaneous changes faithfully instead of attributing success to one factor.

### 8.3 Skill bundle

```text
skills/
  reobserve-ambiguous-target/
    SKILL.md
    metadata.json
    references/
      recovery-evidence.json
      transfer-notes.md
```

SKILL.md is the readable entry point. Metadata carries retrieval fields, version,
capability prerequisites, validated configurations, evidence and status. Reference
raw video/trajectories through evidence URIs rather than copying them into every skill.
Provider boundaries allow filesystem, index or remote storage replacement while
reusing DSH discovery and on-demand loading.

This is a format illustration, not experience from a real experiment:

```markdown
---
name: reobserve-ambiguous-target
description: Help the upper layer reobserve and verify after an unsuccessful attempt with ambiguous target binding.
---

# Applicability
Several similar objects are visible, target-binding evidence is insufficient,
and the current goal check has not passed.

# Planning cue
Request a fresh observation or explicit target binding before deciding to retry;
do not merely repeat the same instruction.

# Verification cue
Confirm that the checked entity is the intended target. Policy termination alone
does not prove goal completion.

# Limits
A valid new observation must be available. This does not imply that all failed
grasps are caused by target ambiguity.

# Sources
Metadata and references link the failure, changes and verified recovery evidence.
```

### 8.4 Working state, records and long-term knowledge

| Category | Lifetime | Visibility |
| --- | --- | --- |
| Agent conversation | One assignment | That instance; not automatically copied |
| Task facts/entity bindings | Current task, with time and evidence | Briefs, messages or explicit queries |
| Episode evidence/events | Persistent audit records | Scoped reads with preserved visibility |
| Skill library | Cross-task knowledge | Explicit retrieval, compatibility filtering and on-demand loading |

Task completion returns results and recovery/skill references. A fresh agent on the
next task retrieves relevant knowledge rather than inheriting the previous conversation.

### 8.5 Complete recovery sequence

![Execution, verification and recovery sequence](architecture/assets/async-recovery-sequence.svg)

[Open the sequence SVG](architecture/assets/async-recovery-sequence.svg)

### 8.6 Agent-directed experience retrieval

Experience enters an assignment through an explicit search-and-load cycle. Planner
may search when prior experience could help a planning decision or failed attempt;
Verifier may search when it has a verification question. Neither role receives the
entire SKILL library at startup or after another role publishes an experience.

1. The agent formulates a focused query from the current task and question.
2. `skills.search` returns metadata without SKILL bodies. The agent evaluates task
   relevance, required capabilities, limitations and validated configurations.
3. `skills.load` returns only the selected skill's metadata and Markdown into the
   calling assignment's native DSH context. The agent may load another relevant
   skill, refine the search, or proceed with current observations and evidence.
4. The agent reuses guidance already available in context. A changed question or
   content removed by context maintenance may justify another retrieval.
5. Delegation includes explicit applicable guidance or a skill reference and its
   limitations. Each recipient decides what it needs in its independent context.

Retrieval is agent-directed; the implementation currently uses keyword matching over
`task_semantics`, capped at 20 metadata records per search. Semantic embeddings,
relevance ranking and section-level loading remain unimplemented. Current prompts
instruct selective loading; the runtime does not deduplicate deliberate load calls.
Native tool-call records expose queries and selected versions for inspection.

Knowledge remains advisory across simulation and hardware. Source references grant
no additional evidence permissions, and matching task semantics do not establish
cross-embodiment validity. Formal verification uses current authorized evidence and
the admitted task conditions. See the [memory implementation](../harness/agent-runtime/memory/README.md).

## 9. Replaceable components and adapter contracts

A unified interface specifies inputs, outputs, semantics and compatibility. It does
not imply that arbitrary models, devices and environments are interchangeable.
Preflight failures must explain the concrete mismatch.

| Component | Required contract | Compatibility and optional capabilities |
| --- | --- | --- |
| Model provider | DSH model interface; images, tools and structured-output support | Different roles may use different models; check actual supported inputs |
| Tool provider/catalog | ID, description, input/output schemas, executor, scope, effects and resources | Native TS, Python/HTTP or MCP; expose only selected compatible tools |
| Policy provider | Subgoal/observation input, action/status output, version and input/action specs | Cameras, proprioception, control mode/frequency and instruction granularity |
| Embodiment adapter | Device/joint/sensor IDs, coordinate frames, units and observation/action mapping | Fixed arm, mobile manipulation or dual arm; no navigation requests to a body without that capability |
| Environment adapter | Observations, entities, run source and task/evaluator mapping | reset/step/snapshot/GT are explicit simulation capabilities, not mandatory hardware methods |
| Hardware backend | Connection, state, streams, commands and confirmed stopping | DiMOS/SDK/ROS2; declare actual pause/resume support |
| Verification provider | Registered checks, criterion versions, value/unknown reason and evidence | Simulation GT or real sensor evidence; unsupported is not fabricated false |
| Memory provider | Query, write, version retrieval, applicability filtering and evidence linkage | Filesystem, index or remote storage; traceable retrieval |
| Role/router | InvocationBrief, outputs, subscriptions and independent context | New roles do not change the base envelope; control permissions are explicit |

### 9.1 Observation and action semantics

Observation semantics include observation ID, capture time, source sequence,
stream/sensor/device IDs, coordinate frame, media references, visibility and relevant
calibration version. Preserve per-camera timestamps rather than pretending streams
are synchronized. Pin evidence references in verifier requests; later frames must not
change what a previously issued reference identifies.

ActionSpec declares robot, joint order, units, control mode, frequency and limits.
Matching tensor shape is only the first check: two seven-joint arms can have different
joint order and gripper units.

In v1, only one active execution owns a given actuator resource. Agents may observe
and analyze concurrently but cannot issue conflicting arm commands. Physical resource
ownership cannot rely solely on serial tool execution inside one DSH agent.

### 9.2 Simulation, hardware and replay

All three use common task events and observation views, with the source clearly marked.
Simulation can advance simulated time and query GT. Hardware evolves in real time.
Replay reproduces only recorded events and observations.

Replay can test perception, verifier output, message handling and skill extraction.
It cannot prove that a new action would succeed or resend recorded actions to a robot
as “resume.” Backends report job/device state and takeover behavior after disconnection;
models cannot infer a stopped arm merely from a log.

### 9.3 Extension examples

For RoboCasa, implement observation/entity/task-check mapping, bind its robot and a
compatible policy, and run the same Subgoal/Verification contract suite. The base
Planner/Verifier/Evolver communication protocol remains unchanged.

For a real arm, select DiMOS or a direct SDK backend, declare cameras, joints, gripper
and stopping capabilities, match policy inputs/action semantics, then configure real
verification evidence. Device connection alone does not establish a usable subgoal policy.

### 9.4 Complete tool catalog

The dotted names below describe the intended logical API, not existing native DSH
names. Each selected tool gets its own model-facing schema and a recorded logical-ID
to wire-name mapping. Do not reduce the entire interface to an opaque
`call_any_tool(name, string)`.

| Toolset | Minimum capability | Default consumer | Source/adaptation |
| --- | --- | --- | --- |
| planning | Read/write plans, goal dependencies and criterion links | Decision owner | Legacy todos; DSH display plus durable task plan |
| workspace/files | Read/write/edit/list/search working notes and intermediate files | Explicitly configured roles | DSH file/search capabilities and private workspaces |
| team | List members, delegate, send, request context and query status | Planner and authorized roles | DSH scoped factory plus EDH routing |
| perception.read | Capture, segment, detect, estimate depth and localize; optional point clouds | Planner, Verifier and perception roles | Legacy capture/detection, depth and SAM adapters |
| observation.active | Turn view/look at a target and return a new observation | Planner and explicitly authorized roles | Legacy rotate-camera and actual device controls |
| execution | Start/query/pause/resume/stop jobs; optional gripper/reach primitives | Configured decision/pause owners | Asynchronous execution and resource services |
| verification | Check goal, read evidence and submit formal result | Current final verifier | Limited facts provider and formal-verdict protocol |
| task_memory | Query facts, record observations and bind entities | Planner and authorized roles | Source-linked task facts replacing global scene state |
| skills | Search/load applicable knowledge with versions | Planner, Verifier and selected roles | DSH discovery/loading plus EDH compatibility retrieval |
| experience | Read recovery, save skills and report experience | Evolver | Recovery chains, evidence and versioned memory |

Examples of logical tool IDs are `perception.capture`, `perception.segment_objects`,
`observation.turn_view`, `execution.start`, `skills.search` and `skills.load`.
The skeleton's [planned inventory](../harness/agent-runtime/tools/definitions/planned-tools.json)
records its current draft spellings. Section 9 defines required capabilities;
Step 01/02 must reconcile aliases and final tool schemas before exposing callable APIs.

Expose perception tools only when a provider is available. Missing depth/segmentation
must not appear usable and then return fake data. Users can add SAM3-like segmentation,
other detectors/depth models or private services without wrapping them as agents.
Direct VLM image reasoning and external perception tools can coexist.

### 9.5 Upper-level tools and Deep Agents migration

The old `agents/top_agent.py` combines perception/memory tools and relies on
`create_deep_agent` for basic capabilities such as `write_todos` and file operations.
Preserve these capabilities while replacing the runtime with DSH. Migrating only
policy tools would omit essential planning and working-memory support.

| Legacy capability | EDH behavior | Constraint |
| --- | --- | --- |
| write_todos | Create/read/update plans with goal IDs, dependencies, states and success references | Plan state does not replace formal verifier facts |
| read_file/write_file/edit_file | Private assignment workspace for progress, analysis and intermediate artifacts | Other roles' files require explicit handoff |
| File discovery/search | Search only the workspace and explicitly mounted read-only material | DSH fs-search subprocess paths must obey the same visibility boundary as file tools |
| Subagent delegation | `team.delegate` returns assignment/agent identity without waiting for a long task | No inherited parent conversation or tools |
| Context compaction/persistence | Reuse DSH capabilities within the current session | Not a mandatory manual user tool; cannot introduce other agents' context |
| On-demand experience | Search/load skill versions with applicability | Knowledge enters fresh tasks through explicit tool results |

In the inspected DSH baseline, `todo_write` belongs to one agent and its UI projection
clears at the next turn. It is not a durable cross-turn task-plan database. EDH maintains
a task-scoped PlanDocument owned by decision_owner, with stable goal IDs and plan
versions. DSH todo/UI may display a summary. Verifier/Evolver may keep their own work
lists but cannot modify Planner's authoritative plan.

The target PlanDocument includes task ID, version, owner assignment and items with
goal ID, description, dependencies, state, success-contract reference and optional
last-verification reference. Updates check expected versions. Completion requires a
matching passed verdict; writing a todo cannot complete an unexecuted goal. The current
skeleton schema is a draft subset and is not the full implementation acceptance contract.

Files are private by default. Cross-role handoff uses immutable artifact references or
explicit read-only mounts of specific versions, not a mutually writable scratchpad.
General shell access is not a default for every role; users may select a digital tool pack.

### 9.6 Perception and SAM-style integration

Bind perception requests to an existing observation ID and frame, not an implicit
mutable “latest image.” Results preserve provider/model version, source observation,
coordinate convention, detections and evidence:

```json
{
  "observation_id": "obs_120",
  "provider_version": "user-sam-adapter-v1",
  "instances": [
    {
      "detection_id": "det_4",
      "label": "cup",
      "score": 0.91,
      "bbox_xyxy": [0.12, 0.30, 0.28, 0.68],
      "bbox_space": "normalized_image",
      "mask_ref": "artifact_mask_4",
      "entity_id": null
    }
  ],
  "overlay_ref": "artifact_overlay_4",
  "depth": {"status": "unavailable"}
}
```

A detection ID is not a stable world-entity ID. Fill entity_id only after tracking or
explicit binding. Without depth, calibration or a reliable estimate, do not invent
metric distances. Provider confidence is not necessarily calibrated and is not GT.
Masks, overlays and RGBD retain source-frame and processing provenance.

Legacy SAM adapters are migration references. Recheck old API patches and dependency
workarounds against the selected actual provider; do not treat them as current install
instructions. Heavy providers run optionally/in separate processes and are not imported
when unused. Pin the actual code/checkpoint during integration and run contract checks;
this specification does not choose a SAM version.

### 9.7 Active observation is a scheduled physical capability

`observation.turn_view` requests a changed view; an adapter resolves the real motion.
The legacy rotate_camera wording suggests camera-only motion, but the BEHAVIOR
motion.rotate implementation uses base yaw and head pitch.

For a desktop pan/tilt camera, lock `camera_pan_tilt`. For an R1Pro yaw view, the resource
may be `base`. If a policy owns the base, queue the observation or return resource_busy
so Planner can decide whether to pause or change the schedule. Never rotate the base
silently alongside the active policy.

Inputs identify intent, camera/entity references, requested angle or look-at target and
budget. Resolve actual effects/resources before execution. Results include requested
and achieved pose, completion/failure reason, new observation and actual time/steps.
Acceptance of a request does not mean the camera reached its destination.

Role configuration and the current InvocationBrief jointly authorize observation
motion. Planner has this capability by default; Verifier defaults to reading, pausing
and checking. If a team gives active observation to Verifier or a user role, the brief
must authorize the actual device-action range. Resource scheduling still applies;
route changes, retry and policy resume remain decision-owner actions.

Track observation-action budgets and total task cost. Do not hide physical steps to
bypass policy budgets. Verification requiring unapproved base/arm motion asks the upper
layer rather than executing silently.

### 9.8 ToolDefinition and integration paths

A tool declares logical ID/version, description, input/output schemas, executor,
effect, capability requirements, resource resolution, sync/async lifecycle and output
media. Tool packs may define timeouts; physical motion also obeys task budgets.

```yaml
schema_version: physical.tool.v1
tool_id: perception.segment_objects
version: '1'
description: Return instance segmentation for a text prompt on a referenced observation frame
input_schema: builtin:SegmentationRequest.v1
output_schema: builtin:SegmentationResult.v1
executor:
  kind: python_rpc
  provider: sam_local
  operation: segment_objects
effect: read_observation
required_capabilities: [rgb_observation]
resource_policy: provider_serialized
result_media: [json, image_ref, mask_ref]
```

Support native DSH/TypeScript integration, Python-provider RPC, and existing MCP tool
bridges. Configuration selects a provider for a model-facing tool; replacing SAM need
not change the role prompt.

Native and external execution paths share call records and visibility enforcement.
MCP schemas are only an entry point: EDH must map physical effects, resources, media and
compatibility rather than assuming every external tool is read-only. High-volume streams
remain outside ordinary text messages.

The target ToolResult distinguishes completed, running with operation ID, failed and
unknown, and records call/agent/assignment identity, tool version, input/output evidence,
effects, actual resources and errors. Errors include invalid_input, unsupported,
observation_stale, provider_unavailable, resource_busy, timeout and execution_state_unknown.
Read-only inference may return an error; uncertain physical timeouts require state
reconciliation before any further motion. The current result schema checks structural status rules, but operation tracking and
selected-tool payload validation still require F1–F3 work before runtime acceptance.

Declared concurrency is only a preliminary filter. A SAM session may need serial
provider access; active observation may need device resources. Actual resolved resources
determine scheduling. Registration, role selection, model-visible schema and runtime
permission must agree; hiding a tool in the UI is not authorization enforcement.

## 10. Control console

Follow the approved prototype's physical-task layout. The old demo used synthetic data;
production components connect to real events and observation services.

### 10.1 Required work areas

| Area | Display and interaction |
| --- | --- |
| Task/instructions | Goal, constraints, additional input, run source and config version; distinguish received/effective input |
| Sensors | Cameras/depth/other streams, sources/timestamps, stale or disconnected states; compare live and agent-seen frames |
| Agents | Instances, roles, callers, private sessions, current assignments, waiting dependencies, received briefs/messages |
| Team/Role | Team version, member aliases and instances, definitions, effective tools and startup errors |
| Tool calls | Category, provider, source observation, annotated results, actual resources and state |
| Embodiment | Connection, actuator state, job, budgets and confirmed pause/stop; render according to device capabilities |
| Subgoals/recovery | Goals, attempts, changes, decision ownership and original recovery-goal state |
| Verification | Monitor versus formal verdict, individual checks, GT source, unknown reasons and evidence |
| Experience | Evolver trigger, read evidence, output skill version/scope and later retrieval |
| Timeline | Causally linked user input, messages, execution, pause, checks, retries and skills |

### 10.2 Interactions

Users issue tasks/constraints, request pause/termination, and inspect evidence/history.
A user resume request reaches Planner and becomes an explicit decision. Until device
acknowledgement, show “pause requested” or “state unknown,” not stopped based on prose.

History is read-only and clearly labels attempt/time. Playback position is not current
device state. Label debug GT as agent-invisible; screenshots of mixed UI must not leak
hidden state into agent input.

The message view should answer: Why did Verifier pause? Why did Planner retry? Which
failure did Evolver use? What context did this new agent actually receive? Show explicit
decision explanations, tool calls and evidence, not inferred private model reasoning.

v1 supports file-configured teams and dynamically created instances. A drag-and-drop
workflow editor is optional. Video uses stream/asset channels and refreshes independently
of model replies.

## 11. User-defined teams and roles

Composable agents mean user-authored role teams: define responsibility, choose tools,
join a team and delegate through the harness. Adding a role does not require copying
a builder, changing fixed Python role enums or writing a model loop.

### 11.1 Minimum authoring workflow

1. Select a built-in team or copy a team.yaml.
2. Create a ROLE.md with responsibility and tool needs.
3. Add the role file to the team's members.
4. Select the team in the console, inspect resolved members/tools/bindings and start
   through the normal task workflow; no additional per-role approval is required.

Existing registered tools need only configuration. A new model/device service still
requires a provider; natural-language role descriptions do not implement missing tools.
The [examples](../examples/README.md) are loader fixtures, not a working loader.

### 11.2 Custom role example

File: `roles/scene-analyst.md`:

````markdown
---
role_id: scene-analyst
description: Identify target objects and spatial relationships using available perception tools and return evidence to the caller.
tools:
  - perception.capture
  - perception.segment_objects
  - perception.estimate_depth
---

You are the scene analyst. The caller supplies the task and context through an InvocationBrief.

Inspect the referenced frames. Capture a new observation or segment candidate
objects when needed; estimate spatial relationships only when depth is available.
Return candidate entities, evidence references, uncertainty and any missing context.
Do not treat detections as ground truth, retry physical tasks or move the robot.
````

To authorize turning for a new view, select `observation.turn_view` and explicitly
supply allowed motion and budgets in the brief; no new agent implementation is needed.

Every role can report insufficient context through the framework's report protocol;
normal handoff does not require an additional custom tool. Explicit communication
tools are convenient entry points, not access to every member's files. The earlier
`needs_context` wording maps to the implemented `insufficient_context` status; a later
versioned report can complete the assignment after explicit context arrives.

Output uses the AgentReport.v1 envelope. A stricter role may declare
`output_schema: ./schemas/scene-assessment.json`; the loader validates a role-local
object schema in DSH's supported subset and binds it to the native reporting tool's
result argument. Identity and routing remain framework-owned. See the
[implemented report protocol](implementation/upper-runtime.md). An omitted model uses the team/deployment
binding, not temporary caller-instance settings.

### 11.3 Team example

For a team.yaml next to its roles directory:

```yaml
schema_version: physical.team.v1
team_id: household-team
entrypoint: lead
members:
  lead: builtin:planner
  verifier: builtin:verifier
  evolver: builtin:evolver
  scene: ./roles/scene-analyst.md
bindings:
  decision_owner: lead
  final_verifier: verifier
  recovery_evolver: evolver
tool_bindings:
  perception.segment_objects: sam_local
```

`sam_local` refers to a deployment-registered provider, potentially a Python service
or another implementation. Checkpoints, secrets and endpoints belong in deployment
configuration, not public role instructions. The repository example resolves its role
path relative to `examples/teams/household.yaml`.

Default collaboration: entrypoint receives the task; decision_owner may delegate to
members; final_verifier gets a complete brief before execution; recovery_evolver gets
one on retry. Matching events reach the active assignment in the relevant scope. Adding
scene makes it addressable, not automatically active or subscribed to the whole history.

An illustrative invocation uses the complete brief fields:

```yaml
operation: team.delegate
member: scene
assignment_key: inspect-cup-before-attempt-2
brief:
  objective: Distinguish the left and right cups and report a candidate binding for the user's target
  task_scope:
    task_id: task_42
    goal_id: goal_store
  expected_output:
    schema: AgentReport.v1
    recipient: planner_1
  entities: {}
  success_contract:
    id: identify_target
    version: '1'
    all:
      - check: target_identity_supported
        args: [left_blue_cup]
  known_facts:
    - statement: The target is the left blue cup; its stable entity ID is not yet established
      observed_at: '2026-09-07T00:00:00Z'
      evidence_refs: [obs_120]
  history_summary: Inspect the target before a second placement attempt
  changes: []
  evidence_refs: [obs_120]
  tools_and_limits:
    allowed_tools: [perception.capture, perception.segment_objects, perception.estimate_depth]
    allowed_actions: [observe]
```

The call returns assignment ID, agent ID and accepted status. The recipient works in
a fresh context and returns a structured report; the caller decides whether to use
the binding. An analysis report marked completed does not mean the robot goal passed.
The identity-check name above illustrates a role-specific output requirement; it is
not a currently registered runtime check.

### 11.4 Required fields, defaults and validation

| Definition | Required content | Defaults and checks |
| --- | --- | --- |
| RoleDefinition | role_id, description, tools and nonempty Markdown instructions | Intended role schema version defaults to physical.role.v1; model defaults to team; InvocationBrief input and AgentReport output |
| TeamDefinition | schema_version, team_id, entrypoint, members, responsibility bindings | Referenced members and built-in/relative role files must exist |
| Role tools | Registered logical IDs; optional toolsets resolve to fixed IDs | Reject unknown tools, missing schemas or incomplete effect declarations before activation |
| Responsibility bindings | decision_owner, final_verifier; recovery_evolver when learning is enabled | One decision owner per task, one final verifier per goal, appropriate tool capabilities |
| AgentReport | Assignment/scope identity, status, summary, structured result where needed and evidence | Completed/failed/insufficient-context/cancelled semantics; empty evidence allowed, fabricated references forbidden |

The target Role/Team ID pattern is `[a-z][a-z0-9_-]{0,63}`. Tool lists are deduplicated.
Reject unknown fields outside documented extensions. Resolve relative files from the
owning role/team file; reserve `builtin:` for built-in references. Bootstrap schemas
capture only part of this target validation and are not loader acceptance evidence.

Definitions are shared read-only; sessions and workspaces are private. Snapshot resolved
team, role and tool versions at run start. File edits affect future runs, not silently
replace active instances. Hot reload is outside v1.

### 11.5 Advanced composition and dynamic instances

v1 supports delegation and subscriptions. Optional subscription definitions identify
event type, member, scope filter and delivery mode. Deliver only to matching activated
assignments. A trigger creating a new instance needs a complete caller-provided brief;
a bare event is insufficient context.

Member aliases are not instance addresses. `team.send` targets an assignment ID;
multiple active instances must not create an ambiguous “some verifier” destination.
New work uses delegation; follow-up messages remain within that assignment's context.

Users may replace Planner, add a scene analyst or object-state verifier, or disable
Evolver for ablation. Validate responsibilities by capabilities, not role names.
Without Evolver, explicitly mark recovery learning disabled. Final-verifier ownership
and the budget verification gate remain required for the default physical-task profile.
Specialists report to the designated final verifier; final authority stays unambiguous.

Authorized members need not form a fixed manipulation/navigation tree. Team-run routing
controls permissions; caller relations express delegation and handoff responsibility.
Custom roles and analysis tools do not automatically gain motion, retry or replan authority.

### 11.6 Loader/factory and authoring acceptance

Load files → resolve role/tool/schema references → expand defaults/toolsets → check
responsibilities/model/device compatibility → freeze TeamRunSnapshot → create a target
DSH scope → inject role instructions and the explicit caller brief.

Build the target role's composition rather than inheriting the parent's defaults.
Shared model clients, connection pools and read-only providers do not imply shared
prompts, sessions or mutable tool state. Every call carries assignment scope; stateful
perception providers isolate or serialize their own sessions.

The console exposes team selection, members, role preview, effective tools and missing
dependency diagnostics. File-based authoring is the v1 priority, not a visual editor
or marketplace. Acceptance adds scene-analyst through files/configuration, swaps its
segmentation provider without changing the role, and inspects the brief, actual model
tool list, evidence and returned report. No fixed role enum or special builder changes.

## 12. Implementation structure and legacy migration

### 12.1 EDH ownership and selective DSH absorption

EDH owns its monorepo. The server and console assemble the product. Both runtime sides live under `harness/`, with public wire contracts alongside them.
The TypeScript `agent-runtime/` and Python `physical-runtime/` can run separately while
remaining parts of one physical-agent framework. Domain modules cover agents, teams, models, tools, communication, planning, files, tasks, execution,
perception, observation, verification, memory, storage and contracts. The current
[module map](architecture/modules.md) is the source of actual code paths.

DSH supplies implementations to absorb; do not rewrite its loop. Validate source and
runtime dependencies before migration, preserve licenses and record original/destination
paths. Bootstrap fixes provenance and interfaces but copies no DSH runtime. Historical
full-fork/physical-plugin layouts are superseded by the EDH-owned structure.

The wire schema has one source. TypeScript is generated; executable Python boundary
validation is Step 01. Do not maintain incompatible manual DTO definitions.

### 12.2 Legacy EAF migration map

| Legacy implementation | Preserve | Change |
| --- | --- | --- |
| execute_subtask | Separate instructions and success criteria; closed-loop responsibility | Fixed manipulation/navigation becomes capability binding; blocking text becomes jobs/events/reports |
| Context projection | Relevant region/object summaries | InvocationBrief with instance/time/evidence; no implicit global scene graph |
| top_agent core tools | Todos, files and delegation | DSH bridges, durable PlanDocument, private assignment files |
| Perception/SAM/depth | Capture, segmentation, overlays and localization | Replaceable providers, explicit observation/calibration, no global spatial-memory side effects |
| rotate_camera | Active viewpoint acquisition | Resolve actual head/base resources and report achieved pose |
| ExecutionReport | Execution summary and final observation | Policy success is diagnostic; formal verification is separate |
| Verification/rollout monitor | Independent checks, in-flight observations and interruption paths | DSH verifier, mandatory budget trigger, separate facts and recovery suggestions |
| Verification bundle | Per-attempt evidence | Versioning, causality, device confirmation and actual model-visible inputs |
| Policy registry/contracts | Type specifications, lazy loading and remote inference | Check units, frames, joints, frequency and compatibility |
| Lessons | Failure evidence as input | Retry-driven Evolver and scoped successful-recovery skills |
| Global trace/scene graph/counters | Underlying responsibilities | Task/attempt scope; remove implicit cross-task sharing |
| BEHAVIOR backend | Existing real environment integration path | Extract common boundaries; keep R1Pro binding in configuration |
| Deep Agents builders | Useful role ideas and prompt content | DSH runtime; no second model loop |

Legacy code does not implement full RoboCasa/RoboTwin support. Mocks do not establish
support. Do not migrate autonomous local retries from old navigation/manipulation agents.

## 13. Milestones and acceptance

These are capability groups; the implementation plan defines construction order.
Later capabilities may first be developed on CPU doubles before real-environment
acceptance. No timeline is estimated without staffing and compute information.
M0–M3 form v1, hardware-interface doubles are exercised in M0/M2, M4 evaluates broader
configurations, and M5 covers actual hardware.

| Milestone | Deliverable | Completion evidence |
| --- | --- | --- |
| M0: Teams/tools/context | Loader, catalog, role factory, briefs, routing and test execution/perception/device backends | Config-only role addition, no inherited tools/history, no duplicate actions |
| M1: Tools and simulation | Persistent plans/files, perception/active observation, BEHAVIOR worker, policy interface, GT verifier | Observe/plan/change view/execute; mandatory budget checks; actual resources and steps traceable |
| M2: Async supervision/recovery | Nonblocking jobs, feedback, pause acknowledgement, owner retry/replan and recovery chains | In-flight feedback, owner-only attempts, failure recovery, test-backend disconnect/reconnect/stop handling |
| M3: Experience/console | Retry Evolver, skill version retrieval and production UI | Traceable successful recovery; fresh next-task agent explicitly retrieves skill; UI explains the process |
| M4: Extensibility | Second real environment/body, minimal DiMOS experiment and hardware contracts | Adapter addition without core changes; real/test/replay validation distinguished |
| M5: Real hardware | Bound robot, compatible policy and real evidence provider | Actual task/stop/disconnection behavior and unknown handling reported independently |

Even without a robot, v1 tests different capability declarations, asynchronous data,
pause/stop acknowledgement and reconnect states. Try minimal DiMOS interoperability
when dependencies are available; otherwise report it unverified, not supported.

### 13.1 Required contract and integration checks

| Scenario | Required observation |
| --- | --- |
| Independent context | A marker withheld from the brief is absent from the recipient's actual model input; appears only after explicit handoff |
| New task, reused role | Fresh session without previous objects, messages or working memory |
| Insufficient context | Explicit context request rather than hidden access to other sessions |
| Incompatible capabilities | Reject before execution with the missing camera/control/check mapping |
| Budget exhaustion | Stop actions, preserve boundary and trigger formal verification even without a model tool request |
| Stale monitor result | Old attempt/frame cannot complete the current attempt |
| Verifier pause | Request and acknowledgement remain distinct; only Planner resumes or creates an attempt |
| Redelivery/reconnection | Idempotent job; query uncertainty before further physical commands |
| GT isolation | Only authorized facts enter agents; debug state remains inaccessible |
| Retry and learning | Only explicit upper retry starts Evolver; normal success does not; failed chains yield no successful skill |
| Replan prerequisite | Prerequisite success does not close the original recovery goal |
| Skill applicability | Preserve source configuration, reject mismatches and retain authoritative conditions |
| Role replacement | New role/subscription uses configuration without a fixed role enum |
| User-authored team | A new role file/member completes a delegation without a dedicated builder |
| Tool isolation | Perception role lacks execution.start in both model schema and execution authorization |
| Files and plans | Same-named files do not collide; plans persist; todos cannot fabricate success |
| Provider replacement | Same role/observation works with another conforming segmentation provider |
| Active observation | Gimbal/base resource resolution differs by body; conflicting policy motion does not run concurrently |
| Missing optional dependencies | CPU profile starts without SAM/GPU; selecting an absent provider yields a clear diagnostic |

### 13.2 Evaluation

Report task and first-attempt success, retry/replan counts, recovery success, control
steps, wall time, model calls/cost, monitoring latency/observation lag, pause-ack latency
and verification coverage. Report unknown outcomes separately rather than dropping them.

Compare no experience, raw episode records and distilled skills. Separately compare
end-only verification with asynchronous monitoring plus final verification. Keep tasks,
policy, budgets and GT visibility matched so extra oracle information is not credited
to memory.

For transfer, align task semantics, object roles, required capabilities and criteria.
Freeze the source library before target evaluation. Separate target-side skill updates
from source-skill transfer gains. Record skill versions, task order and seeds; distinguish
online accumulation from frozen-library evaluation.

Measure adapter effort through files/changes, core modifications and conformance results.
A cheap mock adapter does not prove easy integration with every physical robot.

## 14. Deployment bindings and evolution

Bind the following to actual resources before dependent implementation:

- A subgoal-capable checkpoint, GPU, input/action specs and supported instruction granularity;
  incompatible policies require a separate training/fine-tuning work package.
- The next real environment/body after the initial configuration. BEHAVIOR, RoboCasa
  and RoboTwin are extension targets, not all currently supported.
- Monitoring interval/lag, model/execution budgets and latency targets, based on measurement.
- Robot model, cameras, DiMOS/SDK/ROS2 backend and actual stop/resume/evidence capabilities.
- Release details, dependency locks and model/data permissions. The name is now EDH and
  new scaffold code uses MIT; preserve upstream notices and distinguish code licenses
  from model-weight or dataset terms.

Filesystem skills and a single host/worker deployment are v1 defaults, not architectural
limits. Changes to role ownership, context isolation or verification gates require a
documented decision rather than an adapter-specific bypass.

## 15. Sources and current status

### 15.1 Reference basis

| Source | Use and limits |
| --- | --- |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/tree/d347e703908d0406b7a7ef80e3a0e594d86b2215) | Pinned runtime/session/tool/plugin/UI research; module map and key-path inspection, not a line-by-line audit of every file |
| [DSH agent](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/core/agent/README.md) | Scoped creation, followup/steer/inject and lifecycle; model-step delivery is not hard-real-time handling |
| [DSH subagent control](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/subagent/tool-subagent-control/README.md) | Default parent/child messages; arbitrary task routing belongs to EDH |
| [DSH skills](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/skill/skill-filesystem/README.md) | Discovery/loading; EDH adds compatibility and evidence versioning |
| [DSH presets](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/preset/agent-presets/README.md) | Composition reuse; explicitly verify target-role isolation from parent composition |
| [DSH todo](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/todo/tool-todo/README.md) | Session list/UI projection, not a durable shared task plan |
| [DSH files](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/fs/tool-fs/README.md) | Read/image/write/edit with assignment-scoped workspace access |
| [DSH file search](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/fs/tool-fs-search/README.md) | Glob/grep subprocess paths need the same workspace restriction |
| [DSH MCP](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/mcp/mcp-client/README.md) | External tools; EDH supplies effect/resource/result mappings without assuming resource/prompt support |
| Legacy EAF | Commit `714e00ca83999da2df7221dcf205968adde5b441`; execution, verification, context projection, policies and evidence |
| [DiMOS](https://github.com/dimensionalOS/dimos) | Modules, typed streams, blueprints, hardware protocols and MCP; optional backend candidate, not installed or interoperably verified |
| [ASPIRE](https://research.nvidia.com/labs/gear/aspire/) | Inspiration for evidenced recovery/transfer boundaries; EDH skills target upper decisions and verification; no reproduced results |

See [provenance](provenance/README.md) for the source audit. Historical ideas are
reference material; simulation-only scope and automatic replanning at budget expiry
are superseded by the confirmed decisions here.

### 15.2 Current status

Delivered: selective original DSH runtime, native tools/TODOs, immutable teams,
independent role sessions, explicit context/evidence, versioned plans/files,
async verification and recovery, failure-aware SKILLs, durable domain records and
a runnable HTTP/SSE debugging console. These run with scripted model/backend
fixtures, including sequential multi-goal recovery. Live VLM deployment, concurrent
physical goals, nested independent recovery chains, physical transport/action
admission, actual simulation/policies/perception and hardware remain pending.
See [progress](implementation/progress.md) for acceptance and the next steps.

## 16. Work packages, source entry points and first CPU scenario

This is a self-contained implementation handoff. Source references guide migration;
legacy prompts and installation workarounds are not new user instructions.

### 16.1 Source entry points

DSH paths below are relative to the pinned upstream checkout, not EDH's folder layout.
Use the [pinned source tree](https://github.com/deepseek-ai/deepseek-harness/tree/d347e703908d0406b7a7ef80e3a0e594d86b2215)
if the research checkout is unavailable.

| Purpose | DSH source paths | Verify during implementation |
| --- | --- | --- |
| Independent instances | `packages/core/agent/src/index.ts`, `packages/core/agent/src/runtime-types.ts` | Actual create/setup-scope/send/followup/steer signatures |
| Model/tool loop | `packages/core/agent-loop/src/index.ts`, `packages/core/agent-loop/src/tool-calls.ts` | Reuse original loop; physical ownership is not single-agent tool serialization |
| Role composition | `packages/preset/agent-presets/src/index.ts`, `packages/preset/agent-presets/src/mount.ts`, `packages/preset/agent-presets/src/session.ts` | Explicit target preset/scope; avoid parent composition inheritance |
| Tool registration/results | `packages/core/tools/src/index.ts`, `packages/core/tools/src/types.ts` | Registry, cancellation, structured/multimodal results |
| Background communication | `packages/subagent/tool-subagent/src/index.ts`, `packages/subagent/tool-subagent-control/src/index.ts` | Parent/child restrictions and EDH router integration |
| Plans/files | `packages/todo/tool-todo/src/index.ts`, `packages/fs/tool-fs/src/index.ts`, `packages/fs/tool-fs-search/src/index.ts` | Persistence, private workspaces and search scope |
| External tools | `packages/mcp/mcp-client/src/index.ts` | Media references, cancellation and reconnection |
| State/UI | `packages/core/session/src/types.ts`, `packages/api/gateway/README.md`, `packages/client/ui-tool/src/client/index.ts` | Durable events/projections rather than parsed model prose |
| Skills | `packages/skill/skill-filesystem/README.md`, `packages/skill/tool-skill/src/index.ts` | Discovery/loading and EDH metadata indexing |

Legacy EAF paths are relative to a separately obtained legacy checkout:

| Purpose | Legacy source paths | Preserve/change |
| --- | --- | --- |
| Upper tools/prompts | `src/eaf/agent/agents/top_agent.py`, `src/eaf/agent/agents/prompts/top.py` | Planning/files/perception/facts; remove robot constants |
| Perception | `src/eaf/agent/tools/perception.py` | Capture, segmentation, overlays, depth/localization; remove global side effects |
| SAM/depth providers | `src/eaf/agent/interfaces/sam_backend.py`, `src/eaf/agent/interfaces/da3_depth.py`, `src/eaf/agent/interfaces/lingbot_depth.py` | Replaceable lazy providers; recheck actual APIs/dependencies |
| Active observation | `src/eaf/agent/interfaces/http_backend.py`, `src/eaf/sim/behavior/motion.py` | Actual base/head resources and achieved pose |
| Subtasks/verification | `src/eaf/agent/orchestration/subtask_executor.py`, `src/eaf/agent/orchestration/verification.py`, `src/eaf/agent/orchestration/verify_bundle.py` | Explicit inputs, independent checks, evidence and async identities |
| In-flight monitor | `src/eaf/agent/runtime/rollout_monitor.py` | Monitor abort is not device-stop confirmation |
| Policy/environment | `src/eaf/contracts.py`, `src/eaf/sim/schemas.py`, `src/eaf/sim/behavior/session.py` | Calls and budgets; no environment-private types in generic tools |

### 16.2 Initial work packages

W01–W07 group responsibilities. The implementation plan splits UI, real adapters and
acceptance into separate steps. Target interfaces may exist in bootstrap; their presence
does not satisfy functional completion.

| ID | Work | Output | Acceptance |
| --- | --- | --- | --- |
| W01 | Single protocol source | Role/Team/Tool/Brief/Envelope/Report/Plan/Observation/Result schemas and cross-language fixtures | Matching versions, valid inputs accepted, malformed structures and invalid references rejected at appropriate boundaries |
| W02 | Team/Role loader and catalog | Resolution, preflight and immutable snapshots | Config-only role addition, deterministic missing-binding errors |
| W03 | DSH role factory and communication | Fresh scopes, nonblocking delegation, send/reply/context requests/subscriptions | No prompt/tool/workspace leakage; correlate brief and actual model input |
| W04 | Upper-level tools | Persistent plan/todo mapping and scoped files/search | Plans survive turns, version conflicts rejected, private files explicitly handed over |
| W05 | Full tool execution slice | CPU capture/segmentation, active observation, jobs/checks, results and resources | Scene-role report, head/base conflicts and no GPU dependency |
| W06 | Verification and recovery | Mandatory formal checks, monitor, pause acknowledgement, owner retry and Evolver | Budget must verify; only owner creates attempts; original-goal success enables skills |
| W07 | UI and actual adapters | Team/role/tool console, BEHAVIOR/provider migration, optional SAM | Real events replace demo data; dependencies and unverified capabilities are explicit |

W01–W06 schema/fixture/integration work can run without a GPU. Missing simulators or
checkpoints block real-adapter acceptance, not prior CPU work. CPU checks do not prove
policy effectiveness.

### 16.3 Reproducible CPU acceptance scenario

Use explicitly labeled test backends and scripted model responses to validate framework
behavior, not intelligence:

1. Load household-team with user-defined scene-analyst, selected perception tools and
   the framework's minimum communication/reporting capability.
2. Planner receives “Put the left blue cup in the cabinet,” writes a PlanDocument and
   private progress note.
3. Delegate via InvocationBrief. Scene gets only its role and explicit task context,
   calls capture/segment and returns candidates/frame evidence; execution.start is unavailable.
4. Planner submits attempt_1. Test policy advances declared control steps while Verifier
   monitors. Budget expiry forces formal checking; test GT returns inside=false.
5. Planner explicitly retries, records recovery_1 and briefs a fresh Evolver with failure
   and changes. On attempt_2, final_verifier formally confirms inside=true for the original goal.
6. Evolver writes a test-fixture skill and returns its reference. A new task's fresh
   Planner sees it only after explicit skills.search/load.

Expected event outline; monitoring/perception events may interleave:

```text
team.resolved → assignment.created(planner)
plan.updated → assignment.created(scene) → tool.completed(segment) → agent.report(scene)
assignment.created(verifier) → execution.started(attempt_1)
execution.budget_exhausted → verification.requested → verification.completed(failed)
retry.requested(planner) → retry.started(recovery_1) → assignment.created(evolver)
execution.started(attempt_2) → execution.ended → verification.requested
verification.completed(passed, original_goal) → recovery.resolved(success)
experience.created(test_fixture) → agent.report(evolver)
```

Fix inputs/responses and inspect actual DSH model-adapter messages/tool schemas, not
just a helper's fresh=true flag. Media must be readable images or explicit test types,
not broken image references labeled as sensors. Keep fixture skills separate from
real experience libraries.

### 16.4 Build, checks and handoff report

Current commands are in [development setup](development/setup.md):
`pnpm install --frozen-lockfile` and `pnpm check`. Skeleton checks are not runtime
acceptance. Add actual behavior-test commands as implementation lands; do not present
upstream test paths as tests already passed here. Base Python interfaces import without
GPU packages; actual providers get isolated dependencies later. Report changes, actual
checks, skipped items/reasons and next steps.

### 16.5 Change log

- v1.0 (2026-09-06): DSH-based physical loop, independent contexts, async Verifier,
  retry Evolver, adapter boundaries and console direction.
- v1.1 (2026-09-07): Team/Role authoring, full tool capabilities, role-scope isolation,
  source entry points, CPU slice and handoff acceptance.
- v1.2 (2026-09-07): Step 00–16 sequence, explicit actions/gates, CPU/simulation/hardware
  boundaries and interrupted-work handoff; SVG diagrams retained.
- v1.3 (2026-09-07): EDH-owned repository, intuitive flat modules, selective DSH absorption,
  provenance, skeleton bootstrap and a separate canonical implementation plan.
- v1.4 (2026-09-07): English public documentation and diagrams. Preserve requirements
  and explicitly distinguish intended contracts from partial skeleton declarations. Group
  both runtimes and shared contracts under `harness/` (decision 0002).

## 17. Step-by-step implementation plan

[implementation/plan.md](implementation/plan.md) is the single maintained plan.
Skeleton Bootstrap is a separate delivery stage. Interfaces and directories do not
complete the functional acceptance gates of Steps 00–16.

## Implementation update: upper application first (2026-09-08)

The current implementation order prioritizes the DSH-backed upper application and
console before physical runtime providers. The runnable CPU fixture validates role
isolation, native tool calls, planning/files, verification, recovery and experience
publication. It is not evidence of model quality, simulation success or hardware
readiness. See [progress](implementation/progress.md) for exact current capability.

The recovery activation point is now explicit: **formal failed subgoal -> decision
owner accepts replan/retry -> explicit failed-attempt handoff -> Evolver records
planner and execution progress -> original-subgoal formal success -> SKILL**.
The Evolver receives scoped messages rather than shared agent histories. Both
replan and retry enter one recovery; a later retry does not duplicate the Evolver.
See [decision 0004](implementation/decisions/0004-recovery-observation-and-action-admission.md).

Physical providers must separate policy inference from action admission and device
execution. Pause invalidates queued/late policy chunks and requires a separate
controller acknowledgement. Resume is a decision-owner action. Device-specific
buffering and interruption granularity remain explicit provider capabilities;
software gate closure does not establish that physical motion has stopped.

### v1.8 clarification: observability and delivery order

Upper work continues before physical providers. Reuse the native DSH TODO plugin
and expose real model output, tool arguments/results/errors, assignment/turn/step
identity, explicit context and TODO history. Concise decision notes are useful;
missing provider reasoning must never be fabricated. Agent-reported TODO completion
is separate from verifier-accepted physical success. The final console must show
key agent, task, sensor, execution, verification and recovery state together in one
workspace, without page/tab switching for essential state. The unified console now
implements this layout, with stacked sections on narrow screens and scrollable details.

### Implemented role reporting clarification

Framework-provided agent.report and team.query now return versioned, identity-bound
AgentReport records through native DSH inbox delivery. Custom role schemas constrain
report.result using DSH-supported JSON Schema. Exact retries return the same receipt;
final results cannot be rewritten. Native idle state is not a role result or physical
verdict. Decision owners finish tasks through existing task tools. Native raw tool
definitions invoke DSH input validation explicitly; schema declaration alone does
not validate arguments. No new registry, model loop or physical middleware is added.


## Implementation update: plan-selected subgoals (2026-09-09)

The native `tasks.select_goal` tool selects an admitted plan goal. `planning.read`
exposes the deployment-bound check catalog; Planner may compose subgoals from those
exact checks or use predefined bindings. The final task criteria and executed goal
history remain immutable. Dependencies require their own latest accepted verdicts.
Switching requires confirmed ended execution and formal verification. Returning to a
failed goal requires explicit retry; attempt budgets apply per goal.

A recovery can span a successful repair prerequisite and ends only at formal success
of its original failed goal. SKILL publication is then allowed while later task goals
continue. Evolver model failures remain learning failures. No new DSH loop or dispatcher
was introduced. [Runtime guide and SVG](implementation/multi-goal-runtime.md) specify
current tool semantics, limits and the CPU acceptance scenario.


## Implementation update: caller report acknowledgement (2026-09-09)

Roles now have native team.ack_report. The fixed caller explicitly accepts/rejects
an exact published report version. Acknowledgement is an immutable recorded assessment,
separate from DSH delivery settlement and from physical verification. Report history
retains a published version chain. Startup marks unsettled delivery interrupted while
preserving receipts; it does not resume sessions or replay physical actions.
The [illustrated protocol guide](implementation/report-acknowledgements.md) contains
tool arguments, permissions, replay semantics, crash boundaries and acceptance tests.

## Implementation update: asynchronous provider reads (2026-09-12)

Upper perception and verification calls may resolve asynchronously. Pass the native
DSH cancellation signal into providers and reject late results before changing
assignment evidence or checked facts. Formal check requests carry their expected
execution and stopped boundary IDs; revalidate them after remote completion. The
backend query method is an immediate client-side projection, refreshed before
stream callbacks. Transport implementation and physical acknowledgement remain
separate integration work. See [execution boundary](../harness/agent-runtime/execution/README.md).
