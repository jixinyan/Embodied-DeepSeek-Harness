# Live model and simulation acceptance

The requested delivery covers the complete upper agent workflow, BEHAVIOR-1K,
RoboCasa, RoboTwin and actual VLM/policy integration. DSH remains the agent runtime.
All commands, model checkpoints and simulator observations used for acceptance must
come from the actual installed services. Generated task verdicts or scripted model
responses cannot establish these gates.

## Implementation responsibilities

1. The upper application uses the existing DSH loop, tool dispatch, independent role
   sessions and explicit briefs. Integrate remote provider results through the existing
   image, task, verification and recovery services. Fix demonstrated gaps in that path.
2. The physical worker owns the environment instance across a user session. Simulator
   SDK calls have a single owner thread/process. Policy inference and incoming pause
   requests remain independent of blocking simulation and inference work.
3. Every policy action passes through ActionGate and a generation-aware device boundary.
   The boundary checks generation when the native control step is about to execute.
   A stop acknowledgement accounts for any in-flight native step before declaring a
   stopped boundary. Connection loss cannot silently replay commands.
4. Simulator adapters expose actual observations, controller semantics, supported task
   checks and capabilities. Active observation is available only when the selected
   embodiment implements it. Unknown capabilities, tasks and checks fail explicitly.
5. Model and policy services use isolated dependencies, deployment-selected devices and
   explicit source/checkpoint versions. Providers validate their camera/state/action
   mappings, units, normalization and controller modes before executing actions.
6. The console selects admitted deployments and presents the same authoritative state,
   task plan, real sensor observations, tool calls and verification events as the host.
   The installation of a checkpoint alone does not make it a compatible launch option.

## Evidence gates

| Gate | Required actual evidence |
| --- | --- |
| VLM | Load the configured model; consume a real simulator image; complete a native DSH tool-call/result round; retain provider output and image provenance. |
| Policy | Load the selected checkpoint and transforms; consume a real instruction, camera/state observation; return finite actions with documented native semantics. |
| Simulator | Reset the selected task/embodiment; capture valid camera/state observations; execute admitted native control steps; query its actual success checks. |
| Worker | Start a job; publish ordered status; confirm pause at the command boundary; reject stale actions/resume; enforce step/time budgets and disconnect handling. |
| Verification | Start a fresh formal assignment after an eligible execution ends with a confirmed boundary; check scoped before/after evidence and limited GT for that boundary. Running observations remain outside the Verifier assignment. |
| Planner | Receive images and scoped evidence; select subgoals and tools; own subsequent resume, retry or replan decisions through the native loop. |
| Recovery | Observe a genuine failed attempt and Planner recovery decision; give Evolver the explicit prior attempt; record subsequent execution; publish a SKILL only after original-goal formal success. |
| Session and console | Select a compatible deployment; run multiple tasks with one environment; expose real sensor/agent/tool/task state; release resources on session end. |

A manual control input can verify an actual device boundary, but it does not establish
learned-policy inference. A real policy can fail a task; retain the failed outcome and
diagnose it without altering GT or declaring task success. Cross-provider experience
reuse requires its own task and provenance evidence.

## Provider matrix

| Provider | Native installation/reset | EDH worker and action admission | Actual policy and upper VLM task |
| --- | --- | --- | --- |
| RoboCasa 1.0.1 / PandaOmron | Passed: OpenCabinet reset, three cameras and native control | Real GR00T actions, frame capture, confirmed pause/stop and consecutive task ports passed | Console Planner execution and formal GT failure recorded; successful task/recovery acceptance pending |
| BEHAVIOR-1K v3.9.2 / R1Pro | Native picking_up_trash reset, separate three-camera capture, GT and clean shutdown pass | Policy control and worker integration pending | Pending |
| RoboTwin stable release / Aloha AgileX | Passed: adjust_bottle reset, three cameras, 14-channel state and native GT | Policy control and interruption pending | Pi0.5 weights and official tokenizer loaded; service listening; native-observation inference pending |

See [GPU integration](gpu-integration.md) for immutable source pins, dependency
isolation and completed native checks. Record model family, exact checkpoint,
normalization files, native controller, camera mapping, task, seed and service settings
with every actual policy run. Public configuration remains independent of host paths,
GPU model and device index. Hardware requirements belong to each provider.

## Required handoff evidence

Maintain the actual command/configuration, exit status and output report under the
ignored local acceptance directory. Public progress records describe the observed
result and remaining gate without publishing private paths, credentials or weights.
Commit verified implementation checkpoints with their module documentation. Update the
provider matrix only after the corresponding real acceptance has completed.

## End-to-end visual delivery

After implementation and actual integration acceptance, deliver a replay of a real
console-launched simulation task. Preserve the source run and export these artifacts:

- A playable simulation rollout video generated from the actual camera frames, with
  capture timestamps and the original frame sequence retained separately.
- A synchronized inspectable timeline of Planner input images, public model output,
  plans/TODOs, native tool calls/results, policy requests/chunks, ActionGate decisions,
  executed controls and formal GT-backed verification. Historical monitor events retain their original audit identity.
- An SVG flow diagram showing the actual participating roles, services and message
  paths, with links from the replay to corresponding recorded events.
- A run manifest containing the EDH revision, source/checkpoint revisions, deployment
  configuration identity, task/seed, environment/embodiment, final GT result and paths
  to the original logs and frame metadata.

Use run, assignment, execution, observation and tool-call identities to correlate
events. Distinguish wall-clock time, simulator time and recorded action counts.
Playback may change speed, but must preserve its mapping to the original timestamps.
Model text comes from the actual provider; absent reasoning is not synthesized.
Replay data comes from the authoritative records and images, without a separate
invented event stream.

If a real failure and Planner-directed recovery occur, include the Evolver handoff,
subsequent evidence and resulting SKILL only when the original goal has a formally
accepted success. Show the observed outcome for every recorded attempt. A failed
rollout remains failed in the replay. The complete visual delivery is pending until
the required provider and recovery acceptance gates are satisfied. The recorded
RoboCasa console run `bc80d2aa-d6e4-4a38-b370-9efedc887936` already combines a real
Planner, GR00T controls, simulator images and accepted formal GT failure. Its replay
contains 2,300 events, 3,165 original images and three camera videos. Every video retains
1,050 source frames. The run executes the official 1,050-control horizon and reaches
formal verification at its confirmed stopped boundary. A later Planner model request
ends with `TRANSPORT_ERROR`. The run contains no retry or recovery experience.
The exported manifest identifies missing authoritative revision/seed fields and absent
policy request/action-chunk events; separate service and configuration records retain
additional provenance. These remain explicit evidence gaps in the complete delivery.
See [replay export](../../scripts/REPLAY.md) for reproduction and evidence checks.
