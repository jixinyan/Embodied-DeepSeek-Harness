# Native RoboTwin and Pi0.5 deployment

The native `adjust_bottle` provider uses pinned RoboTwin revision
`bf44be51cf5717a5595ce59447f2cf5263d2aa95` and the Pi0.5 checkpoint
`SidneyXie/pi05_robotwin@e49e2ab6c11f07511573b67261bd129e88d0a416`.
The checkpoint receives three 640×480 RGB cameras and the native fourteen-channel
`joint_action.vector`. Its saved LeRobot processors produce absolute joint targets.
The service retains original model outputs and converts the two gripper channels
with the native `numpy.clip(value, 0, 1)` semantics. See
[checkpoint identity and mapping](../../examples/policies/lerobot-pi05-robotwin.json).

Local Qwen Planner/Verifier with this learned checkpoint completes a headless
native task with 107 controls, independent formal success, released Session and
audited three-camera recordings. See the [recorded handoff](qwen-headless-checkpoint.md)
for source identity, original trace, MP4 and remaining acceptance.

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

For local Qwen, co-locate the Agent server, model service, policy and simulator on
the GPU host. Forward the console's same loopback port to the browser host; its Host
validation requires the matching port. Select
[qwen38-vllm.yaml](../../examples/models/qwen38-vllm.yaml) for upper roles and set
`publishRunningImages: false`, `recordSimulationFrames: false` and an absolute
`simulationVideoDirectory` in the worker configuration. Model captures retain
complete camera groups. See [headless recording](headless-simulation.md).

The Pi0.5 service accepts `--compile-model` and `--no-compile-model`; omitting both
retains the checkpoint's official LeRobot configuration. The supplied checkpoint
selects `max-autotune` when compilation is enabled. Eager inference is selected
explicitly with `--no-compile-model`; the startup record includes the effective
compile setting and mode alongside checkpoint/source identity. Deployment-specific
`OMP_NUM_THREADS` and `MKL_NUM_THREADS` settings bound CPU processing independently
of GPU selection. Task acceptance always checks actual checkpoint outputs, native
receipts and formal verification.

`adjust_bottle` admits 400 native control targets. Each target invokes native
interpolation; its physics-step count is recorded separately. The catalog budget
must preserve the native criterion `task_success` and the 400-control-step limit.
The checkpoint produces a 50-action horizon. `policyMaxActionsPerInference: 16`
admits a prefix that fits the measured three-camera recording cost within the
application's 300-second observation deadline. Positive observation, policy and device timeouts remain explicit deployment
bindings, within the native worker's 300-second limit. Three camera frames and
the fourteen-channel state are captured again before each new policy request.

Native scene configuration accepts `ray_tracing_denoiser` with `none`, `oidn` or
`optix`; the default is `none`. EDH applies and checks this setting immediately
after native scene construction, before native cameras are created. Scene metadata
records the selected value. Model observations and native recordings use that
same renderer. A deployment selecting OIDN or OptiX must validate support on its
selected GPU and SAPIEN installation.

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

Native execution `native-acceptance-4d5be85e-2ec1-4d44-a8b3-f1c89008dcd4`
completed `adjust_bottle` with 120 actual controls, 11,151 physics steps, four
identified Pi0.5 requests and 432 three-camera frame groups. The unchanged native
`task_success` predicate returned true; execution ended at a confirmed
`episode_terminated` boundary with zero uncertain actions. Its first control was
followed by a confirmed ordinary pause, two seconds of unchanged control/physics
counts, and resume using the remaining cumulative 400-control budget. The native
environment closed and its process exited. Evidence remains in the GPU host's
`.local/work/robotwin-policy-full-gpu4/` directory.

Application run `af510a44-c050-4363-80ca-0b17fb04499f` confirms ordinary pause
after three controls, explicit Planner resume of the same execution and actual
subsequent controls. Operator cancellation ended after five controls and 354
physics steps with a confirmed `user_stop` boundary. Pause and terminal boundaries
each held unchanged counts for three seconds. No Verifier assignment or formal
verdict was created. Session `0ffefba9-231c-4bf6-976f-7869254da9bc` closed with
resources released; its native worker exited and the console remained responsive.

Application run `8fcb950b-eebf-4133-ae94-197ac8e6bb41` completes the retained
native task through the real Pi0.5 service and native DSH Planner. Execution
`d4d400cc-5266-4d0a-9716-885282de3177` records 111 controls, 10,443 physics steps,
seven identified policy requests and 409 three-camera frame groups. It ends with
confirmed `episode_terminated` boundary `dbf8605c-c2d7-476a-8bd5-90f46c084f5a`.
A fresh independent Verifier checks the unchanged `task_success=true` predicate
and submits verdict `57eb96be-d796-4a34-842d-ad5cfa8d071f` as `passed`. Planner
then calls `tasks.finish`; the run records `succeeded`. Session
`d6eda014-a729-4da8-be07-13dbf04952d4` closes with `resources=released`, and its
native worker exits. The console and Pi0.5 service are also shut down.

This run retains the exact native instruction, seed 0, bottle model 16 and
orientation tag 0. The admitted budget is 400 controls and 3,600 wall-clock
seconds; inference admits 16 actions with a 300-second observation deadline.
Native camera sampling occurs every 30 physics steps and returns head, left-wrist
and right-wrist RGB images. Each executed action has its actual generation,
PolicyRequest, original model/native output and ActionReceipt retained under
the explicit `EDH_POLICY_REQUEST_RECORD_DIR` binding. Segment records use
execution/request/segment identities and reject overwrites.

The complete 663-event export, 523 native sensor samples, service/checkpoint
identity, source snapshots and SHA-256 records remain in
`.local/work/robotwin-20260929/`. The actual source configuration retains
`sourceCode.state=modified`; the export preserves those running source files.
[audit-recorded-run.py](../../scripts/audit-recorded-run.py) checks this learned
policy source independently of direct/hybrid DSH policy Session traces. It
requires the native sensor export, actual request/receipt directory, service log
and pinned policy manifest. Missing identified service evidence fails acceptance.
The source audit passes all 663 events, 111 actual receipts and seven actual
inference identities; every inference has an executed prefix. The checkpoint
digest is `a7e94d38448efa8554575467a25b39dfaac721448d8de189fdaf27fc299b7013`.
This run has no recovery attempt or experience publication. See
[GPU integration evidence](gpu-integration.md).

## Recorded visualization

The successful run's complete recorded export is
`.local/work/replay-robotwin-success-8fcb950b/`. `timeline.html` provides an
interactive recorded-wall timeline with synchronized head/wrist cameras,
Planner and Verifier output, tools, plan, TODO and original event details.
`robotwin-task-overview.mp4` presents the same recorded source at 1920×1080,
10 fps and 122.8 seconds. It compresses recorded wall time at 16× and labels
reading holds; all camera views retain their original aspect ratio. Playback
uses local historical files and requires no model, simulator or policy service.

All four MP4 files pass complete decoding. Every rendered frame passes text
boundary checks; all 265 source-text pages across 101 recorded text regions also
pass. The validation records retain font identity/SHA, source audit, media SHA
and actual browser checks at initial, running and completed times. Three native
640×480 camera videos load without media errors and seek to their identified
final frame alongside `task_success=true`, Verifier `passed` and the completed
run. The export retains all 663 events, 1,233 image records and three camera
videos. The endpoint recorded no reasoning content blocks; assistant text and
tool arguments are shown from actual records.
