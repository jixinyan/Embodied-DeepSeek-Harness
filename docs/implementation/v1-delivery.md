# v1 delivery and acceptance

Updated: 2026-10-03. Native Qwen/Pi0.5 RoboTwin retained-scene retry and
RoboDojo task success, real SAM/YOLO tool calls and source-bound RoboCasa RGB-D
geometry are verified. Reusable native factories, complete retention bindings,
packaged Desktop lifecycle and selected DSH recovery/JSON portability have production
checks. Actual RoboDojo unchanged-terminal multi-task acceptance and clean
retained-scene retry pass. Additional model/provider workflows and release gates remain open.
The [current Agent loop](current-agent-loop.md) records prompt, memory and retry
behavior; full v1 acceptance remains pending. Evolver work is paused and SceneState
implementation is deferred under the current user instruction.

The delivery target is a complete EDH v1 with every agreed product capability
implemented and verified. A working directory, interface declaration, installed
checkpoint or successful simulator reset does not complete a capability. Each row
below needs an implementation, executable checks and retained acceptance evidence.
The [project specification](../project-spec.md) defines the behavior; this page
tracks the remaining work across that behavior.

The [release validation guide](release-validation.md) defines source checks,
actual native task submission, source-bound audits and product/safety evidence.

## Acceptance register

| ID  | Capability                                  | Confirmed current state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Remaining implementation and acceptance                                                                                                                                                                                                                               |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V01 | DSH agent runtime and replaceable models    | Native Qwen/Pi0.5 run `686c9767-746a-430e-ba81-900eef3fb09c` verifies a failed attempt, retained-scene retry, fresh formal success, six completed TODOs, zero tool errors and released resources. Actual Qwen failed-step recovery preserves completed results, unknown/not-started outcomes and original errors. Five native journals verify 149 interrupted prefixes without physical replay. Actual Node/JavaScriptCore JSON portability passes; exact selected-source provenance is retained.                                          | Verify multi-goal behavior and additional custom-role workflows. Current task testing uses local Qwen and learned policies.                                                                                                                                           |
| V02 | Composable teams and explicit communication | Actual Qwen/Pi0.5 runs `ef8f9d03` and `66ff9b47` verify independent SceneAnalyst context, explicit evidence transfer, selected-schema reports, Planner acknowledgement, retained-scene retry and formal success. The latter retains 765 events, 104 controls and two tool errors; four assignments retire and the Session releases resources. Its clean-workflow acceptance is false.                                                                                                                                                      | Verify additional roles, insufficient-context follow-up, cancellation and zero-tool-error planning with actual model/provider combinations.                                                                                                                           |
| V03 | Planning and task decisions                 | Native TODOs, persistent plans, registered goals, owner-only selection/retry/replan/resume and user clarification exist. Run `686c9767` preserves the original criterion and environment: 64-control failed attempt followed by a 49-control successful retry. RoboCasa run `7dfb663e` verifies three failed attempts, two accepted retries and truthful failure after budget exhaustion.                                                                                                                                                  | Validate multi-subgoal completion and prerequisite recovery with actual simulation. Task criteria remain supplied by validated providers and explicit configuration.                                                                                                  |
| V04 | Post-execution verification                 | Real RoboCasa confirms zero Verifier assignments during running/paused execution, Planner-owned resume, and one fresh Verifier after confirmed budget end with a native failed GT verdict. RoboDojo confirms a fresh independent Verifier after native episode termination, unchanged native GT success and Planner completion.                                                                                                                                                                                                            | Check unknown verdicts, scoped before/after evidence and native GT across all four providers, including policy-stop boundaries.                                                                                                                                       |
| V05 | Evolver and reusable SKILLs                 | Failure-aware Markdown storage, recovery linkage, metadata search, selective loading and provenance checks exist. Actual retry resolves a recovery journal without an Evolver assignment or new SKILL. Live Teams disable learning.                                                                                                                                                                                                                                                                                                        | Evolver development/publication is paused. Existing SKILL search/loading remains available. Cross-Session reuse/transfer and semantic ranking require their own future acceptance.                                                                                    |
| V06 | Physical worker and action admission        | Host/Python transport, retained environments, ActionGate budgets, independent device watchdog and OS-backed shared resource leases are implemented. All four providers expose authoritative terminal state. Preflight publishes a fresh confirmed ended boundary and current observation before policy creation when the native episode has ended. Native run `4a65da16` separately verifies actual endpoint refusal after admission: backend_error, zero controls, no Verifier and released resources.                                    | Verify actual unchanged-terminal repeated task with zero new controls/inferences, connection loss, watchdog deadlines and stale action rejection; verify provider-start rejection before a receipt.                                                                   |
| V07 | RoboCasa / PandaOmron                       | Native reset, cameras and controller mapping pass. Qwen/GR00T run `7dfb663e-debb-44fb-a4da-96be2b88e664` completes 192 controls, 24 learned inferences, three fresh failed Verifiers and two accepted retries; all 13 assessment TODOs complete with zero tool errors and released resources. Actual SAM-mask RGB-D measurement is separately verified.                                                                                                                                                                                    | Obtain reproducible successful task/recovery and native success termination. Validate complete workflows on additional task/checkpoint bindings.                                                                                                                      |
| V08 | RoboTwin / Aloha AgileX                     | Native adjust_bottle success and actual failed-attempt recovery pass through Qwen/Pi0.5 and ActionGate. Run `686c9767` covers 113 controls, eight identified policy requests, 10,662 physics steps, two fresh formal Verifiers and released resources. All six recorded videos pass decoding/timestamp checks. Separate checks verify pause/resume and cancellation.                                                                                                                                                                       | Extend validated configuration/catalog support to additional checkpoint-compatible tasks and bodies; verify multi-task continuity.                                                                                                                                    |
| V09 | BEHAVIOR-1K / R1Pro                         | Qwen/GR00T run `0b7da1de` completes 48 controls and 192 physics steps across three attempts, two accepted retries, three independent failed Verifiers and 11 completed assessment TODOs. Four assignments retire and native resources release. Actual action identities, nine camera videos and 698 model-facing schemas pass source checks. One active-view tool error is retained; clean-workflow acceptance is false.                                                                                                                   | Verify supported device-capability exposure with actual model calls, a zero-tool-error workflow, original task success and additional task/scene/checkpoint combinations.                                                                                             |
| V10 | Perception and active observation           | Real Qwen capture/SAM3.1/YOLO26 tool calls pass. Native RoboCasa SAM-mask measurements return source-bound axial depth, camera range, camera/world surface coordinates and coverage. Six R1Pro native trials verify yaw/pitch, cancellation, 170 controls, 680 physics steps and clean shutdown. Qwen/production-worker run `8f35aca4` verifies capture and both yaw directions; returned RGB bytes match actual later requests, with zero tool errors and released resources. Fixed-camera RoboTwin requests expose only supported tools. | Validate actual Planner pitch workflows and active-motion concurrency; complete native measured geometry across additional providers and camera/calibration accuracy checks.                                                                                          |
| V11 | Spatial memory and frame selection          | Native context compaction, whole-message image recency and original audit retention exist. SceneState lifecycle is specified in the spatial-memory proposal.                                                                                                                                                                                                                                                                                                                                                                               | SceneState implementation is deferred. Its initialization/update/reset and retrieval requirements remain documented for subsequent work.                                                                                                                              |
| V12 | Console and launcher                        | Unified trace-only console, compatible selectors, history and actual model/tool/TODO displays exist. Packaged Electron opens the console from saved native RoboTwin configuration; profile selection, Stop service and application-quit cleanup pass with released writer locks, exited owned children, closed listeners and zero browser errors. This lifecycle check allocates no simulator and performs no inference. Recorded native task videos retain separate acceptance.                                                           | Verify multi-task continuity, installed task execution/configuration switching across the supported matrix and signed distribution.                                                                                                                                   |
| V13 | Persistence and maintenance                 | Complete built-in native ownership covers submission, plan, file, clarification, native audit and leased external sources. Default factories bind record/original-image retention. Actual four-session journals verify independent selection and preservation through restart. Production HTTP/browser checks retire 626 private records, retain two request identities and explicitly collect 180 private original images while source digests remain unchanged.                                                                          | Validate complete installed maintenance/task workflows across additional native configurations. Unknown extension formats require explicit complete inspection.                                                                                                       |
| V14 | Hardware portability and release handoff    | The hardware integration interface exposes capabilities, connection identity, ActionSpec and confirmed stopping. Watchdog/resource checks use actual threads and processes. Environments remain isolated and configuration selects devices.                                                                                                                                                                                                                                                                                                | Publish reproducible setup, supported configuration matrix and release checks. Physical robot experiments follow simulation/interface acceptance, as agreed, and need a selected device.                                                                              |
| V15 | RoboDojo / dual ARX X5 | Actual Qwen/Pi0.5 run `897f215d` verifies failed 32-control execution followed by successful 26-control retained-scene retry, 580 native physics steps, four identified learned requests, two fresh Verifiers, eleven completed TODOs and zero tool errors. Six native camera videos and the composite MP4 pass complete source/decode checks. Same-Session run `ca43312e` verifies its unchanged ended episode with a fresh boundary/Verifier and zero new controls, physics steps or inferences; resources release. The 18-file checkpoint is verified. | Verify original build_tower stages, native interruption and remaining hybrid acceptance. Evolver remains paused. |

