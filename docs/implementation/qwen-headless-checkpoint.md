# Local Qwen and headless learned execution — September 30, 2026

The current checkpoint verifies a real local Qwen Planner/Verifier task with
learned Pi0.5 controls, native task success, completed Planner TODOs, committed
terminal receipts, released Session resources and worker-local simulator videos.
Full v1, custom-role reporting, recovery and the RoboDojo `build_tower`
demonstration remain in the [delivery register](v1-delivery.md).

## Recorded task

Run `6610a9f4-29b8-499c-82ed-d81aab542e13` uses the original RoboTwin
`adjust_bottle` instruction: “Pick up the bottle on the table headup with the
correct arm.” The native scene is `demo_clean`, seed 0, bottle model 16,
orientation tag 0 and Aloha AgileX. The admitted budget is 400 controls and
3,600 seconds. Scene metadata records `ray_tracing_denoiser=none`; EDH applies
the renderer setting before native cameras are constructed.

Execution `fe6a7456-7d36-47c5-9c2f-486f2f72d2c9` records 116 controls,
eight identified Pi0.5 inference requests and 10,767 native physics steps. It
ends with `episode_terminated` and confirmed boundary
`f3883436-17ab-42e6-be5d-59f20fce1a98` at 18:57:40.030 UTC. Execution takes
532.435 seconds. ActionGate admits checkpoint-derived actions and prevents
remaining chunk actions after the acknowledged terminal boundary.

An independent Qwen Verifier checks the unchanged native `task_success=true`
criterion and submits passed verdict `06478829-49c3-49e0-b0c3-4c0330c6af2e`.
Planner completes the durable plan and all five native TODO items before
`tasks.finish`. User Session `9a752dfc-0c0e-4c3c-a1be-4f5bee136f55` closes with
`resources=released`. Planner Session `e912baaa-edae-428c-addd-334467183383` and
Verifier Session `03c8c526-684d-4665-940e-8c127b1341cf` have independent contexts.
This task contains no retry or Evolver and establishes no recovery-SKILL acceptance.

## Native role completion

Completion instructions follow the role's responsibility: decision owners use
`tasks.finish` or `tasks.abandon`; formal Verifiers use `verification.submit`;
delegated work uses structured `agent.report` results. Accepted completion tools
call native DSH `ToolExecution.concludeTurn`. DSH commits the receipt and ends the
current turn before normal assignment retirement disposes its context.
Missing-context reports conclude their turn and retain the assignment for explicit
caller context. Task success checks the decision owner's actual TODO statuses.

The complete 238-event trace passes the native audit with
`--require-clean-role-completion`: zero native tool errors, zero model steps after
terminal tools in the same turn, and five completed TODOs. Verifier submission,
receipt and completed turn occur at sequences 201, 202 and 204. Planner finish,
receipt and completed turn occur at sequences 233, 234 and 235. Plan writing,
goal selection and execution admission each await the preceding tool's receipt.
The running browser displays `Execution running.` and records only `/logo.png`
as an image, with zero camera-resource requests.

## Actual models and deployment

Qwen `Qwen/Qwen3.8-27B` revision
`1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0` supplies both upper roles. All
18 checkpoint shards match official SHA-256 and byte lengths. Its isolated
environment uses vLLM 0.30.0, PyTorch 2.13.0 and Transformers 5.17.0, BF16,
131,072 context tokens, `qwen3_xml` tools and `qwen3` reasoning parsing.
Native DSH preserves actual provider-returned reasoning through image/tool rounds.
See [model configuration](model-configuration.md) and
[Qwen deployment](../../examples/models/README.md).

The separate Pi0.5 service uses LeRobot 0.6.1 source
`7e241bd630a3719a56157a497ce5d08f244784f1` and checkpoint revision
`e49e2ab6c11f07511573b67261bd129e88d0a416`. Eager inference is explicitly selected
with `--no-compile-model`. Original requests, model responses, normalization,
14-channel native targets and generation-bound ActionReceipts pass the audit.
All eight inference requests have actual executed prefixes.

The Agent server, vLLM, policy and native worker run on `jd_B300`; model image
traffic stays on that host. The browser uses a same-port loopback forward on 4326.
GPU selection, environments, checkpoints and endpoints are deployment settings.
Data remains in `data/`, weights in `checkpoints/`. This run makes no GPT requests.

## Recordings and retained evidence

Headless SAPIEN records three native cameras locally. Each MP4 contains 419 actual
rollout frames. The frame journal binds execution, scope, policy request, segment,
native step and simulator time. Complete decoding passes; decoded timestamps
match the journal with zero measured error. Rollout frames never enter the
console stream. Explicit captures and stopped-boundary images remain available
to authorized model tools.

The composite MP4 includes initial observations, native rollout cameras, original
Agent reasoning/output, tools, plan, TODOs, counters and formal verdict. It has
764 frames at 10 fps, 1920 × 1080 resolution and 76.4 seconds duration. The
630.241-second recorded task timeline uses 16× wall-time playback and 18 labeled
reading holds. Fourteen actual model-output events contain returned reasoning.
Every rendered frame passes text bounds checks; all 217 source-text pages across
72 regions and complete composite decoding pass. No additional reasoning is inferred.

Private evidence is retained in `.local/work/upper-closure-20260930/final/`:

- `replay/`: 238 original events, run configuration, six authorized capture images,
  native videos/journals, policy identity and SHA-256 records.
- `source-audit.json`: real task, independent contexts, boundary, original criterion,
  learned requests, control receipts, native videos and clean role completion.
- `qwen-pi05-task.mp4`, its render report and `media-validation.json`: composite
  demonstration, full decoding, source-text bounds, font identity and media hash.
- `sensor-samples-6610a9f4-29b8-499c-82ed-d81aab542e13.json`, `policy-requests/`,
  service logs, `completed.json`, `closed.json` and browser proofs: actual sources.
- `source-snapshot/`: 24 tested runtime/configuration files, hashes and working-source
  patch. The source identity is `modified` at
  `c4e24cfb4ba16e4062b5b063f917eb8e3110597a`; preserved provider edits receive no
  additional acceptance from this task.
- `source-integrity.json`: snapshot hashes, the auditor hash and correspondence to
  current owned changes. Local policy-server diagnostic edits remain pending;
  policy-service acceptance refers to its recorded source.

TypeScript checking, formatting, Python compilation/base imports, document links,
SVG XML and pinned DSH provenance pass. The aggregate suite has no new complete
passing result. Real task acceptance uses the actual model, checkpoint, simulator,
controls and unchanged native formal check above.

## Continuation boundary

The current trace-review milestone is complete. Owned simulator, Agent server,
Pi0.5 and vLLM resources are released; recorded MP4 playback requires none of them.
Other GPU workloads are preserved. Read current files and Git status before editing;
existing BEHAVIOR, RoboCasa/SAM, YOLO and RoboDojo OpenPI work remains uncommitted.
The GPU checkout retains modified tested source and private recordings. Inspect
those changes before updating it.

Continue actual custom-role report/evidence transfer and genuine multi-goal recovery
acceptance. RoboDojo learned-policy dependency consistency and ARX X5 inference
remain required before its hybrid mode or `build_tower` success can be certified.
Continuously updated scene memory and complete four-provider acceptance remain
in the delivery register. No additional development task is scheduled; the weekly
DSH monitor performs read-only release discovery and assessment.
