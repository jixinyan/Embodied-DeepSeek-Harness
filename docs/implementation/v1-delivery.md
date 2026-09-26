# v1 delivery and acceptance

Updated: 2026-09-26.

The delivery target is a complete EDH v1 with every agreed product capability
implemented and verified. A working directory, interface declaration, installed
checkpoint or successful simulator reset does not complete a capability. Each row
below needs an implementation, executable checks and retained acceptance evidence.
The [project specification](../project-spec.md) defines the behavior; this page
tracks the remaining work across that behavior.

## Acceptance register

| ID | Capability | Confirmed current state | Remaining implementation and acceptance |
| --- | --- | --- | --- |
| V01 | DSH agent runtime and replaceable models | Selected native DSH loop, tools, sessions and context management are mounted. Local Qwen/vLLM completes real image/tool rounds, persisted reasoning and rc.2 dynamic-tool checks. | Diagnose the recorded model connection failure and verify long-running task/recovery behavior. Exercise a configured cloud OpenAI-compatible endpoint when credentials are available. |
| V02 | Composable teams and explicit communication | Team/ROLE loading, separate assignment contexts, briefs, reports, acknowledgements and tool exposure exist. | Verify custom roles and role/tool configuration changes with actual model sessions, including cancellation, explicit evidence transfer and role retirement. |
| V03 | Planning and task decisions | Native TODOs, persistent plans, registered goals, owner-only selection/retry/replan/resume and user clarification exist. | Validate multi-subgoal completion and Planner-directed recovery with actual simulation. Task criteria must remain supplied by validated providers and explicit configuration. |
| V04 | Post-execution verification | Real RoboCasa confirms zero Verifier assignments during running/paused execution, Planner-owned resume, and one fresh Verifier after confirmed budget end with a native failed GT verdict. | Check successful and unknown verdicts, scoped before/after evidence and limited GT across all three native providers, including policy-stop and episode-termination boundaries. |
| V05 | Evolver and reusable SKILLs | Failure-aware Markdown storage, recovery linkage, metadata search, selective loading and provenance checks exist. | Record a genuine failure followed by a Planner recovery decision and formal original-goal success. Verify Evolver publication and explicit reuse in another session; evaluate transfer to another environment/body. Semantic ranking and richer retrieval are still unimplemented. |
| V06 | Physical worker and action admission | Host/Python transport, retained environments, control generations, ActionGate budgets, real GR00T controls and confirmed RoboCasa pause/stop exist. | Complete independent watchdog and shared-resource arbitration; verify connection loss and stale action rejection under actual inference/control, with measured stop boundaries. |
| V07 | RoboCasa / PandaOmron | Native reset, cameras, controller mapping and a 1,050-control Qwen/GR00T run are recorded. Formal GT is false. | Diagnose policy/task behavior and model failure; obtain reproducible successful task and recovery evidence. |
| V08 | RoboTwin / Aloha AgileX | Native adjust_bottle reset, three cameras, 14-channel targets and GT are recorded. Pi0.5 weights/tokenizer are installed. The adapter currently admits only adjust_bottle. | Complete fresh-observation policy inference, ActionGate control, interruption, verification and console task acceptance. Replace the single-task restriction with validated configuration/catalog support for supported tasks and bodies. |
| V09 | BEHAVIOR-1K / R1Pro | Native picking_up_trash reset and separate capture return three cameras, 21 state groups, 23-channel actions and GT. Clean shutdown passes. The adapter currently admits only that task and an instance_id setting. | Connect the selected GR00T provider and verify control/interrupt/GT/session-release behavior through the console. Expose validated task/scene/instance configuration and compatible checkpoint selections. |
| V10 | Perception and active observation | Reference-addressed capture, scoped image delivery and perception schemas exist. SAM 3.1 and YOLO26 depth are the selected perception providers. Current native providers declare no active-view directions. | Integrate the actual selected checkpoints through replaceable services and authorized image references; verify segmentation, depth provenance/calibration and supported physical observation actions. Validate tool effects, actual resources, camera calibration and evidence identity. |
| V11 | Spatial memory and frame selection | Native context compaction, whole-message image recency and original audit retention exist. The spatial-memory representation awaits a user design decision. | After that decision, implement session-scoped spatial observation records, explicit scene-memory tools, coverage-aware selection and comparison-frame retention using actual sensor metadata. |
| V12 | Console and launcher | Unified live console, compatible launch selections, session/task history, actual model/tool/TODO displays, a desktop launcher and synchronized event/camera replay exist. A real-run MP4 export is available. | Verify native deployment creation, multi-task continuity, configuration switching and clean release from the launcher. |
| V13 | Persistence and maintenance | Durable records/images, scoped audits, SQLite history index, compaction and several reference-owner modules exist. | Complete submission/plan/file/clarification/native-audit ownership, archived request identities and user-facing retention operations. Verify restart reconciliation and cleanup against actual histories without losing SKILL sources. |
| V14 | Hardware portability and release handoff | Device/provider boundaries and deployment configuration exist. | Implement and validate the hardware integration interface, capability discovery and stop acknowledgement. As agreed, physical robot experiments follow simulation/interface acceptance; their completion needs a selected device and independent evidence. Publish reproducible setup, compatibility declarations and release checks. |