## Execution order

1. Complete zero-tool-error local Qwen custom-role planning, additional explicit
   evidence workflows and multi-goal acceptance. Continue RoboDojo learned-policy
   dependency/inference validation. Preserve ActionGate and independent post-execution
   verification; record simulator video locally and inspect trace through the console.
2. Preserve verified DSH recovery, JSON portability and exact selected-source hashes;
   validate additional model routes against their actual supported protocols.
3. Complete clean custom-role RoboTwin and BEHAVIOR policy workflows, including
   shutdown. Continue real RoboCasa successful-task and recovery acceptance.
4. Finish the watchdog/resource boundary and native perception/active-observation
   providers. Apply the same capability/configuration rules to every supported body.
5. Preserve existing selective experience retrieval. Resume deferred SceneState and
   paused Evolver work only when the user includes them in the active scope; retain
   independent source/destination acceptance requirements for experience transfer.
6. Preserve verified unchanged-terminal multi-task continuity and complete native
   maintenance, configuration switching and task scenarios as one installed
   application. Preserve verified default retention, restart behavior and packaged
   launcher lifecycle.
7. Review every acceptance row, publish the exact supported configuration matrix,
   update documentation/diagrams and tag v1 only when the agreed gates pass.

Work on independent providers can proceed concurrently. Changes to shared identities,
authority, state transitions and evidence rules require consistent checks on both
runtime sides before dependent integration is accepted.

## Real-run visualization requirements

The live console exposes Agent/task state. Recorded exports join that state with
worker-local simulator video. Together they retain:

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
