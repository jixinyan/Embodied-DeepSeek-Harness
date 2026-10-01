# Recorded Agent workflow demos

The MP4 composites pair actual model output, tool receipts, plans, TODOs and formal
verification with recorded simulator images. They replay existing native runs;
rendering does not execute a task or establish an additional acceptance result.
Original timestamps determine each displayed state. Labeled reading holds and
wall-time compression make the recorded decisions readable.
Execution counters, native checks and formal verdicts include their recorded
attempt identity. TODO status includes the reporting member and completed count.

## Delivered recordings

Private artifacts are retained under `.local/work/demos-20260930/`; generated media,
model requests and simulator data are excluded from Git.

| Recording | Actual task result | Model and policy | Duration | Source |
| --- | --- | --- | --- | --- |
| `robotwin-retry-success.mp4` | Failed first attempt, accepted Planner retry, independent formal success | Qwen3.8-27B / Pi0.5 | 101.417 s | `686c9767-746a-430e-ba81-900eef3fb09c` |
| `robocasa-retry-exhaustion.mp4` | Three failed formal verdicts, two accepted retries, Planner concludes failure | Qwen3.8-27B / GR00T | 118.667 s | `7dfb663e-debb-44fb-a4da-96be2b88e664` |
| `sam-yolo-grounding.mp4` | Pre-motion perception and user clarification; zero physical controls | Qwen3.8-27B / SAM3.1 / YOLO26 depth | 40.083 s | `0b6b7450-0bb9-483a-9ff4-2631d65530df` |
| `behavior-retry-exhaustion.mp4` | Three failed formal verdicts, two accepted retries, Planner concludes failure; one recorded tool error | Qwen3.8-27B / GR00T | 128.833 s | `0b7da1de-19c2-4f9f-8229-bb346a178c16` |

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
FFmpeg decoding passes. FFprobe confirms 1,217 / 1,424 / 481 / 1,546 encoded frames and
their durations. Every rendered text page passes its panel bounds. Companion
`*.json` and `*.validation.json` files retain source identity, all formal verdicts,
the final verdict, media hash and full-decoding results. The renderer validates
source hashes, original image bytes and decoded image dimensions before rendering.

Native control/inference, simulator timestamps, independent Verifier Sessions,
TODO completion and resource release remain covered by the original source audits
documented in [progress](progress.md). Rendering and media validation do not replace
those audits. BEHAVIOR task success, a zero-tool-error workflow and custom-role
acceptance remain separate work until their own actual records pass the required
checks. New renders retain cumulative tool-error counts and four-second holds at
actual failed calls; the video validator compares those counts with the original
event journal.
