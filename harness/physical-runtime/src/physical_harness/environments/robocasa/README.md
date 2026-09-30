# robocasa

`RoboCasaEnvironment` binds RoboCasa 1.0.1, robosuite 1.5.2 and MuJoCo 3.3.1 to
PandaOmron's `HYBRID_MOBILE_BASE` controller. It validates the native 12-channel
layout, normalized limits and 20 Hz control frequency after the actual scene reset.
The last channel is `base_mode`. Session configuration selects a seed and split or
explicit layout/style IDs, plus texture and camera randomization settings. Unknown
or conflicting fields fail. A later upper task must use the same native task ID;
`bind_task` preserves the current scene.

Three 256 × 256 RGB cameras and the five proprioception arrays used by the official
PandaOmron GR00T mapping are captured as native observations. The only registered
formal check is RoboCasa's task success predicate under `task_success`. The adapter
does not expose active camera movement. `step` calls one actual robosuite control
step and reports the measured MuJoCo internal step count. A manually specified
neutral control action passed one step with 25 internal steps in the isolated GPU
environment. That check did not execute a learned policy or complete the task.

After each committed native control, `step` reports `episode_terminated` when
RoboCasa's current `_check_success()` predicate or native `done` flag is true.
The ActionGate worker obtains the device stop acknowledgement before publishing
the terminal boundary. This matches the official GR00T evaluation wrapper's
`terminate_on_success` setting. The independent Verifier still evaluates
`task_success` after the confirmed end. The adapter stores no success latch;
task binding preserves the scene and subsequent checks read its current state.
The successful-predicate branch remains awaiting a real successful policy task.

`capture_metric_depth` is an explicit read-only native-owner operation. Each
camera obtains RGB and normalized depth from one MuJoCo `render(depth=True)`
call. Both arrays use top-left image coordinates. Official robosuite
`get_real_depth_map`, `get_camera_intrinsic_matrix` and
`get_camera_extrinsic_matrix` supply axial depth in metres, intrinsic calibration
and the camera-to-world transform. The capture includes observation identity,
per-camera timestamps, simulation time and clipping distances; it advances no
controls. The backend advertises `measureObject` only for RoboCasa and uses the
native worker's read-only `measure_object` operation. Input binds an observation
identity, actual named camera, original image SHA-256 and binary PNG mask. The
worker requires its latest explicit capture, unchanged control counters and a
confirmed paused/ended boundary when execution exists. The provider renders the
current frame and requires the RGB digest to match the admitted original image.
Calibration identity includes the actual intrinsics, camera pose and capture.

Measurements report axial-depth and camera-range medians, p10/p90 axial spread,
selected/valid pixel counts and coverage, camera/world frames and intrinsics.
`centroidCameraXYZ` and `centroidWorldXYZ` are means of visible valid surface
points. Camera axes are right/down/forward, and distances use metres. Read-only
request cancellation rejects the caller without disconnecting the worker;
the backend checks cancellation again before returning a result.

Run `scripts/check-robocasa-metric-depth.py --output-directory <ignored-directory>`
inside the isolated RoboCasa environment with its native EGL configuration. The
checker uses the existing `NativeActionDevice.on_owner` to reset and capture the
scene. It saves paired RGB PNGs, float32 axial-depth NPY files and calibration
JSON records with `calibration_id`, `fx/fy/cx/cy`, camera identity and SHA-256
values. Every RGB array must equal the native observations captured before and
after it; robot state and simulation time must remain unchanged. The exported
depth is simulator measurement for perception-quality evaluation.

Simulator calls must stay on the execution worker's owner thread. The adapter alone
does not publish upper agent updates, image references or formal verdicts.

On 2026-09-30, the GPU1 native gate check passed reset, three-camera capture,
manual control, confirmed pause/resume, a second execution on the retained scene,
and a stable simulator clock after an in-flight stop. A separate worker check used
the checkpoint-backed GR00T-N1.6 policy on GPU6. Its first task executed seven
admitted controls and 175 MuJoCo steps, published native camera frames, and
returned `task_success=false` at a confirmed boundary. The worker opened and
closed a second task on the same scene, then exited. The local report is
`.local/work/robocasa-agent-worker/result.json`; the remote gate report is
`.local/work/robocasa-agent-gpu1-gate/result.json`. These checks establish
policy-to-simulator control and Session task lifecycle for this deployment.
Successful OpenCabinet completion and recovery remain unverified.

A subsequent native console run, `eb163146-9971-4fa2-b040-7a65fcf2424c`, used the
configured Astra Responses model, the same GR00T checkpoint and the environment's
exact `Open the cabinet door.` instruction. The first attempt executed 1,050
controls, 132 policy calls and 26,250 MuJoCo steps. It ended with
`budget_exhausted` at a confirmed device boundary. An independent Verifier read
the native `task_success=false` result and submitted a failed verdict. The
Planner explicitly requested a retry on the retained scene, and an independent
Evolver recorded that recovery. The second attempt executed 1,002 controls, 126
policy calls and 25,050 MuJoCo steps before a confirmed `backend_error` boundary.
The worker's ten-second `writer.drain()` deadline expired while publishing an
execution update. No successful recovery verdict or recovery SKILL was produced.

SAM requests in that run reached the real service, while the native DSH tool's
ten-second deadline expired before a segmentation result could be published.
The segmentation schema now uses DSH-supported string fields and preserves the
128/128/1,024-character domain limits separately. Successful cold and warm
segmentation publication through DSH, native task success termination, and
same-Session success-predicate lifecycle checks retain separate acceptance gates.

