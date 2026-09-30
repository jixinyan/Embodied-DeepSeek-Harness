# GPU deployment and simulation integration

GPU-host access is available. Delivery now prioritizes an actual simulator, policy
service, action gate and console workflow. The existing upper runtime remains DSH-owned.
Deployment checks and provider task acceptance are recorded separately.

## Source versions

Sources inspected on 2026-09-23:

| Component | Source version | Immutable revision |
| --- | --- | --- |
| RoboCasa | `1.0.1` in official source and documentation | `4f8a2980def75a55dff96b990745b83540425f09` |
| robosuite | `1.5.2`, official master dependency used by RoboCasa | `5ce6643f3092639d08f7b0f90ed1c6a84f50552c` |
| MuJoCo | `3.3.1`, required by RoboCasa | Python distribution pin |
| BEHAVIOR-1K | `v3.9.2` | `b1979916ec1549b10a4e65e630bc6504a9af1b00` |
| RoboTwin | `release` | `bf44be51cf5717a5595ce59447f2cf5263d2aa95` |

RoboCasa's latest GitHub release tag is `v1.0`; its current documented package version
is `1.0.1`, including revised evaluation horizons. Installation uses the immutable
`1.0.1` source above. The official installation requires robosuite's master branch;
the inspected dependency is also pinned to its commit. See the
[RoboCasa installation guide](https://robocasa.ai/docs/build/html/introduction/installation.html)
and [official updates](https://github.com/robocasa/robocasa).

Keep each simulator and policy service in its own Python environment. Record exact
source revisions, installed distributions, renderer/driver versions, dataset versions,
camera/controller settings and checkpoint transforms with acceptance results.
CUDA inference availability alone does not establish rendering compatibility.
BEHAVIOR inherits the [Isaac Sim rendering requirements](https://behavior.stanford.edu/getting_started/installation.html).

## Environment isolation

### Workspace storage

Keep deployment resources in separate directories under a configurable workspace root:

| Directory | Contents |
| --- | --- |
| `code/` | EDH and pinned upstream source checkouts |
| `data/robocasa/` | RoboCasa kitchen scenes, textures and object assets |
| `data/behavior/` | BEHAVIOR scene, object, robot and task assets |
| `data/robotwin/` | RoboTwin objects, backgrounds and embodiment assets |
| `checkpoints/` | Model weights, processors, normalization statistics and checkpoint metadata |
| `envs/` | Isolated Python environments, Node.js and deployment graphics libraries |
| `cache/` | Dependency and download caches |
| EDH `.local/work/` | Local acceptance reports, logs and intermediate checks |

Download assets directly into their provider's data directory and weights into their
checkpoint directory. Use upstream-supported configuration to select resource paths.
When an upstream package requires a source-relative assets directory, link that path
to the dedicated data directory. Preserve incomplete downloads and their metadata when
changing locations; coordinate active writers before moving files. Large assets,
weights, download caches and private license material stay outside Git.

The checked deployment stores RoboCasa assets in `data/robocasa/assets`, with its
upstream `robocasa/models/assets` path linked to that directory. RoboTwin's objects,
background textures and embodiments reside in `data/robotwin/`, with corresponding
source-relative links. BEHAVIOR downloads target `data/behavior/downloads/`.
RoboCasa passed native GPU rendering, OpenCabinet reset and all three camera checks
after relocation; the local report is `.local/work/robocasa-installation-gpu5/result.json`.

### Dependencies and graphics

Use dedicated environments for RoboCasa, BEHAVIOR, RoboTwin, the upper VLM service
and each policy service. The inspected GPU deployment uses an isolated Python 3.11.16
environment for RoboCasa, with `include-system-site-packages = false`. Its bootstrap
tools and Node.js 24.21.0 / pnpm 11.19.0 also have dedicated installation prefixes.
System Python packages, existing environments, drivers and shell startup files remain
unchanged. Record the installed distributions in local deployment evidence.

The selected GPU's driver is a shared host prerequisite. User-space GLVND libraries may be
provided from a project-owned prefix. On Ubuntu 22.04 amd64, the following downloads
and extracts distribution packages without installing them into the operating system:

```sh
mkdir -p .local/work .local/graphics/packages .local/graphics/root
export TMPDIR="$PWD/.local/work"
cd .local/graphics/packages
apt-get download libegl1=1.4.0-1 libglvnd0=1.4.0-1 libopengl0=1.4.0-1 libgl1=1.4.0-1 libglx0=1.4.0-1
for package in *.deb; do
  dpkg-deb -x "$package" ../root || exit
done
cd ../../..
```

Set `LD_LIBRARY_PATH` to that prefix's `usr/lib/x86_64-linux-gnu` directory only for
the simulator process. Set `TMPDIR` to the project's `.local/work` directory. Do not
change global linker configuration or replace system libraries. Other operating
systems require their own compatible graphics packages. Python environments isolate
dependencies; process permissions and device access remain host responsibilities.

## GPU portability

EDH's upper runtime, shared protocol, model HTTP transport, policy WebSocket transport
and action gate have no GPU model, GPU vendor, CUDA architecture or host-path requirement.
Simulator and inference providers own their device dependencies. Keep device selection,
rendering backend, precision, memory limits and service addresses in deployment/provider
configuration. Capability validation must reject unsupported combinations before a session
starts; failure must not silently select another device or execution backend.

The EGL checker accepts any functioning OpenGL vendor. `MUJOCO_EGL_DEVICE_ID` selects
a device; `--expect-vendor` optionally asserts the deployment's intended vendor. It
records the actual driver and device selection. A rendering pass alone does not certify
hardware acceleration or learned-policy execution. The Ubuntu GLVND commands above are
an OS-specific installation recipe, not a framework-wide dependency.

Inspect both compute processes and memory occupancy immediately before assigning a
device. Zero instantaneous utilization can still mean another task owns that device.
Independent simulator and inference checks should run concurrently on available
devices. Keep each assignment in the process environment and deployment record;
stop only processes owned by the current EDH deployment when moving a service.

The 2026-09-23 deployment check found other tasks on GPUs 0–2 and available devices
3–7. EDH's current allocation uses GPU 7 for the VLM, GPU 3 for RoboCasa GR00T,
GPU 4 for RoboTwin pi0.5, and GPUs 5–6 for simulator checks. RoboCasa and BEHAVIOR
use GPU 5 at separate scheduled times; RoboTwin uses GPU 6. Policy and simulator
entries describe allocation while installation proceeds; actual readiness is recorded
by the acceptance results. Recheck availability before each service starts.

Provider support follows the upstream simulator/model requirements. A GPU that runs
MuJoCo may not satisfy Isaac Sim's rendering requirements or a policy's CUDA kernels.
The recorded NVIDIA host check establishes one tested deployment. Other GPUs require
the same actual installation, rendering and inference checks before being marked verified.

## RoboCasa installation check

Install the pinned RoboCasa and robosuite sources with all declared dependencies in
Python 3.11, then install `harness/physical-runtime` in that environment. Download the
official kitchen assets with `python -I -m robocasa.scripts.download_kitchen_assets`.
Keep temporary files and generated reports under the ignored project `.local/` directory.
Use the environment's Python executable. `-I` also excludes `PYTHONPATH`, the user
package directory and the current directory from ordinary module search.

The [installation checker](../../scripts/check-robocasa-installation.py) runs real MuJoCo
physics and EGL rendering, records the actual OpenGL vendor, and saves the actual
rendered frame plus numeric state changes. With the assets installed it also creates
the selected RoboCasa task, resets PandaOmron, captures its three cameras and records
the native action limits, controller layout, task instruction and initial success check.
It closes the renderer/environment and raises errors on missing dependencies, rendering
failure or invalid observations. It does not invoke a learned policy.

```sh
mkdir -p .local/work
TMPDIR="$PWD/.local/work" MUJOCO_GL=egl MUJOCO_EGL_DEVICE_ID="${EDH_RENDER_DEVICE:?Select an available rendering device}" \
  python -I scripts/check-robocasa-installation.py \
  --output-directory .local/work/robocasa-installation
```

Use `--renderer-only` to check MuJoCo physics and GPU rendering without kitchen assets.
For a deployment that requires NVIDIA rendering, add `--expect-vendor NVIDIA`.
The complete check accepts `--environment` and `--seed`. All result files remain local;
an installation check does not establish task completion or console integration.

## Recorded GPU checks

On 2026-09-23, the isolated RoboCasa environment passed dependency consistency for
139 installed distributions. The standalone checker completed 100 real MuJoCo steps;
the body's height changed from `1.0` to `0.8018380000000003`. It produced a nonuniform
256 × 256 RGB image using `NVIDIA H20G/PCIe/SSE2`, with NVIDIA OpenGL 4.6.0 and driver
580.105.08. GLVND 1.4.0-1 was loaded from the deployment-owned prefix.
The remote EDH checkout also passed TypeScript checking using its dedicated Node prefix.
The checker reports isolated Python mode with the user package directory disabled.
Selecting EGL device `1` with an explicit NVIDIA vendor expectation also passes.

The official `download_kitchen_assets --type all` command completed with exit code 0.
The full checker then completed with exit code 0 using EGL device `0`, an explicit
NVIDIA vendor expectation and the isolated Python 3.11.16 environment. Its report
records `isolated_mode: true` and `user_site_enabled: false`. RoboCasa created and reset
`OpenCabinet` with `PandaOmron`, the `pretrain` split and seed `0`. The task instruction
was `Open the cabinet door.` and the initial success check returned `false`. All three
native camera images (`robot0_agentview_left`, `robot0_agentview_right` and
`robot0_eye_in_hand`) passed 256 × 256 RGB shape, `uint8` type and nonuniformity checks.
The checker saved these images, the renderer image and `result.json` under the ignored
`.local/work/robocasa-installation/` directory on the GPU host.

The native action dimension is 12, with lower and upper limits of -1 and 1 in every
dimension and a 20 Hz control frequency. The controller reports `right: [0, 6]`,
`right_gripper: [6, 7]`, `base: [7, 10]` and `torso: [10, 11]`. The installed
robosuite `HYBRID_MOBILE_BASE` controller uses the remaining action index 11 for
`base_mode`; its native `get_action_info_dict()` leaves that index out of the named
segments. EDH's `robosuite.hybrid_mobile_base` ActionSpec includes all twelve channels
and validates their units, bounds and order. The installation checker reports
`policy_executed: false`.

The [native control checker](../../scripts/check-robocasa-gate.py) additionally runs
explicit manual controls through the real ActionGate and RoboCasa adapter. It checks
confirmed pause, resume, control-step budget exhaustion, a second execution in the
same scene, and interruption during a multi-action sequence. The simulator clock
remains unchanged after confirmed stop. These controls establish the device boundary;
learned-policy task completion and the complete console workflow remain pending.

Camera preprocessing also passes a numerical comparison on one actual
`RoboCasaGymEnv` OpenCabinet reset with PandaOmron, pretrain split and seed 0.
For `robot0_agentview_left`, `robot0_agentview_right` and `robot0_eye_in_hand`,
the decoded EDH PNG is exactly equal to the corresponding official
`get_basic_observation` array. All arrays are 256 × 256 × 3 `uint8`, with the
native `opengl` convention accounted for by the simulator adapter. The policy
consumes those PNG pixels directly. Evidence is retained at
`.local/work/robocasa-camera-parity/result.json`; this check executes no policy.

## Native worker transport checks

The `4428fb6` worker checkpoint passes actual process checks with the installed
RoboCasa environment on GPU 5. The TypeScript host runs locally and connects to
the isolated Python worker over SSH. One environment retains its scene across
two task ports with separate run IDs. Pre-execution capture stores three real
256 × 256 image attachments. Repeated execution request identities are rejected,
and a native stopped-boundary check returns `task_success=false`.

The policy endpoint is unavailable in this check. Its connection error reaches
the host with the actual diagnostic, zero executed controls and an
`ended`/`device_confirmed=true` status. This establishes failure propagation;
learned-policy inference, post-execution formal verification and the complete upper task remain
pending. A separate interruption during initialization rejects the pending request
and preserves unconfirmed resource release. Normal close requires its acknowledgement
and worker process exit.

Reports and process output are in the **local** checkout at
`.local/work/native-worker-remote/{result.json,disconnect.json,process.log}`;
the associated image objects are in its `images/` directory. The camera-parity
report above is retained on the GPU host. TypeScript checking, Python compilation,
format checks for the changed files and whitespace validation pass for this checkpoint.
Fourteen session-request and task-history checks also pass against real local journals,
including compaction/reopen, interrupted publication and 2,000 task memberships.
These storage checks do not execute a model or simulator.

## RoboCasa learned-policy controls

The checkpoint-backed GR00T service consumes an actual RoboCasa observation and
returns a finite 16 × 12 native action chunk. Its initial request
`275d7fbe-a231-42f7-b510-639a872036f2` takes 54.047 seconds; deployment timeouts
must accommodate the measured startup behavior while preserving observation expiry.
The source, checkpoint and transforms are recorded in the
[RoboCasa policy profile](../../examples/policies/gr00t-n1d6-robocasa.json).

A subsequent real worker check passes with execution
`b26f4ff0-0a1c-4891-99f9-4a27f2b85351` and policy request
`dd63803c-e6f7-4490-badc-9a493426400f`. ActionGate admits six confirmed controls;
the simulator advances 150 MuJoCo physics steps and supplies the corresponding
camera frames. Unknown-action count is zero. Pause and stop both receive native
confirmation. A second run ID retains the same scene and closes successfully.
The limited native check returns `task_success=false`.

The local report at `.local/work/native-worker-gr00t-03/result.json` records a
passing exit status, base revision `478299e` and the exact list of working changes.
`process.log` and `images/` are retained in that same attempt directory. The
service-side record is preserved in the GPU host's
`.local/work/gr00t-service-pre-provenance.log`.
This is policy-to-simulator acceptance. Accepted task success and successful recovery
require separate evidence.

## Console-driven RoboCasa execution

Run `598378e8-a56b-4629-b8a9-380dc1408fdd` was submitted through the console with
the native instruction `Open the cabinet door.` Qwen created a plan and started
execution; GR00T supplied four action chunks, ActionGate admitted 64 controls,
and MuJoCo advanced 1,600 physics steps. The confirmed budget boundary triggered
formal verification. The accepted native verdict was `task_success=false`. The
run later terminated after the Planner assignment exceeded its deadline.

The replay at `.local/work/replay-failed-pts/` contains 399 events, 204 original
images and three camera videos. Each video has 64 source frames and one terminal
hold frame. FFprobe verifies every source frame timestamp within 0.15 ms of its
recorded simulation time. Policy request identities, checkpoint provenance and
image hashes are retained. This replay preserves the failed outcome.

The full-horizon console run `bc80d2aa-d6e4-4a38-b370-9efedc887936` uses the
official OpenCabinet horizon of 1,050 controls. Its 66 GR00T requests produce
1,050 admitted controls and 26,250 physics steps, with 1,050 three-camera samples.
The confirmed budget boundary receives a formally accepted `task_success=false`
verdict. After receiving that result and acquiring fresh evidence, the Planner's
model request terminates with `TRANSPORT_ERROR`. The recorded error does not retain
its precise transport cause. This run publishes no retry or SKILL.

The full-horizon replay at `.local/work/replay-bc80/` retains 2,300 events and
3,165 original images. Its three camera videos each contain 1,050 source frames
and a terminal hold frame. Browser DOM inspection confirms that all three videos
load with 256 × 256 dimensions, 52.4997-second duration and no media error. The
HTML timeline exposes all 2,300 original event entries, including the terminal
role retirement. Its manifest explicitly reports unavailable authoritative
run revision/seed fields and policy request/action-chunk events. Separate saved
deployment and service evidence must be read alongside those declared gaps.

Camera synchronization is measured separately from control frequency. The native
RoboCasa control frequency is 20 Hz of simulation time. In run
`bc80d2aa-d6e4-4a38-b370-9efedc887936`, the first 581 recorded control frames span
approximately 139.4 wall-clock seconds, about 4.1 published frames/s. Browser DOM
checks during motion observed five-second display windows at 4.2 and 6.0 frames/s,
request-to-decode times of 22.1 and 22.9 ms, and capture-to-decode times of 741 and
331 ms. All three 256 × 256 images decoded successfully and matched the displayed
frame number. These samples are not a sustained FPS guarantee or latency percentile.
Capture-to-decode compares the worker host clock with the browser host clock.

The console publishes all three decoded images together, preserves its image
elements and keeps only the latest waiting display update. Operator frames use
their exact recorded `simulation.frame` image routes; selecting Lead showed its
actual initial observation while the operator stream continued. No operator frame
was added to Lead's context by that selection. Original frame records remain
available for replay. Browser measurements are retained in
`.local/work/live-robocasa-server-05/browser-observations.md`.

## RoboTwin rendering check

The pinned SAPIEN `3.0.0b1` renderer passes an actual native check on the assigned
GPU. The provider selects `Device("cuda:6")` through deployment configuration and
reports PCI `0000:dd:00.0`, matching that device's NVIDIA process inventory. A
256 × 256 RGB frame is nonuniform. After 100 physics steps at 250 Hz, the test box
rests at approximately 0.1 m above the ground. The report is saved locally at
`.local/work/robotwin-render/result.json`; no policy or RoboTwin task executes in
this rendering check.

The actual `adjust_bottle` task reset subsequently passed with Aloha AgileX and
seed 0. The adapter returned three 640 × 480 PNG observations, fourteen native
joint/gripper targets and `task_success=false`. The physics timestep is 0.004 s.
The deployment uses CuRobo 0.7.7 compiled with isolated CUDA 13.0.88, PyTorch
2.11 with CUDA 13.0 and Warp 1.7.0. Its reset report is
`.local/work/robotwin-task/result.json` on the GPU host.

The September 30 complete `adjust_bottle` console run
`8fcb950b-eebf-4133-ae94-197ac8e6bb41` supplies three native 640 × 480 RGB cameras
and a fourteen-value state vector to the pinned Pi0.5 service on GPU 4. It records
seven identified policy requests, 111 controls, 10,443 physics steps and 409
three-camera frame groups. The service retains original model outputs and applies
native clipping only to the two gripper channels. Actual ActionReceipts preserve
each generation, action mapping and cumulative native count. Execution ends at a
confirmed `episode_terminated` boundary; independent Verifier checks return
`task_success=true` and verdict `passed`, and Planner calls `tasks.finish`.
The Session releases its environment and the worker exits; the console and policy
service also exit. The complete source export, sensor metadata, service log,
identified requests/receipts, native patches and running source snapshots are in
`.local/work/robotwin-20260929/`. Confirmed pause/resume and operator cancellation
checks are documented in the [RoboTwin deployment record](robotwin-live.md).

## Live VLM image and tool checks

An isolated vLLM 0.30.0 service loads the deployment's Qwen3.8-27B checkpoint and
serves `qwen3.8-27b` over loopback OpenAI-compatible HTTP. The checked configuration
uses a 32,768-token context window, BF16, `FLASH_ATTN`, eight maximum sequences,
the `qwen3_coder` tool parser and `qwen3` reasoning parser. Device selection belongs
to the launch process. The current service runs on an available GPU 7.

[The native API check](../../examples/models/check-qwen38-native.py) supplies the
actual RoboCasa `robot0_agentview_left` PNG, receives `perception__capture`, and
receives a visual response after its tool result. Recorded finish reasons are
`tool_calls` and `stop`.

[The DSH check](../../examples/models/live-robocasa-camera.mjs) creates independent
Planner and Verifier sessions. Each invokes its configured camera tool once, receives
the stored image attachment and completes its turn. Assertions check matching
tool-call/result identifiers, the image reference and `turn/end=completed`.
Both sessions use image attachment
`sha256:b46b25d0f6ddf6d9b9e6098c6e8504a834d5830400f2827fefd38ed210ee3202`.
These checks use a static native reset frame. Formal GT verification and model-driven
robot task completion require the complete physical worker workflow.
The task's recorded reset GT is `false`. The visual review mentions an apparently
open lower cabinet; that prose is not a task verdict and does not establish success
of the configured OpenCabinet goal. The check certifies image/tool delivery and turn
completion, without scoring visual accuracy or granting verification authority.

The complete selected DSH release adaptation passes the same actual checks at EDH
commit `1a571e2215022a49072471ee60699b651e6d4e44`. The DSH check enables native
context management with a 32,768-token capacity, 2,048-token output cap, 4,096-token
headroom, pressure ratio 0.7, retention ratio 0.15, summary limit 8,192 and a 12-image
visual-history limit. Both short role rounds complete; they do not trigger automatic
summarization.

The GPU 7 release-check result files are `.local/work/qwen38-native-rc1-gpu7.json` and
`.local/work/qwen38-dsh-rc1-gpu7.json` in the remote EDH checkout. The inference service
log is `.local/work/vlm-8002-gpu7.log`. They remain deployment-local evidence.

## RoboTwin policy service readiness

The isolated LeRobot 0.6.1 service loads the selected pi0.5 checkpoint with strict
parameter matching and listens on a deployment-local WebSocket endpoint. Its pinned
source is `7e241bd630a3719a56157a497ce5d08f244784f1`; the checkpoint is
`SidneyXie/pi05_robotwin@e49e2ab6c11f07511573b67261bd129e88d0a416`.
The 9,354,050,752-byte model file matches the published SHA256
`9a5381c3260fc58fdb4b90d17b93f9090bcbfbcd8e0287f9bf2acea2477a2bc3`.

The checkpoint's official PaliGemma tokenizer requires authorized Hugging Face
access. The GPU deployment has that access and retains the six tokenizer files
under `checkpoints/lerobot/paligemma-3b-pt-224/`, pinned to
`google/paligemma-3b-pt-224@35e4f46485b4d07967e7e9935bc3786aad50687c`.
The saved pre/postprocessor initializes offline against these local files.
Credentials stay outside the repository and run exports.

The service runs on GPU 4 and reports its model/tokenizer identities in
`.local/work/lerobot-pi05-service-gpu4-recheck.log` in the remote live checkout.
Its initial load report is preserved in
`.local/work/lerobot-pi05-service-pre-provenance.log`. The complete native task
check subsequently confirms four actual policy requests, 120 admitted controls,
11,151 physics steps and unchanged `task_success=true`. Confirmed pause/resume,
terminal counters and native environment close pass. Its evidence is retained in
`.local/work/robotwin-policy-full-gpu4/`. The complete console task subsequently
passes native success, independent formal verification and resource release; see the
[RoboTwin deployment record](robotwin-live.md).

## Integration sequence and acceptance

1. Verify the actual GPU renderer, install immutable simulator sources and assets, and
   reset a real task with valid camera observations. Record task/robot/controller metadata.
2. Implement the simulator adapter using those native observations and controls. Derive
   the advertised capabilities from the installed robot. Preserve explicit frame, unit,
   controller and action-channel semantics in the selected physical profile.
3. Connect the policy client/server adapter using a matching checkpoint and normalization
   bundle. Verify actual image/state preprocessing and action decoding before admission.
4. Connect the Python worker to the upper execution port. Every action chunk passes
   through ActionGate; stop, stale generation, budget expiry and connection failure must
   be validated against the simulator's actual command boundary.
5. Publish real images through the existing image-reference service. Route formal checks
   through the limited verification provider and leave retry/replan/resume to Planner.
6. Exercise session creation, multiple tasks, stop/resume, formal verification and release
   through the console. Record real provider/model outputs and failed-to-successful
   recovery before certifying the complete workflow.
7. Apply the same acceptance to BEHAVIOR/R1Pro and RoboTwin's configured arms. Configuration
   selection exposes only combinations whose adapter, embodiment, sensors, action mapping
   and checkpoint declarations match.

Learned-action worker acceptance, remaining simulator providers and complete task
acceptance remain required. Existing checkpoint directories must be checked against their manifests and
deployment metadata before advertising compatibility. Retention owner completion and
reviewed deletion admission remain tracked in [domain retention](domain-retention.md).
