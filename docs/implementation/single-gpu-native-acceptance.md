# Single-GPU native integration

Local date: 2026-10-06. Original service timestamps: 2026-10-07 UTC.

## Source and deployment

The committed runtime is `e142f15e808561768cf9e4d8dba3d727858f1c2e`.
It runs from an independent clean worktree on `jd_B300`; the existing modified
remote checkout remains preserved. The local checkout received the current
`origin/main` through a fast-forward-only pull. Native dependencies, datasets,
checkpoints and all generated records retain their existing isolated locations.

Current EDH work may use at most one physical GPU selected from GPUs 2–4.
This deployment selects physical GPU 2, UUID
`GPU-aa3aa801-a799-81e2-996e-e949b2405898`, for all model, policy, physics and
graphics work. The active NVIDIA XML identifies Qwen, OpenPI and simulator
contexts on that same UUID, including the simulator's graphics context.
Device identifiers remain deployment settings; framework modules do not require
this server or GPU model.

| Binding | Actual configuration |
| --- | --- |
| Upper model | Qwen3.8-27B, local vLLM Chat Completions, independent Planner/Verifier contexts |
| Execution | Native OpenPI/JAX Pi0.5 through the EDH JSON WebSocket bridge |
| Checkpoint | `RoboDojo-sim-arx_x5-joint-0/59999`, verified 18-file inventory |
| Checkpoint SHA-256 | `fbf1abbda5863ebe4193754a9db16a1637d9127f042052b828e2aaeee7cc5dc7` |
| Environment | Native RoboDojo `general_pickup`, evaluation seed 0, headless |
| Embodiment | Dual ARX X5, absolute 14-channel qpos targets, continuous grippers |
| Original instruction | Pick up the mint green scissors by 10 cm. |
| Attempt budget | 32 controls; retry preserves the native scene and original criterion |
| Console | Trace-only; model observations retain their authorized image attachments |

The Qwen launcher checks the private IPC directory's absolute path and 60-byte
limit before loading weights. The actual server starts using the configured
short directory and returns its configured model identity.

## Real OpenPI connection reuse

The inference-only acceptance consumes an unchanged original native RGB/state
request with SHA-256
`7f83a1108f607e8f249ef15c6cf111aec2457a8b936cd637eba8d0ce9e357a45`.
The first client performs inference 0; a newly connected second client performs
inference 1; the first client performs inference 2; a replacement connection
performs inference 3. These are actual checkpoint inferences with zero device
controls. The warm native responses take approximately 0.185–0.200 seconds;
the first response includes JAX compilation.

Each request has a distinct canonical UUID. The production client/audit checks
the original instruction hash, float32 state hash, three decoded RGB hashes,
checkpoint/source identity and exact action conversion. The original source
file remains unchanged. A JSON bridge subsequently connects at native counter
4 and the task below uses identified native indices 4–7. The complete native
log retains all eight inferences.