A separate cancellation run, `7e9ef306-42c3-4511-a831-65c3aee5431d`, invoked the
segmentation tool and closed its Session two seconds later. The native tool call
was cancelled, resources were released, and no segmentation completion for that
call appeared during the following 45 seconds. The SAM service's first
`add_prompt` log followed the Session close, so this check covers cancellation
during the request/startup path; cancellation during an already-running cold
inference remains unverified. Both Sessions were closed, and the owned console,
GR00T, SAM and port-forward processes were stopped.

The local evidence directory is `.local/work/robocasa-sam-20260930/`, including
`run-final.json`, `backend-failure.json`, `server-repaired.log`, `sam.log`,
`sam-cancel.log`, `session-closed.json` and `cancellation-result.json`. These are
private run records and are excluded from Git. The schema tests, TypeScript
checking, formatting checks and `git diff --check` passed at this checkpoint.

The headless local-Qwen run `415e2c46-7527-469a-9969-600ebc5520ba` uses
Qwen3.8-27B through the existing configured model loader, GPU1 native RoboCasa and
GPU6 GR00T. The team disables recovery learning. It executes 1,050 controls,
132 identified policy requests and 26,250 MuJoCo steps in 244.156 seconds. Cold
GR00T inference takes 60.505 seconds; the subsequent inference median is
0.147 seconds. Running publications contain metadata with no camera-frame events,
and three camera videos remain local to the worker. The unchanged ten-second
worker output deadline completes this task without an output timeout.

Execution `f6529761-37ce-4029-a2d2-8732b33c0a2f` ends at a confirmed
`budget_exhausted` boundary. Independent Qwen Verifier verdict
`80a05f6f-d8e7-4938-83d9-682575f52b42` is failed with native `task_success=false`.
The Planner ends the failed goal, and Session
`5566c490-e37b-4a51-ba69-3104fd624d4e` closes with resources released. Two
`planning.update` calls fail input/plan validation before later corrected calls;
this run establishes no clean-role-completion or successful-task acceptance.
Evolver does not run. The 1,180-event trace, original policy log/requests, videos
and metric capture are retained in `.local/work/robocasa-qwen-20260930/`.

The separate seed-0 metric capture is
`metric-depth-calibrated/result.json` under that evidence directory. All three
RGB arrays match native camera observations exactly, and each depth/calibration
pair shares capture `164b98ca-a598-49e4-83eb-921fe641f6ef`. This reset observation
has its own identity and does not represent the preceding task's final state.

`scripts/check-robocasa-object-measurement.ts` exercises the actual native worker,
local image store, live SAM cabinet masks and GR00T controls. Its verified run
retains `object-measurement-verified/result.json` in the private evidence directory.
Both initial SAM regions match their measured pixel counts.
The two regions contain 6,953 and 17,627 valid pixels with axial medians of
1.282525 and 0.952102 metres and camera-range medians of 1.412978 and 1.046194
metres. Coverage is 1 for both regions. Wrong source images,
earlier captures, running-device requests and earlier Session identities are
rejected. A cancelled measurement publishes no caller result, and a subsequent
measurement succeeds on the same connection. After real GR00T control and a
confirmed pause, fresh camera segmentation and native measurement succeed while
the control count remains unchanged. All owned native checker resources close.

Set `EDH_SAM31_BASE_URL` in the RoboCasa deployment to select the SAM/measurement
team. That team disables recovery learning and registers
`perception.segment_objects` and `perception.measure_object`. Geometry requests
use the matching source-image and SAM-mask evidence references. Optional YOLO
prediction has a separate provider binding and role.

The Qwen/SAM/native-measurement run
`e4c1038f-cb92-4664-a79e-6760aa2e5241` publishes capture, segmentation and
measurement receipts in order, followed by a complete structured plan, goal
selection and execution receipts. Measurement evidence
`9f93596a-a915-47cc-9925-ee4fc33bdf16` retains the original camera and mask
references, axial median 1.282525 metres, camera-range median 1.412978 metres
and valid fraction 1. Execution `57fec71c-d911-4128-a7cc-86cf8f734a26` executes
1,050 controls, 132 policy calls and 26,250 MuJoCo steps in 183.642 seconds.
Independent verdict `c1cb5d54-ff1c-4848-871e-99d2ba63d7a5` is failed with
native `task_success=false`. The upper run ends by operator cancellation after
that verdict. Session `7ce5fd2d-0467-4a4f-b7c9-805b896dfab1` closes with
resources released. Records are in `.local/work/robocasa-measured-20260930/`.

A separate 64-control native run
`e6ebc3f3-37e5-4274-a51f-2d49584af534` validates `execution.query` through
the actual UpperRun tool. Its running receipt at control 8, policy call 1
returns the current task scope and saved metadata evidence
`2fcdc98c-27a9-4091-acd6-1c3ba71d6a02:status:9`. Running images remain disabled.
The execution ends at a confirmed budget boundary after eight policy calls and
1,600 MuJoCo steps in 10.747 seconds. Independent native verification is failed.
The operator concludes this validation and Session
`d4268aca-98d7-453c-993d-3f5e10b966ad` closes with resources released. Records
are in `.local/work/robocasa-query-20260930/`.

All six videos from these two executions decode successfully, with 1,050 and
64 frames respectively in each of the three native camera streams. No camera-frame
event is published into their upper running traces. The GR00T service and both
validation consoles stop after release; shared Qwen and SAM remain allocated for
other validation work. Full Planner task completion, successful native task
termination and same-Session success-predicate lifecycle acceptance remain pending.
