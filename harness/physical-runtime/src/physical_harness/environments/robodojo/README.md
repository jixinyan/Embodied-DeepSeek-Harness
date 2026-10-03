# RoboDojo native service

Native `build_tower` additionally declares `tower_base_structure` and
`tower_middle_structure`. These read freshly constructed conditions from the
original SDK's `_base_structure_checks()` and `_middle_structure_checks()`, using
`RewardManager.check_once` with the same top-level AND and nested logic as the
native task. The original `task_success` criterion remains the native episode
success, including the complete tower and robot return conditions.

The [tower catalog](../../../../../../examples/tasks/robodojo-build-tower.json)
is a complete production task catalog. Set the selected worker's `nativeTaskId`
and native service task to `build_tower`, and assign this JSON object to its
`catalog` field. Its `allowedSubgoalChecks` admits the two fixed named checks
with `args: []`. A Planner can create a base goal, a middle goal requiring both
structure checks and a dependency on the base goal, then retain the original
final goal with a dependency on the middle goal. Each dependency requires its
own current passed formal result and matching attempt. Planner can request
`execution.end` for its current running subgoal; an acknowledged `planner_stop`
provides an eligible confirmed boundary for a fresh Verifier while the native
scene remains allocated. A bounded execution ending in `budget_exhausted` or
`policy_stop` also permits formal verification. An ordinary pause retains the
Planner's current decision and running subgoal.

Stage checks run on the simulator owner thread. Each RPC requires the current
episode and native control index, preserves all eight block poses, native
control/physics/time/end/success values and `RewardManager`/`Func_Parser` mutable
data, and fails immediately if any value changes. An exclusive
`<episode_id>/tower_check_<position:06d>.json` records the actual condition
values, before/after state, observation digest and check/physics source digests.

`native-check-provenance.json` and immutable copied SDK source files identify
the original implementations. No score transition is evaluated by these reads.

The native service records both structure checks after actual reset and every
completed native control. These private source records preserve measured stage
progression and can calibrate deployment budgets from a completed trajectory.
They do not stop controls or supply a formal verdict. Authorized stopped checks
produce fresh records through the same read-only evaluator.

`scripts/check-robodojo-tower-stages.py` audits a closed actual episode using its
original source copies, action receipts, retained NPZ observations and every
stage record. It verifies false reset conditions, ordered native base/middle/final
progression and unchanged physical/reward state for each read. Use
`--episode-root <native-output-directory> --output <new-report-path>`;
`--require-complete` requires a successful completed trajectory with all three
observed transitions. A calibrated whole-task trajectory and an independently
verified staged workflow have separate acceptance states. Keep the original
native instruction for every learned-policy execution across the stage goals.

The original Pi0.5 driver executes its complete 50-action prediction before the
next inference. Set the selected worker's `policyMaxActionsPerInference` to `50`
when using that native rollout profile. Each action retains its own ActionGate
admission and actual native receipt; Planner review and terminal stop still use
the current execution's authenticated ownership and generation.

The base predicate checks original vertical separation and upright orientations;
the middle predicate adds native board/support-circle geometry. Their exact
thresholds come from the installed SDK. These predicates retain the SDK's
geometric meaning. Actual base-to-middle-to-final progression and zero-state-change
stage reads require their own recorded native task acceptance. Compilation and
catalog admission alone do not establish those results.

This module owns the EDH simulator service, current RGB-D capture, calibrated
pixel grounding, measured-state FK checks, numerical IK and velocity-limited
dual-arm target preparation. `RoboDojoEnvironment` is the worker-side RPC client.
`server.py` is the simulator-side entry point. Both use the existing bounded
msgpack/zlib transport and exact episode/step identities.

The simulator process imports a separately installed RoboDojo SDK, IsaacLab,
Isaac Sim and cuRobo. Its source packages and assets have explicit independent
locations. The service has no LitchiAgent or GPT-as-Policy imports. Upper roles
and the execution policy remain native EDH DSH Sessions; each actual control is
admitted by the worker's ActionGate before reaching this service.

Native service configuration selects CUDA visibility through `gpu`, including a
single complete GPU UUID. Optional `rendererGpu` selects the physical graphics
index in the original AppLauncher configuration before Kit starts. The launcher
disables multi-GPU rendering and supplies logical physics device `0` through the
original Kit arguments. Native EvalEnv and cuRobo continue to use the CUDA device
selected by their existing `torch.cuda.current_device()` configuration. Deployment
admission must verify the initialized Kit device and every owned process's full
graphics and compute allocation before submitting a task. This explicit startup
binding has source and compilation checks; native placement acceptance is pending.

