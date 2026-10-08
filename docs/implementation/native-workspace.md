# Native workspace deployment

[native-workspace.mjs](../../apps/server/src/native-workspace.mjs) composes configured
native deployments into one Console and workspace. Its runnable entry is
`examples/deployments/native-workspace.mjs`. Environment, embodiment, execution mode, checkpoint
and model selectors continue to resolve complete compatible launch profiles.
Each profile retains its own trusted Team file and role directory, so R1Pro and
arm-based environments can use different planning and verification prompts.
Profile selection displays its resolved Team before allocating a Session.

Create an actual workspace JSON, for example `.local/native-workspace.json`:

```json
{
  "version": 1,
  "modelConfiguration": "../examples/models/qwen38-vllm.yaml",
  "dataDirectory": "native-sessions",
  "consolePort": 4324,
  "deployments": {
    "dojo": { "provider": "robodojo", "configuration": "profiles/robodojo.json" },
    "twin": { "provider": "robotwin", "configuration": "profiles/robotwin.json" },
    "casa": { "provider": "robocasa", "configuration": "profiles/robocasa.json" },
    "behavior": { "provider": "behavior", "configuration": "profiles/behavior.json" }
  }
}
```

Every referenced provider file must contain its real native worker, installed
scene/task catalog, checkpoint and policy endpoint as described in the
[native deployment guide](../../examples/deployments/README.md). Paths in the
workspace JSON resolve relative to that JSON. Provider-specific configuration
continues to use its existing path rules. The common model configuration overrides
each provider's model file and may define both local vLLM and cloud API aliases.
Each profile's `plannerModel` selects one of those aliases. Credentials stay in
the configured local environment.

The supported native provider identifiers are `robodojo`, `robotwin`, `robocasa`
and `behavior`. Multiple groups may use the same provider with different Teams,
tasks or checkpoints. Group IDs contain at most 40 characters. Profiles are
namespaced as `<group>.<profile>` and must fit the existing 80-character profile
limit. Their labels include the group, and each selected combination retains the
original policy/checkpoint identity. Component selectors never combine incompatible
profiles. Close the current Session before selecting and allocating another.

The workspace owns one native DSH host, common configured models and the existing
image/tool services. All provider configurations must declare identical optional
SAM, YOLO and camera-intrinsic bindings. Conflicting declarations fail during
configuration loading. Simulator-specific calibrated measurement continues through
the selected native backend. Each provider's ordinary environment factory owns its
worker, scene, action resources and policy mode; imported modules and service
startup allocate no simulator or model inference.

For the Desktop launcher, select `native-workspace.mjs` as the deployment and set
`EDH_NATIVE_WORKSPACE_CONFIG` in its environment file. The launch configuration
still supplies its own workspace directory and may use port `0`. The configured
workspace console port is a valid fixed port for direct execution:

```sh
EDH_NATIVE_WORKSPACE_CONFIG=/absolute/path/native-workspace.json \
pnpm exec tsx --tsconfig tsconfig.runtime.json examples/deployments/native-workspace.mjs
```

The provider factories retain their existing managed-service leases. `/api/services`
namespaces each inspection identity by group; commands and credentials remain
private. Server close awaits all owned service lifecycles and preserves cleanup
errors. Native record and image retention use the existing complete ownership
policy, including the selected Team, immutable Session catalog and independent task
contexts. Restart never resumes physical actions automatically.

Actual startup, selector, task switching and confirmed cleanup require retained
production records. Source checks alone establish no model or simulator outcome.

## Offline readiness

Validate the actual workspace before allocating environments or acquiring model
and policy service leases:

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-workspace-readiness.mjs \
  --config /absolute/path/native-workspace.json \
  --output .local/work/<new-readiness-directory>
