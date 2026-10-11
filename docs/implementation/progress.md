# Implementation progress

Updated: 2026-10-11 · Spec v1.129 · v1 release acceptance in progress.

## Active work and constraints

Complete implementation and CPU validation of the agreed framework, including
the GPU-facing code paths that can be exercised without model or simulator
allocation. Keep module responsibilities and source entry points explicit.

- GPU allocation, model inference and simulator execution remain stopped during
  this phase. Future native work on `jd_B300` may use at most one physical GPU
  from devices 2–4, with all EDH components on that selected device.
- Use actual source, installed processors, original records and production
  services for acceptance. Keep independent agent contexts, Planner decision
  ownership, fresh post-execution Verifiers and the sole ActionGate.
- Evolver development remains paused. SceneState implementation remains deferred.
  Existing selective SKILL retrieval and source inspection remain available.
- Preserve isolated environments, canonical server changes, original evidence,
  `data/` for datasets and `checkpoints/` for model weights.

## Implementation and verified behavior

| Component | Verified scope | Implementation and evidence |
| --- | --- | --- |
| Agent loop and model routes | Absorbed native DSH loop, scoped tools, independent assignments, Qwen/cloud routes and original recovery journals | [Current Agent loop](current-agent-loop.md), [DSH integration](dsh-integration.md) |
| Teams and communication | Configured custom roles, explicit briefs, independent reports and acknowledgements; native custom-role RoboTwin recovery succeeds | [Role contexts](role-context-acceptance.md), [source map](../development/code-map.md) |
| Plans, retries and verification | Owner-only goal decisions, durable TODOs, retained-scene retry and fresh formal verification after confirmed eligible execution end | [Multi-goal runtime](multi-goal-runtime.md), [verification boundaries](native-tool-boundaries.md) |
| Policy inputs and checkpoint startup | Four-provider original observation admission; GR00T metadata, prepared-tensor and actual checkpoint-decoded action admission; real saved LeRobot processors; actual OpenPI model transforms, normalization and checkpoint identity | [CPU validation](cpu-release-validation.md), [checkpoint bindings](checkpoint-bindings.md) |
| Policy transport and action execution | Real CPU WebSocket/pipe/thread/process ownership; action schema/range/identity admission; ActionGate and confirmed device boundaries | [CPU validation](cpu-release-validation.md), [execution module](../../harness/physical-runtime/src/physical_harness/execution/README.md) |
| RoboTwin | Native Qwen/Pi0.5 retry success, custom-role execution and two packaged Desktop tasks with released resources | [v1 delivery](v1-delivery.md), [recorded demos](recorded-demos.md) |
| RoboCasa | Native Qwen/GR00T CloseDrawer success and retained-scene recovery; source-bound RGB-D measurement | [v1 delivery](v1-delivery.md), [recorded demos](recorded-demos.md) |
| RoboDojo | Native Qwen/Pi0.5 task success, retry and zero-action same-Session terminal verification | [Single-GPU acceptance](single-gpu-native-acceptance.md), [v1 delivery](v1-delivery.md) |
| BEHAVIOR-1K | Actual R1Pro controls, independent failed task verdicts, calibrated RGB-D and active observation | [v1 delivery](v1-delivery.md), [BEHAVIOR module](../../harness/physical-runtime/src/physical_harness/environments/behavior/README.md) |
| Perception | Real SAM3.1/YOLO26 calls, authorized image delivery, RGB-D geometry and R1Pro view controls | [Capability map](features.md), [source map](../development/code-map.md) |
| Console and launcher | Compatible Session selectors, trace/TODO/tool/role status, task history, packaged native submission and confirmed shutdown | [Native workspace](native-workspace.md), [Desktop launcher](../../apps/desktop/README.md) |
| Persistence and memory | Scoped history, record/image retention, compaction, source-bound audit inspection and on-demand SKILL sections | [Capability map](features.md), [source map](../development/code-map.md) |

