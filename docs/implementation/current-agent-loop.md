# Current upper Agent loop and memory

The default execution path uses independent Planner and Verifier DSH Sessions.
Local Qwen supplies the upper roles and a learned checkpoint supplies actions.
Cloud OpenAI-compatible and Responses endpoints remain configurable model bindings.
Recovery learning is disabled in current live Teams. SceneState implementation is
deferred; existing evidence and experience retrieval remain available.

## System prompt composition

Each assignment receives its selected `ROLE.md` instructions, deployment additions,
the responsibility-bound [numbered workflow](prompt-workflow.md), the Team source
digest, explicit-context rules and responsibility-specific completion instructions.
Tool definitions describe their schemas and authority. Native DSH assembles the
model prompt and owns model requests, tool dispatch, cancellation and context
management. No role receives another role's conversation implicitly.

| Role                      | Source                                                                             | Required behavior                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planner                   | [built-in instructions](../../harness/agent-runtime/agents/roles/planner/ROLE.md)  | Observe images, maintain the plan/TODOs, select goals, start policy execution, inspect formal evidence and explicitly decide retry/replan/resume.                                   |
| RoboTwin Planner          | [native task instructions](../../examples/roles/robotwin-planner.md)               | Preserve the checkpoint's task instruction and fourteen-channel action interface; retain the scene across attempts and follow the reported retry budget.                            |
| Grounded RoboTwin Planner | [perception instructions](../../examples/roles/robotwin-perception-planner.md)     | Segment an object, estimate depth using its matching mask and source image, retain numerical evidence references and distinguish prediction accuracy from verified task conditions. |
| Verifier                  | [built-in instructions](../../harness/agent-runtime/agents/roles/verifier/ROLE.md) | Start after confirmed eligible execution end, inspect authorized images, check the original criterion, submit a passed/failed/unknown verdict and retire.                           |

The completion instructions come from
[TeamSessions](../../harness/agent-runtime/communication/src/sessions.ts).
Native RoboCasa uses the [RoboCasa Planner](../../examples/roles/robocasa-planner.md),
or the [SAM/metric Planner](../../examples/roles/robocasa-sam-planner.md) when
segmentation and native region measurements are configured. BEHAVIOR's
[live Team](../../examples/teams/behavior-live.yaml) binds the built-in Planner
and Verifier with recovery learning disabled. Each deployment selects the role
instructions and model binding explicitly.
Decision owners finish with `tasks.finish` or `tasks.abandon`; Verifier finishes
with `verification.submit`; custom delegated work uses `agent.report`.
With context management enabled, scoped host state includes the current goal,
execution, retry budget and learning setting. It contains no shared conversations
or automatically granted sensor evidence.

## Task and retry sequence

1. Planner captures images and reads the admitted task and available checks.
2. Planner writes the complete plan and TODOs. Goal selection waits for the plan
   receipt; execution waits for the selection receipt.
3. `execution.start` starts one bounded policy job. ActionGate controls actual
   action admission between policy inference and the simulator/device.
4. Planner finishes its response while the job runs. A confirmed ordinary pause
   permits an explicit Planner resume within the remaining cumulative budget.
5. `policy_stop`, `episode_terminated` or `budget_exhausted`, with confirmed device
   stopping, creates one fresh independent Verifier. Running frames do not trigger it.
6. Verifier checks and submits the admitted criterion. Its receipt and authorized
   stopped-boundary evidence reach Planner; the Verifier turn completes and retires.
7. After failure, Planner diagnoses supported facts and reads `planning.read.retry`.
   `tasks.retry` requires the current failed verdict, confirmed ended execution,
   a factual `attemptSummary` and nonempty proposed `changes`.
8. An accepted retry creates a new attempt identity without resetting the environment.
   Planner awaits its receipt, captures the retained scene, updates plan/TODOs and
   starts the new attempt in a subsequent model step. Each goal permits three
   started attempts; its admitted control and wall-time budgets apply per attempt.
9. Formal final-goal success permits plan/TODO completion and `tasks.finish`.
   Exhausted unsuccessful attempts require an explicit failed outcome. Unknown
   evidence permits clarification or an explicit unknown outcome.

The recovery journal continues to link failed and successful attempts while learning
is disabled. No Evolver assignment or new SKILL is created by the live workflow.
Cancellation and backend errors retain their distinct outcomes and do not establish
task success. The implementation is
[UpperRun](../../apps/server/src/application.ts); actual recovery acceptance is
recorded separately in [progress](progress.md).