```

The checker starts the production Console on an automatically selected loopback
port with an empty private journal. It checks every configured profile's Team,
model, checkpoint, policy mode, environment-owned task catalog and service
projection. It requires no active Session and zero owned service processes or
leases. Shutdown must release the journal writer and close the listener. Original
workspace, model and provider files retain their hashes. The output preserves
those hashes, the deployment digest and the full profile matrix.

The 2026-10-07 check passes for four current profiles: RoboDojo `build_tower`
with Pi0.5, RoboTwin `adjust_bottle` with Pi0.5 and SceneAnalyst, RoboCasa
`CloseDrawer` with GR00T, and BEHAVIOR `picking_up_trash` with R1Pro/GR00T.
Evidence: `.local/work/v1-offline-readiness-20261007-03/`. It performs zero
environment allocations, model inferences and simulator controls. Native task
and multi-goal success require their own original source records.

## Configuration and Console acceptance

The 2026-10-03 production startup reads four original native configuration files,
loads their distinct Teams and exposes four compatible profiles from one server.
Actual browser selection checks each environment's embodiment, policy and exclusive
checkpoint choice. RoboTwin displays its configured SceneAnalyst in both the Team
graph and assignment sidebar. Teams with learning disabled display that state in
the workflow and recovery panels. The browser reports zero errors or warnings.
Normal server shutdown releases the writer lock and closes the loopback listener;
all four original configuration hashes remain unchanged.

Evidence: `.local/work/native-workspace-20261003/`. This accepts configuration,
Team projection, selection and shutdown without allocating a simulator or invoking
a model. Native task execution and switching allocated environments retain their
own source-bound acceptance requirements.

## Allocated profile switching acceptance

The production Console on 2026-10-03 allocates two native profiles in sequence
from the immutable `b8351f322f427a37e2a812b9e637bceb3448f08e` archive. Both use
GPU 1 and the configured `brain` binding to `Qwen/Qwen3.8-27B` on the existing
local vLLM endpoint. Each profile retains its own Team, role source digest,
embodiment, policy and checkpoint. The selected Session configuration and actual
Planner run agree on those bindings.

| Profile                              | Team            | Native Session                         | Actual cameras                   |
| ------------------------------------ | --------------- | -------------------------------------- | -------------------------------- |
| `behavior.behavior-picking-up-trash` | `behavior-live` | `852b25b2-4414-4b86-82b2-619cb2702db2` | Three 256×256 R1Pro cameras      |
| `casa.robocasa-single-door-gr00t`    | `robocasa-live` | `915d6a9f-a7f4-42e9-a8b8-7d1b52979425` | Three 512×512 PandaOmron cameras |

Production API admission resets each actual SDK environment and retains its
environment-owned catalog. The original BEHAVIOR hidden instance 0 and RoboCasa
seed-0 single-door configuration, native `task_success` criteria and configured
budgets pass direct comparisons with the original provider files. In each task,
Qwen completes one `perception.capture` and one `user.ask` for motion approval.
All six original PNGs are read through the evidence API and match their content
hashes. Both inspection tasks are cancelled when their Sessions close. There are
zero execution jobs, formal Verifiers, learned policy inferences and tool errors.
This accepts allocation, configured Team/model selection, native camera capture
and switching; native task success remains governed by its separate acceptance.

BEHAVIOR retains six original RGB-D camera records from reset and Planner capture.
Their depth, intrinsic matrices, camera poses and source PNGs pass independent
geometry recomputation with explicitly labeled complete-image regions. Each
camera has 65,536 valid pixels; both observations retain native time
`0.3416666844859719`. Median axial depths are `1.2791872024536133` m,
`0.2570967674255371` m and `0.25578856468200684` m for head, left wrist and right
wrist respectively. The SDK camera-parameter annotators are initialized during
sensor configuration, using their required four render updates before the native
instance reset.

Both Session closes confirm `resources: released` before the next allocation.
The actual BEHAVIOR SDK process, both workers, checker, process observer and
Console processes exit. The loopback listener and writer lock are absent after
server shutdown. Original provider configuration hashes remain unchanged.

Evidence: `.local/work/native-workspace-allocated-20261003-02/`, including the
original configurations, immutable source revision, Session catalogs, complete
run histories, camera bytes, calibrated arrays, criteria audit and process/release
checks. The retained bundle `acceptance-records.tar.gz` has SHA-256
`fdbd565598db73ffe20b1ed7aace7b3accef6a434962fe42a328fadfa6869680`.

## Original calibrated capture records

Set `EDH_METRIC_CAPTURE_RECORD_DIR` to an existing owned directory to retain
original calibrated observations. BEHAVIOR, RoboTwin and RoboDojo record their
native RGB-D observation replacement. RoboCasa records its existing
`capture_metric_depth` result, including measurements that invoke that method.
The configured path contains provider and observation directories, `capture.json`
and each camera's `source.png` and `calibration.npz`. Metadata retains native time,
process identity, world frame, recording source hash and the PNG/array hashes.
The operator owns this optional record directory.

An independent actual RoboCasa probe from
`ebdd089` verifies all three native 512×512 camera records against the original
SDK pixels and arrays, then recomputes geometry for complete-image regions. Robot
state and camera bytes remain unchanged, with zero policy clients or controls.
The native process exits normally with status 0. Evidence:
`.local/work/robocasa-capture-trace-20261003/native-capture-records.tar.gz`, SHA-256
`9aaa76c8222c1ee0348f3d993f9445a5b3ea1e40dbe7e71bfc325b5874b54512`.
