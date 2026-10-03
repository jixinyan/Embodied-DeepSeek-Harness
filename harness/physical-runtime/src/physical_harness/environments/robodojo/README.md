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
own current passed formal result and matching attempt. A bounded execution
ending in `budget_exhausted` or `policy_stop` provides an eligible confirmed
boundary for each fresh Verifier while the native scene remains allocated.

Stage checks run on the simulator owner thread. Each RPC requires the current
episode and native control index, preserves all eight block poses, native
control/physics/time/end/success values and `RewardManager`/`Func_Parser` mutable
data, and fails immediately if any value changes. An exclusive
`<episode_id>/tower_check_<position:06d>.json` records the actual condition
values, before/after state, observation digest and check/physics source digests.

`native-check-provenance.json` and immutable copied SDK source files identify
the original implementations. No score transition is evaluated by these reads.

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
