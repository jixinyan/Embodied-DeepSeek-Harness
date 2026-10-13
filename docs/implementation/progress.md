# Implementation progress

Updated: 2026-10-13 · Spec v1.155 · v1 release acceptance in progress.

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

Native deployment and workspace ports use one schema in the native configuration
module. JSON values are integer numbers from 1 through 65535; omitted native
provider fields retain their configured defaults and workspace fields remain
required. RoboCasa's environment override validates its nonblank numeric string
against the same range. All admission occurs before resource acquisition.

Eighty-one original-configuration Console port checks pass with twenty-five
admitted and fifty-six rejected cases. Independent readers repeat all cases,
compare fifteen source identities and verify sixty-six declared configuration
derivatives. Original model, Team, checkpoint and worker bindings remain unchanged.
The complete forty-component CPU campaign passes 1,508 cases and 858 independently
inspected source/input comparisons, with original journals/images unchanged and
all diagnostic process groups/writers released. No model, policy, simulator or GPU
executes. Evidence:
`.local/work/native-console-port-cpu-final-20261013/scene-configuration/independently-verified.json`
and `.local/work/native-console-port-cpu-final-20261013/independently-verified.json`.

Exact source `88f1099` matches all 157 campaign production/checker files. Isolated
Linux passes and independently repeats the same eighty-one Console port cases;
all outcomes match macOS. Sixty-six declared derivatives, fifteen source identities
and six original model/provider files pass independent inspection. The runner
exits, isolated source stays clean and canonical server changes remain unchanged.
Ubuntu CI `38376212894` at the same source passes fresh installation, full source
checks and 78 runtime cases. Downloaded artifacts match 89 source comparisons and
41 inputs; production reads preserve seven task-plan journals and 338 retry events
in 22 native Sessions with released writers. Fifteen previously executed
installed-SDK sources match the commit. Evidence:
`.local/work/native-console-port-cpu-final-20261013/committed-source-verification.json`,
`.local/work/native-console-port-linux-verified-20261013/local-independent-verification.json`,
`.local/work/ci-native-console-port-inspection-20261013.json` and
`.local/work/ci-native-console-port-native-independent-20261013.json`.

GPT input preparation has a versioned diagnostic at
`scripts/check-native-policy-inputs-offline.mjs`. A strict original-input manifest
selects its deployment/profile, policy-model endpoint, original text, two original
RGB PNGs and native workspace. The optional `nativePolicyInputRecords` campaign
binding schedules the diagnostic with the existing owned process-group runner.
It checks production file preparation, cancellation, pre-service failure
admission and an idle Console lifecycle, with explicit configuration derivatives
and preserved original source hashes. This scope allocates no native worker,
gateway, model, simulator or GPU.

Source `8c75a65` passes the configured forty-component/1,427-case macOS campaign.
Independent inspection matches 792 source/input comparisons, 157 exact-commit
production/checker files and all forty released diagnostic process groups, with
original journals/images unchanged and writers released. The selected-file
diagnostic also passes thirty-three cases on isolated Linux. Independent readers
repeat twenty-eight file checks per platform, verify thirty-one configuration
derivatives, match twenty-two source identities and check fifteen stored-image
fields. All case outcomes and prepared image identities match across platforms.
Linux preserves eleven original input files, declares only configuration-path
relocations, releases its actual Console ownership and preserves canonical server
changes. Its original task snapshot exercises text admission only.

Actual Ubuntu CI `38369131528` at the same source passes fresh installation,
complete source checks and 78 production runtime cases. Downloaded artifacts match
89 exact-source comparisons, 41 inputs, fourteen distributions and thirteen imports.
Independent production readers preserve seven task-plan journals and all 338 retry
events in 22 native Sessions, with 56 genuine failed connections, zero provider
responses and released writers. Fifteen previously executed installed-SDK sources
match this commit without rerunning unchanged processors. Evidence:
`.local/work/native-policy-checker-cpu-20261013/committed-source-verification.json`,
`.local/work/native-policy-checker-linux-verified-20261013/local-independent-verification.json`,
`.local/work/ci-native-policy-checker-inspection-20261013.json` and
`.local/work/ci-native-policy-checker-native-independent-20261013.json`.

Selected RoboDojo GPT profiles prepare their instruction text, nonempty
demonstration text and decoded PNG references before managed-service acquisition.
Preparation uses the existing DSH attachment service and its image limits; file
reads and completion check the caller's cancellation signal. The independent
policy host, gateway and worker consume the prepared values.

Thirty-three CPU cases pass on an original direct profile and saved files.
Four valid preparations preserve original text and three ordered stored camera
references. Twenty-four reader/factory checks reject twelve genuine filesystem,
text, decode and image-limit failures before any managed service starts. Two
cancellation checks preserve idle service state; two environment-entry checks
reject missing or mismatched preparation. The configured production Console
separately starts and closes with its process group/listener released and empty
journal unchanged. The diagnostic declares its closed local endpoint and
unauthenticated model-configuration derivative, produces no model response and
uses a saved task snapshot only to check text admission. One-shot effectiveness
retains native requirements. Independent inspection matches nineteen original/
source identities, thirty-one configuration derivatives, twenty-eight repeated
file checks and fifteen stored-image fields. Evidence:
`.local/work/native-policy-inputs-final-20261013/independently-verified.json`.

