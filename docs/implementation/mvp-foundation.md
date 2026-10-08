# Framework foundation acceptance

Use the [v1 register](v1-delivery.md) for current capability and remaining native
acceptance, and the [implementation plan](plan.md) for the executable sequence.
The active development scope covers CPU-accessible implementation/debugging and
GPU-provider source/protocol/lifecycle checks. Evolver remains paused; SceneState
implementation remains deferred.

## DSH reuse boundary

[Decision 0003](decisions/0003-reuse-dsh-mechanisms.md) defines the runtime owners.
Native DSH services provide agent loops, tool registration/validation/dispatch,
Sessions, inbox follow-ups, model transport and cancellation. EDH services bind
Teams, permissions, goals, providers, evidence and physical resource ownership
through those mechanisms. See the [code map](../development/code-map.md).

## Foundation requirements

| Area | Required behavior | Production evidence |
| --- | --- | --- |
| Agent lifecycle | Fresh independent assignments, scoped prompt/tools, explicit context, cancellation and retirement | [Native role/context workflows](role-context-acceptance.md), [assignment lifetime](assignment-lifetime.md), [context CPU checks](cpu-release-validation.md#native-context-and-scope-ownership) |
| Team configuration | Immutable profile-specific bindings and compatibility checks before allocation | [Native workspace](native-workspace.md), [Team loader](../../harness/agent-runtime/teams/README.md) |
| Communication | Bound identities, explicit missing-context exchange, versioned reports and acknowledgements | [Communication](../../harness/agent-runtime/communication/README.md), [actual role workflows](role-context-acceptance.md) |
| Tools | Clear model-visible types, role authority, native dispatch, provider result validation and scoped media | [Tools](../../harness/agent-runtime/tools/README.md), [original schema/plan checks](cpu-release-validation.md#model-visible-tool-schemas) |
| Tasks and execution | Immutable criteria/attempts, owner decisions, ActionGate and confirmed device state | [Current Agent loop](current-agent-loop.md), [verification boundaries](verification-boundaries.md), [native release campaign](native-release-campaign.md) |
| Perception | Authorized images, calibrated source-linked metrics and active-view resource ownership | [Perception](../../harness/agent-runtime/perception/README.md), [live provider matrix](live-integration.md#provider-matrix) |
| Verification and recovery | Independent formal review after eligible confirmed end; explicit Planner retry and original-goal recovery | [Multi-goal workflow](multi-goal-runtime.md), [single-GPU task acceptance](single-gpu-native-acceptance.md) |
| Experience | Immutable failure-aware SKILLs, explicit metadata search/section reads and provenance | [Memory](../../harness/agent-runtime/memory/README.md), [source inspection](skill-provenance.md) |
| Persistence | Scoped private work, versioned plans, durable critical events, bounded readers and explicit maintenance | [Storage maintenance](storage-maintenance.md), [domain retention](domain-retention.md) |
| Application and Console | Compatible launch selection, retained Sessions, actual trace/status, owned startup/shutdown | [User Sessions](user-sessions.md), [Desktop](../../apps/desktop/README.md), [CPU release checks](cpu-release-validation.md) |

## Foundation invariants

1. Each new delegation creates a fresh assignment and context. Same-assignment
   continuation uses that assignment's own history and explicit follow-up input.
2. Accepted messages, model processing, tool completion, device acknowledgement
   and formal task success retain separate identities and authoritative records.
3. Critical records persist before their published acceptance. Conflicting duplicate
   identities fail. Uncertain transport cannot replay physical commands.
4. Async work retains its call, operation, execution, assignment and attempt scope.
   A caller deadline leaves outstanding owned work observable until it finishes.
5. Model-visible schema, selected role tools and dispatch authorization agree.
   Actual device effects determine perception/motion resource requirements.
6. Only Planner starts, retries, replans or resumes. Confirmed eligible execution
   ends create a fresh Verifier; ordinary running/paused observations stay with Planner.
7. A passed prerequisite and completed TODO grant no original-task success.
   Original-goal recovery requires its own current accepted formal verdict.
8. Image references preserve source, visibility, clock and calibration. Native
   context pruning preserves original audit and evidence records.
9. Live Teams disable learning. SKILL retrieval remains explicit and grants no
   new evidence or physical authority. SceneState is outside current implementation.
10. Shutdown drains owned threads, requests, scopes, Sessions and processes.
    Actual cleanup failure preserves unknown device/resource state.

## Foundation slices

| Slice | Owner and gate | Current evidence |
| --- | --- | --- |
| F1: boundaries | Canonical schema, typed payloads, semantic scope/lifecycle admission and generated types | [Boundary APIs](boundaries.md), actual TS/Python request/record readers |
| F2: Team and native role binding | Effective prompt/tools/models, independent contexts and authorized delivery | Actual custom-role workflow, original model schemas and scoped context reads |
| F3: physical bridge | Nonblocking worker transport, validated native operations, resources and ActionGate | Actual CPU pipes/sockets/processes; native controls and confirmed boundaries |
| F4: durable domain state | Immutable task/plan/report/verdict/evidence records and bounded maintenance | Original copied journals, production retention/restart and source inspection |
| F5: verification and recovery | Independent formal verdicts, owner retry and unchanged original criteria | Native Qwen/learned-policy recovery on RoboTwin, RoboDojo and RoboCasa |
| F6: application lifecycle | Configured Console/Desktop, retained environments and owned service release | Actual packaged two-task workflow and four-provider readiness |
| F7: release integration | Current-source CPU checks and complete installed native task/fault matrix | CPU diagnostics and recorded source audits pass; complete native campaign remains open |

## Validation boundaries

CPU checks use actual original journals, production functions, file permissions,
OS pipes, threads, HTTP/WebSocket services and owned child processes. They retain
source hashes, original errors, admission scopes and terminal cleanup evidence.
They allocate no model or simulator and return no generated policy action.

Native acceptance uses installed model/policy/SDK services, real sensor observations,
ActionGate controls, independent formal verdicts and fully decoded videos. Each
task identifies its original configuration, source, checkpoint, seed and device.
Loaded-policy cancellation, additional geometry/motion cases and the full installed
configuration matrix retain their native gates in the v1 register.

The consolidated campaign verifies RoboDojo Tower prerequisites/final success,
BEHAVIOR original-task success, supported RoboTwin/RoboCasa workflows, retained
terminal continuity and resource release. Run cases sequentially on one authorized
physical GPU after the CPU phase. See [campaign preparation and execution](native-release-campaign.md).

Existing native results support only their recorded task/configuration boundaries.
Experience evolution/transfer and real robot experiments require their own subsequent
scope and independent source/destination or hardware acceptance.