Run `686c9767-746a-430e-ba81-900eef3fb09c` verifies this sequence with native
Qwen, Pi0.5 and RoboTwin `adjust_bottle`: attempt one exhausts 64 controls and
receives a failed verdict; Planner retries in the retained scene; attempt two
terminates after 49 controls and receives a passed verdict from a different
Verifier. The 292-event audit confirms eight identified policy calls, all six
TODOs completed, zero tool errors, no Evolver/new SKILL and released resources.
All six worker-local camera videos pass full decoding and timestamp checks.
Its actual model-request audit verifies 344 tool schemas across 12 Planner and
four Verifier calls. Before a failed or unknown terminal call, Planner completes
factual assessment TODOs describing unmet conditions and remaining recovery.
Their completion describes finished assessment work and carries no success claim.

Native RoboCasa run `7dfb663e-debb-44fb-a4da-96be2b88e664` verifies the unsuccessful
branch: three failed formal results, two retained-scene retries, 192 GR00T controls,
all 13 assessment TODOs completed and accepted tasks.abandon with the failed outcome.
The original required goal persists in the plan. All four role assignments retire
and Session resources release. The 467-event source audit observes zero tool errors
and zero post-terminal model steps; 616 actual tool schemas pass wire inspection.

## Available memory

| Memory                              | Lifetime and access                                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native DSH conversation             | Independent per assignment; supports token metering, compaction, pruning and bounded image history.                                                            |
| Durable plan, TODOs and run journal | Persistent task records; current state is retrieved through scoped tools and operational context.                                                              |
| Images and other evidence           | Immutable references with assignment-specific grants, source time and task/attempt identity. Loading a SKILL does not grant its original evidence.             |
| SKILL library                       | Persistent across Sessions; `skills.search` returns keyword-matched metadata, and `skills.load` adds only selected bodies or sections to the caller's context. |
| Assignment files                    | Private versioned files with explicit communication when another role needs their contents.                                                                    |

There is no initialized, continuously updated scene graph in the current runtime.
Keyword retrieval has no embedding ranking. Existing SKILL retrieval continues while
new experience generation is paused.

## Grounded depth evidence

`perception.segment_objects` operates on one authorized camera attachment.
`perception.estimate_depth` requires its original observation and one matching SAM
mask. The host checks permissions, source-image identity, mask origin, dimensions
and service hashes before publishing the result.

Results contain meter-valued axial-depth median and p10/p90 spread, selected/valid
pixel counts, coverage, checkpoint/source provenance and an overlay reference.
Camera range requires deployment-provided intrinsics for that camera. The source
timestamp remains the capture time; processing a retained image does not refresh it.
Monocular prediction reports source-camera metric accuracy as unverified. Repeated
inference and valid pixels do not establish absolute-distance accuracy. Paired native
RGB-D/GT comparisons report raw errors without fitting a per-image scale.

`perception.measure_object` uses the same authorized source-image/SAM-mask pair
with an explicitly capable native backend. RoboCasa obtains RGB and metric depth
from the same stopped simulator state, checks the original image hash and applies
the native camera calibration. It returns axial-depth median/p10/p90, median camera
range, valid-pixel coverage and camera/world coordinates of the mean visible valid
surface points. This centroid describes the observed surface. It does not establish
the geometric center of an occluded object. Running execution, stale capture,
different camera/source images and another Session are rejected.

Actual Qwen run `0b6b7450-0bb9-483a-9ff4-2631d65530df` completes capture, SAM
segmentation and YOLO26 estimation through the production tools, reports a
0.5965579 m bottle axial-depth median with its accuracy limitation, and requests
user clarification before motion. It uses zero physical controls and releases its
Session with zero native tool errors. Its 18,202 selected mask pixels match SAM's
reported area, and the mask attachment digest matches the depth input. Five actual
Qwen requests contain 110 checked tool schemas. This validates the tool round;
it does not establish task success.

Actual RoboCasa Qwen run `e4c1038f-cb92-4664-a79e-6760aa2e5241` obtains a
source-bound native measurement before planning and executing GR00T. Its selected
region has 6,953 valid pixels, axial median 1.2825247 m, camera range 1.4129782 m
and visible-surface world centroid `[5.163526, -4.293053, 0.576546]` m.
Independent native checks verify stopped-state measurement, source identity and
unchanged simulator time; these measurements do not claim task success.

On two actual RoboCasa SAM regions, raw YOLO26 axial medians differ from native
RGB-D medians by approximately 0.373 m and 0.102 m. `validFraction = 1` describes
finite positive pixel coverage. Metric accuracy remains unverified for an arbitrary
source camera. Use native RGB-D measurements when the simulation requires measured
geometry; retain prediction provenance and accuracy limits for monocular estimates.

For RoboTwin, set `segmentationURL` and `depthURL` together in the deployment
configuration to select `robotwin-perception.yaml`. Optional
`depthIntrinsicsByCamera` contains deployment-owned calibration entries keyed by
camera attachment name. Ordinary `robotwin-live.yaml` remains available without
those perception providers.