The same source passes all thirty-nine configured CPU components and 1,394 cases.
Independent inspection matches 737 source/input comparisons and all thirty-nine
released diagnostic process groups. Original journals/images remain unchanged and
writers release. Camera configuration repeats sixty-six cases and twenty-two
declared derivatives. These scopes allocate no model, simulator or GPU. Evidence:
`.local/work/native-policy-inputs-cpu-20261013/independently-verified.json`.

Exact source `b3de927` independently matches all 153 campaign production/checker
files and nine selected-input sources. Ubuntu CI `38366929341` passes fresh
installation, complete source checks and 78 production runtime cases. Downloaded
artifacts match fourteen distributions, thirteen imports, 41 input identities
and 89 exact-source comparisons. Independent production reads preserve seven
task-plan journals and all 338 retry events in 22 native Sessions, with released
writers. The fifteen sources used by the previously executed Linux SDK checks
also match `b3de927`; their original-request/prepared-tensor scope remains
unchanged. Original-perception inspection verifies 143 cases, forty source
comparisons, fifteen PNG checks, forty-eight statistic fields and nine exact-
commit sources. No model, policy, simulator or GPU executes. Evidence:
`.local/work/native-policy-inputs-final-20261013/committed-source-verification.json`,
`.local/work/native-policy-inputs-cpu-20261013/committed-source-verification.json`,
`.local/work/ci-native-policy-inputs-inspection-20261013.json`,
`.local/work/ci-native-policy-inputs-native-independent-20261013.json`
and `.local/work/native-policy-input-perception-independent-20261013.json`.

RoboDojo direct/hybrid configuration admits the three supported GPT control
modes and strict demonstration metadata before service acquisition. The native
reader and GPT policy share their mode definitions and 64-image capacity.
Thirty-six declared metadata derivatives of an original direct profile pass
independent production-reader inspection: thirty invalid inputs reject and six
valid configurations preserve original model, Team, worker, checkpoint and
service bindings. Ten original/source identities match, original files remain
unchanged and native allocations remain zero. Actual saved text/image paths
establish metadata admission only; one-shot model execution and demonstration
effectiveness retain native requirements. Evidence:
`.local/work/native-demonstration-final-20261013/independently-verified.json`.

The same source passes all thirty-nine configured CPU components and 1,394
cases. Independent inspection matches 737 source/input comparisons and confirms
all thirty-nine diagnostic process groups and writers released. Original journals
and images stay unchanged; camera configuration repeats sixty-six cases and
twenty-two declared derivatives. Twenty-four additional port/endpoint derivatives
also pass independent production readers on this source. These scopes allocate
no model, simulator or GPU. Evidence:
`.local/work/native-demonstration-cpu-final-20261013/independently-verified.json`,
`.local/work/native-demonstration-port-20261013/independently-verified.json` and
`.local/work/native-demonstration-uri-20261013/independently-verified.json`.

Source `b69d927` independently matches all 153 campaign production/checker
files, six demonstration sources, five gateway/configuration sources for each
port/endpoint check and fifteen loaded installed-processor sources. Actual
Ubuntu CI `38362872636` passes fresh installation, complete source checks and
78 production runtime cases. Downloaded artifacts match fourteen distributions,
thirteen imports, 41 input identities and 89 exact-source comparisons. Production
readers preserve seven task-plan journals and 338 retry events in 22 independent
native Sessions with released writers. Separate original-perception inspection
matches forty source comparisons, fifteen PNG checks, forty-eight depth-statistic
fields and nine exact-commit sources. Every scope retains zero native allocation.
Evidence: `.local/work/native-demonstration-cpu-final-20261013/committed-source-verification.json`,
`.local/work/ci-native-demonstration-inspection-20261013.json` and
`.local/work/ci-native-demonstration-native-independent-20261013.json`.

Direct/hybrid profiles validate optional `workerPolicyUri` through the existing
native endpoint schema before service acquisition. Original-profile CPU checks
admit the saved endpoint, omission, secure WebSocket and localhost values; eight
invalid explicit values reject. Independent readers compare all twelve declared
derivatives with their original configuration, preserve complete native/model/
Team/service bindings and match the exact Zod issues. Gateway-port checks repeat
twelve additional cases on the same source. Both original source files and five
production source identities remain unchanged; native allocations remain zero.
Evidence:
`.local/work/native-gpt-worker-uri-admission-20261013/independently-verified.json`
and `.local/work/native-gpt-worker-port-admission-20261013/independently-verified.json`.

The same endpoint-admission source passes the complete thirty-nine-component
CPU campaign and 1,394 cases. Independent readers match 737 source/input
comparisons, all thirty-nine released diagnostic process groups and unchanged
original journals/images. The camera component independently repeats sixty-six
cases and twenty-two configuration derivatives with released writers.
Evidence: `.local/work/native-gpt-endpoint-cpu-campaign-20261013/independently-verified.json`.

Source `33ae4e2` independently matches all 153 campaign production/checker files,
five configuration/gateway sources for each twelve-case admission check and
fifteen loaded installed-processor sources. Actual Ubuntu CI `38358983308`
passes fresh installation, full source checks and 78 production runtime cases.
Downloaded artifacts match fourteen distributions, thirteen imports, 41 input
identities and 89 exact-source comparisons. Production readers preserve seven
task-plan journals and 338 native retry events in 22 Sessions with released
writers. Separate original-perception inspection matches forty source comparisons,
fifteen PNG checks, forty-eight depth-statistic fields and nine exact-commit sources.
All these scopes retain zero native allocation. Evidence:
`.local/work/ci-native-gpt-endpoint-inspection-20261013.json`,
`.local/work/ci-native-gpt-endpoint-native-independent-20261013.json` and
`.local/work/native-gpt-endpoint-perception-independent-20261013.json`.

