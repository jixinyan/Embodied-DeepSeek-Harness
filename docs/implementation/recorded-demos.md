# Recorded Agent workflow demos

The MP4 composites pair actual model output, tool receipts, plans, TODOs and formal
verification with recorded simulator images. They replay existing native runs;
rendering does not execute a task or establish an additional acceptance result.
Original timestamps determine each displayed state. Labeled reading holds and
wall-time compression make the recorded decisions readable.
Execution counters, native checks and formal verdicts include their recorded
attempt identity. TODO status includes the reporting member and completed count.

## Delivered recordings

The native v1 integration recordings are retained under
`.local/work/v1-20261003/`, `.local/work/v1-robotwin-20261003/` and
`.local/work/v1-robodojo-20261003-05/` and `.local/work/v1-robotwin-20261003-clean/`.

| Recording                                 | Actual task result                                                                                                                                | Model and policy                   | Duration  | Source                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------- | -------------------------------------- |
| `robodojo-qwen-pi05-success-reviewed.mp4` | Native task success, independent formal success and released resources; one recorded plan-parameter error                                         | Qwen3.8-27B / Pi0.5                | 80.167 s  | `02475b82-b6b6-457f-8cf8-3199ef265bc6` |
| `robotwin-qwen-pi05-retry-success.mp4`    | Independent SceneAnalyst, failed first attempt, accepted Planner retry, formal success and released resources; two recorded plan-parameter errors | Qwen3.8-27B / SceneAnalyst / Pi0.5 | 340.167 s | `66ff9b47-9e2d-4514-904c-cd61c869b44c` |
| `robodojo-qwen-pi05-clean-retry-success.mp4` | Failed first attempt, retained-scene retry, independent formal success, completed TODOs and released resources; zero tool errors | Qwen3.8-27B / Pi0.5 | 126.250 s | `897f215d-119f-4880-9030-1d9edeb9fabb` |
| `robotwin-qwen-pi05-clean-team-retry-success.mp4` | Independent SceneAnalyst, explicit report acknowledgement, failed first attempt, retained-scene retry and formal success; zero tool errors and released resources | Qwen3.8-27B / SceneAnalyst / Pi0.5 | 276.000 s | `a5d9132e-f4fb-438e-8c71-e81394cffd39` |

The clean RoboTwin Team composite contains 773 original events, 26 model analysis
events, 113 actual controls, eight identified learned inferences and 10,494 native
physics steps. It retains 409 rollout frames and one initial observation per camera.
The independent SceneAnalyst reports through the selected schema and Planner
acknowledges that receipt. Attempt one completes 64 controls with a failed formal
verdict; its retained-scene retry completes 49 controls with a passed formal verdict.
All twelve owner TODOs complete, four assignments retire and resources release.
Original learned inputs/actions, three typed plan writes and all six native videos
pass source checks. The composite's 3,312 frames fully decode and pass text bounds.
MP4 SHA-256:
`112e9a6e736d499d3e43f80204df54e95a43a14dce5a122fe8a915771ef06eb8`.

The clean RoboDojo composite includes 304 original events, 21 model analysis events,
58 controls, four identified learned requests and 580 actual physics steps.
It retains 58 native rollout frames and one initial observation per camera.
Its two fresh Verifiers report failed and passed; all eleven owner TODOs complete.
The original action, inference, checkpoint and native-counter audit passes.
Its 1,515 encoded frames fully decode with every rendered text boundary checked.
The MP4 SHA-256 is
`0e78b0dce8f6da148e171085420fa4599f02bcdb22321afc06abfe279e959ce6`.
Separate source-bound acceptance verifies a second task on the same ended episode
with a fresh Verifier and zero new controls, physics steps or policy requests.

The RoboDojo composite includes 223 original events, 11 model analysis events,
59 admitted controls and four identified learned inferences. Three native videos
retain their original frame timestamps. Its 962 composite frames fully decode;
the MP4 SHA-256 is
`436d2dc818ec1206b84c4ae3f45107064cd53468b03fac6351b58ecb8484f269`.
This recording's legacy native step counter does not establish physics-step totals.

