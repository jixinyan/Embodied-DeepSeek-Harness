# Native RoboTwin and Pi0.5 deployment

The native `adjust_bottle` provider uses pinned RoboTwin revision
`bf44be51cf5717a5595ce59447f2cf5263d2aa95` and the Pi0.5 checkpoint
`SidneyXie/pi05_robotwin@e49e2ab6c11f07511573b67261bd129e88d0a416`.
The checkpoint receives three 640×480 RGB cameras and the native fourteen-channel
`joint_action.vector`. Its saved LeRobot processors produce absolute joint targets.
The service retains original model outputs and converts the two gripper channels
with the native `numpy.clip(value, 0, 1)` semantics. See
[checkpoint identity and mapping](../../examples/policies/lerobot-pi05-robotwin.json).

## Application configuration

Set `EDH_ROBOTWIN_CONFIG` to a private JSON configuration and launch
[robotwin-live.mjs](../../examples/deployments/robotwin-live.mjs) with the runtime
TypeScript configuration. The configuration requires `modelConfiguration`,
`dataDirectory`, `checkpoint` and `worker`. `consolePort` defaults to 4323.
The model configuration uses the existing
[configured model API](model-configuration.md); credentials stay in environment
bindings. The deployment supplies a complete `robotwin-adjust-bottle` launch
profile, independent Planner/Verifier/Evolver role Sessions and the retained
native Session task catalog.

The worker configuration follows
[native worker configuration](../../apps/server/src/native-worker.ts). Required
bindings include the isolated Python command, native source working directory,
`provider: robotwin`, `nativeTaskId: adjust_bottle`, source/schema paths, selected
renderer device, policy identity, policy WebSocket URI and the task catalog.
The policy runs with `executionMode: policy`. An SSH deployment must preserve
worker file descriptor 3 as transport and direct simulator output to stderr.

`adjust_bottle` admits 400 native control targets. Each target invokes native
interpolation; its physics-step count is recorded separately. The catalog budget
must preserve the native criterion `task_success` and the 400-control-step limit.
`policyMaxActionsPerInference: 50` uses the checkpoint's complete action horizon.
Positive observation, policy and device timeouts remain explicit deployment
bindings, within the native worker's 300-second limit. Three camera frames and
the fourteen-channel state are captured again before each new policy request.

The native task instruction and scene metadata replace the configured catalog's
instruction during Session admission. Planner passes that instruction verbatim
to Pi0.5. A confirmed ordinary pause retains the same execution, scene and
cumulative budget; Planner explicitly decides whether to resume. Eligible
confirmed execution end creates a fresh Verifier. Operator cancellation is a
terminal user stop and creates no formal-success verdict.

## Native rollout evidence

[check-robotwin-policy-rollout.py](../../scripts/check-robotwin-policy-rollout.py)
performs identified native inference and executes each admitted action through
ActionGate. Its default budget is 400 controls and its default policy horizon is
50. `--pause-after-actions` checks an ordinary confirmed boundary, holds its
actual control/physics counts and resumes with the remaining cumulative budget.
`--stop-after-actions` checks a terminal user stop. A terminal native episode or
admitted budget end is followed by a held-boundary check and the unchanged native
`task_success` predicate. The script requires a fresh output directory.

The output contains each exact policy request and response, `controls.jsonl`,
three-camera native frame files and a final `result.json`. Each control record
binds the request, segment, receipt, physics count and frame identities. The
final result records admitted/native budgets, uncertain actions, held boundaries,
native check values and confirmed environment release. Environment/control
checks establish their own acceptance scope; successful task completion requires
the native success predicate and the application-level independent formal verdict.

The application deployment has passed actual startup, profile/role loading and
HTTP configuration checks. Complete native rollout and application Session
control/verification evidence are under active validation. See
[GPU integration evidence](gpu-integration.md).
