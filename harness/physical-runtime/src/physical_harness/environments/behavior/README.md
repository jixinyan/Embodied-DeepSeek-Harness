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

Original `picking_up_trash` success, a complete upper run without tool errors and
additional task/scene/checkpoint combinations remain separate acceptance gates.