The RoboTwin composite includes 765 original events, 30 model analysis events,
104 controls, seven identified learned inferences and 10,087 native physics steps.
It retains 390 rollout frames and one initial observation per camera. Formal
verdicts are failed, then passed. Its 4,082 composite frames fully decode;
the MP4 SHA-256 is
`ec157d72d8e9002aeb083b9de3b2b63ffbc7b54d4c2550f6ce3756749f4fa930`.
Both composites preserve their original tool errors and pass source-integrity,
duration, encoding and every-frame text-boundary checks. These runs precede
the configured Qwen strict-tool decoding checkpoint; clean-workflow acceptance
is recorded independently.

Private artifacts are retained under `.local/work/demos-20260930/`; generated media,
model requests and simulator data are excluded from Git.

| Recording                       | Actual task result                                                                                                           | Model and policy                    | Duration  | Source                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------- | -------------------------------------- |
| `robotwin-retry-success.mp4`    | Failed first attempt, accepted Planner retry, independent formal success                                                     | Qwen3.8-27B / Pi0.5                 | 101.417 s | `686c9767-746a-430e-ba81-900eef3fb09c` |
| `robocasa-retry-exhaustion.mp4` | Three failed formal verdicts, two accepted retries, Planner concludes failure                                                | Qwen3.8-27B / GR00T                 | 118.667 s | `7dfb663e-debb-44fb-a4da-96be2b88e664` |
| `sam-yolo-grounding.mp4`        | Pre-motion perception and user clarification; zero physical controls                                                         | Qwen3.8-27B / SAM3.1 / YOLO26 depth | 40.083 s  | `0b6b7450-0bb9-483a-9ff4-2631d65530df` |
| `behavior-retry-exhaustion.mp4` | Three failed formal verdicts, two accepted retries, Planner concludes failure; one recorded tool error                       | Qwen3.8-27B / GR00T                 | 128.833 s | `0b7da1de-19c2-4f9f-8229-bb346a178c16` |
| `custom-role-retry-success.mp4` | Explicit specialist report and acknowledgement, failed first attempt, successful retry; eight recorded plan-parameter errors | Qwen3.8-27B / SceneAnalyst / Pi0.5  | 189.083 s | `ef8f9d03-c9e6-4671-aac4-99c965631ae4` |

The RoboTwin recording contains 292 events, 113 admitted controls, eight identified
Pi0.5 inferences and 416 native frame groups across three cameras. Its two formal
verdicts are `failed`, then `passed`. The six original native camera files retain
their decoded frames and simulator timestamps.

The RoboCasa recording contains 467 events, 192 admitted controls, 24 identified
GR00T inferences and 192 native frame groups across three cameras. All three
formal verdicts are `failed`. The final `tasks.abandon` result is displayed as a
failed conclusion. This run verifies retry exhaustion and lifecycle completion;
its OpenCabinet task does not succeed.

The grounding recording contains 53 events and five actual Qwen output events.
It displays the source head-camera image, the actual SAM segmentation overlay and
the actual YOLO26 depth overlay only after their recorded tool results arrive.
The selected mask has 18,202 pixels. Axial median depth is 0.5965579 m, with
p10/p90 values of 0.5806525/0.6230189 m. Camera-specific metric accuracy remains
unverified; this monocular estimate has no calibrated radial-range result.
The original snapshot waits for an explicit user response. The Session was later
closed and resources released. This recording contains no execution or task verdict.

The BEHAVIOR recording retains 399 events, three identified GR00T inferences,
48 controls and 192 physics steps in `picking_up_trash`. Each of the three attempts
uses its admitted 16-control budget and reaches a confirmed execution boundary.
Three fresh Verifiers report the original native criterion as false. Planner
accepts two retries, completes all 11 assessment TODOs and concludes failure.
All four assignments retire and the Session releases its resources. Nine original
camera videos pass full decoding and timestamp checks. One unsupported active-view
call remains visible in the recorded trace; `cleanWorkflowAcceptance` is false.
The source audit validates inference/action/receipt identity and terminal order.
It uses the recorded worker source, separately from the subsequent native tool
budget and device-capability validation.

