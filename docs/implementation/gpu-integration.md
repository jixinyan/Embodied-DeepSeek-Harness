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
learned-policy inference, in-chunk monitoring and the complete upper task remain
pending. A separate interruption during initialization rejects the pending request
and preserves unconfirmed resource release. Normal close requires its acknowledgement
and worker process exit.

Reports and process output are in the **local** checkout at
`.local/work/native-worker-remote/{result.json,disconnect.json,process.log}`;
the associated image objects are in its `images/` directory. The camera-parity
report above is retained on the GPU host. TypeScript checking, Python compilation,
format checks for the changed files and whitespace validation pass for this checkpoint.

## RoboTwin rendering check

The pinned SAPIEN `3.0.0b1` renderer passes an actual native check on the assigned
GPU. The provider selects `Device("cuda:6")` through deployment configuration and
reports PCI `0000:dd:00.0`, matching that device's NVIDIA process inventory. A
256 × 256 RGB frame is nonuniform. After 100 physics steps at 250 Hz, the test box
rests at approximately 0.1 m above the ground. The report is saved locally at
`.local/work/robotwin-render/result.json`; no policy or RoboTwin task executes in
this rendering check. Task reset, CuRobo control and interruption acceptance remain
required before the RoboTwin provider can be marked verified.

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
