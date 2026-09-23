# BEHAVIOR-1K native environment

The provider source is BEHAVIOR-1K `v3.9.2` at immutable revision
`b1979916ec1549b10a4e65e630bc6504a9af1b00`, with OmniGibson 3.9.2
and Isaac Sim 5.1.0 in an isolated Python 3.11 environment. The
[LeRobot dependency revision patch](lerobot-revision.patch) selects the
official `wensi-ai/lerobot` `release/b1k` source at immutable revision
`436812bd8ee39b768c645c248c91f1330834e687`. This preserves the
published OmniGibson dependency and its `dataset` extra.

Provider data belongs under `workspace/data/behavior`. The fixed public
`behavior-1k/zipped-datasets` snapshot is
`9f0d57d465726976ed98138d3f8b8ca3e2186775`. Required archives and
extraction targets are:

| Archive in `data/behavior/downloads` | Extracted directory | Version |
| --- | --- | --- |
| `behavior-1k-assets-3.9.0.zip` | `data/behavior/behavior-1k-assets` | 3.9.0 |
| `omnigibson-robot-assets-3.8.2.zip` | `data/behavior/omnigibson-robot-assets` | 3.8.2 |
| `2026-challenge-task-instances.zip` | `data/behavior/2026-challenge-task-instances` | 2026 challenge |
| `2025-challenge-task-instances.zip` | `data/behavior/2025-challenge-task-instances` | 2025 challenge |

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
`action_normalize: false`. `BehaviorEnvironment` supports that task with an
R1Pro robot. It validates the controller order and joint limits after native
reset, publishes the 21 GR00T state groups from the actual 258-value robot
proprioception, and evaluates `task_success` through the native compiled task
goal. The native `ActionSpec` has 23 channels at 30 Hz; base and gripper inputs
are normalized to `[-1, 1]`, while torso and arm commands are absolute joint
positions in radians with measured joint limits. The GR00T processor converts
its relative torso and arm predictions to absolute commands before this native
action interface receives them.

On 2026-09-23, native reset of 2025 `picking_up_trash` instance 0 in
`house_double_floor_lower` produced three 256×256 RGB PNG cameras, all 21
finite state groups, a validated 23-channel `ActionSpec`, and a native
`task_success=false` result. This was an observation and ground-truth check;
no policy action or task completion was measured. The simulator process
returned status 139 during `og.shutdown()`: OmniGibson 3.9.2's `cleanup()`
raised `OSError: [Errno 39] Directory not empty` while removing its temporary
skybox resource directory, followed by an Isaac Sim shutdown segmentation
fault. The native session close and control-step acceptance remain unverified.
The remote acceptance report is
`/home/jixin/workspace/code/Embodied-DeepSeek-Harness/.local/work/behavior-adapter/result.json`;
the process status and log are in the same `.local/work` directory as
`behavior-adapter-1.status` and `behavior-adapter-1.log`.
