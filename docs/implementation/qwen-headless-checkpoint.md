# Local Qwen and headless learned execution — September 30, 2026

Development is stopped at the requested minimal goal: a real local Qwen
Planner/Verifier task with learned Pi0.5 controls, native success, released Session
resources, a trace-only browser console and worker-local simulator recordings.
Complete v1 acceptance and the RoboDojo `build_tower` demonstration remain pending.

## Recorded task

Run `7c158abe-a195-4575-b8bf-a58569da6127` uses the original RoboTwin
`adjust_bottle` instruction: “Pick up the bottle on the table headup with the
correct arm.” Scene configuration is `demo_clean`, seed 0, bottle model 16,
orientation tag 0 and Aloha AgileX. The admitted budget is 400 controls and
3,600 seconds. Planner observes the native cameras, writes a complete plan and
TODO list, selects the original goal and starts the learned policy job.

Execution `a9ebc34a-5c43-4027-9e72-ea90ae8420bc` records 107 admitted controls,
seven actual Pi0.5 inference requests and 10,642 native physics steps. It ends
with `episode_terminated` and confirmed boundary
`b988a0f2-1205-4075-b261-150de92eef1c` at 17:21:49.744 UTC. Execution takes
524.620 seconds of wall time. ActionGate prevents remaining chunk actions after
the acknowledged terminal boundary.

An independent Qwen Verifier starts after that boundary. The unchanged native
`task_success` check returns true; verdict
`ee6bfff8-e3fe-43a7-b1a8-f01e49085ccf` is `passed`. Planner updates the durable
goal to `done` and calls `tasks.finish`. User Session
`476a0b0a-e3fe-433b-a113-a0519583fb45` closes with `resources=released`.
Planner Session `ec056f78-eaec-42f0-8f3a-3eb1f3dea4a9` and Verifier Session
`e8f773e5-b380-4b2b-a309-4c3c3bdaef95` have independent contexts. This task has
no retry or Evolver and establishes no recovery-SKILL acceptance.

The original trace includes a rejected supplementary `agent.report` result and
a remaining `in_progress` Planner TODO. Formal verification and task completion
are recorded independently. Supplementary reports and terminal TODO completion
require a fresh real task acceptance before the upper workflow is certified complete.

## Actual models and isolated deployment

Qwen `Qwen/Qwen3.8-27B` revision
`1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0` supplies both upper roles. All
18 checkpoint shards match official SHA-256 and byte lengths. Its isolated
environment uses vLLM 0.30.0, PyTorch 2.13.0 and Transformers 5.17.0, BF16,
131,072 context tokens, `qwen3_xml` tools and `qwen3` reasoning parsing. The
native DSH model adapter retains actual reasoning through image/tool rounds.
See [model configuration](model-configuration.md) and
[Qwen deployment](../../examples/models/README.md).

The separate Pi0.5 service uses pinned LeRobot 0.6.1 source
`7e241bd630a3719a56157a497ce5d08f244784f1` and checkpoint revision
`e49e2ab6c11f07511573b67261bd129e88d0a416`. The service selects
`--no-compile-model` and records that setting with its pinned checkpoint identity.
Seven actual native responses match their original requests and executed receipts;
there are no uncommitted inference requests. Normalization, original arm targets,
14-channel action layout and generation checks remain validated by the native audit.

The Agent server, vLLM and native worker run on `jd_B300`; image/tool traffic
stays on that host. The browser connects through a same-port loopback forward
on 4326. GPU selection, isolated environment paths, checkpoint locations, process
sockets and policy URLs are deployment settings. Datasets remain in `data/` and
weights in `checkpoints/`. No GPT execution or planning request is used by this run.

## Console and recordings

The actual browser displays role assignments, model reasoning returned by the
provider, tools, plan/TODO status, control counters, formal verification and
recovery state. Its only image is the project logo; it requests zero camera assets.
Running worker publications retain immutable metadata evidence and actual action
receipts without camera payloads. Explicit observation tools and confirmed
boundary captures continue supplying complete authorized image groups to models.

Headless SAPIEN records three native cameras locally. Each camera MP4 has 407
actual frames. The frame journal identifies execution, scope, policy request,
ActionSegment, observation, native step and simulator time. All three MP4 files
pass complete FFmpeg decoding; every decoded timestamp matches the journal with
zero measured error. No rollout frames are transmitted through the console stream.

The composite MP4 contains the initial three-camera observation, all recorded
rollout sources, original Agent output, plans, tools, counters and formal verdict.
It has 730 frames at 10 fps, 1920 × 1080 resolution and 73.0 seconds duration.
The original task trace covers 606.658 seconds; playback compresses wall time
at 16× with 17 labeled reading holds. Thirteen actual model-output events contain
provider-returned reasoning. No additional reasoning is inferred. Full composite
decoding and all 166 source-text pages across 59 text regions pass. Every rendered
frame passes text boundary checks.

## Evidence and source checks

Private evidence is retained in `.local/work/qwen-policy-20260930/`:

- `final-replay/`: 220 original events, task configuration, six authorized capture
  images, identified policy log, original native videos/journals and SHA-256 records.
- `qwen-pi05-task.mp4` and its JSON render report: the composite demonstration.
- `final-source-audit.json`: independent upper contexts, scope, boundary, criterion,
  Planner completion, seven learned requests, 107 receipts and all native videos.
- `media-validation.json`: full composite decoding, frame count, dimensions,
  source-text pagination/bounds, font identity and video hash.
- `sensor-samples-7c158abe-a195-4575-b8bf-a58569da6127.json`, `policy-requests/`,
  `policy-eager.log`, `model.log`, `completed.json` and `closed.json`: actual sources.
- `source-snapshot/`: 20 tested source/configuration files, hashes, revision/status
  and the actual working-source patch. Source identity is `modified` at
  `c4e24cfb4ba16e4062b5b063f917eb8e3110597a`; preserved provider edits are not
  implicitly accepted by this task.

TypeScript checking, Python compilation/base imports, workspace/document links,
SVG XML, formatting and pinned DSH provenance pass. The full aggregate suite has
no new complete passing result. Real task acceptance uses the native model,
learned checkpoint, simulator, recorded controls and formal check above.

## Continuation boundary

Read current files and Git status before editing; preserve existing uncommitted
BEHAVIOR, RoboCasa/SAM, YOLO and RoboDojo OpenPI work. The
[provider handoff](pause-2026-09-30.md) retains their exact acceptance boundaries.
The primary GPU checkout retains its tested modified source and private recordings;
update it only after inspecting those changes.

The owned simulator worker, Agent server, Pi0.5 service and vLLM process have
exited. Their ports 4326, 8004 and 18080 are closed; the local forwarding process
has exited. Other GPU workloads remain present. Shutdown evidence is retained in
`shutdown-check.txt`. No model or simulator is started for recorded MP4 playback.

The next upper-workflow acceptance must complete structured `agent.report`
results and terminal TODO state on a real task. RoboDojo learned-policy
dependency consistency and ARX X5 inference remain required before its hybrid
mode or `build_tower` can be claimed successful. Recovery/SKILL transfer,
continuously updated scene memory and all four-provider v1 acceptance remain
in [the delivery register](v1-delivery.md). No additional task is scheduled.