The custom-role recording retains four independent Sessions: Planner, SceneAnalyst
and two fresh Verifiers. The explicit handoff grants three camera images and a
caller-supplied context marker. The specialist reads the evidence and publishes
its selected-schema report; Planner queries and acknowledges that exact report
before its first plan-write receipt. Attempt one completes 64 controls and receives
a failed native verdict; its accepted retry completes 60 controls and receives a
passed verdict. The 415-event record includes 124 actions, eight identified Pi0.5
inferences, 11,366 physics steps and 446 native frame groups. All six native camera
files, terminal tool receipts, completed TODOs and released resources pass their
source checks. Eight actual plan-parameter errors remain visible; the task succeeds
and clean-workflow acceptance is false. Source binding uses an exact 495-file
SHA-256 inventory and ten deployment/configuration hashes from the private overlay.
The saved run has no Git revision value. Thirty-four actual model requests retain
754 checked tool schemas. The original run validates native physical tool budgets;
it precedes the rotation and capability-subset changes.

## Offline preparation

`scripts/prepare-recorded-replay.mjs` accepts saved `run.json` and `events.json`,
the original immutable attachment directory and the run's recorded acceptance audit.
It retains exact source bytes, checks event identity/order, validates attachment
SHA-256 and byte counts, and copies referenced observation images. The manifest
records source hashes. The output directory must be empty.

```sh
node scripts/prepare-recorded-replay.mjs \
  --source "<saved-source-directory>" \
  --attachments "<original-attachment-directory>" \
  --audit "<native-source-audit.json>" \
  --output .local/work/recorded-demo
"<isolated-render-environment>/bin/python" scripts/render-run-video.py \
  --export .local/work/recorded-demo \
  --simulation-videos "<original-worker-video-root>" \
  --output .local/work/recorded-demo/demo.mp4 \
  --font "<installed-font-file>" --wall-speed 12 --fps 12
"<isolated-render-environment>/bin/python" scripts/check-run-video.py \
  --video .local/work/recorded-demo/demo.mp4 \
  --export .local/work/recorded-demo
```

For the recorded grounding snapshot, add `--observation-only` to preparation and
rendering, and omit `--simulation-videos`. That mode requires an audited pending
user clarification, no execution and zero physical controls. Its three displayed
images are the source head-camera image, SAM overlay and YOLO depth overlay. It
labels the display as pre-motion grounding and records a null formal verdict.

## Verification boundary

All delivered composites are H.264, `yuv420p`, 1920 × 1080 at 12 FPS. Complete
FFmpeg decoding passes. FFprobe confirms 1,217 / 1,424 / 481 / 1,546 / 2,269 encoded frames and
their durations. Every rendered text page passes its panel bounds. Companion
`*.json` and `*.validation.json` files retain source identity, all formal verdicts,
the final verdict, media hash and full-decoding results. The renderer validates
source hashes, original image bytes and decoded image dimensions before rendering.

Native control/inference, simulator timestamps, independent Verifier Sessions,
TODO completion and resource release remain covered by the original source audits
documented in [progress](progress.md). Rendering and media validation do not replace
those audits. BEHAVIOR task success, zero-tool-error custom-role planning and the
remaining acceptance combinations retain their own actual evidence requirements.
New renders retain cumulative tool-error counts and four-second holds at
actual failed calls; the video validator compares those counts with the original
event journal.

The recorded endpoint-failure run `4a65da16-f64d-4eb2-9d33-7873fa8247cc`
has zero native actions and a confirmed `backend_error` ending. Its original
zero-byte frame journal and manifest (`frames: 0`, `cameras: []`) can be exported
as hash-bound native recording evidence. The exporter retains both original files
and lists no camera videos or frame policy request IDs. Actual zero-frame and
446-frame successful-run records pass byte/hash comparisons. Zero-frame evidence
contains no simulator rollout or completed learned inference; the exported
availability list explicitly reports unavailable native rollout frames.