Each native result belongs to its recorded source/configuration and original
task. CPU admission, preprocessing and historical-record checks establish their
documented boundaries. Loaded-model and complete native task acceptance retain
the release requirements below.

## Latest verified source changes

| Source checkpoint | Behavior and checks |
| --- | --- |
| `82cdc7e` | Actual source/installation/runtime CI `38173880914` passes all 58 CPU cases across five components. Downloaded artifacts independently admit fourteen distributions, thirteen imports, fifteen input digests and 53 exact-commit source comparisons. Uploaded/local inspection matches seven consolidated fields and the inspector's Git source identity. Production readers independently admit/reject all seven downloaded task-plan journals with unchanged digests and released writers. The seventeen configured task-plan outcomes match local macOS validation. GPU/model/simulator allocation remains zero. |
| Configured task-plan CPU checks | `check-task-plans-offline.mjs` uses the published RoboDojo Tower catalog and production TaskGoals/TaskPlans/LocalStore. Seventeen local cases verify configured templates, durable writes, owner/version/criterion/completion admission, six stored-read cases, reopening and compaction with released writers. Source CI requires its report and seven journals; the v3 consolidated inspector admits all five CPU components, configured goal identity, declared outcomes and exact Git source digests. These checks make no model calls or physical task claims. |
| `fba367c` | Actual source/installation/runtime CI `38173531465` passes all 41 CPU cases at the stored-plan implementation checkpoint. Complete source checks, fresh installation, original runtime diagnostics and consolidated exact-source admission pass with zero native allocation. |
| Stored task plans | `planning/plans.ts` owns the production `TaskPlans` service and exports `PlanOwner`/`PlanWrite`. Reads validate the canonical PlanDocument, requested task identity and stored version. Four original task histories pass thirteen accepted plan writes, nine execution requests, seventeen read-only templates and twenty-four original/invalid-derived read checks. Reopening and journal compaction preserve each final plan and version. Independent verification matches 68 source/input/journal digests and confirms 28 released writer paths. Original failed/passed verdicts and source records remain unchanged. Complete source checks pass; GPU/model/simulator allocation remains zero. |
| `4d9031b` | Complete source/installation/runtime CI run `38172377733` passes all 41 actual CPU cases: six device-owner, four Session-resource, sixteen Worker-transport and fifteen native DSH core-tool cases. Downloaded artifacts admit fourteen distributions, thirteen imports, seven original input digests and 42 exact-commit source comparisons. Uploaded/local inspection matches seven consolidated fields and the inspector's Git source identity. Separate local verification matches fourteen tool source identities, seven original receipt fields and eight request/schema fields with unchanged parent contract and released writers. All native allocations remain zero. |
| Core native tool definitions | `tools/core-definition.ts` owns definition assembly, provider timeout selection, DSH argument admission and turn conclusion; `core-output.ts` owns canonical JSON/image rendering. UpperRun supplies availability, scoped operations, role authority and assignment lifetime. Actual native DSH dispatch passes fifteen CPU file/clarification cases with preserved rejected-call journals and released writers/host. Seven original tasks retain 98 exact native results and 81 ordered images; sixteen original model requests retain 344 valid schemas. Source CI requires the additional `agent-tools` report and v2 consolidated admission of all four components. GPU/model/simulator allocation remains zero. |
| `3accbb6` | The production CPU artifact inspector passes in actual GitHub run `38162874886` after fresh installation, complete source checks and all 26 runtime cases. Downloaded artifacts independently match fourteen distributions, thirteen imports and 28 exact-commit source comparisons. The uploaded consolidated report matches seven result fields, all five input digests and the inspector's Git source digest; four local admission processes are confirmed released. Source, records and native allocation boundaries remain unchanged. |
| CPU runtime artifact admission | `check-cpu-runtime-evidence.py` compares complete actual pip/install records and all three runtime reports against the selected Git commit. Actual `50dd522` CI artifacts pass fourteen distributions, thirteen imports, 28 source comparisons and 26 runtime cases. Four actual CLI admission cases pass, preserving seven original input/source identities; different-source, optimized-Python and existing-output inputs reject before publication. Source CI invokes this production checker before uploading consolidated runtime evidence. |
| `50dd522` / `e3fef01` | Source CI binds Ubuntu 24.04, project Node.js 22.23.3/Python 3.11.17 and official stable Node.js 24 action commits. Actual installation/source/runtime run `38161986298` passes with fourteen distributions, thirteen imports and 26 device-owner/Session-resource/Worker-transport cases. Independent artifact inspection matches 28 exact-commit source comparisons, complete pip/download records and released-owner/Worker outcomes. The same 26 cases pass in a fresh macOS CPU environment. CUDA remains invisible and native allocations remain zero. |
| `7639e58` / `bd8cb9d` | The reusable packaged Desktop CPU diagnostic checks actual ASAR source identities, all configured component selections, renderer isolation, Chromium sandboxing and two owned-service shutdown cycles. macOS and Linux headless Wayland/Pixman workflows pass with four profiles, ten packaged files, zero browser errors and zero native allocations. Source checks and GitHub installation/source CI pass. |
| `bc9a79e` | CPU installation admission requires the complete initial package report and consistent supplemental provenance. Actual combined core/provider installation passes with twelve distributions and thirteen production imports; a genuine supplemental-only report rejects before output publication. Complete source checks and Python 3.11 GitHub installation/source CI pass. Conditional `typing_extensions` is pinned to the same 4.16.0 verified on Python 3.11/3.12. |
| `6b63217` / `8e63230` | Fresh macOS/Linux checkouts install the frozen pnpm dependencies and isolated Python package, pass complete source checks, four-provider readiness and four real ActionGate/thread/lock cases, and build Desktop artifacts. The macOS package passes all four compatible selections and two shutdown cycles with zero browser errors. Independent verification compares 857 tracked files per platform, 53/46 evidence files and five/eight released processes; Linux additionally confirms six released process groups. Nine source comparisons and thirteen matching import identities connect both platforms to Python 3.11 CI. All native allocations remain zero and canonical user changes remain unchanged. |
| `18b513b` | The native OpenPI producer reserves its unlistening socket before checkpoint/SDK startup and supplies it to the inherited SDK service after readiness. Forty-six actual CLI cases pass on both CPU platforms. Complete original four-provider checkpoint identities, four native digest/report failures with released ports and 87 unchanged actual SDK transform cases pass on clean Linux. Independent verification confirms 155 source/checkpoint/input comparisons, 54 process releases and 39 local implementation/manifest comparisons. Platform admission outcomes and SDK values remain unchanged, with preserved user changes and zero native allocations. |
| `930963c` | The OpenPI producer admits actual SDK model inputs and complete normalized/decoded actions; the JSON bridge admits action limits before preparation/request transmission. Actual installed SDK CPU checks pass 87 transform cases on twelve original-request/native-action derivatives, plus twelve original codec inputs, 76 numeric and 44 real CLI startup cases. Independent verification matches 193 source/input comparisons, 49 actual process releases and fifty local implementation/manifest comparisons. Original prepared values, source cleanliness and user changes remain unchanged, with CPU-only JAX and zero native allocations. |
| `a278547` | RoboTwin admits action count before input preparation/model calls and complete finite floating-point tensors before/after saved postprocessing. Actual LeRobot 0.6.1 CPU checks pass 34 saved-postprocessor cases on seven original selected-prefix derivatives, 21 input cases, 70 original Torch/controller cases and 76 four-provider numeric cases. Independent verification matches 472 source/input comparisons, five actual process releases and 35 local implementation/manifest comparisons. Original prepared/native values remain unchanged and CUDA stays uninitialized. |
| `2592b1d` | Both GR00T constructors bind normalized float32 model-output and decoded-group admission to the actual checkpoint processor. Installed SDK CPU checks pass 1,306 cases on 1,272 original-record-derived inputs, with exact SDK float32/controller equality and checkpoint padding. Clean Linux source additionally passes 1,330 controller and 76 numeric checks. Independent verification matches 2,706 source/input hashes, five actual process releases and 44 local production/manifest comparisons. CUDA stays uninitialized and canonical user changes remain unchanged. |
| `de9b7f2` | CPU campaign output admission resolves the existing parent through the actual filesystem, supports configured directory aliases and keeps output within this checkout's `.local/work`. Thirty-one components and 548 admission/process/wire/resource cases pass per platform on macOS and isolated Linux, with 469 source/input comparisons, twelve context-source comparisons and thirty-one released diagnostic process groups per platform. Three actual CLI output-admission cases also reject before component startup. |
| `e38d488` | The configured CPU release campaign includes the same production GR00T controller conversion used by online inference. Thirty-one components and 548 admission/process/wire/resource cases pass on macOS, with source identities, independent context inspection and actual diagnostic process-group release. |
| `30c50d4` | Both GR00T adapters expose `native_action_record`; the shared action-count reader admits integer limits 1–512. Eighty-five controller checks pass per CPU platform on 27 original records. Linux additionally passes 1,330 checks on 1,272 original records, including 1,248 complete BEHAVIOR model outputs. Original native values and full model records remain unchanged. |
| `c857e13` | Core tool output evidence selection belongs to `tools/core-output.ts`. On macOS and isolated Linux, 98 original results per platform from seven tasks preserve exact native JSON and 81 ordered images, including six formal checks. All thirty current-source CPU components and 463 admission/process/wire/resource cases pass per platform; independent checks verify 428 source/input comparisons and thirty process-group releases per platform. Original records and canonical server changes remain unchanged. |
| `27b3950` | Native RGB-D range and coordinate arithmetic fails at numerical overflow. Thirty-nine checks pass per CPU platform on thirteen original captures and twenty-six invalid calibration derivatives, with original geometry preserved within its recorded precision allowance. |
| `48bcc47` | Both GR00T adapters admit actual collator tensors after native bfloat16 conversion and before model inference. Seventy-two installed processor/codec cases cover forty-six original requests and twenty-six declared invalid derivatives. Original prepared values remain unchanged. |
| `d937330` | RoboTwin prepares and admits actual saved checkpoint processors before policy construction. Twenty-two original/invalid JSON, safetensors and selector checks pass in the installed LeRobot environment. |
| `2821c21` | Both GR00T constructors admit model/processor/statistics compatibility before optional SDK imports. All 111 original/invalid configuration checks pass on macOS and isolated Linux. |
| `a97d0a9` | Four production adapters expose independently callable input preparation. Thirty configured CPU components pass 463 admission/process/wire/resource cases per platform on macOS and isolated Linux. |

