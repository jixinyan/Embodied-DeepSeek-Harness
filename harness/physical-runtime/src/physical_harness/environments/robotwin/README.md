# RoboTwin native environment

`RoboTwinEnvironment` binds the pinned RoboTwin stable release
`bf44be51cf5717a5595ce59447f2cf5263d2aa95` to the synchronous
`NativeEnvironment` interface. The admitted native task is `adjust_bottle` with
the `aloha-agilex` embodiment. `bind_task` preserves its current scene. A new
session or an explicit native reset creates a new scene.

The adapter reads `task_config/demo_clean.yml`, the Aloha-AgileX embodiment
configuration and the provider's `Large_D435` camera configuration. It requests
three 640×480 RGB cameras: `head_camera`, `left_camera` and `right_camera`.
`joint_action.vector` contains the provider's 14 drive targets in this order:
`fl_joint1..6`, normalized `fl_joint7`, `fr_joint1..6`, normalized `fr_joint7`.
The arm commands are absolute joint angles in radians. The pinned Aloha-AgileX
URDF declares `[-10, 10]` for each arm joint; native joint limits are checked
after reset. The gripper commands have the provider's normalized `[0, 1]`
range. The provider's `set_gripper` maps those values to physical gripper
positions. `task_success` calls the active native task's `check_success()`.
The task instruction comes from the pinned provider file
`description/task_instruction/adjust_bottle.json` `full_description` field.
Scene metadata reports the reset seed, sampled bottle model and orientation,
and the 250 Hz physics timestep after reset.

Each `robotwin.qpos_target` command may run a variable number of 250 Hz physics
steps, so its `ActionSpec.frequency_hz` is `null`. `NativeStep.raw_sim_steps`
records the completed physics steps. The [native runtime patch](native-runtime.patch)
adds stop polling before admission and between physics steps, reports partial
commands, and selects the SAPIEN render device through
`ROBOTWIN_RENDER_DEVICE`. A zero-step interruption does not consume a native
action count. The worker retains the control-budget reservation until it reads
the native result. The patch also propagates qpos TOPP planning failures and
empty plans. The native `take_action` fallback of 50 steps is not used for
admitted qpos commands.

Each command samples real camera frames at its first completed physics step and
then every `frame_sample_interval_steps` steps (default 10, or 25 Hz); it keeps
at most `max_frames_per_action` frames (default 300). Both positive integer
settings are session reset configuration fields. Reaching the configured
capacity stops the command at that completed physics-step boundary and returns
`recording_capacity_exhausted` with its actual partial execution counts and
all captured frames. Every frame carries the
actual UTC capture time, its command-local 1-based physics-step index, and
`simulation_time_s`. This simulation time starts at zero after native reset
and counts admitted control physics steps only; setup physics steps are excluded.
The final control observation is returned separately at command completion.
The adapter also offers each sampled frame to a bounded live-frame callback
while the native command is running. If that queue is full, the current
physics-step boundary returns `live_frame_capacity_exhausted` with actual
partial execution counts; final control admission remains tied to `NativeStep`.

The pinned [RoboTwin installation script](https://github.com/RoboTwin-Platform/RoboTwin/blob/bf44be51cf5717a5595ce59447f2cf5263d2aa95/script/_install.sh)
specifies the [SAPIEN URDF/SRDF patch](sapien-urdf-loader.patch) and the
[mplib planner patch](mplib-planner.patch). The latter removes `or collide`
from one planner condition as directed by the
[official installation instructions](https://robotwin-platform.github.io/doc/usage/robotwin-install.html).
This changes that planner's path-selection behavior and does not establish
general collision safety. The patches apply only to pinned packages
`sapien==3.0.0b1` and `mplib==0.2.1` in the isolated RoboTwin environment.
The compatible NVIDIA CuRobo `isaac-4.0` source is pinned separately at
`0a50de1ba72db304195d59d9d0b1ed269696047f` and builds its CUDA
extensions with the isolated CUDA 13.0 compiler. Set `CUDA_HOME` to that
compiler and `TORCH_CUDA_ARCH_LIST=10.0+PTX` for this H20G deployment;
validate the compiled kernels on the actual GPU before admitting a task.
This CuRobo revision uses the `wp.torch` interface provided by
`warp-lang==1.7.0`. Set `ROBOTWIN_WARP_PTX_TARGET_ARCH=100` to use Warp's
documented forward-compatible PTX target for the H20G; the adapter applies
this explicit deployment setting before importing CuRobo and requires actual
kernel execution to pass the native task check.

Keep simulator downloads under `workspace/data/robotwin` and point the
provider's `assets/objects`, `assets/background_texture`, and
`assets/embodiments` paths to those directories. The public asset snapshot is
`TianxingChen/RoboTwin2.0@3dc3b798668feb99ac61cc9086d84cbcc3d79186`.
Run the native process from the pinned RoboTwin source root with that root on
`PYTHONPATH`. Set `CUDA_VISIBLE_DEVICES` to its assigned physical GPU and set
`ROBOTWIN_RENDER_DEVICE=cuda:0` for the resulting single visible device.
Confirm `sapien.Device(...).pci_string` against the assigned GPU PCI address.
The adapter requires an explicit render-device setting.

The pinned requirements install `torch==2.4.1`; H20G `sm_103` requires an
isolated PyTorch CUDA build that executes real kernels on that device. This
deployment uses `torch==2.11.0+cu130` and matching torchvision after the
provider requirements. Both matrix multiplication and the NVRTC `erfinv`
kernel executed on the assigned H20G. No GPU index is embedded in the adapter
or `ActionSpec`.
