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
TMPDIR="$PWD/.local/work" MUJOCO_GL=egl MUJOCO_EGL_DEVICE_ID=0 \
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

Kitchen asset installation and RoboCasa task reset remain in progress. No learned
policy, upper VLM, robot task or complete console workflow has passed GPU acceptance.

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

The host-to-worker bridge, simulator adapters and learned-policy task acceptance remain
required. Existing checkpoint directories must be checked against their manifests and
deployment metadata before advertising compatibility. Retention owner completion and
reviewed deletion admission remain tracked in [domain retention](domain-retention.md).