See the [policy identity protocol](robodojo-backend.md#learned-policy-service-identity)
and its actual inference checker.

## Successful retained-scene retry

Session: `b4c218de-5185-43bb-80c8-225b701c7979`.
Run: `551fa79d-ac67-43e3-a12b-63a13a0200a8`.

| Boundary | Controls | Native physics steps | Formal result |
| --- | --- | --- | --- |
| First attempt, confirmed `budget_exhausted` | 32 | 320 | Fresh Verifier: `failed` |
| Planner-authorized retry, confirmed `episode_terminated` | 29 | 290 | Separate fresh Verifier: `passed` |

Planner observes the retained scene, accepts recovery, updates its durable plan,
selects the original goal and starts the next attempt. The native success check
remains unchanged. Planner commits the final matching verdict, completes all
ten TODOs and calls `tasks.finish`. The receipt precedes native turn completion;
all three assignments retire and normal Session close releases the environment.
Learning remains disabled, with zero Evolver assignments or published SKILLs.

The production full-run audit passes:

- 308 original events, three independent upper Sessions and zero tool errors.
- 61 original action receipts, four identified learned requests and 610 native
  physics steps, checked against original simulator source records.
- 128 immutable sensor samples and 61 recorded rollout frames per camera.
- Six native camera videos, with exact frame counts and zero timestamp error.
- One accepted recovery chain, two scoped formal verdicts, completed TODOs,
  terminal-tool receipts and zero model steps after terminal tools.

Original exported run SHA-256:
`e4f0acee8e3134bb1e748ae185ba01e30c375e574c3f38b2a5e8b224fc719852`.
Original exported event SHA-256:
`6f043ce2e4a053e9c39164e84929a0acdd8ff23fcb17c8ddb8de5e89756a1c28`.

## Recorded workflow video

`robodojo-single-gpu-retry-success.mp4` combines the three original native
camera views with timestamp-bound Agent output, tool receipts, plan/TODO state,
execution counters and the failed/passed formal verdicts. It retains 19 actual
model-analysis events, 61 rollout frames and one initial observation per camera.
Wall-time compression and reading holds are labeled in the recording.

The composite is H.264, `yuv420p`, 1920 × 1080 at 12 FPS, with 1,172 frames and
a duration of 97.666667 seconds. Source-integrity checks, full FFmpeg decoding,
recorded failure-count comparison and every-frame text bounds pass.
MP4 SHA-256:
`1c7c7fa8c72fcd86ac5c765f930c203ae8186571ef6f96819020f02b939cebc2`.
The video, rendering report and validation report are retained together under
`.local/work/v1-20261006-single-gpu/`. Rendering does not run an additional task.

## Failure capture and resource ownership

The actual admission check selects an absent private recording directory.
The native worker fails its directory preflight before allocating a simulator.
Session `93349d3f-45df-43a2-8204-8f863d7af90d` records an admission error and
unknown resources. The HTTP acceptance driver resolves its own request identity,
retains the original `FileNotFoundError`, closes that Session, confirms released
resources and exits with code 1. No task is admitted.

The deadline check starts a fresh native environment, submits a real task and
uses a one-millisecond acceptance deadline. Run
`c761548f-5399-49e9-90ae-44ad2d207dbe` retains its active pre-close event prefix,
then its final 11-event cancelled history and retired assignment. The driver
retains the original deadline error, releases the Session and exits with code 1.
This checks failure capture and cancellation; it claims no task success.

A separate actual conflicting request during the successful run returns HTTP
409 and exits unsuccessfully. Its request UUID differs from the active Session's
UUID; that existing Session remains active with held resources. Cleanup never
closes another invocation's Session.

[The failure reader](../../scripts/check-live-acceptance-cleanup.mjs) validates
the actual admission/deadline exports and unsuccessful process exits.

## Shutdown and retained records

After all Sessions release resources and Qwen reports zero running/waiting
requests, the owned Console, JSON bridge, native OpenPI and Qwen process groups
receive shutdown signals and exit. The Console writer lock is removed. Native
worker/simulator ownership also ends, and no EDH GPU process remains. Unrelated
workloads retain their original ownership.

Private evidence is retained under `.local/work/v1-20261006-single-gpu/` on both
the local checkout and GPU host. The host additionally retains original native
episode/action records, immutable attachments and the complete Console journal.
`task-audit.json`, `reconnection/acceptance.json`, `admission-cleanup.json`,
`timeout-cleanup.json`, `conflict-acceptance.json`, `gpu-active.json` and
`services-closed.json` identify the accepted boundaries. Generated records remain
outside Git.

## Remaining acceptance

The observed final Planner model step reports 8,192 completion tokens while
returning a short reasoning block and one valid empty-argument completion call.
It consumes about 208 seconds. The task still has zero tool errors and completes
its native terminal workflow. A separate short-context native model diagnostic
returns the completion call in 64 tokens and approximately 0.924 seconds.
Full-context generation/transport investigation remains required; these records
do not establish the cause of the long step.

This configuration verifies connection reuse, task recovery and resource
ownership on one GPU. Original `build_tower` stages, BEHAVIOR task success,
additional multi-goal/provider configurations and the complete installed release
matrix retain their gates in the [v1 register](v1-delivery.md). Evolver remains
paused and SceneState remains deferred.