## Execution order

1. Deliver an inspectable real-run dashboard. Use the recorded run below to verify
   the full agent/task view while keeping simulation time and wall-clock time distinct.
2. Complete the current model diagnostics and native DSH release compatibility checks.
   Preserve failure causes without retaining credentials or sensitive request bodies.
3. Complete policy-to-simulator acceptance for RoboTwin and BEHAVIOR, including
   clean shutdown. Continue real RoboCasa task and recovery acceptance.
4. Finish the watchdog/resource boundary and native perception/active-observation
   providers. Apply the same capability/configuration rules to every supported body.
5. Finish spatial memory, retrieval improvements and cross-session recovery experience
   acceptance. Prove every transfer claim with retained source and destination tasks.
6. Complete storage ownership/retention and restart behavior, then verify launcher,
   configuration switching and all v1 scenarios as one installed application.
7. Review every acceptance row, publish the exact supported configuration matrix,
   update documentation/diagrams and tag v1 only when the agreed gates pass.

Work on independent providers can proceed concurrently. Changes to shared identities,
authority, state transitions and evidence rules require consistent checks on both
runtime sides before dependent integration is accepted.

## Real-run visualization requirements

The console and exported replay must expose the following together:

- Task instruction, selected backend, embodiment, policy/checkpoint and model.
- Role identities, assignment lifecycle and explicitly delivered messages/evidence.
- Model-returned analysis and response text, associated with the actual role and step.
  Missing model reasoning stays unavailable; the UI must not invent it.
- Versioned task plans and TODO status as they existed at the selected time.
- Tool inputs/results, execution/budget state, physical control counts and errors.
- Confirmed execution boundaries, formal checks, accepted verdicts and recovery/SKILL events.
- All recorded camera views with capture time, observation identity and simulation time.
- A shared wall-clock cursor plus links to the original event and frame records.

Run `bc80d2aa-d6e4-4a38-b370-9efedc887936` supplies real Qwen/DSH/GR00T/RoboCasa
records: 2,300 events, 1,050 control frames and native formal failure, followed by
a model transport error. It contains no retry or SKILL. Its existing videos encode
52.4997 seconds of simulator time; agent inference and transport elapsed on a
different wall-clock timeline. The replay must preserve that distinction.

## Evidence rules

Validation uses actual providers, model services, simulator SDKs, persisted records
and production functions. Every acceptance record identifies source/checkpoint
revisions, configuration, task/seed, device, command, result and remaining limits.
Historical fixture tests do not establish real task acceptance. An unknown or failed
verdict never becomes task success through the visualization or documentation.

The [live integration matrix](live-integration.md) and [GPU evidence](gpu-integration.md)
retain provider details. Update this register when a required capability changes state.
