# BEHAVIOR-1K native environment

The provider source is BEHAVIOR-1K `v3.9.2` at immutable revision
`b1979916ec1549b10a4e65e630bc6504a9af1b00`, with OmniGibson 3.9.2
and Isaac Sim 5.1.0 in an isolated Python 3.11 environment. The
[LeRobot dependency revision patch](lerobot-revision.patch) selects the
official `wensi-ai/lerobot` `release/b1k` source at immutable revision
`436812bd8ee39b768c645c248c91f1330834e687`. This preserves the
published OmniGibson dependency and its `dataset` extra.

The native Isaac Sim 5.1.0.0 distributions pin `packaging==23.0`,
`Pillow==11.3.0` and `websockets==12.0`. OmniGibson 3.9.2 declares
`Pillow~=11.0.0` and `websockets>=15.0.1`; the selected
[LeRobot source](https://github.com/wensi-ai/lerobot/blob/436812bd8ee39b768c645c248c91f1330834e687/pyproject.toml)
declares `packaging>=24.2,<26.0`. Whole-environment dependency validation reports
these upstream constraint conflicts. Retain the complete installed dependency
metadata and native runtime import sources with acceptance records. Native task
execution and package dependency validation have separate evidence states.

Provider data belongs under `workspace/data/behavior`. The fixed public
`behavior-1k/zipped-datasets` snapshot is
`9f0d57d465726976ed98138d3f8b8ca3e2186775`. Required archives and
extraction targets are:

| Archive in `data/behavior/downloads` | Extracted directory                           | Version        |
| ------------------------------------ | --------------------------------------------- | -------------- |
| `behavior-1k-assets-3.9.0.zip`       | `data/behavior/behavior-1k-assets`            | 3.9.0          |
| `omnigibson-robot-assets-3.8.2.zip`  | `data/behavior/omnigibson-robot-assets`       | 3.8.2          |
| `2026-challenge-task-instances.zip`  | `data/behavior/2026-challenge-task-instances` | 2026 challenge |
| `2025-challenge-task-instances.zip`  | `data/behavior/2025-challenge-task-instances` | 2025 challenge |

Set `OMNIGIBSON_DATA_PATH` to `workspace/data/behavior` in the native
process. The official OmniGibson asset functions install the required local
data key after license acceptance. The key and downloaded datasets stay out
of Git.

The R1Pro evaluation configuration declares head, left wrist and right wrist
camera roles in `omnigibson/eval/r1pro.yaml`. The GR00T N1.6 BEHAVIOR
evaluation source at `9b37aa1ce69c73c6d165233fa88128283bba4508`
uses `picking_up_trash` test instances from the 2025 challenge bundle.
It sets those three native cameras to 256×256 and the head camera horizontal
aperture to 40.0, then reads their RGB channels directly. Its controllers use base
velocity, trunk and arm position, and smooth gripper commands with
`action_normalize: false`. `BehaviorEnvironment` selects activities and scene
configurations from the installed `available_tasks.yaml` and requires the chosen
2025 native instance file with an R1Pro robot. It validates the controller order and joint limits after native
reset, publishes the 21 GR00T state groups from the actual 258-value robot
proprioception, and evaluates `task_success` through the native compiled task
goal. The native `ActionSpec` has 23 channels at 30 Hz; base and gripper inputs
are normalized to `[-1, 1]`, while torso and arm commands are absolute joint
positions in radians with measured joint limits. The GR00T processor converts
its relative torso and arm predictions to absolute commands before this native
action interface receives them.

Scene configuration accepts `instance_id` (default 0, range 0–9) and
`scene_config_id` (default 0, a key in the selected task's SDK configuration).
Optional `evaluation_horizon: "human_demo_2x"` applies the checkpoint's official
evaluation timeout: twice the mean human control count for the selected activity.
The provider reads the installed GR00T task index mapping with Python's AST parser
and the actual `2025-challenge-task-instances/metadata/episodes.jsonl` with
`jsonlines`. Scene metadata records both source hashes, the task index, episode
count, mean and admitted native control horizon. Install the `behavior-evaluation`
extra in the native interpreter. The upper goal budget must admit that complete
horizon; the native termination and compiled task predicate retain their authority.
For the installed `picking_up_trash` data, 200 episodes average 5,267.75 controls,
giving a native horizon of 10,535 controls. The official rollout evaluates eight
actions from each 32-action model prediction.
The activity identity supplies its display instruction; the active compiled
BDDL goal remains authoritative for `task_success`. The
[native task selection guide](../../../../../../docs/implementation/native-task-selection.md)
records 74 actual installed task/scene configurations and all ten prepared
`picking_up_trash` instances. Additional activity assets and complete workflows
require their own native validation.

`BehaviorProcessEnvironment` keeps native simulator operations on an independent
process's main thread. A standard bounded multiprocessing connection carries
provider calls; deadlines supervise initialization, control and close. The native
interpreter comes from `EDH_BEHAVIOR_NATIVE_PYTHON`, separately from the worker
interpreter. Close uses one total deadline, confirms SDK shutdown and requires an
actual process exit code 0. Shutdown releases the USD watcher and loaded scene,
unregisters Workspace show-window callbacks and calls the complete `og.shutdown()`
path. A timeout retains an unconfirmed release outcome.

The [live deployment](../../../../../../examples/deployments/behavior-live.mjs)
uses configurable initialization/close defaults of 600000/900000 ms. Its
[Team](../../../../../../examples/teams/behavior-live.yaml) binds independent
Planner/Verifier roles with recovery learning disabled. Model/GPU/checkpoint/source
paths belong to deployment configuration.

## GPU configuration

The native process requires `OMNIGIBSON_GPU_ID` with the physical renderer GPU
index and `CUDA_VISIBLE_DEVICES` with that GPU's complete `GPU-...` UUID.
Admission reads the actual index, UUID, PCI bus and device name through
`nvidia-smi --query-gpu=index,uuid,pci.bus_id,name` and requires the two selections
to identify the same device. Numeric CUDA visibility lists are not admitted.
Exactly one CUDA-visible device is required; PyTorch uses logical device 0.
The provider calls the original public `og.launch(device="cuda:0")` API before
environment construction. Isaac SimulationContext configures the physics device
during stage initialization, before native physics advancement. OmniGibson retains its physical renderer
index and original `multi_gpu=False` launch setting.

Scene metadata retains the actual device identity, visibility, CUDA logical
index, physics device and renderer selection. Deployment-specific GPU indices
remain configurable. Native startup placement, calibrated capture and shutdown
require an actual process/device audit for each selected environment; configured
selection alone does not establish runtime placement.

## Active observation

The provider declares `rotation_axes: [yaw, pitch]` after validating native R1Pro
controllers. Planner's `observation.rotate` accepts relative degree-valued angles:
positive yaw turns left and positive camera pitch looks up. Yaw uses the native
base velocity controller; pitch uses absolute `torso_joint3` control and the
measured head-camera optical axis. Other joint commands retain their current
native hold targets. Returned world positions use meters, and all returned angles
use degrees. The tool supplies fresh head/left-wrist/right-wrist RGB images,
requested/achieved angles, before/after pose, controls, physics steps and stop reason.

The host admits rotation before policy execution or after confirmed execution end
and formal verification. Rotation exclusively owns the physical motion resource.
The native primitive has a 240-control / 45-second budget and a 1.5-degree tolerance;
cross-process cancellation supplies zero-velocity settling controls and retains
the actual achieved movement. Original task criteria remain unchanged.

Actual OmniGibson 3.9.2 validation in `picking_up_trash`, instance 0, verifies
requested yaw ±15 degrees and camera pitch ±10 degrees within tolerance. Six
trials, including cancellation before control and during motion, retain 170 controls,
680 physics steps, seven fresh observation identities and clean native shutdown.
Each of the three recorded camera files fully decodes its 170 frames. These checks
validate the native primitive. Actual Qwen run `8f35aca4` separately validates
capture, both yaw directions and subsequent model requests containing the exact
returned image bytes. It waits for explicit confirmation before policy execution
and closes with released resources. [Progress](../../../../../../docs/implementation/progress.md)
records both acceptance scopes and remaining task requirements.

September 30 lifecycle 13 verifies three real GR00T requests, 18 R1Pro controls,
72 physics steps, pause/resume, a second retained-scene execution and terminal stop.
Confirmed pause/stop takes approximately 0.198/0.227 seconds; native time remains
unchanged after confirmation. An active synchronous control finishes before stop
acknowledgement. The SDK close returns and the native process exits normally.

Actual console run `c9c3809c-374c-437f-b131-12977a44044a` uses Qwen Planner,
GR00T and a fresh independent Qwen Verifier. It executes 16 controls and 64 physics
steps, reaches confirmed budget exhaustion, receives native `task_success=false`,
and ends with Planner `tasks.abandon`. Both role Sessions retire; the user Session
closes with resources released and its worker/native processes exit. The three
256×256 camera videos each decode all 16 frames. One final plan update is rejected
for attempting to abandon the required final goal; the run does not establish a
zero-tool-error complete acceptance. The current Planner instructions retain the
required goal and conclude unsuccessful tasks through `tasks.abandon`.

Original `picking_up_trash` success and additional task/scene/checkpoint combinations
remain separate acceptance gates.

Actual Qwen/GR00T run `c2f2a9e0-7322-4c1c-baba-9e2f52fbbe7c` admits the
official 10,535-control human-demo horizon and executes 1,088 controls with 4,352
physics steps. Its 137th request ends with a policy inference error and a confirmed
`backend_error` boundary. No formal Verifier is admitted for that backend boundary.
The Session closes with released resources and both native processes exit. Its
original final task criterion remains unsettled. The exact failed input is retained;
a separate real-checkpoint inference on that input reproduces an arm target beyond
the native controller range. That inference establishes a current source diagnosis;
the unsuccessful historical inference has no retained model output.

The GR00T action converter applies the original OmniGibson R1Pro controller limits
to normalized base/gripper commands and absolute arm/trunk targets before ActionGate
admission. The official configuration uses absolute `JointController` position targets,
and its `_update_goal` clips each target to the actual joint limits. Service inference
records retain all 32 original model actions, the converted admitted prefix and its
conversion identity. The recorded-run auditor verifies every admitted value against
that precise clipping operation. Nonfinite outputs and incompatible controller mappings
fail at their source. Native task success still uses the compiled BDDL criterion.

Actual full-horizon Qwen/GR00T run `96c0b983-ab94-4ec8-b13e-783749ab4197`
uses source `c3defeb2b09d8640cce8a5b28bd85b331cfbca15`, checkpoint revision
`300db814db8ab5dd010026d5631f280048d06b91` and the original hidden instance 0,
scene configuration 0 and compiled BDDL criterion. It admits 10,535 controls;
the native episode ends after 9,983 controls, 1,248 actual learned inferences
and 39,932 reported physics steps during learned execution. Five original
pre-policy `observation.rotate` calls consume another 553 controls and 2,212
physics steps. The complete reported native motion is 10,536 controls and
42,144 physics steps. These Planner observations change the hidden instance's
initial robot yaw and camera pitch before checkpoint execution; the official
evaluation begins at the original instance reset pose. This run retains those
actual conditioning changes. Its confirmed `episode_terminated` boundary
is recorded at `2026-10-03T09:56:38.710Z`. The independent formal Verifier returns
`task_success=false`. A subsequent execution in that retained episode ends during
native preflight with zero additional controls or inferences and another fresh
failed Verifier. Planner concludes the unsuccessful task. The original individual
native `terminated` and `truncated` fields were unavailable in this retained run;
its specific native termination cause is unclassified.

The original-source audit checks 10,237 events, 9,996 production-validated sensor
samples, 9,983 action receipts and all 1,248 learned inference identities. Each of
the three original camera videos fully decodes 9,983 frames with exact native
timestamps. Every admitted prefix is verified against the raw prediction and
canonical controller clipping. The run records zero tool errors, two fresh
failed Verifiers and one recovery chain. Its Session closes with resources
released; owned policy, console, worker and SDK processes exit. The positive
action/source/video audit and retained upper boundaries pass. A durable provider
source audit for the zero-control native preflight is unavailable in this historical
record.

Future action receipts and native diagnostics retain the exact SDK-returned
`terminated` and `truncated` flags, each original termination condition's `done`
and `success` values, environment step, actual before/after physics counters and
the native `_post_step` implementation's file hash. The original combined
`episode_terminated` admission and independent formal Verifier remain authoritative.

Actual source `665823df681cec3bc684aaeda599a66b06d4dc06` validates these fields
with one genuine checkpoint inference and one admitted native control in an
independent original `picking_up_trash` reset. The SDK physics counter advances
from 41 to 45; its returned `terminated`, `truncated`, timeout and predicate
condition values are all false. Original ActionReceipt, native diagnostics and
StopAcknowledgement retain the same values and source hash. The confirmed
`budget_exhausted` boundary is `024ce69d-59d6-4e32-b5a0-8c787f0210a3`, with one
executed action, four physics steps and zero uncertain actions. Native PID 505187
exits normally and the resource lease releases. These records validate actual
SDK step diagnostics and device confirmation; no upper task or formal Verifier
was created. Records remain under `.local/work/behavior-native-flags-20261003-02/`.

The October 3 stationary `picking_up_trash` instance-0 probe validates all three
256×256 RGB-D cameras with explicitly labeled complete-image region masks. Each
mask has 65,536 valid depth pixels; median axial depths are 1.27918720 m for head,
0.25709677 m for left wrist and 0.25578856 m for right wrist. Measurement preserves
the native robot state and exact PNG bytes and issues zero policy controls or
inferences. Retained depth, calibration, source PNG and mask PNG reconstruct every
geometry value exactly in the originating native NumPy environment. The native
process exits normally. This independent initialized scene has its own observation
identity and does not describe the learned task's final scene.

The October 3 native owner-deadline probe uses immutable EDH source
`9a7778b78249703216ccdddd556f6cfdf76336e8`, BEHAVIOR source
`b1979916ec1549b10a4e65e630bc6504a9af1b00` and the original instance-0
`picking_up_trash` reset. It sends `SIGSTOP` to its owned SDK child PID 5352 while
the production `NativeActionDevice.on_owner` awaits a real `observe` RPC.
An `asyncio.timeout(0.75)` returns after 0.75334951 seconds. The original operation
remains pending and uncancelled, with its Future retained for device cleanup.
After `SIGCONT`, the original SDK observation completes on its original owner
thread. Native scene `e6baf41e-6d84-4ff7-ac98-587996aae035`, physics counter 41,
zero controlled physics steps, robot state and all three exact PNGs remain
unchanged. Four native observations retain twelve original RGB-D camera records;
their source digests, calibration arrays and metric geometry all pass independent
recomputation at an unchanged simulation time.

The probe creates zero policy clients, controls or StopAcknowledgements. Its scope
is caller cancellation, retained native operation tracking and eventual owner
completion. Actual SDK close acknowledges shutdown, returns exit code 0 and
releases the owner thread and retained Future. Wrapper PID 4964, outer worker PID
5287 and native PID 5352 are confirmed absent. Original monotonic trace, native
source copies, arrays, process-release audit and exact source archive are retained
under `.local/work/behavior-owner-deadline-20261003/`. The local and remote
`deadline-records.tar.gz` SHA-256 is
`c547a80539984f0ddeeb349b18ff145a9e05ebbc2c3e668b8a98e83dcc07661d`.
