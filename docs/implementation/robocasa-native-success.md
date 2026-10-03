# Native RoboCasa CloseDrawer success

Run `043520a2-1e9a-4b18-af1b-821a84a7ba7a` completes the original RoboCasa
`CloseDrawer` task through the production EDH Console, independent Qwen Planner
and Verifier, identified GR00T service and native ActionGate worker. Its 598
original events contain zero tool errors. Session
`69e9191c-5cac-490c-ac8b-1d1d54b9c0ef` closes normally with resources released.

## Sources and configuration

The frozen EDH source is `9b32f3795b0f782eab2db4ac3b07103488c13b2f`.
All 765 archived files match their executing source bytes. The source archive has
SHA-256 `37bdc4621a60242c31e12276908e368ecc50abc86cf67964555a8f8622a25bbc`.
RoboCasa is `1.0.1@4f8a2980def75a55dff96b990745b83540425f09`, robosuite is
`1.5.2@5ce6643f3092639d08f7b0f90ed1c6a84f50552c`, and MuJoCo is `3.3.1`.
The simulator and learned service retain separate Python environments.

The actual admitted profile selects PandaOmron, seed zero, `split: null`, target
objects, three fixed 512×512 cameras and the declared layout/style pairs
`[[1,1],[2,2],[4,4],[6,9],[7,10]]`. The allocated scene is layout 7, style 10.
Camera randomization and generative textures are disabled. The environment's
instruction is `Close the right drawer.`; Planner passes it verbatim to execution.
The sole formal criterion remains the SDK's original `task_success`, with an
admitted maximum of 1,050 controls and 1,200 wall-clock seconds.

Qwen3.8-27B supplies two independent role contexts. The actual policy is
`nvidia/GR00T-N1.6-3B@d0814e7ecb19202e7c8468b46098b0b7ef3a6d61`, using the
pinned official implementation `9b37aa1ce69c73c6d165233fa88128283bba4508`.
Its checkpoint digest is
`ee3482f3234fd88e579ed4767553525e989bb6bc73a42083b30155f096041d42`.
The original 16-action model horizon supplies eight actions per inference through
the documented PandaOmron transform. Device selection belongs to configuration.

## Actual task and agent workflow

Planner captures the native scene, commits plan version 1, selects `close_drawer`
and starts execution `5283fcaf-f171-4dc2-a079-f7368a2bab9e`. Five bounded running
reviews deliver current three-camera evidence to that same Planner context.
Explicit `execution.query` receipts with `completeTurn: true` conclude observation
turns and allow subsequent host follow-ups. No formal Verifier exists during
running execution.

The worker commits 382 controls and 48 identified learned requests before its
confirmed `episode_terminated` boundary
`a61fdb3c-794d-4032-af20-7922f3cf5d84`, at generation 1. The receipt history
reports 9,550 MuJoCo internal steps, derived from native simulator time and model
timestep. This source has no separate native physics-counter audit; the report
preserves that limit.

A fresh independent Verifier checks the current original criterion and submits
passed verdict `b2acd64a-5d5f-4dc6-9b70-6cecf603521d` with `task_success=true`.
Planner consumes that result, commits plan version 2 with the accepted verdict,
completes all seven TODOs and calls `tasks.finish`. The formal tool receipt at
sequence 562 precedes its native result at 563 and completed turn at 565.
The task-finish receipt at 593 precedes native result 594 and completed turn 595.
Both assignments retire, with zero post-terminal model steps. This successful
first attempt contains no recovery chain or new SKILL.

## Record and video checks

The production audit verifies 390 immutable sensor samples, all 382 action
receipts, 48 original inference requests and responses, checkpoint/source identity,
formal scope, completed TODOs and native role completion. Each of the three
worker-local camera videos fully decodes 382 frames with exact recorded
presentation timestamps. The original journal remains unchanged during reading.

The synchronized `robocasa-qwen-gr00t-close-drawer-success.mp4` includes all three
recorded views, 15 original model-analysis events, tools, plan and TODO updates,
native ending, formal verdict and task completion. Its 975 frames encode
81.250 seconds at 12 FPS, 1920×1080 H.264. Recorded wall time plays at 12× speed
with labeled reading holds. Source hashes, every rendered text boundary and full
video decoding pass. MP4 SHA-256:
`38a579ea60fcc4ed1c96b97837aa04d2fd13aefaaaf88aae3f68573e9ee66d88`.

Normal Session close precedes service shutdown. OS inspection confirms absence of
the owned Console, policy and acceptance-driver processes and process groups,
refused loopback connections on both service ports and an absent writer lock.
Shared model and other experiment services remain independent.

Original private evidence is retained under
`.local/work/v1-robocasa-close-drawer-20261003-01/`. The closed evidence archive
matches on the local and deployment hosts, with SHA-256
`70382b9f1118d795d97ad194bef867544e36a4478015e2f370fb3c433deca28a`.
This accepts the selected
CloseDrawer configuration. OpenCabinet outcomes, other task/seed combinations,
and a second task on an ended Casa scene retain their own actual acceptance
requirements. Retained-scene recovery has the separate native acceptance below.
See [release validation](release-validation.md)
and [recorded demos](recorded-demos.md) for reproduction.

## Retained-scene retry success

Run `7e3f76b6-48e2-40eb-b218-49ba404362bc` uses frozen EDH
`7adaa4368db4ce2f594ecb95e86f794c071ad64d`; all 769 executing files match its
source archive. The SDK, checkpoint, native seed-zero scene selection and original
`task_success` criterion match the binding above. The admitted budget is 1,050
controls and 1,800 wall-clock seconds. Qwen uses physical GPU 2, GR00T GPU 3,
and the MuJoCo EGL renderer GPU 4.

The admitted operator profile requests an initial stopped progress assessment.
Planner explicitly ends the first attempt at 84 controls and 11 learned inferences;
the fresh independent Verifier returns `task_success=false`. Planner consumes that
verdict, records the failed attempt and authorizes continuation in the retained
scene. The second execution performs 306 controls and 39 learned inferences,
reaches its original native episode end and obtains a new independent passed
verdict. The scene clock remains the same across both executions. The 9,750 reported
physics steps derive from native elapsed time and model timestep.

All 685 original events, 399 immutable sensor samples, 390 action receipts and 50
identified learned requests pass the production audit. Each attempt retains three
fully decoded native videos with 84 or 306 frames and exact timestamps. The failed
and passed Verifiers have distinct contexts; Planner consumes both verdicts and
completes all thirteen TODOs. No formal verification occurs during running
execution, no tool errors or post-terminal model steps occur, and one recovery
chain resolves without an Evolver assignment or new SKILL.

Session `60fa1fbf-870e-47b1-b6c6-20cefcdb1775` closes normally with resources
released. Recorded owned worker, Console, policy and driver PIDs and the service
group are absent; both listeners refuse connections and writer ownership ends.
Original evidence is retained under
`.local/work/v1-robocasa-retry-terminal-20261003-02/`. Its closed archive SHA-256 is
`cd025c9c0c071d835478bf49a5ea22810c780722b3c570aac7d9d68d6958655f`.
This run accepts the selected native recovery workflow.

`robocasa-qwen-gr00t-retry-success.mp4` contains three native views, 29 actual
model-analysis outputs, plan/TODO updates, the failed assessment, explicit retry,
successful independent verification and task completion. Its 1,298 frames encode
108.167 seconds at 12 FPS and 1920×1080. Complete decoding, original source hashes
and every rendered text boundary pass. MP4 SHA-256:
`72c4ef6a446e837f3780b5485c0e81fe74dfcc6d2ce0cafc127564d3d7789ef0`.
