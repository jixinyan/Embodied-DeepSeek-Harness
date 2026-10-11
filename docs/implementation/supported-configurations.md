# Configuration and acceptance matrix

Configuration selects the provider, embodiment, execution mode, checkpoint,
model and Team together. The production loader validates complete compatible
profiles before allocating an environment. The Console displays those profiles
and their selected component values. Native task catalogs are discovered after
Session admission.

## CPU installation platforms

| Platform | Node.js | pnpm | Python | Verified boundary |
| --- | --- | --- | --- | --- |
| macOS arm64 | 25.4.0 | 11.19.0 | 3.14.0 | Fresh editable installation, complete source checks, four-provider HTTP readiness, actual ActionGate/thread/lock checks, packaged Desktop selectors and two service shutdown cycles |
| Linux x64 | 24.21.0 | 11.19.0 | 3.12.14 | Fresh editable installation, complete source checks, four-provider HTTP readiness, actual ActionGate/thread/lock checks, Linux Desktop packaging and headless Wayland/Pixman window/selector/shutdown checks |
| GitHub Ubuntu 24.04 x64 | 22.23.3 | 11.19.0 | 3.11.17 | Actual Source checks workflow, fresh fourteen-distribution installation manifest, complete source checks and 26 actual device-owner/Session-resource/Worker-transport cases |

The base CPU dependency versions are in
[constraints.txt](../../harness/physical-runtime/constraints.txt). Source setup
uses the frozen pnpm lockfile and an independent Python environment as described
in the [setup guide](../development/setup.md). Actual pip reports retain each
download identity and installation version. `typing_extensions` is required by
the schema dependency on the recorded Python 3.11/3.12 installations; the recorded
Python 3.14 installation does not require it.
Production CPU CI installs the `policy,robodojo,recording` extras and binds the
official stable action revisions described in [CI provenance](../provenance/ci-actions.md).

These rows allocate no model, policy network, simulator or physical GPU. Native
SDK environments have their own dependency constraints and provenance. The
recorded RoboDojo environment and its dependency-admitted candidate are described
in [native environment admission](robodojo-supported-environment.md).

## Configured native profiles

Clean `6b63217` loads these four original configurations through the production
native workspace. Both CPU platforms expose the corresponding model, checkpoint,
policy, catalog and independently configured role definitions. The packaged
macOS Console selects all four profiles through its actual component controls.
No Session or managed model/policy service starts during these readiness checks.
The actual Linux package also selects all four profiles and completes service-stop
and application-quit cycles through CPU-rendered Wayland windows. Both platforms
enable Chromium sandboxing and retain isolated renderers with zero browser errors.

| Provider | Embodiment | Policy ID | Checkpoint identity | Configured task | Team |
| --- | --- | --- | --- | --- | --- |
| RoboDojo | Dual ARX X5 | `openpi-pi05-robodojo-arx-x5` | `RoboDojo-sim-arx_x5-joint-0/59999`, complete inventory SHA-256 `fbf1abbda5863ebe4193754a9db16a1637d9127f042052b828e2aaeee7cc5dc7` | `build_tower` | [robodojo-live.yaml](../../examples/teams/robodojo-live.yaml) |
| RoboTwin | Aloha AgileX | `lerobot-pi05-robotwin-aloha-agilex` | `SidneyXie/pi05_robotwin@e49e2ab6c11f07511573b67261bd129e88d0a416` | `adjust_bottle` | [robotwin-scene-analyst.yaml](../../examples/teams/robotwin-scene-analyst.yaml) |
| RoboCasa | PandaOmron | `gr00t-n1d6-robocasa-pandaomron` | `nvidia/GR00T-N1.6-3B@d0814e7ecb19202e7c8468b46098b0b7ef3a6d61` | `CloseDrawer` | [robocasa-live.yaml](../../examples/teams/robocasa-live.yaml) |
| BEHAVIOR-1K | R1Pro | `gr00t-n1d6-behavior-r1pro` | `nvidia/GR00T-N1.6-BEHAVIOR1k@300db814db8ab5dd010026d5631f280048d06b91` | `picking_up_trash` | [behavior-live.yaml](../../examples/teams/behavior-live.yaml) |

These recorded profiles use the configured `brain` binding to
`Qwen/Qwen3.8-27B` and learned-policy execution mode. The native catalog preserves
the task's original criterion, permitted subgoal checks and revision. The
RoboDojo Tower profile admits its native base/middle structure checks while
retaining `build_tower` as its final goal. Its readiness result does not establish
Tower success.

Different checkpoints, tasks, role definitions and model endpoints require
complete compatible profiles and their own acceptance. RoboDojo direct/hybrid
execution has its [execution-mode interface](litchi-execution-modes.md) and
separate native release requirements. Evolver remains paused and SceneState
remains deferred; SKILL retrieval keeps its explicit per-assignment context rules.

## Native task release gates

The [v1 register](v1-delivery.md) retains original source-bound task outcomes,
independent formal verdicts, native action/video evidence and resource release.
Current-code loaded-model acceptance, complete Tower/prerequisite recovery,
BEHAVIOR original task success, policy interruption, measured perception,
allocated profile switching and additional configurations retain their native
gates. Signed distribution retains its deployment signing requirements.

The [native campaign](native-release-campaign.md) binds concrete configurations
to sequential Session/task submissions and original evidence. Run it only in the
authorized native-testing phase with the configured device allocation.