Recorded GR00T model-input checks independently verify 418 SDK/checkpoint/input/source hashes,
16 configuration sources, 327 derivative hashes and 51 local source comparisons.
Original files/server status remain unchanged and actual diagnostic processes
release. CUDA stays uninitialized; model, inference, environment and control
allocations remain zero. Full source checks pass with 70 Python files, 28 base
imports, 52 diagnostics and 128 pinned DSH files/25 bindings.
Evidence and commands: [CPU validation](cpu-release-validation.md#gr00t-pre-inference-model-input-admission).

Current GR00T controller conversion separately verifies original group/horizon,
count, controller threshold and range handling without importing model SDKs.
Independent Linux checks match 1,354 source/input comparisons and confirm four
runner/diagnostic process releases, clean frozen source and unchanged canonical
user changes. Local comparison verifies 24 implementation/manifest comparisons,
31 original input identities and identical 85-case/76-case controller/numeric
results between CPU platforms. Raw RoboCasa probabilities, SDK group dtypes,
loaded inference and original task success retain their native acceptance scope.
See [controller validation](cpu-release-validation.md#gr00t-controller-conversion).

Current installed GR00T decoding checks use actual checkpoint normalization and
relative-to-absolute processing on explicitly original-record-derived inputs.
Normalized network predictions are not retained in those original JSON records.
The guarded float32 groups and native mapping match the same SDK decoding exactly.
Source/report/archive identities and actual process releases verify independently;
GPU, model, simulator and control allocations remain zero.
See [decoding validation](cpu-release-validation.md#gr00t-checkpoint-action-decoding).

Current RoboTwin saved action postprocessing admits complete model tensors and
checks inverse-normalization results before native prefix selection. Explicit
original-selected-prefix derivatives and declared capacity padding match the same
actual SDK postprocessor exactly; original complete normalized predictions remain
outside these records. Saved input processing and original native conversion retain
their prior verified values. Reports, source identities and actual process-group
releases verify independently with zero model, simulator or GPU allocation.
See [postprocessor validation](cpu-release-validation.md#robotwin-checkpoint-action-postprocessing).

Current OpenPI input/output admission uses the same actual SDK camera, tokenizer,
normalization and absolute-action transforms as native inference. Complete
normalized output admission covers model padding and the full horizon before
native channel/prefix selection. Explicit original-native-action-derived inputs
match the same SDK's float32 controls exactly. Sources and process releases verify
independently with CPU-only JAX and uninitialized CUDA. Original normalized network
predictions and loaded-model behavior retain their native requirements.
See [OpenPI transform validation](cpu-release-validation.md#openpi-checkpoint-model-transforms).

Native geometry additionally passes 39 checks on both platforms with 78 original
input/production-source comparisons per platform. Original file identities,
numeric admission, report digests and the Linux archive digest independently match.
The actual Linux runner/diagnostic processes release, frozen source stays clean and
canonical server status remains unchanged. No model, simulator or GPU allocates.
See [geometry validation](cpu-release-validation.md#numeric-geometry-admission).

## Remaining release requirements

| Requirement | Required authoritative acceptance |
| --- | --- |
| Complete multi-goal and prerequisite recovery | Current-code native Tower run with admitted goal dependencies, separate formal verdicts, original final success, complete plans and resource release |
| Additional model/Team/provider configurations | Real supported model routes, independent roles and task success through each selected configuration |
| BEHAVIOR original task success | Original provider criterion passes after real policy controls and an independent fresh Verifier |
| RoboDojo build_tower and hybrid execution | Actual task stages and final criterion, identified policy requests, admitted actions, interruption and released resources |
| Loaded-policy stop/fault boundaries | Actual loaded checkpoint, scoped cancellation/failure, confirmed device stopping and absence of stale actions |
| Complete native perception and active observation | Source-bound measured geometry across selected providers, Planner pitch workflows and active-motion concurrency |
| Complete configuration and maintenance workflows | Allocated Console switching, retained terminal-source records and task/maintenance workflows across the supported matrix |
| Release distribution | CPU setup, fresh installation provenance and the configured profile matrix are published. Complete native SDK/task configurations and signed distribution retain their acceptance requirements. |

The [v1 delivery register](v1-delivery.md) defines the full per-capability gates.
The [configuration matrix](supported-configurations.md) records actual CPU
platform versions and exact configured provider/checkpoint/Team identities.
The [native campaign](native-release-campaign.md) defines executable configurations,
task submissions and evidence requirements. GPU work remains stopped during the
current CPU phase. A v1 tag requires every active release gate to pass.

## Find the implementation

| Responsibility | Source location |
| --- | --- |
| Application composition, Sessions and service startup | [apps/server](../../apps/server/README.md) |
| Agent roles, Teams, prompts, planning and tools | [harness/agent-runtime](../../harness/agent-runtime/README.md) |
| Policy adapters, simulator providers, execution and device resources | [harness/physical-runtime](../../harness/physical-runtime/README.md) |
| Shared wire schemas and generated declarations | [harness/contracts](../../harness/contracts/README.md) |
| Trace Console and Desktop launcher | [apps/console](../../apps/console/README.md), [apps/desktop](../../apps/desktop/README.md) |
| Exact production files and diagnostic commands | [Source entry points](../development/code-map.md) |

The [checkpoint history](checkpoint-history.md) preserves complete dated
implementation and acceptance records with their original evidence references.