Immutable source `d98f2af` accepts independent native watchdog fencing on
`general_pickup`, seed 0, with the identified ARX X5 Pi0.5 checkpoint
`fbf1abbda5863ebe4193754a9db16a1637d9127f042052b828e2aaeee7cc5dc7`.
One actual native inference returns its unchanged eight-action prefix. The owned
SDK subprocess receives `SIGSTOP` while its original `episode_status` admission
is pending; revoking the actual resource lease triggers the independent watchdog.
ActionGate remains `pausing`, without device confirmation, until the SDK receives
`SIGCONT` and its owner operation drains. The final original StopAcknowledgement
confirms boundary `9b0f7f7e-1b1a-4c0d-bde4-7a91ba5221c8` with `backend_error`.
Zero controls, uncertain actions or new physics steps occur. Actual native
counter 844, simulation time 3.3760001603513956 seconds and the original NPZ
observation digest remain unchanged. The source audit checks original request,
raw model output, bridge/native logs, checkpoint inventory, imported policy
sources, SDK counter provenance and the durable device acknowledgement.
The native SDK, checker, owned policy and bridge processes exit; their listeners
and resource lease are released. This accepts the physical stop boundary;
no upper task or formal Verifier is created.

The same independent stopped scene accepts calibrated measurements from all
three registered cameras before learned inference. Each measurement uses an
explicit complete-image region mask and contains 307,200 valid pixels. Axial
medians are 0.6147001683712006, 0.3538808822631836 and 0.39017629623413086 metres
for `cam_high`, `cam_left_wrist` and `cam_right_wrist`. Native robot state and
camera bytes remain identical during capture and measurement. Recomputing all
retained RGB, depth, mask and calibration arrays reproduces every metric field
exactly. Complete original records and the successful audit are retained on both
hosts under `.local/work/v1-robodojo-watchdog-20261003/`.

The isolated outer worker installs the declared physical distribution and its
`policy`, `catalog` and `robodojo` extras. Its 17-package dependency check and
production imports pass. The separate OpenPI environment retains 189 packages
with its own passing dependency check. The native simulator installs the declared
`catalog` and `robodojo-server` extras and retains 308 packages, including the
original Isaac Sim kernel 5.1.0.0, FastAPI 0.115.7 and IsaacLab 0.54.3. Their
upstream requirements are incompatible: the kernel pins FastAPI 0.115.7,
FastAPI requires Starlette `>=0.40.0,<0.46.0`, and IsaacLab requires
Starlette `==0.49.1`. The outer native environment installs Starlette 0.49.1
and its package dependency check reports the FastAPI constraint conflict.

After actual `SimulationApp` initialization, the original Isaac Sim
`pip_prebundle` supplies FastAPI 0.115.7 and Starlette 0.45.3. The native service
records those actual module paths, original distribution metadata, complete
requirements and file hashes in `native-dependencies.json`. At runtime the
IsaacLab Starlette requirement remains unsatisfied. SDK packages, bundled
dependency files and their metadata are preserved. Package dependency validation
and observed native SDK execution have separate evidence states.

Actual zero-control SDK admission uses immutable
`665823df681cec3bc684aaeda599a66b06d4dc06` under
`.local/work/robodojo-sdk-deps-20261003-04/`. It directly imports the genuine
initialized SDK dependencies, captures all three calibrated cameras, checks
original native `task_success=false` and exactly recomputes every retained RGB-D
measurement. Native control/physics counters, simulation time, NPZ digest,
robot state and PNG bytes remain unchanged. It creates zero policy clients or
inferences. Native PID 473038 exits normally and its owner checker exits.
This accepts native capture, GT, calibration and close with the declared
dependency conflicts. ASGI serving was not exercised. The complete original
records and environment manifests remain available independently of task demos.

`kinematics.py` uses `yourdfpy` to read the robot URDF. Native reset validates
its FK against both measured EEF poses before permitting tools or actions.
`geometry.py` uses the optical camera's actual intrinsics and USD world pose.
`motion.py` anchors a joint delta once at preparation and limits every proposed
tracking step by the measured native velocity limits. FK/IK preparation advances
zero physical steps. Collision-free trajectories are not certified.

The native task registers its original success conditions after reset. The service
never changes its step limit or task criterion. Camera recordings retain initial
and post-action observations. Disconnect ends the owned simulator and closes its
recorders; uncertain native operations invalidate the episode.

Start with [the deployment launcher](../../../../../../examples/deployments/start_robodojo.py)
and an explicit JSON configuration. See [deployment instructions](../../../../../../docs/implementation/robodojo-standalone.md)
and [source provenance](../../../../../../docs/provenance/litchi-robodojo.md).