Native direct/hybrid configuration admits `policyGatewayPort` before managed
services or the gateway/worker can allocate. Twelve declared port derivatives of
an original Astra direct profile pass independent production-reader inspection:
eight invalid values reject and four admitted values preserve exact model, Team,
worker, checkpoint and service bindings. Original configuration/model bytes
remain unchanged. Gateway, model, worker, simulator and GPU allocations remain
zero. Evidence:
`.local/work/native-gpt-profile-admission-20261013/independently-verified.json`.
See [gateway admission](cpu-release-validation.md#native-policy-gateway-configuration).

The complete configured CPU campaign passes thirty-nine components and 1,394
cases on the same configuration-reader source. Independent inspection matches
737 source/input comparisons, unchanged original journals/images and all
thirty-nine released diagnostic process groups. Calibration inspection repeats
all sixty-six cases and twenty-two declared configuration derivatives. Evidence:
`.local/work/native-gpt-configuration-cpu-campaign-20261013/independently-verified.json`.

Actual installed Linux processors separately pass seventy-two checks on forty-six
original requests across RoboTwin, RoboCasa, BEHAVIOR and RoboDojo. Execution uses
an isolated clean checkout at `5b26a5a`; fifteen loaded production/checker files
match the current source. Independent remote inspection verifies 418 source
identities; local inspection preserves all 282 prepared tensor/codec metadata
fields against their original saved processor records. Four diagnostic process
groups and the runner release, canonical server changes remain unchanged and
CUDA remains uninitialized. No policy network, inference, simulator or controls
allocate. Evidence:
`.local/work/current-sdk-cpu-linux-20261013-verified/independently-verified.json`.
See [installed processor inspection](cpu-release-validation.md#current-installed-policy-processors).

Gateway-port checkpoint `e49ee3c` independently matches all 153 captured campaign
production/checker files, four gateway/configuration sources and fifteen actual
installed processor sources. Actual Ubuntu CI `38357884320` passes fresh
installation, full source checks and 78 production runtime cases. Downloaded
artifacts match fourteen distributions, thirteen imports, 41 input identities and
89 exact-source comparisons. Production readers preserve seven task-plan journals
and 338 native retry events in 22 Sessions, with released writers and zero native
allocation. Evidence:
`.local/work/ci-native-gpt-gateway-inspection-20261013.json` and
`.local/work/ci-native-gpt-gateway-native-independent-20261013.json`.

Camera-bank configuration loading admits an omitted field as an empty default
and rejects explicit `null`, arrays and text. Empty `{}` remains valid at both
deployment and profile scope. Sixty-six CPU cases pass through all four actual
provider configurations and the idle production HTTP server. Independent
inspection verifies twenty-two declared configuration derivatives: thirteen
rejections and nine accepted defaults/empty banks. Exact worker, checkpoint,
model and service bindings remain unchanged. Eighteen original/source identities
match, both original camera values remain exact, the empty journal reopens
unchanged and all writers/listeners release. No model, simulator or GPU allocates.
Evidence: `.local/work/calibration-configuration-admission-20261013/independently-verified.json`.
See [camera-bank admission](cpu-release-validation.md#profile-camera-calibration-admission).

The complete configured CPU campaign passes thirty-nine components and 1,394
cases. Independent inspection verifies 737 source/input comparisons and all
thirty-nine released diagnostic process groups. Original journals preserve
sixty-nine model outputs, seventy tool calls and both model-image contexts;
all source images remain unchanged. Separate NumPy/Pillow inspection matches
forty source identities, fifteen PNG checks and forty-eight depth-statistic
fields. Writers release and native allocations remain zero. Evidence:
`.local/work/calibration-configuration-cpu-campaign-20261013/independently-verified.json`
and `.local/work/calibration-perception-independent-20261013.json`.

All 153 captured production/checker files match `f9016c4`. Actual Ubuntu CI
`38349877123` passes fresh installation, complete source checks and 78 runtime
cases. Independent downloaded-artifact inspection verifies fourteen
distributions, thirteen imports, 41 inputs and 89 exact-source comparisons.
Production readers preserve seven task-plan journals and all 338 retry events
in 22 native Sessions, with released writers and no native allocation. Evidence:
`.local/work/ci-calibration-configuration-inspection-20261013.json`,
`.local/work/ci-calibration-configuration-native-independent-20261013.json` and
`.local/work/calibration-configuration-cpu-campaign-20261013/committed-source-verification.json`.

Native configuration, execution-environment lifetime and deployment assembly have
explicit source owners. `native-deployment-configuration.mjs` owns provider,
Team/model/task/checkpoint/service admission and native context defaults.
`native-policy-environment.mjs` owns learned-worker allocation and RoboDojo's
direct/hybrid gateway, independent host and ordered audit lifetime.
`native-deployment.mjs` assembles model/perception/profile factories, managed-service
leases and Console startup, and preserves its original public configuration/root
exports. TypeScript parser/printer comparison against `f4317f5` verifies all five
complete function bodies, parameters and five constant initializers. Actual
module imports verify the five public export names and shared configuration
function identity. Evidence: `.local/work/native-deployment-move-source-20261012.json`.

The same source passes the complete thirty-nine-component CPU campaign and 1,372
cases. Independent inspection verifies 715 source/input comparisons and thirty-nine
released process groups. Four original configured profiles and both camera
configuration derivatives retain exact selected values; eighteen calibration
source/implementation identities match. Original journals/images remain unchanged,
diagnostic writers release and model/simulator/GPU allocations remain zero.
Evidence: `.local/work/native-deployment-modules-cpu-campaign-20261012/independently-verified.json`
and its `depth-calibrations/independently-verified.json`.

All 153 captured production/checker files match `2ef31d7`. Actual Ubuntu CI
`38348086492` passes fresh installation, complete source checks and 78 runtime
cases. Downloaded evidence independently matches 89 exact-source comparisons and
41 inputs. Production readers preserve seven unchanged task-plan journals and
all 338 retry events in 22 native Sessions, with released writers and no native
allocations. Evidence: `.local/work/ci-native-deployment-modules-inspection-20261012.json`,
`.local/work/ci-native-deployment-modules-native-independent-20261012.json` and
`.local/work/native-deployment-modules-cpu-campaign-20261012/committed-source-verification.json`.

Each native environment/launch profile retains its own camera calibration bank.
Native configuration, deployment preparation and UpperRun admit detached,
immutable snapshots; Session tasks select their profile bank. Omission inherits
the deployment default and a supplied bank replaces it, including `{}`. Common
model/SAM/YOLO endpoints can serve profiles with different cameras. Private banks
participate in native factory identity and remain absent from public metadata.
Forty-four CPU checks pass through all four actual configured factories and an
idle production HTTP server using saved RoboCasa and RoboDojo calibration values.
Invalid fields reject, input mutation preserves prepared values, services remain
idle, and the empty journal's writer and HTTP listener release. No model,
simulator or GPU allocates. This scope establishes configuration admission and
propagation; source-camera accuracy and loaded-provider workflows retain native
acceptance. See [profile calibration checks](cpu-release-validation.md#profile-camera-calibration-admission).
Evidence: `.local/work/depth-calibration-binding-final-20261012/acceptance.json`.

The complete configured CPU campaign passes thirty-nine components and 1,372
cases. Independent checks match 694 source/input comparisons and all thirty-nine
released diagnostic process groups. Four native profile identities, sixteen
calibration source/implementation identities and both configuration derivatives
verify independently. Original camera values remain exact, the empty journal
reopens unchanged, and the writer releases. Model/simulator/GPU allocations remain
zero. Evidence: `.local/work/depth-calibration-cpu-campaign-20261012/independently-verified.json`
and its `depth-calibrations/independently-verified.json`.

All 151 captured production/checker files match `38c0a3e`. Actual Ubuntu CI
`38346569166` passes fresh installation, complete source checks and all 78
production runtime cases. Downloaded evidence independently matches 89 exact-source
comparisons and 41 inputs. Production readers preserve seven task-plan journals
and all 338 retry events in 22 native Sessions, with released writers and zero
native allocations. Saved SAM/YOLO outputs additionally preserve fifteen PNG
checks, forty-eight statistic fields and nine exact committed source identities.
Evidence: `.local/work/ci-depth-calibrations-inspection-20261012.json`,
`.local/work/ci-depth-calibrations-native-independent-20261012.json` and
`.local/work/depth-calibration-cpu-campaign-20261012/committed-source-verification.json`.

SAM3.1/YOLO26 response admission belongs to `perception/src/model-responses.ts`.
The HTTP clients retain transport/deadline ownership; existing client type exports
and tool results remain available. Three saved SAM camera responses and six YOLO
outputs pass 143 production admission checks, including empty results, mask/ROI
coverage, calibrated range, detached values and cancellation. Original metadata
and binary outputs reassemble the service response without provider execution;
source files remain unchanged. No model, simulator or GPU allocates. See
[response admission](cpu-release-validation.md#perception-model-response-admission).

Independent NumPy/Pillow inspection verifies forty original/source identities,
fifteen PNG checks and forty-eight original depth-statistic fields. The configured
CPU campaign passes all thirty-eight components and 1,328 cases; independent reads
match 676 source/input comparisons and thirty-eight released diagnostic process
groups. Original journals/images remain unchanged and all diagnostic writers
release. Evidence:
`.local/work/perception-response-cpu-campaign-20261012/independently-verified.json`
and its `perception-responses/independently-verified.json`.

All nine response source/checker files and 148 campaign implementation files match
`953abec`. Actual Ubuntu CI `38343498588` passes fresh installation, source checks
and all 78 production runtime cases. Downloaded evidence matches 89 exact-source
comparisons and 41 inputs; independent production reads preserve seven task-plan
journals and 338 retry events from 22 native Sessions with released writers and
zero native allocations. Evidence:
`.local/work/perception-response-cpu-campaign-20261012/perception-responses/independently-verified-source.json`
and `.local/work/ci-perception-responses-inspection-20261012.json`.

Measurement request snapshots and native RGB-D receipt admission belong to
`perception/src/metric-measurement.ts`. NativeTaskBackend retains request transport,
cancellation, current task identity and closure. Thirteen original captures pass
416 admission/snapshot checks across RoboCasa, RoboTwin and RoboDojo. Independent
NumPy inspection matches 44 source/original file identities and 494 decoded fields;
original distances, matrices, coordinates and capture metadata remain exact.
Complete source checks pass with zero model, simulator or GPU allocations. See
[native metric receipts](cpu-release-validation.md#native-metric-receipt-admission).
The same backend source passes all thirty-seven CPU campaign components and
1,185 cases; independent inspection matches 634 source/input comparisons and
all thirty-seven released diagnostic process groups. Original records remain
unchanged. Evidence:
`.local/work/metric-measurement-admission-current-20261012/independently-verified-source.json`
and `.local/work/metric-measurement-cpu-campaign-20261012/independently-verified.json`.
The measurement implementation additionally matches all five captured source
files against `c942b63`. Actual Ubuntu CI `38339782470` passes fresh installation,
source checks and all 78 production runtime cases. Downloaded evidence matches
89 exact-source comparisons and 41 inputs; production reads preserve seven
task-plan journals and 338 events from 22 native retry Sessions with released
writers and zero native allocations. Evidence:
`.local/work/ci-metric-measurement-inspection-20261012.json` and
`.local/work/ci-metric-measurement-native-independent-20261012.json`.

Perception result construction belongs to `perception/src/results.ts`; UpperRun
retains provider admission, cancellation, immutable retention and assignment grants.
Five original journals pass 140 core-result and 120 ordered-image comparisons.
Eight SAM and three YOLO results match all nineteen generated sensor samples,
including original observation time, mask references and provider provenance.
Complete source checks pass. No model, simulator or GPU allocates. Evidence:
`.local/work/perception-results-recorded-final-20261012/acceptance.json`.
See [perception result construction](cpu-release-validation.md#perception-result-construction).
Independent production reads verify twenty-one source/schema/journal identities,
all 140 native contents and five released writers. The same source passes the
complete thirty-seven-component CPU campaign: 1,185 cases, 634 source/input
comparisons and all thirty-seven diagnostic process groups released. Original
records remain unchanged and native allocations remain zero. Evidence:
`.local/work/perception-results-cpu-campaign-20261012/independently-verified.json`.

Actual Ubuntu CI `38336834409` passes fresh installation, source checks and all
78 production runtime cases at `4f89fd6`. Downloaded evidence independently
matches 89 exact-source comparisons and 41 inputs. Production reads preserve
seven task-plan journals and all 338 events from 22 native retry Sessions, with
released writers. Eight request-option, thirteen failure-classification and fifteen
retry-configuration JUnit cases additionally verify their exact names and source
identities. Native allocations remain zero. Evidence:
`.local/work/ci-perception-results-inspection-20261012.json` and
`.local/work/ci-perception-results-native-independently-verified-20261012.json`.

Packaged Desktop source `887d707` passes three service cycles with all four
configured provider profiles. Application restart retains its saved configuration
and stays idle; Console reuse, reload, close and reopening preserve the same owned
service. Independent inspection matches nineteen source/package/configuration
identities and twelve profile selections, confirms five absent application/service
processes and three refused listeners, and reopens the actual empty production
LocalStore without changing its journal. Every writer releases; browser errors and
Session/model/policy/simulator/GPU allocations remain zero. Evidence:
`.local/work/desktop-restart-configuration-20261012/acceptance.json` and
`.local/work/desktop-restart-configuration-20261012/independently-verified.json`.
Complete source checks pass. Allocated native task and configuration workflows
retain their release requirements.

Linux source `86c612a` passes the same v2 workflow using a real headless
Wayland/Pixman CPU compositor with Chromium sandboxing. Independent checks match
nineteen source/package/configuration identities, twelve profile selections and
six released processes including the compositor. Its process group and sockets
release; the canonical server revision, status and tracked-change digest stay
unchanged. The transferred archive and all 31 original evidence files verify.
Cross-platform inspection matches all ten ASAR files and the diagnostic source,
twenty-four selections, six service cycles and unchanged empty production journals.
Evidence: `.local/work/desktop-restart-linux-20261012-evidence/unpacked-files.json`
and `.local/work/desktop-restart-linux-20261012-evidence/platform-comparison.json`.

Actual Ubuntu CI `38305942638` at `86c612a` passes complete source and fresh
installation checks, seven SKILL tests, eight request-option tests, thirteen
failure tests, fifteen retry-configuration tests and 78 production runtime cases.
Independent inspection matches fourteen distributions, thirteen imports, 41
input identities and 89 exact-commit source comparisons. Production readers
verify seven unchanged plan journals and all 338 native events in 22 Sessions
with released writers. The three JUnit reports verify their exact case names and
contain zero failures or skips. Evidence:
`.local/work/ci-desktop-restart-inspection-20261012.json`,
`.local/work/ci-desktop-restart-independently-verified-20261012.json` and
`.local/work/ci-desktop-restart-native-independently-verified-20261012.json`.

Native source relationships now belong to `native-record-references.ts`; the
workspace factory retains composition, SKILL export leases and image sources.
Each task source references its existing Run, and the Run retains the complete
task inventory. Shared generated identities reference an existing indexed
field-bearing record, which retains their complete group. Actual immutable-baseline comparison checks 10,532 original
records in four retained histories. Direct dependencies decrease from 49,848,314
to 44,667; every current edge exists in the prior graph and every prior edge
has a current direct or two-edge source path. Retention flags and selection
admission remain equivalent. Actual private archival, retirement and reopening
check sequence-bound inventory refresh and consumed preview tokens. The selected
grounding Session retires 455 records, while three other Sessions preserve all
404 original records with exact values and revisions. Source journals stay
unchanged and copied writers release. These checks execute no physical task.
Evidence: `.local/work/native-identity-sources-{robotwin,behavior,robodojo,grounding}-final-20261012/acceptance.json`.
Independent production readers repeat the original and reopened complete graphs,
verify all source/compiler/report digests and all 404 preserved record values
and revisions. Seventy-six source comparisons bind the four results. Evidence:
`.local/work/native-identity-sources-independently-verified-20261012/acceptance.json`.

The current complete CPU campaign passes 37 components and 1,185 cases.
Independent inspection verifies 634 source/input comparisons, unchanged original
journals/images and 37 released diagnostic process groups. The native retry
reader independently checks 36 current sources, 22 native Sessions and all 338
durable events with the v5 source policy. Complete source checks pass. Evidence:
`.local/work/native-identity-sources-cpu-campaign-20261012/independently-verified.json`
and `.local/work/native-identity-sources-cpu-campaign-20261012/model-retry/independently-verified.json`.

Committed v5 source `ebf8e76` independently matches 156 production/checker files.
Actual Ubuntu CI `38302136882` passes fresh frozen installation, complete source
checks, seven SKILL tests, eight request-option tests, thirteen failure tests,
fifteen retry-configuration tests and 78 production runtime cases. Downloaded
artifacts independently match fourteen installed distributions, thirteen imports,
41 input identities and 89 exact-commit source comparisons. Production readers
verify all 338 native event bodies and seven unchanged task-plan journals with
released writers. The three JUnit reports preserve every declared case name,
with zero failures or skips. Evidence:
`.local/work/native-identity-sources-cpu-campaign-20261012/committed-source-verification.json`,
`.local/work/ci-native-identity-sources-inspection-20261012.json`,
`.local/work/ci-native-identity-sources-independently-verified-20261012.json` and
`.local/work/ci-native-identity-sources-native-independently-verified-20261012.json`.

Committed source `63054e2` independently matches 156 production/checker files,
including all four native graph checks. Actual Ubuntu CI `38297182234` passes
fresh frozen installation, complete source checks, seven SKILL tests, eight
request-option tests, thirteen failure tests, fifteen retry-configuration tests
and 78 production runtime cases. Downloaded artifacts independently match fourteen
installed distributions, thirteen imports, 41 input identities and 89 exact-commit
source comparisons. Production readers check all 338 native event bodies and
seven unchanged task-plan journals with released writers. Separate JUnit reports
preserve every case name with zero failures or skips. Evidence:
`.local/work/native-reference-cpu-campaign-20261012/committed-source-verification.json`,
`.local/work/ci-native-reference-inspection-20261012.json`,
`.local/work/ci-native-reference-independently-verified-20261012.json` and
`.local/work/ci-native-reference-native-independently-verified-20261012.json`.

Native model-request retries use the selected DSH executor in
`agents/src/dsh/model-retry`, with provider-owned endpoint configuration and
correlated Console/retention events. Twenty CPU cases use actual refused TCP
connections: 56 failed attempts in 22 native journals, independent Sessions,
reset counts on later turns, fractional waits, native jitter, disabled retries,
always-mode cancellation and prompt host disposal. Shared native audit admission
preserves exact wait values and normal/always budgets for record and image retention.
Eight cases release historical bodies during a pending retry. Reopened LocalStore
readers independently verify all 338 immutable event bodies, stable original
snapshots, native replay projections, unchanged journal digest and released writers.
Eighteen invalid payload derivatives reject without changing their sources.
Fifteen configuration checks pass, and independent TypeScript
normalization verifies executable-source identity with pinned DSH. These checks
allocate no model, simulator or GPU and provide no model response. Successful
provider recovery remains part of the native acceptance campaign.

Source `4978102` CPU campaign passes 37 components and 1,185 cases.
Independent inspection verifies 633 source/input comparisons, unchanged original
journals/images and 37 released diagnostic process groups. The pinned-source
audit passes 129 files and 25 module bindings; complete source checks also pass.
Evidence: `.local/work/model-retry-history-cpu-campaign-20261012/independently-verified.json`
and `.local/work/model-retry-history-cpu-campaign-20261012/model-retry/independently-verified.json`.
The v3 native binding independently admits 2,991 actual RoboTwin records, 141
BEHAVIOR records and 6,541 RoboDojo records through complete namespace owners.
Thirteen selected sources match `4978102`; all three copied/source journals stay
unchanged and copied writers release. Evidence:
`.local/work/native-audit-retention-independently-verified-20261012.json`.

Source `4978102` additionally matches 144 distinct production/checker files against
its exact Git commit. Actual Ubuntu CI `38293337371` passes fresh installation,
complete source checks, seven SKILL tests, eight request-option tests, thirteen
failure tests, fifteen retry-configuration tests and 78 production runtime cases.
Downloaded-artifact admission independently verifies fourteen distributions,
thirteen imports, 41 input digests and 88 exact-commit source comparisons. Native
retry journals/Team traces and all JUnit cases retain their exact identities.
Independent production reads additionally verify all 338 downloaded native event
bodies and seven unchanged plan journals with released writers. No native
allocation occurs. Evidence:
`.local/work/ci-model-retry-history-independently-verified-20261012.json`,
`.local/work/ci-model-retry-history-native-independently-verified-20261012.json`
and `.local/work/ci-model-retry-history-configuration-independently-verified-20261012.json`.

| Source checkpoint | Behavior and checks |
| --- | --- |
| `741311c` | Native model-request retries pass sixteen refused-connection cases, eighteen journals and 44 failed attempts with independent executable-source provenance. The 37-component/1,181-case CPU campaign verifies 617 source/input comparisons and 135 exact-commit production/checker files. Actual Ubuntu CI `38290122403` passes fresh installation, full source checks, seven SKILL tests, eight request-option tests, thirteen failure tests, fifteen retry-configuration tests and 74 production runtime cases. Downloaded artifacts verify fourteen distributions, thirteen imports, 36 inputs, 77 exact-commit sources, unchanged plan journals and released writers. No model responds or native resource allocates. |
| `f6a890a` | The complete 36-component/1,165-case CPU campaign independently verifies 574 source/input comparisons, 116 exact-commit production/checker identities and 36 absent process groups. Actual Ubuntu CI `38185797204` passes fresh installation, full source checks, seven SKILL tests, eight model-configuration tests, thirteen model-failure tests and 58 separate production-runtime cases. Downloaded artifacts independently verify fourteen distributions, thirteen imports, fifteen input digests and 53 source comparisons; seven plan journals remain unchanged and release writers. Both JUnit reports and their exact configuration/test/workflow sources match this revision. Native allocations remain zero. |
| Shared model failure admission | Both adapters share bounded HTTP error reading and canonical DSH context/auth/quota/rate/server/timeout classifications. Responses stream errors retain structured code/type classification; HTTP errors preserve request ID/retry timing without provider prose. Thirteen authored CPU checks and three actual application HTTP errors pass. The complete 36-component/1,165-case CPU campaign independently verifies 574 source/input comparisons, unchanged original records/images and 36 absent process groups. Four configured providers remain unallocated with zero Sessions and released writers/listeners. Actual provider failure/recovery acceptance remains separate. |
| `620d507` | The complete current-source CPU campaign passes 36 components/1,165 cases with 570 independent source/input comparisons, 115 exact-commit production/checker identities and 36 absent process groups. Actual Ubuntu CI `38183379841` passes complete source/installation admission, seven SKILL tests, eight protocol-configuration tests and 58 separate production-runtime cases. Downloaded artifacts independently match fourteen distributions, thirteen imports, fifteen input digests and 53 source comparisons; seven plan journals remain unchanged and release writers. The eight-case JUnit report, configuration/test/workflow source and four model files match the exact revision. All native allocations remain zero. |
| Protocol-specific model configuration | Configuration reading admits nondefault Chat Completions role/token/reasoning/tool/extension fields only for that protocol. Eight authored tests pass on actual published cloud/local YAML files, including the Responses defaults and explicit incompatible-option derivatives. The configured four-provider production HTTP workspace preserves profile/Team/model identities, idle services and writer/listener release without allocation. Source CI retains the separate JUnit configuration artifact alongside production runtime evidence. |
| `1012df8` | The complete 36-component/1,165-case CPU campaign matches 115 distinct production/checker files against the exact commit. Actual Ubuntu CI `38182924925` passes fresh installation, complete source checks, seven SKILL tests and its separate 58-case runtime suite. Independent artifact admission verifies fourteen distributions, thirteen imports, fifteen input digests and 53 exact-commit source comparisons. Consolidated/checker identities agree; seven plan journals remain unchanged and release writers. Original-image and Responses diagnostics retain their local record-based scopes. All native allocations remain zero. |
| Shared model image request admission | Both cloud/local adapters admit intrinsic references and complete native request metadata, detach resolver-owned data and preserve cancellation reasons. Responses resolves each image once and checks every represented occurrence against byte/count limits before HTTP. Actual DSH image services and two complete original contexts retain six images/15 occurrences through 67 checks. All 36 CPU components/1,165 cases pass; independent inspection verifies 570 source/input comparisons, unchanged journals/images and 36 absent diagnostic process groups. Original Responses output/argument admission and native historical contexts remain unchanged. All native allocations remain zero. |
| `72757e0` | Actual Ubuntu source/installation/runtime CI `38181160684` passes full source checks, seven SKILL document/metadata tests and 58 separate runtime cases. Independent downloaded-artifact inspection matches fourteen distributions, thirteen imports, fifteen input digests and 53 exact-commit source comparisons; consolidated/checker identities agree, and seven plan journals remain unchanged with released writers. The local 35-component/1,098-case campaign independently matches 543 source/input comparisons and 106 distinct production/checker files against this exact commit. Original Responses admission retains its separately declared record-based scope. All native allocations remain zero. |
| Complete CPU campaign with Responses admission | All 35 configured components and 1,098 admission/process/wire/resource cases pass on macOS. Independent inspection verifies 543 source/input comparisons, unchanged reports/journals and all 35 absent diagnostic process groups. Native DSH expansion and replay independently preserve 69 original Astra outputs and 70 calls, with detached replay items and released copied writers. Historical contexts retain twelve independent assignments and six visual-context cases; four-provider readiness and complete source checks pass. GPU/model/simulator allocations remain zero. |
| Responses function-call and replay admission | The Responses adapter admits required fields, ordered sequence numbers, stable output/item/call identities and consistent final arguments. Completed terminal output must match every streamed call before native DSH dispatch. Replay follows retained DSH calls after token-budget/context pruning. Original-record CPU checks preserve 69 Astra outputs, 70 calls and durable argument segments across 128 admission/invalid-derivative cases. Journals remain unchanged and copied writers release; provider requests, dispatches and native allocations remain zero. The optional configured CPU campaign selects original Responses journals. Original provider SSE is outside this record-based scope. |
| `5527e60` | Depth inspection requires enabled assertions and the production helper's exact checkout origin. The guarded six-record calculation passes all 168 cases; optimized Python rejects before output creation. The complete local campaign passes 34 components/970 cases with 533 source/input comparisons and released process groups. Actual Ubuntu CI `38179611064` passes full source checks, seven SKILL tests and 58 separate runtime cases; independent downloaded-artifact admission matches installation, checker/source and fifteen input identities, with unchanged plan journals and released writers. Native allocations remain zero. |
| `6d1f4e2` | Actual Ubuntu source/installation/runtime CI `38179169536` passes complete source checks, seven SKILL document/metadata tests and all 58 cases in the separate five-component artifact suite. Independent downloaded-artifact admission matches fourteen distributions, thirteen imports, fifteen input digests and 53 exact-commit source comparisons. Consolidated result/checker identities agree; all seven plan journals remain unchanged and release writers. The local 34-component perception campaign has separate 970-case evidence. Native allocations remain zero. |
| Complete CPU campaign with perception admission | All 34 configured components and 970 admission/process/wire/resource cases pass on macOS. Independent inspection verifies 533 source/input hashes, unchanged reports/journals and all 34 absent diagnostic process groups. Perception retains four original requests and six learned-depth records; rotation writers release; historical contexts retain twelve independent assignments and six visual-context cases. All four providers pass readiness and complete source checks pass. GPU/model/simulator allocations remain zero. |
| Perception request and numerical admission | SAM/YOLO share strict input admission with detached image/mask bytes and immutable ROI/calibration metadata. Inputs and cancellation are checked before HTTP. Actual original-record checks pass 134 request cases with zero connections and 168 depth-statistic cases on six saved native records. Normal float32 statistics and identified camera ranges remain consistent; invalid derivatives and numerical overflow reject. Source arrays/files and NumPy settings remain unchanged. The optional configured CPU campaign includes both diagnostics. No model, simulator or GPU allocates. |
| `8de1f01` | Actual Ubuntu source/installation/runtime CI `38177836119` passes complete source checks, seven SKILL document/metadata tests and all 58 cases in the separate five-component CPU artifact suite. Independent downloaded-artifact admission matches fourteen distributions, thirteen imports, fifteen input digests and 53 exact-commit source comparisons. Consolidated fields/checker identity agree; all seven plan journals retain their digests and release writers. The local 32-component original-record campaign has its separate 668-case evidence. Native allocations remain zero. |
| Complete CPU campaign with rotation receipts | All 32 configured components and 668 admission/process/wire/resource cases pass on macOS, including 118 original/invalid rotation inputs. Independent inspection verifies 492 source/input hashes, unchanged reports/journals, all 32 absent diagnostic process groups and released rotation journal writers. Historical contexts retain twelve independent assignments and six visual-context cases; all four configured providers pass readiness. Complete source checks pass and all GPU/model/simulator allocations remain zero. |
| Active observation admission and module ownership | The observation module owns bounded rotation request and strict, immutable measured receipt admission. NativeTaskBackend retains task identity/cancellation; Worker/provider retains actual resource ownership/control. Two original BEHAVIOR receipts preserve exact angles, positions and counters; 94 invalid receipt derivatives and 22 invalid requests reject. Original native DSH output inspection preserves sixteen results, fifteen ordered images and one formal check. Execution/perception public entry points expose actual services/types, and mode resolution belongs to execution-mode.ts. Original outcomes remain unchanged; no models, simulators or GPU allocate. |
| `492871f` | Actual source/installation/runtime CI `38176988303` passes complete source checks, seven authored SKILL document/metadata tests and all 58 cases in the separate five-component CPU artifact suite. Native allocations remain zero. |
| SKILL metadata admission | SkillLibrary search and document load share canonical SkillMetadata, immutable storage-version and skill/key identity admission. Search still returns metadata only, scans lazily and applies origin filtering after admission. Bundle/read types belong to `library.ts`; selection metadata belongs to `skill-sections.ts`, with unchanged workspace exports. Seven authored-document CPU tests and complete source checks pass; CI requires that suite. Evolver remains paused, SceneState remains deferred and no recovery experience or native task result is generated. |
| `3398769` | Actual source/installation/runtime CI `38176009858` passes all 58 CPU cases after production module export consolidation. Independent downloaded-artifact inspection verifies fourteen distributions, thirteen imports, fifteen input digests and 53 exact-commit source comparisons; uploaded/local consolidated fields and checker identity match. Production reads preserve all seven downloaded plan journals and release their writers. Local service outcomes match the preceding Linux reports, with 25 implementation-source comparisons and unchanged reopened file/question/plan journals. Complete source checks pass and native allocations remain zero. |
| Runtime module exports | Agents, Teams, models, communication, files, tasks, verification and storage entry points expose the production services and their actual method/data types. WorkspaceFile belongs to AssignmentFiles in `files/workspace.ts`; TeamRunSnapshot belongs to FileTeamLoader in `teams/loader.ts`. Consumers continue to use the same workspace imports. The module map names concrete implementations. Complete source checks, fifteen native DSH CPU tool cases and seventeen configured task-plan CPU cases pass with released hosts/writers and zero native allocation. |
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
