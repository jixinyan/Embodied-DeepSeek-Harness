# Embodied DeepSeek Harness — Project Specification

Version: v1.118 · 2026-10-09

Status: native Qwen/Pi0.5 RoboTwin and RoboDojo recovery have independent formal verification and original action/video evidence. RoboDojo run `897f215d` verifies zero-tool-error retained-scene retry, 58 controls, 580 actual physics steps and four identified inferences; subsequent same-Session run `ca43312e` verifies the unchanged terminal episode with zero additional controls/inferences and released resources. Clean custom-role RoboTwin run `a5d9132e` verifies independent SceneAnalyst communication, 113 controls, eight identified inferences, failed-attempt recovery and formal success with zero tool errors and released resources. Packaged Desktop run `bd3e1606` verifies actual Console submission, 101 controls, seven learned requests and formal retry success; a second task explicitly selects its history, verifies the current ended scene and completes Session/service cleanup. Its synchronized Agent-trace MP4 passes source and full-decoding checks. Actual Planner review/end and concurrent native terminal boundaries pass separate checks. Native Qwen/GR00T RoboCasa CloseDrawer has independent success and retained-scene recovery evidence. BEHAVIOR preserves its observed failed task outcomes. Native perception and R1Pro active observation have separate real checks. Selected DSH recovery/JSON portability, complete default native retention and configured service lifetimes have production acceptance. A unified native workspace has actual four-provider configuration, profile-specific Team, Console selection and cleanup acceptance. CPU transport, service ownership, interrupted admission and source-bound record checks have production validation. Evolver is paused and SceneState is deferred. Multi-goal and the complete installed task/configuration matrix remain pending.

Project: Embodied DeepSeek Harness (EDH).

GR00T normalized model output and checkpoint-decoded actions pass admission in
`policies/gr00t_model_output.py`, bound to the actual processor by both native
constructors. Normalized values require finite float32 arrays with configured
horizon/channel capacity. Checkpoint padding remains supported; SDK normalization
and relative-to-absolute conversion retain their semantics. Exact decoded group
keys, dimensions, finite values and float32 range are checked before the SDK's
final cast, with numerical arithmetic checks during decoding.
Clean `2592b1d` passes 1,306 installed SDK CPU checks on 1,272 explicitly
original-record-derived inputs. Guarded float32 groups and controller actions
match the same actual SDK result exactly. It also passes 1,330 original controller
and 76 numeric checks on isolated Linux. Independent verification confirms 2,706
source/input comparisons, five actual process releases, clean frozen source and
unchanged canonical user changes. Local verification matches 44 production/manifest
comparisons, 58 shared controller cases, 24 shared RoboCasa records and identical
four-provider numeric results. CUDA remains uninitialized with zero model,
inference, simulator or control allocation. Original normalized network predictions
and loaded-model/task acceptance retain their separate requirements.
See [SDK decoding validation](implementation/cpu-release-validation.md#gr00t-checkpoint-action-decoding).

GR00T controller conversion belongs to each provider's `native_action_record`,
used by both online inference and original-record CPU inspection. ActionSpec,
numeric groups, matching horizons and integer request limits 1–512 pass admission
before native mapping. Clean `30c50d4` passes 85 checks per CPU platform on 27
original BEHAVIOR/RoboCasa records. Linux additionally passes 1,330 checks on
1,272 original records, including 1,248 complete BEHAVIOR model outputs. Original
native values and model records remain unchanged. Independent checks verify 1,354
Linux source/input comparisons, four actual process releases and unchanged user
changes; local comparison matches 24 implementation and 31 original-input identities.
Clean `de9b7f2` includes this conversion in the configured CPU campaign, with
31 components and 548 admission/process/wire/resource cases per platform on
macOS and isolated Linux. Independent checks verify 469 source/input comparisons,
twelve context-source comparisons and 31 actual diagnostic process-group releases
per platform. Campaign output admission resolves actual filesystem parents within
the checkout's `.local/work`; three real CLI checks reject invalid outputs before
component startup. Linux additionally confirms actual campaign-runner release,
clean frozen source and unchanged canonical user changes.
No model, simulator, inference or GPU allocates. Raw
RoboCasa probabilities, SDK group dtypes and complete loaded-model/task behavior
retain native acceptance requirements.
See [controller validation](implementation/cpu-release-validation.md#gr00t-controller-conversion).

Core tool output evidence selection belongs to `tools/core-output.ts`. UpperRun
supplies the calling Verifier's check sample and admits assignment grants and
visibility before native DSH rendering. Clean `c857e13` matches 98 original core
results per platform across seven tasks on macOS and isolated Linux, including
27 image results, 81 images and six formal checks. The current source also passes
all thirty CPU components and 463 admission/process/wire/resource cases per
platform. Independent checks verify 428 source/input comparisons and thirty
actual process-group releases per platform. Linux additionally
verifies twelve context-implementation hashes and actual campaign-runner release.
Original records, clean frozen source and canonical server changes remain unchanged.
GPU/model/environment allocation and controls remain zero.
See [tool evidence validation](implementation/cpu-release-validation.md#core-tool-evidence-selection).

Native RGB-D geometry uses scoped arithmetic checks for back-projection, ranges
and camera/world coordinate reductions. Clean `27b3950` passes 39 CPU checks per
platform on macOS and isolated Linux: thirteen original native captures and
twenty-six explicitly invalid finite-calibration derivatives. Original geometry
stays within its recorded float64 accumulation allowance. Independent verification
matches 78 input/source hashes per platform, report/archive digests and released
diagnostic processes. No model, simulator or GPU allocates.
See [numeric geometry acceptance](implementation/cpu-release-validation.md#numeric-geometry-admission).

GR00T model-input admission uses the actual SDK collator and native bfloat16
conversion before model inference. State must remain floating-point and every
prepared tensor must be finite and noncomplex. Clean `48bcc47` passes 72 installed
processor/codec checks on forty-six original four-provider requests, including
twelve GR00T invalid-state/dtype/conversion derivatives. Original prepared values
are unchanged. The production constructors also pass 111 configuration checks
on macOS and isolated Linux. Independent checks verify 418 SDK/input/source hashes,
16 configuration sources, 327 derivative hashes and 51 local source comparisons.
CUDA remains uninitialized; model, inference, simulator and control allocations
remain zero. See [model-input acceptance](implementation/cpu-release-validation.md#gr00t-pre-inference-model-input-admission).

RoboTwin startup prepares its real saved SDK processors before policy construction.
Tokenizer/model features, loaded normalization modes and finite native statistics,
absolute-target semantics and matching action inverse statistics must pass admission.
Clean `d937330` passes 22 original/invalid processor checks and sixty installed
processor/codec checks on forty-six original requests, with unchanged prepared
values and zero CUDA initialization. Independent verification matches 416 SDK/
input/source hashes, 14 configuration/tokenizer hashes, 105 derivative hashes and
42 local source comparisons. This acceptance constructs no policy network and
performs no inference or controls. See [saved-processor admission](implementation/checkpoint-bindings.md#lerobot-saved-processor-admission).

GR00T startup admits model/processor/statistics compatibility before optional SDK
imports and policy construction. The production constructors check ordered
modalities, temporal indices, action semantics, processor capacities and finite
native normalization dimensions. Clean `2821c21` passes 111 original/invalid
configuration checks and sixty shared input checks on both macOS and isolated
Linux. Sixty actual installed processor/codec checks on forty-six original requests
retain identical prepared tensor/envelope values. Independent verification matches
416 SDK source/input hashes, 45 configuration/input hashes and 84 local comparisons.
No model, environment, inference or controls allocate. Loaded-policy and complete
native task acceptance remain required; see [checkpoint admission](implementation/checkpoint-bindings.md#gr00t-configuration-admission).

Every learned adapter exposes its production request preparation for CPU inspection
using real installed checkpoint processors or the OpenPI codec. LeRobot validates
prepared tensor values after saved normalization and before policy inference.
Clean `a97d0a9` passes sixty CPU checks on forty-six original four-provider requests,
including fourteen normalization rejection checks. Independent verification matches
414 SDK/checkpoint/input/source hashes. CUDA stays uninitialized, original files and
canonical server status remain unchanged, and diagnostic processes release. This
acceptance constructs no policy network and performs no inference or device controls.
The same clean source passes all thirty configured CPU components on macOS and
isolated Linux, with 463 admission/process/wire/resource cases per platform, 383
source/input comparisons, sixty process receipts and sixty-one actual OS release
checks. Four native cases/eight planned submissions match across platforms with
zero allocation. Loaded models and complete native tasks retain their release gates.

Policy numeric output admission requires real numeric arrays, positive dimensions,
declared action shapes and finite values before native conversion. OpenPI checks
finite float32 range before narrowing. Adapter-owned GR00T mappings, LeRobot
tensor/controller conversion and OpenPI gripper semantics remain authoritative.
Seventy-six original-record/declared invalid-output checks pass on macOS and Linux
with no model SDK imports, model calls or GPU allocation. Clean `deb5207` passes
all thirty configured CPU components and 463 admission/process/wire/resource
cases per platform. Independent verification matches 383 component source/input
hashes, twenty-three diagnostic hashes, sixty process receipts and sixty-one
actual OS release checks. The installed LeRobot/Torch module separately passes
seventy CPU conversion checks on seven original RoboTwin records with exact action
values and no GPU initialization. Fourteen source/input hashes independently match;
the SDK environment's seventy-nine packages pass compatibility checks. Both platforms
prepare four native cases/eight submissions without models, environments or controls.
Loaded-model/device and complete native task gates remain required.

All four learned-policy adapters use the shared model-independent observation
input owner. Before model calls, source observation and embodiment identities,
RGB PNG format/dimensions/byte bounds and finite float32 state representation
must pass admission. Native camera/state mappings, tensor batch transforms,
checkpoint normalization and action conversion stay with the selected adapter.
Sixty CPU checks on four original requests verify twelve cameras, twenty-eight
state groups and declared invalid derivatives without SDK imports or model calls.
RoboDojo prepared tensors match their actual native inference hashes. Clean
`7e04e8e` passes all twenty-nine configured CPU components on macOS and isolated
Linux, with 387 admission/process/wire/resource cases per platform. Independent
comparison verifies 355 component source/input hashes, twenty-two diagnostic hashes,
fifty-eight process receipts and fifty-nine actual OS release checks. Original
files and canonical server status remain unchanged. Both platforms prepare four
native cases and eight planned submissions without model, environment or control
allocation. Loaded-model/device and native-task behavior retain their GPU gates.

The policy server validates the request schema, ActionSpec, execution mode and
selected checkpoint identity before inference admission. Explicit unsupported,
null, boolean and numeric mode selectors fail without invoking a model. An omitted
selector retains the learned-policy default. Original request/action scopes,
response normalization, service ownership and ActionGate continue to apply.
Clean `d3336fc` passes all twenty-eight CPU components and 327 admission/process/
wire/resource cases per platform on macOS and isolated Linux. Independent comparison
verifies 327 component source/input hashes, fifty-six process receipts and fifty-seven
actual OS release checks. Both platforms prepare the same four native cases and
eight planned submissions without models, environments or controls. Current-source
CPU preparation is complete; loaded-model/device and native-task behavior retain
their GPU acceptance requirements.

Selected checkpoint identity reaches the execution boundary. Learned profiles bind
`checkpointSha256` to Worker initialization and ActionGate tickets; requests,
responses and admitted segments use optional `checkpoint_sha256`. The policy
service checks its own verified artifact before inference, and the client/Gate
require the selected identity before dispatch. Hybrid profiles bind the selected
identity to lower-policy proposal requests and validate their complete scope before
model review. Direct model profiles use their model binding. CPU checks preserve
original action values and exercise actual rejection/connection/resource boundaries;
clean `416a38a` passes all twenty-eight components and 323 admission/process/wire/resource
cases per platform on macOS and isolated Linux. Independent comparison verifies
326 component source/input hashes, fifty-six process receipts and fifty-seven
actual OS release checks. Original files and canonical server status remain
unchanged. Loaded-policy and native task acceptance remain required.

Native launch profiles admit optional `checkpointSha256` and retain that identity
through immutable deployment, Console, Session and run metadata. GR00T/LeRobot
startup/inference telemetry contains the complete checkpoint file mapping;
recorded rollout audits verify the selected digest and preserved file/source
identity. OpenPI audits admit a complete configured ARX X5 inventory and saved
normalization. Clean `6877ce3` passes the twenty-eight-component CPU campaign on
macOS and isolated Linux, including sixteen original-record checks and twenty
four-provider configuration/factory/HTTP checks. Each platform passes 290
admission/process/wire/resource cases. Independent verification matches 318
component source/input hashes and all fifty-six process receipts; sixty-one actual
OS checks confirm owned process release. All four original checkpoints and the
canonical server checkout remain unchanged, with no GPU allocation.
Loaded custom-checkpoint compatibility and physical task acceptance retain their
native gates. See [checkpoint bindings](implementation/checkpoint-bindings.md).

Native GR00T/LeRobot and OpenPI startup supports a configured checkpoint SHA256
before SDK imports. Compatible custom artifacts retain actual file identity,
saved normalization and mandatory adapter modality/action checks. Existing
reference defaults remain available. [Checkpoint bindings](implementation/checkpoint-bindings.md)
define the CLI, identity calculation and CPU/native acceptance boundaries.
Native OpenPI also validates fourteen-channel finite ARX X5 saved normalization
against its complete inventory before model SDK imports. Its JSON bridge admits
digest syntax before listener/client allocation. Forty-four actual startup cases
and eight original-file/declared invalid-input normalization checks pass on macOS
and isolated Linux. Clean `43ad63c` completes all twenty-six CPU components with
254 admission/process/wire/resource cases per platform, source/input comparisons
and independently confirmed process release. Original checkpoint/normalization
data and canonical server status remain unchanged.

Production native deployment and multi-provider workspace assembly belong to
`apps/server/src/native-deployment.mjs` and `native-workspace.mjs`. Runnable
examples select these factories. Original exports, profile configuration and
repository-root resolution pass direct source/module checks; all twenty-six
CPU components pass after relocation. The
[code map](development/code-map.md) identifies each implementation owner.

Native policy service startup, model identity and inference audit belong to
`physical_harness/policies/services`. Five example entries import those same
production functions. Direct module and example entries pass twenty-four actual
CPU startup cases; original logic, repository root, schema/manifest data and
function identity have separate checks. Current `d8b3aee` passes forty-two startup
cases within all twenty-six CPU components on both platforms, with 252
admission/process/wire/resource cases per platform. Independent comparison
verifies 216 component source hashes, original inputs/configuration and fifty-two
process receipts; fifty-six actual OS checks confirm process/group release.
Actual original checkpoints for all four providers pass selected identity checks
on Linux. The canonical checkout status and original checkpoint files remain
unchanged. Model SDKs load only in selected startup;
loaded inference and physical workflows retain native acceptance requirements.

The CPU campaign retains each diagnostic's process-group ownership until actual
exit and release. SIGINT/SIGTERM finish the active diagnostic and stop subsequent
admission; interrupted campaigns retain completed reports and publish no final
acceptance. Actual signal and complete CPU checks validate these boundaries
without loading models or simulators.
Frozen `0000db5` passes all twenty-six components and three signal cases on
isolated Linux. Six original data hashes, six configuration hashes, nineteen
diagnostic hashes and 202 component source-hash comparisons match macOS;
all process receipts and original reports retain their verified digests.

Native campaign cancellation keeps signal and driver ownership until the
request-matched Session finishes closure. Four actual CPU admission/failure/signal
cases on macOS and isolated Linux validate persistent and repeated cancellation,
original failure preservation and released process/writer/listener resources
without Worker or model allocation.
Loaded inference and device stopping retain their independent native gates.

Native Session operations, process communication and policy-record persistence
have explicit owners under `physical_harness/execution/`. The stable worker entry
is `python -m physical_harness.execution.worker`. Actual CPU process and
TypeScript host checks verify bounded communication and initialization cleanup.
The [source entry points](development/code-map.md) connect product responsibilities
to their implementation files. [CPU validation](implementation/cpu-release-validation.md)
records exact checks independently of native task acceptance.

Native worker configuration uses one complete preallocation schema in the
deployment loader and environment factory. Four configured providers pass the
production Console readiness check with no environment or model allocation.
The schema also owns the public Worker configuration type. Scene parameters
contain finite JSON data, and initialization uses a detached, recursively frozen
configuration/catalog snapshot before preparing or creating a Worker process.
Policy endpoint admission validates URL syntax before protocol, credential and
fragment checks, preserving field-specific preallocation errors.
The transport establishes process ownership before invoking the optional startup
observer, awaits its completion before initialization and confirms process release
before propagating an observer error.
Host requests admit bounded operation names and finite JSON arguments before
serialization or pending-request publication; successful result values use the
same finite JSON domain. Actual initialization interruption retains unknown
device/resource state after owned-process release.
Native device shutdown has one shared owner task. Cancellation and concurrent
close waiters preserve actual thread drain and its original result. Closing
rejects new operations; queued bind/stop/resume barriers recheck admission before
publishing a boundary. Source-file/OS-pipe CPU checks cover these rules with an
unallocated production adapter. Loaded SDK/device closure remains a native gate.
Session close and communication termination retain task/drain ownership through
shared operations. Both device and recording finalizers execute; every original
failure propagates. An uncertain motion boundary preserves resource authority.
ActionGate stop ownership survives caller cancellation. Concurrent waiters share
the original result. Action/resume failure handling retains both operation and
stop errors in the exception group and its receipt text. Failed stopping creates
no confirmed boundary. CPU checks validate ownership and real file/stop failures;
loaded control dispatch and resume keep their native acceptance requirements.
Native grouped operation errors retain their original nested causes in the
existing error receipt through the standard Python traceback formatter, with
local-variable capture disabled. Actual resource-error receipts pass JSON round
trips and preserve every original cause; ordinary error text remains stable.
Failure-time stopping serves action/resume, PolicyRollout and Worker paths with
the same original-error preservation and existing stop reason. Repeated handling
retains an error group already containing the exact stop cause. PolicyRollout
shutdown attempts both device stopping and policy closure and propagates every
original error. Actual CPU connection/owner/pipe checks verify these paths;
loaded simulator and policy execution remain native acceptance requirements.
The policy WebSocket client retains actual connection closure and full shutdown
through shared owner tasks. Cancelled and concurrent waiters preserve drain and
original errors. Pending or failed connection closure rejects new inference.
The inference caller may join connection closure during its own cleanup while
external shutdown awaits its exit. Closing from event/tool callbacks prevents
further response processing. Actual POSIX process/WebSocket checks verify these
rules without model, environment or action allocation.
The shared policy JSON decoder rejects duplicate fields, non-finite constants
and floating-point overflow through the standard library's decoding hooks.
Decoded request, event and tool consumers receive finite JSON values. Invalid
requests fail before inference admission and close their connection with the
generic public failure; original details remain in the service log.
The four EDH JSON policy services bind their configured listener before optional
SDK/model initialization. Connections are admitted only after policy readiness.
Startup failure and normal shutdown release bound Server resources and drain
owned inference work; the OpenPI bridge closes its upstream connection. All
five JSON/native policy CLIs provide argument help before optional SDK imports.
The native OpenPI producer admits its fixed port in `1..65535`, verifies the
complete pinned checkpoint and writes its verification report before optional
SDK imports. JAX device selection, trained-policy loading and the upstream
service follow these filesystem checks. Thirty-four example/module CLI cases
pass on macOS with no model or GPU allocation.
Clean `653a3ea` also passes the complete twenty-six-component CPU campaign on
macOS and isolated Linux, including 244 admission/process/wire/resource cases,
six visual cases, twelve original context reads and four-provider readiness.
Independent comparison verifies 214 component source hashes and fifty-two
process receipts; fifty-four actual OS absence checks confirm process release.
The actual eighteen-file RoboDojo checkpoint retains its identity through two
report-path failure checks before SDK imports. Loaded service/device/task gates
remain independent of this CPU acceptance.
Actual CPU process and network checks validate these stated startup boundaries;
loaded model startup retains native acceptance requirements.
Managed service startup has shared process ownership across its active leases.
Cancelling one admission retains a process needed by another admission. Last-lease
cancellation and global closure drain the owned process group, release readiness
ports and clear writer ownership. Actual configured Console processes verify these
rules on CPU; loaded model-service behavior retains its native requirements.
Managed shutdown waits for both the leader and its complete process group before
clearing PID ownership. Graceful and forced drain use bounded deadlines; original
deadline/release errors remain observable and unconfirmed ownership remains visible.
SAM3.1 and YOLO26 CLI argument help and port/checkpoint field checks precede optional
SDK imports. Valid service startup retains direct dependency imports and original
source/checkpoint verification. CPU argument checks provide no perception result.
Planner prerequisite goals use only admitted native checks and commit their own
passed-verdict plan update before a dependent goal starts. Source and readiness
checks have separate acceptance from physical tasks; see
[offline workspace readiness](implementation/native-workspace.md#offline-readiness).

Native Qwen/GR00T RoboCasa `CloseDrawer` run `043520a2` completes the original
task through 382 controls, 48 identified inferences and a fresh independent
Verifier. All 598 events have zero tool errors; Planner completes its plan and
seven TODOs, both roles retire and normal Session close releases resources.
The source-bound three-camera Agent-trace MP4 fully decodes 975 frames over
81.250 seconds. Exact configuration, source identities and evidence boundaries
are recorded in [native Casa success](implementation/robocasa-native-success.md).

This specification records confirmed requirements and implementation boundaries.
Items marked “v1 default” are initial implementation choices that may evolve through
configuration or a documented decision. Model checkpoints, compute and robot models
are deployment bindings; they do not block the framework design.

This revision defines the complete v1 runtime and its production acceptance boundaries.
Detailed wire payloads and validation rules are authoritative in the schema and
[contract guide](implementation/contracts.md); examples below are conceptual excerpts,
not complete copyable wire messages. Public documentation and SVG labels use English.

Reading order: start at Section 0; Sections 1–3 explain positioning and architecture;
4–8 define agents, communication, execution, verification and experience; 9–11 cover
adapters, tools and team authoring; 12–16 cover migration, acceptance and source entry
points. Section 17 links the canonical step-by-step implementation plan. All diagrams
are SVG assets; include their directory when handing over this document.

## 0. Handoff entry point

### 0.1 Current work and next action

Native context measurement, provider-usage projections and compaction belong to
`harness/agent-runtime/memory`. Generic DSH registration identities, event routing
and scope disposal belong to `harness/agent-runtime/foundation`. Their selected
source bytes and original imports remain unchanged; aliases and provenance records
identify the owning directories. Actual original Session journals verify native
measurement/projection isolation and complete scope release without replaying
tool calls or invoking models. See [context CPU validation](implementation/cpu-release-validation.md#native-context-and-scope-ownership).

Native policy services share `physical_harness.policies.inference` for one-thread
operation ownership. Inference and its audit records finish under that owner
despite caller cancellation. Concurrent admission fails; shutdown drains actual
work, and original model or recording errors preserve scoped evidence before
propagation. The CPU diagnostic verifies actual recording/pipe/thread lifecycle
without allocating a simulator or providing a model result. Loaded-policy and
physical-task acceptance retain their native release requirements.

The tools module owns logical parameters, model-visible schema preparation and
output evidence selection in `core-inputs.ts`, `model-schema.ts` and `core-output.ts`.
The application, role workflow checks
and recorded-plan readers use its public exports. Each generated parameter object
is independent of canonical definitions and caller-provided role/plan schemas.
Native DSH remains the registration, dispatch and validation owner. Actual
recorded request/plan inspection and parameter-scope checks are documented in
[CPU validation](implementation/cpu-release-validation.md#model-visible-tool-schemas).
UpperRun supplies formal-check context and admits selected output references
through assignment grants and SensorSamples before native DSH result rendering.
Original tool receipts and persisted native Session audits verify exact JSON
text and ordered image attachments through the production selector.

Host worker communication and confirmed process release belong to
`apps/server/src/native-worker-transport.ts`; retained environment/task/image
assembly belongs to `native-worker.ts`. Python Session operations, process
communication and original request/control recording have their own execution
modules. The [code map](development/code-map.md) identifies each concrete source;
[CPU validation](implementation/cpu-release-validation.md) records actual
request, pipe, cancellation, initialization and cleanup checks.

Current native validation uses at most one physical GPU selected from the
authorized deployment range. Single-GPU Qwen/Pi0.5 RoboDojo run `551fa79d`
verifies a failed attempt, Planner-authorized retained-scene retry, original task
success, completed plan/TODOs, zero tool errors and confirmed Session release.
The owned OpenPI bridge also accepts an already-used identified native service
with explicit request/instruction/state/camera identity. Real startup/deadline
failure checks retain original errors and cleanup records. Exact sources and
remaining efficiency/release gates are documented in
[single-GPU acceptance](implementation/single-gpu-native-acceptance.md).

The current priority is CPU-accessible implementation, production-path debugging
and GPU-provider source/protocol/lifecycle checks. Current-code native model/policy
workflows, multi-task continuity and reproducible release configuration retain the
consolidated campaign's acceptance gates. The maintained
[implementation plan](implementation/plan.md) records each owner and remaining requirement.
One configured CPU campaign validates shared ownership, original contexts,
preallocation and every supported provider's Console CLI. It retains individual
logs and source-bound reports; its command and exact macOS/Linux acceptance are
documented in [CPU validation](implementation/cpu-release-validation.md#consolidated-cpu-campaign).
Live Teams set `learning_enabled: false`;
SceneState development is deferred. The [current Agent loop](implementation/current-agent-loop.md)
records actual system prompt sources, context assembly, memory and retry behavior.
Responsibility-bound numbered workflows and model-facing parameter/receipt guidance
are documented in [prompt workflows](implementation/prompt-workflow.md). Their
contents contribute to the Team digest for every configured physical profile.
Planner can explicitly complete its native turn with `execution.query` and
`completeTurn: true` after reviewing the current admitted execution. Its scoped
status receipt precedes turn completion and delivery of subsequent observations or
formal verdicts. Ordinary query behavior remains available within a decision turn.
Native background faults fail the active run and retire roles through the existing
host. Owned process-group cleanup preserves original errors and unconfirmed device
state; it creates no stop acknowledgement or verification boundary. The
[production fault record](implementation/native-console-fault.md) retains actual
model, SDK, scope, deadline, event, source and OS-release evidence.
Native Qwen/Pi0.5 RoboTwin run `686c9767` verifies failed-attempt recovery and
successful completion with zero tool errors. Clean custom-role run `a5d9132e`
completes its retained-scene retry with explicit SceneAnalyst evidence/report
communication, independent formal verification and zero tool errors.
Native RoboDojo run `897f215d`
verifies a failed attempt and Planner-owned retained-scene retry, followed by native
and independent formal success with zero tool errors. Its subsequent same-Session
task verifies the unchanged ended episode through fresh role contexts and a new
confirmed boundary, with zero new actions or policy requests.
Native Qwen/GR00T RoboCasa retry exhaustion concludes with the observed failed
outcome, completed factual assessment TODOs and released resources. Structured
plan parameters preserve their canonical types. SAM masks use bounded lossless
PNG storage for source-bound geometry. Actual acceptance records are in
[progress](implementation/progress.md).
The
[Qwen headless handoff](implementation/qwen-headless-checkpoint.md) records exact task,
source, checkpoint, verification and shutdown evidence, preserved work and the
continuation requirements. Official DSH releases receive weekly read-only assessment.
Selected upstream ToolCallRecovery and JSON intrinsic-constructor adaptations have
live Qwen, persisted native-history and actual JavaScriptCore acceptance. Failed
steps preserve completed results, record unknown/not-started outcomes and retain
their original errors without replaying physical dispatch.

The [native workspace deployment](implementation/native-workspace.md) loads
configured environment groups into one Console. Each profile binds its own trusted
Team and role directory, alongside the compatible embodiment, execution mode,
checkpoint and model. All resolved Teams contribute to immutable deployment
identity. Selecting a profile shows its configured roles; admitting a Session
fixes that configuration until the Session closes. Actual four-provider startup,
browser selection and normal shutdown pass without simulator allocation or model
inference. Allocated-environment task switching requires its own native acceptance.
Sequential allocated BEHAVIOR and RoboCasa Sessions also verify native capture,
actual Qwen inspection and confirmed close through the unified Console; these
inspection tasks produce no learned actions or formal task success.

The release objective is a complete v1 implementation of all agreed capabilities.
The [v1 delivery register](implementation/v1-delivery.md) connects each remaining
capability to its implementation and actual acceptance requirements, including the
integrated agent/task/sensor visualization.

The active scope covers the complete upper agent workflow, all four simulation
providers and actual VLM/policy integration tests. Installation, native SDK checks,
transport integration and model-driven task acceptance have separate evidence gates.
The [live integration acceptance plan](implementation/live-integration.md) defines
the required checks and the current provider matrix.
The [DSH release adaptation guide](implementation/dsh-release-adaptation.md) records
reviewed upstream changes, absorbed mechanisms and compatibility requirements for
the existing model providers, role lifecycle and persisted history.
The Qwen deployment inherits native vLLM tool parsing and configures XGrammar's
parameter whitespace bound. Complete tool schemas, native DSH streaming and
reasoning remain preserved. The actual 38,069-token Planner context has model
acceptance with 47–59 completion tokens; the
[generation guide](implementation/qwen-tool-generation.md) records exact source,
configuration, nested-plan validation and read-only acceptance boundaries.

GPU-host access is now available for simulation integration. The active delivery
priority is a real environment-to-console workflow, retaining DSH role orchestration,
policy client/server inference, action admission and formal verification. Supported
versions and checkpoint/embodiment compatibility must be recorded from actual upstream
sources and validated on the host. All four native providers have actual task or
lifecycle evidence; successful task completion, clean workflows and each additional
task/checkpoint combination retain independent acceptance requirements.

Each simulator, upper model service and policy service uses an isolated dependency
environment. Host system Python, existing environments and global graphics libraries
remain unchanged. The GPU deployment has verified native MuJoCo physics and NVIDIA
EGL rendering in the RoboCasa environment. Source pins, setup requirements and exact
acceptance boundaries are recorded in [GPU integration](implementation/gpu-integration.md).
Shared runtime code must remain independent of GPU model, vendor, device index and
host directory layout. Providers declare their actual device requirements; deployment
configuration selects compatible devices, rendering and inference settings. Each supported
combination needs its own acceptance evidence, and unsupported combinations fail admission.

The runtime reuses DSH with EDH-owned Team/Role composition, tools, TODOs,
persistent plans/private files, explicit communication, formal verification,
recovery records, selective SKILL retrieval and the unified console. Native Qwen
and learned-policy task runs validate the model-to-worker path, scoped evidence,
explicit retained-scene retry, terminal receipts and resource release. Multi-goal
and prerequisite-recovery acceptance with actual simulation remains open.
The server accepts explicit deployment bindings for tasks, native DSH models,
tools and backend factories. Built-in native factories validate saved configuration,
Teams, compatible launch profiles and the configured benchmark catalog before
environment allocation; see the [deployment guide](implementation/deployments.md).
OpenAI-compatible VLM transport reuses native DSH serialization and streaming.
Cloud API and vLLM bindings can be loaded from YAML/JSON with explicit authentication,
model aliases, image capabilities and endpoint-specific request options. The configured
image service resolves request images, and a non-secret configuration digest contributes
to deployment identity. See [model configuration](implementation/model-configuration.md).
WebSocket learned-policy transport and ActionGate execute actual native controls.
Atomic record retirement and live history-index reconciliation are implemented at
the storage boundary. Application
retention has a configured controller for declared record references, SKILL-source
preservation, durable request identities and leased external sources. Session/request
owners now inspect complete task membership, reverse ownership and catalog dependencies.
Evidence/verification owners inspect image metadata, stopped boundaries, formal contexts
and accepted-verdict sources through their existing readers.
Report owners retain sender/recipient, evidence, version history and receipts, sharing
validated report readers and predecessor checks with ordinary history inspection.
Assignment/recovery owners retain explicit delegation, evidence, formal-result and
ordered event sources, including both failed and successful recovery provenance.
Run/configuration/restart owners retain published history, typed task sources and
selected historical context, with same-session and immutable configuration checks.
Event/message ownership retains typed source references and supports versioned
deployment extensions, including legacy inline history. Submission, plan, private
file, clarification and native-audit owners complete the built-in native composition.
Default native deployments bind explicit record/image source leases and fail on
unknown payload formats. Idle-only archive/inspect/retire and original-image
collection require current revisions and explicit operator admission. Private copies
of actual journals verify independent Session selection, preserved other Sessions,
restart reconciliation and retained request identities; original source audits remain
unchanged. See [domain retention](implementation/domain-retention.md).
The packaged Desktop launcher starts its owned local service from actual saved
native configuration, opens the unified console and exposes compatible selectors.
Actual Stop service and application-quit checks release journal writers, terminate
owned children and close listeners. Signed distribution and the complete installed
application task matrix remain open. Active-task clarification has native/file/HTTP
and console acceptance; complete live clarification/pause/resume continuation still
requires its own acceptance. The host-to-Python worker bridge preserves independent
task identities, native observations and actual post-execution check authority.
See the [adapter guide and SVG](implementation/model-policy-adapters.md) for exact
interfaces, commands and provider-specific acceptance. The execution port requires a confirmed pause and explicit Planner resume,
with execution/boundary/state-version preconditions and a matching published backend
update. An owner ID in a prior subgoal is not a new authorization. See the
[execution contract](../harness/agent-runtime/execution/README.md).
Formal-check contexts persist request/boundary identities, scoped facts and evidence
references. Only active assignment identities and accepted versions remain resident;
native retirement releases them while historical records remain inspectable. The
Assignment inspector exposes saved check facts and accepted verdicts separately,
validating their task, execution, boundary, criteria and evidence identities. See
[verification lifetime](../harness/agent-runtime/verification/README.md).
Accepted verdicts have immutable complete records and compact run summaries. Planner
decisions, recovery, selected historical task context and SKILL source inspection
resolve full results explicitly. The console selects individual accepted results;
missing or conflicting records remain explicit. See
[verdict publication and inspection](implementation/verdict-history.md).
Formal boundary admission uses run, execution and boundary identities together.
Continuous paused updates preserve their stopped facts; a new stop after resume and
a paused-to-ended transition require fresh boundary identities. Immutable admission
records precede native verifier scheduling. See
[verification boundaries](implementation/verification-boundaries.md).
The unified console now displays key
state without page/tab switching; further polish follows actual provider integration.
Native DSH [context management](implementation/context-management.md) is available
by explicit deployment policy, with scoped authoritative state after compaction.
Optional whole-message visual retention bounds historical image blocks while preserving
fresh observations and original evidence audits; oversized fresh batches fail explicitly.
Native [event residency](implementation/session-history.md) publishes and validates older
Session events before releasing their resident bodies. Deployment defaults retain at
most 256 events and 8 MiB of encoded event bodies at audit checkpoints. Logical history
remains readable; active model context and application projections have separate limits.
Role report queries return bounded history pages with explicit earlier-version cursors.
Agents request earlier report bodies when needed; the console provides the same
read-only navigation. Acknowledgement and startup reconciliation traverse published
versions individually. See [report inspection](implementation/report-acknowledgements.md).
Retired role briefs, TODO/report bodies, last observations and stream frames move into
verified immutable archives. Compact run summaries preserve status and caller identity;
the console loads selected historical details explicitly. See
[assignment history](implementation/assignment-history.md) for publication, API and limits.
Workspace session/task lists use bounded summary pages and independent active records.
An application-owned SQLite summary index tracks committed source revisions and run
ownership. Page reads use ordered indexes; startup and compaction reconcile from the
authoritative journal. Source/index write failures remain explicit and reopening repairs
incomplete derived publication without executing models or devices.
The console supports session filtering, earlier/recent history and cross-page selection
of task outcomes. See [workspace history](implementation/workspace-history.md).
[Physical profiles](implementation/physical-profiles.md) bind declared simulator,
embodiment, policy mappings and role context; installed adapter validation is required.
Read [progress](implementation/progress.md), [upper-runtime guide](implementation/upper-runtime.md)
and [capability map](implementation/features.md) for concrete code, checks and limits.
Do not install the simulator/GPU stack merely to run the upper acceptance suite.

Configured and Planner-created GoalBindings share complete field validation, wire
success/budget definitions and a 64-identity task limit. Plan-derived bindings validate
before journal publication; subsequent catalog admission preserves existing bindings
and rejects invalid batches without partial updates. See
[goal admission](../harness/agent-runtime/tasks/README.md#goal-binding-admission).

Each new User Session stores an immutable task catalog supplied by its deployment or
the allocated environment's `describeTasks` method. Console task choices and criteria
inspection read that session catalog. Submission confirms its content digest, and task
backend creation receives the selected definition and digest. Snapshot ownership,
shape and content are validated independently of model decisions. See
[catalog discovery, persistence and acceptance](implementation/session-task-catalogs.md).

### User-session and launcher clarification (v1.12)

A user conversation is a **User Session** containing multiple sequential task runs
on one retained environment. DSH role sessions remain independent assignment contexts.
Session-open requests have immutable persisted request-to-session identities. Duplicate
requests directly read the matching record and compare the complete serialized launch
configuration. Startup reconciles source-only admissions and interrupts unfinished
sessions without allocating an environment. See the
[request publication rules](implementation/user-sessions.md#session-open-request-identity).
Ending a task releases its control scope; ending the user session releases the environment.
Session records retain a task-history count and latest-task reference. Immutable
per-task memberships preserve ownership without expanding the session document on
each admission. Startup migrates legacy task arrays, and existing paged task routes
provide full history. See [membership publication](implementation/user-sessions.md#task-membership-history).
The console is the primary session launcher and status surface. The
[desktop application](../apps/desktop/README.md) selects a launch configuration,
starts the existing server in an owned process and opens the console. It requires
a prepared checkout and a trusted deployment factory. Stop and application quit
wait for cleanup and process exit; abnormal exit preserves an explicit error.
Actual packaged launcher startup, saved native profile selection, Stop service and
application-quit cleanup are verified. Published signed installers and installed
task execution across the supported configuration matrix remain open.
Launch selections must resolve installed environment,
embodiment, policy/checkpoint, upper model and role/tool configurations before allocation.
Experience is workspace-wide and explicitly retrieved across sessions, with source and
transfer-validation limits retained. Read the [session lifecycle and remaining steps](implementation/user-sessions.md)
and [legacy design migration audit](implementation/legacy-migration.md).

The console resolves dependent runtime-source, environment, embodiment, checkpoint,
policy and default-model selectors against installed complete launch profiles. Browser
and server validate the selected combination; stale catalog revisions fail before
allocation. An active session keeps its configuration fixed until it ends. Mermaid
Team relationships and status animations use configured roles and actual assignment
records, with separate execution and verification indicators. Branding uses the project
logo and a blue/white palette. Debug output remains directly inspectable.

Session task admission accepts an editable user instruction and up to four explicitly
selected historical outcomes from that session. Selected criteria remain immutable
session-catalog bindings. Ownership, terminal state, input limits and complete request
identity are checked before allocation. A saved submission records the criteria and
context snapshot. The entry Planner receives this context through its InvocationBrief;
delegated agents retain independent caller-provided briefs. Browser drafts survive
status refreshes, and unconfirmed submissions retain their request identity for retry.
Active-task clarification uses Planner `user.ask`, durable question/answer records,
native DSH turn conclusion and followup delivery, plus a console response panel.
Answer acceptance retains current criteria and execution permissions; resumed execution
requires an explicit Planner decision. Restart interrupts unfinished interactions.
See [clarification behavior and acceptance](implementation/user-clarification.md).
Built-in native factories admit the configured benchmark task and preserve its
criterion separately from editable user instructions. The environment remains
allocated between sequential runs. Native terminal preflight obtains the provider's
current ended state before creating a policy client; an ended episode publishes a
fresh confirmed boundary and observation with zero new controls or policy requests.
RoboDojo and RoboTwin have actual same-Session, unchanged-terminal acceptance.
Additional providers retain their original terminal-source acceptance requirements.
Changing to a task that requires another native scene needs a new User Session.
Live clarification/pause/resume acceptance remains provider-specific.

### 0.2 Repository and workspace

Repository: [Embodied-DeepSeek-Harness](https://github.com/jixinyan/Embodied-DeepSeek-Harness).
Paths are relative to this repository unless explicitly identified as upstream source
paths. EDH owns the architecture and selectively absorbs DSH; it does not copy the
entire upstream product. See [provenance](provenance/README.md) for the pinned source
and dependency audit. Legacy code and the old demo are optional migration assets;
confirmed design, diagrams and authoring examples are included here.

Continue the existing checkout rather than working in a temporary research clone.
See [progress](implementation/progress.md) for actual completion evidence. Directory
and type declarations do not satisfy Step 00's runtime-integration acceptance gate.

### 0.3 Decisions that do not require conversation history

- Use the DSH runtime, with a TypeScript host and optional Python workers. Do not add
  a second Deep Agents/LangGraph agent loop.
- User-defined teams and roles are the composition units. Planner, Verifier and
  Evolver are defaults, not a fixed enum of all possible agents.
- Every new delegation gets a fresh session, sufficient InvocationBrief, private
  working files, explicit tool view and independent message context.
- Register all tools through the catalog. Policy execution is one tool category;
  a perception model can be a provider without being an agent.
- The upper decision owner exclusively controls retry, replan and resume. Verifier
  begins after an eligible execution has ended at a confirmed device boundary.
  Budget exhaustion must enter formal verification.
- Limited GT checks are agent-visible. Complete hidden state is debug-only;
  Evolver cannot bypass visibility through the evidence store.
- An explicit retry starts recovery recording. Publish successful experience only
  after the designated verifier confirms the original recovery goal.
- Simulation comes first. Test hardware interface contracts in v1; real hardware
  runs and policy fine-tuning follow separately.

### 0.4 First implementation report

Report the actual repository commit, working-tree changes, existing modules and spec
version. Identify the selected work item, target files and locally executable checks.
Missing checkpoints do not block protocol/team/tool work; record limitations that
prevent real execution instead of claiming completion.

Progress records include completed work, changed files, commands and results,
unexecuted checks with reasons, and the next item. Preserve unrelated work. Do not
start real hardware, publish software, upload private run data or overwrite the old
project without authorization. Commit verified, coherent checkpoints frequently.

## 1. Project positioning

Build an open-source embodied task framework using DSH runtime implementations.
Users organize agent teams with concise role definitions and team configuration,
then issue tasks through a physical control console. An upper VLM uses planning,
files, communication, perception, active observation and execution tools to complete
long-horizon tasks in simulation or on hardware. Verifier checks outcomes after
eligible execution ends; the upper decision owner chooses retries and replans. Evolver
tracks explicit recovery attempts and turns formally verified recovery into reusable
`SKILL.md` knowledge.

Primary users are embodied intelligence researchers, policy/environment adapter
developers, and operators who need to observe and debug long-horizon robot tasks.

Example: “Put the cup on the table into the cabinet.” The same semantic goal and
communication protocol can apply to different environments or robots. Adapters bind
objects, sensors, controls and success checks. Task organization and experience may
transfer, but policy/hardware compatibility still requires validation.

### 1.1 Highlights and claims to validate

| Highlight                                      | Concrete design                                                                                                             | Evidence required                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| DSH-based physical task loop                   | Reuse the agent runtime; add asynchronous execution, device feedback, verification gates and physical events                | Complete a long-horizon task and recovery without inventing another LLM loop                     |
| User-defined agent teams                       | ROLE.md specifies responsibility/tools; team.yaml binds members and decision roles                                          | Add or replace a role through configuration without modifying fixed agent types or routing       |
| Complete, open tool surface                    | One catalog covers planning/files, SAM-like perception, active observation, policies and checks                             | Compose a new role from existing tools; expose a new perception provider to compatible roles     |
| Independent contexts and explicit cooperation  | Fresh delegation sessions, complete task briefs, direct messaging and subscriptions                                         | Actual model-input checks demonstrate that only explicitly delivered/read information is visible |
| Execution followed by independent verification | Record policy execution and its confirmed end before creating Verifier; require formal checking after budget expiry         | Trace execution, final report, confirmed boundary, checks and verdict on one timeline            |
| Learning from successful retries               | Retry starts Evolver; original-goal recovery success enables skill creation                                                 | Trace every skill to failure, changes, attempts and success evidence                             |
| Replaceable policies, environments and bodies  | Separate semantic contracts from concrete adapters with declared compatibility                                              | Add a second configuration without modifying the general core                                    |
| Physical task observability                    | Console displays agents, devices, plans, messages, evidence references and experience; simulator-host video records cameras | Explain why motion stopped, who requested a retry and which skill was used                       |

These are engineering goals and research claims to test, not assertions of academic
novelty or already demonstrated cross-environment generalization.

## 2. Scope and invariants

### 2.1 Confirmed principles

1. **Reuse the DSH core.** Agent creation, model loop, sessions, tools and lifecycle
   use selected DSH implementations. Domain modules and UI belong to EDH. Python
   workers do not implement a second agent core.
2. **Contexts are independent.** Do not fork the caller's history or copy its system
   prompt, conversation, working memory or other agents' contexts. Every new
   delegation begins with an explicit caller-provided brief.
3. **One assignment may accumulate its own inputs.** A continuing Verifier/Evolver
   keeps observations and messages received within that assignment. A new assignment
   or replacement instance needs an explicit handoff.
4. **The upper VLM owns retry, replan and resume.** Policy providers, Verifier,
   Evolver and event handlers cannot autonomously create a new task attempt.
5. **Verification belongs to an agent.** Simulation GT is the verifier's fact tool,
   not a hidden task decision that bypasses the verifier.
6. **Verifier starts after eligible execution ends.** It receives a fresh brief,
   final execution report and authorized evidence only after the device boundary is
   confirmed. Budget expiry forces formal verification. Ordinary pause remains a
   Planner-controlled execution state and does not create a verifier assignment.
7. **Retry triggers Evolver.** Skills require formal recovery-goal confirmation and
   serve the upper planner/verifier; VLA/VLN consumption of Markdown is not required.
8. **Agents compose through teams and roles.** Users define responsibilities, tools
   and output contracts. Routing must not hard-code planner/verifier/evolver or
   manipulation/navigation as the only possible role types.
9. **Cover simulation and hardware.** v1 runs simulation and validates hardware
   integration contracts; actual hardware trials follow later.
10. **Experience cannot rewrite success criteria.** Preserve the source and version
    of the user's task conditions and benchmark evaluator.
11. **Tools are first-class extension points.** Planning, files, perception, active
    observation, communication, execution, verification and memory are selectable.
    Schedule actual effects; a “perception” label does not imply no physical motion.

### 2.2 v1 delivery boundary

| v1                                                                                                                                                         | Later extensions                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| DSH integration, Team/Role loader, independent sessions, generic task messages/events                                                                      | More complex multi-host agent deployment and workflow recovery          |
| Planning/files, pluggable perception/active observation, unified catalog; SAM 3.1 segmentation and YOLO26 depth integration with explicit model provenance | More perception providers, user tool packs and an extension marketplace |
| Default Planner, Verifier and one Evolver assignment per recovery chain                                                                                    | More roles, specialist verifiers and multi-robot cooperation            |
| Real policy-to-console task loops for BEHAVIOR-1K, RoboCasa and RoboTwin with configuration-selected compatible tasks, embodiments and checkpoints         | Further environment adapters                                            |
| A second configuration to test interfaces, with test/real status distinguished                                                                             | Broader cross-environment and cross-embodiment transfer evaluation      |
| Replaceable subgoal-policy interface, asynchronous jobs and hardware contract tests                                                                        | Fine-tuning, real robot trials and other control policies               |
| Post-execution formal verification with limited GT                                                                                                         | Real-device visual/sensor evidence providers                            |
| Retry → Evolver → evidenced SKILL → later retrieval                                                                                                        | Larger-scale automated skill evaluation and transfer validation         |
| Production console following the approved prototype direction                                                                                              | Teleoperation and additional robot-specific panels                      |

The upper layer initially focuses on embodied tasks, run analysis and experience
management while retaining general tool extensibility. A general coding assistant,
online training, direct SKILL injection into VLA, time-to-go prediction heads and
arbitrary hot-swapping are not v1 acceptance requirements.

The active implementation scope keeps Evolver paused and SceneState deferred.
Existing SKILL storage, explicit retrieval and recovery provenance remain available.
Their future execution/transfer requirements remain in the
[v1 register](implementation/v1-delivery.md).

## 3. Overall architecture

![EDH architecture](architecture/assets/framework-overview.svg)

[Open the architecture SVG](architecture/assets/framework-overview.svg)

Solid lines represent configuration, tasks or control; dashed lines represent
observations, feedback or experience. The numbered stages are team authoring,
independent role sessions and open tool capabilities. Physical execution and
experience return appear below. Every agent has its own context; connections denote
explicit calls and messages.

### 3.1 Deployment and responsibilities

| Layer                                   | Owns                                                                                         | Boundary                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Control console                         | Instructions, run state, plans, Agent trace, evidence and experience views                   | Uses structured facts to display device state                       |
| EDH host with absorbed DSH capabilities | Model calls, independent sessions, tools, agent creation and inboxes                         | Does not advance high-frequency control steps                       |
| EDH domain modules                      | Team/Role loading, catalog, messages, routing, verification gates, recovery and capabilities | No second LLM loop or autonomous retry decisions                    |
| Python execution worker                 | Policy calls, actions, budgets and device-state reports                                      | Cannot create new task attempts on its own                          |
| Environment/hardware backends           | Simulator state, connections and sensor/actuator I/O                                         | No environment-private types in general protocols                   |
| Evidence/memory providers               | Run records, authorized facts, skill versions and retrieval                                  | Stored information does not enter every agent context automatically |

The Planner directly perceives images, plans and makes execution decisions in a
ReAct-style observe/decide/act/observe loop using native DSH. Perception tool results
return images to that Planner; optional specialist agents are helpers, not a mandatory
visual interpretation stage. After eligible execution ends, Verifier receives
authorized stopped-boundary evidence and supplies checked images and authoritative
results for the Planner's next decision. See the
[illustrated loop](implementation/model-policy-adapters.md).

v1 defaults to one Planner per task, owning its physical decisions. The user-facing
coordinator and physical planner may be the same instance. An optional reception or
task-coordination role must preserve one unambiguous execution decision owner.

DSH capabilities handle creation and wake-up; EDH task routing handles explicit
messages across the composable team. DiMOS is a candidate to evaluate for hardware
integration, not a required dependency or replacement agent system.

## 4. Teams, roles, instances and context handoff

A Team is a user-declared collaboration structure. A Role is reusable responsibility
and tool configuration. An AgentInstance is an independent session created for one
assignment. A TeamMember is a stable addressing alias and may correspond to different
instances across assignments. Team membership never implies shared context.

For example, a user adds a `scene_analyst` role with segmentation/depth tools. Planner
can delegate object identification and receive structured candidates without adding
a dedicated hard-coded subagent builder. Calls shown below are intended interfaces.

### 4.1 Role templates

RoleDefinition declares `role_id`, responsibility, model routing, instructions, tools,
optional output schema and lifecycle. TeamDefinition binds subscriptions and duties.
Instances carry `agent_id`, `session_id`, `assignment_id`, `team_run_id`, task scope
and caller relationship. Section 11 defines authoring.

| Default  | Inputs                                                                                                                  | Output/capabilities                                                                                | Excluded responsibility                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Planner  | User goal, capability catalog, explicit observations, verifier feedback and retrieved skills                            | Plans, files, perception/active observation, subgoals, execution decisions, delegation and reports | Fabricating formal verdicts                                          |
| Verifier | Goal/criteria, final execution report, confirmed ended boundary, authorized before/after evidence and check permissions | Independent formal verdict, checked observations and necessary facts                               | Executing actions, viewing in-flight frames, retry, replan or resume |
| Evolver  | Original failure, recovery goal, upper-level changes, related records/events                                            | Evidenced skill bundle, version and summary                                                        | Robot control or changing task criteria                              |

Planner directly calls `execution.start`; the physical worker/policy returns
execution status and observations. The default workflow has no independent Executor
agent. Verifier begins only after an eligible policy execution has ended and its
device boundary is confirmed.

The host builds a fresh verifier brief after an eligible execution has ended and
the device confirms its stop boundary. It includes the Planner-selected goal,
admitted request, criteria, attempt, final execution report, resource budget,
execution status and authorized before/after evidence. The Verifier does not inherit
the Planner conversation or receive frames while execution is running. Ordinary
paused states retain their execution scope and do not create a verifier assignment.

A final role report closes new work admission and retires the native handle after
its current turn reaches quiescence, preserving the receipt, output, audit and report.
Accepted formal-verification assignments use the same completion path. Missing-context
reports remain open. An Evolver with a published SKILL is released after its final
success delivery settles; learning failures release the handle independently of task
success. The decision owner remains available through run shutdown for report inspection.

Completion instructions follow the configured responsibility: Planner uses
`tasks.finish` or `tasks.abandon`, formal Verifier uses `verification.submit`, and
delegated work uses structured `agent.report` results. These tools call native DSH
`ToolExecution.concludeTurn` after successful execution. The current turn commits
its tool receipt and completes before role retirement; missing-context reports
complete the turn while retaining their assignment for explicit caller context.
Planner success requires the completed durable plan, current formal verdict and
all decision-owner TODOs marked `completed` before `tasks.finish`.

Retirement awaits native disposal before publishing its final audit snapshot, including
events committed by scoped cleanup. Assignment evidence grants are opened from the
explicit brief at creation and released after retirement cleanup, including failed
cleanup. Late evidence extensions fail. Creation-publication failures also dispose the
native handle; cleanup failures remain observable at shutdown. Stored evidence, briefs,
reports and audits retain their independent lifetimes. See the
[assignment lifecycle](implementation/assignment-lifetime.md) for acceptance boundaries.

UpperRun archives full retired assignment details before publishing a compact summary.
The native TeamSessions cache releases its brief only after the durable reader returns
the identical assignment. Historical queries preserve access to TODOs, observations,
reports and explicit context; they confer no current evidence permissions. The archive
and run summary have separate publication boundaries. See
[storage and inspection](implementation/assignment-history.md).

Retired identities are not reusable. Callers may query/acknowledge durable reports
after native disposal. A late child report to a finished caller is retained with
failed delivery, without reopening the caller or implicitly transferring new context.

Native audit publication captures the Session event count and reads events by their
original sequence. Only the unpublished suffix is written, followed by its visible
count. The v2 audit index binds a native Session identity to the assignment. Adopting
an unbound historical audit checks its entire published prefix. Delivery error checks
also inspect only the current delivery range. These operations preserve the native
DSH event log; active-log retention remains separate work. See the
[audit publication interface](implementation/session-audits.md#native-publication).

Before retry, Planner prepares the Evolver handoff and recovery record. Starting the
experience agent must not block execution: durable events can be read later through
explicit authorized references if the model is slow.

### 4.2 InvocationBrief: minimum delegation context

| Field            | Content                                          | Example                                                                  |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| objective        | What this assignment must accomplish             | Check this placement against its criterion after confirmed execution end |
| task_scope       | Task, goal, attempt and relevant recovery IDs    | `task_42 / goal_store / attempt_2`                                       |
| expected_output  | Output schema and recipient                      | `VerificationResult.v1 → planner_1`                                      |
| entities         | Object-role bindings and their sources           | `object=cup_17; container=cabinet_2`                                     |
| success_contract | Authoritative definition, version and scope      | Task-sourced `inside(object, container)`                                 |
| known_facts      | Relevant facts with timestamps/evidence          | Previous check false; observation `obs_101`                              |
| history_summary  | Relevant preceding work                          | First attempt left the cup on the table; Planner chose a change          |
| changes          | What differs this time                           | Explicitly bind the left cup, rather than saying only “try again”        |
| evidence_refs    | Authorized records, frame/stream or event ranges | Failure clip, event interval and camera stream                           |
| tools_and_limits | Allowed tools/actions and budget                 | Read authorized evidence and run checks; no subgoal execution            |

The caller is responsible for semantic sufficiency. Schemas validate shape and
references, not whether context is enough. A recipient lacking information sends
`context.request`, waits, or reports insufficient context; it must not invent facts.
Tools may help the caller gather inputs, but the caller still forms an explicit brief.

Shared evidence storage is a source of referenced materials. Recipients can read
listed references or query within their assignment's authorization, with traceable
access. It is not a synchronized shared conversation. Other agents' opinions remain
reports or hypotheses until independently supported.

v1 uses fresh spawn, not a history-inheriting fork. Messages within one assignment
can accumulate. New assignments, tasks, replacement instances and crash recovery
require a new brief or explicit handoff.

**Fresh conversation does not prove role isolation.** The inspected DSH preset child
path may include parent composition. The EDH factory must explicitly build the target
scope, prompt, tools and resource view before publishing a session. Validate the actual
DSH scoped-factory/preset API and add a bridge if necessary. Acceptance checks actual
model inputs for absence of parent-only tools and instructions.

## 5. Generic communication protocol

### 5.1 MessageEnvelope

This is a proposed domain message, not an existing native DSH API:

```json
{
  "schema_version": "physical.message.v1",
  "message_id": "msg_120",
  "kind": "event",
  "type": "verification.completed",
  "sender": { "agent_id": "verifier_3" },
  "destination": { "topic": "task_42.verification" },
  "scope": {
    "task_id": "task_42",
    "goal_id": "goal_store",
    "attempt_id": "attempt_2",
    "recovery_id": "recovery_1"
  },
  "correlation_id": "verify_request_2",
  "causation_id": "execution_stopped_2",
  "sequence": 120,
  "created_at": "2026-09-06T12:00:00Z",
  "payload": {
    "status": "passed",
    "goal_contract_version": "1",
    "checks": [{ "check_id": "inside_target", "value": true }]
  },
  "evidence_refs": ["obs_130", "gt_check_9"]
}
```

`kind` is command/event/request/response/artifact. `type` is a registrable namespaced
extension. A destination identifies one agent, service or task topic. Non-agent
senders use `service_id`. Required scope IDs depend on the event schema.

The runtime supplies or verifies identity, permissions and sequence. A model cannot
impersonate another sender or change its own authority through message content.
`correlation_id` groups an interaction; `causation_id` identifies its direct cause.
Timestamps support freshness, not a strict global order across devices.

### 5.2 Events and responsibilities

| Event                                          | Producer                                   | Consumers                                  | Meaning                                                                                  |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `agent.invoke`                                 | Calling agent through validated runtime    | New agent                                  | Complete brief and independent context                                                   |
| `context.request / response`                   | Recipient/caller                           | Counterparty                               | Explicit missing information, not copied parent history                                  |
| `execution.started / progress`                 | Execution service                          | Planner and UI                             | Actual execution state; in-flight frames stay outside Verifier context                   |
| `execution.pause_requested / paused`           | Requester/execution service                | Planner and UI                             | Intent and confirmed device state separately; ordinary pause does not start verification |
| `execution.budget_exhausted / ended`           | Execution service                          | Verification admission and relevant agents | Confirmed end and stop reason; no automatic success                                      |
| `verification.requested / checked / completed` | Lifecycle coordinator/Verifier             | Verifier, then Planner/Evolver/UI          | Post-end formal checks, scoped evidence and verdict                                      |
| `retry.requested`                              | Planner                                    | Execution/recovery coordination            | Original goal, changes and failure source                                                |
| `retry.started`                                | Runtime after accepting retry              | Evolver, UI                                | Recovery-chain start, never inferred from prose                                          |
| `recovery.resolved`                            | Correlator using the original-goal verdict | Evolver, Planner, UI                       | Original recovery goal passed or was abandoned                                           |
| `experience.created`                           | Evolver after memory persistence           | Planner, experience management, UI         | Skill version, applicability and evidence references                                     |

### 5.3 Routing, ordering and reconnection

v1 uses a typed host router with versioned worker requests and streaming events;
an independent message broker is optional. Direct messages and subscriptions share
the envelope. Persist formal requests/results before delivery, allow redelivery,
and deduplicate by ID. Each task stream has stable ordering; no global service order
is promised.

Acknowledgement means accepted, not processed by the agent or executed by the device.
Physical operations use execution IDs and idempotency keys. After an uncertain
connection failure, query the job before proceeding. If state cannot be established,
report unknown; do not blindly resend motion.

Do not broadcast every sensor frame to each LLM. During execution, operator replay
and authorized Planner observations may use recorded frames; Verifier receives no
in-flight frame messages. Its fresh post-end brief names authorized before/after
evidence. Retain links between durable events and actual model-visible inputs so
audits distinguish what the system knew from what a particular agent saw.

## 6. Subgoals and execution contracts

### 6.1 Identity and ownership

- `task_id`: one user task run.
- `goal_id`: stable semantic subgoal, potentially retained across instruction changes.
- `attempt_id`: one upper-authorized attempt; every retry creates a new one.
- `execution_id`: the actual job accepted by the execution service.
- `recovery_id`: linkage between the original failure and subsequent retry/replan work.

An attempt may contain normal policy action chunks, not an autonomous provider retry.
Resuming the same instruction may consume the remaining budget of the same attempt.
Exhausted budgets are not automatically renewed. A changed instruction or new attempt
requires an explicit upper-level decision and a new attempt ID.

### 6.2 SubgoalRequest

Required semantics include IDs, natural-language instruction, entity-role bindings,
capabilities, success criteria, constraints and budgets. The upper layer may select a
provider, or assembly may bind one from a declared compatible set. Neither may silently
change the task meaning.

```yaml
goal_id: goal_store
attempt_id: attempt_2
instruction: Place the specified cup inside the already-open cabinet
entities:
  object: cup_17
  container: cabinet_2
required_capabilities: [object_manipulation]
success_contract:
  id: store_object
  version: '1'
  all:
    - check: inside
      args: [cup_17, cabinet_2]
budget:
  max_control_steps: 200
  max_wall_time_s: 60
context_refs: [observation_120, entity_binding_4]
```

200 steps and 60 seconds are examples, not universal defaults. Providers declare
control-step meaning and frequency. Record policy calls, actual control steps and
raw simulator steps separately; wall time is an independent boundary.

Success contracts support registered checks and simple all/any combinations. The
environment maps semantic checks to versioned evaluator definitions and parameters.
Unsupported checks are explicit; false differs from unknown. Required conditions
come from the task, not an extra universal preference such as releasing the gripper.

### 6.3 Execution reports and formal verdicts

| Data               | States/content                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| ExecutionStatus    | accepted / running / pausing / paused / ended; counts, device state, observation references          |
| StopReason         | policy_stop / planner_stop / budget_exhausted / user_stop / backend_error / episode_terminated       |
| VerificationResult | pending / running / passed / failed / unknown; checks, evidence, observation time, criterion version |
| PlannerDecision    | resume / retry / replan / finish / abandon; cited feedback and new goals                             |

Policy or execution self-reported success may be diagnostic only. Authoritative
completion requires the designated verifier's verdict for the correct attempt,
criterion version and confirmed ended-boundary evidence. External cancellation and
backend errors retain failed or unknown execution outcomes; neither implies success.

### 6.4 Budgets, pause and verification gates

1. Accept a request and return a job handle without blocking Planner for the rollout.
2. Advance policy actions and emit observations/status for execution records, the
   operator and authorized Planner tools. No Verifier assignment or frame delivery
   runs concurrently with policy execution.
3. Translate authorized pause requests to supported device pause/stop behavior and
   acknowledgement. `pause_requested` must not be displayed as `paused`. An ordinary
   confirmed pause permits Planner-authorized resume within the remaining budget;
   it does not create a formal verification round.
4. On `policy_stop`, `planner_stop`, `episode_terminated` or `budget_exhausted`, stop issuing actions,
   record an `ended` state and confirmed device boundary, then create one fresh formal
   verifier assignment. Budget expiry requires that verification even without a
   model tool request. External cancellation and backend errors retain their own
   failed or unknown outcomes.
5. Give the Verifier the final report, request, budget, status and authorized
   before/after evidence. Check current facts for the ended boundary. Without
   reliable evidence, return unknown.
6. Planner decides what follows. Pending/unknown verification cannot silently become
   passed; request more checks or explicitly handle uncertainty.
7. Only Planner resumes an ordinary pause or creates a new attempt after a final
   result. A backend unable to resume in place reports stopped.

Transport redelivery is not physical action retry. After process restart, query jobs
and devices first. Explicit user termination may cancel agents; record cancellation
or unknown verification rather than fabricated success.

## 7. Verifier: post-execution formal verification

Each eligible ended execution creates a fresh Verifier assignment after the device
confirms its stop boundary. Its explicit brief identifies the goal, criterion version,
attempt, final execution report, request, consumed budget, stopped status and authorized
evidence. No conversation history is implicitly shared. Running controls, ordinary
pauses and their frames do not create or update a Verifier assignment. Device-local
control and connection-failure handling continue without waiting for a model round trip.

### 7.1 Assignment timing and evidence

The admission gate accepts `ended` executions whose stop reason is `policy_stop`,
`planner_stop`, `episode_terminated` or `budget_exhausted`, with matching task, execution and confirmed
boundary identities. A `paused` execution may be resumed by Planner within its
remaining budget. User cancellation, backend failure and uncertain device state
retain explicit failed or unknown outcomes. They never become task success through
a policy report or an old observation.

The Verifier reads only evidence authorized for this stopped boundary. Before/after
images may support comparison when camera pose, object identity and timing are
recorded; perspective changes must be identified. It may request a fresh post-stop
capture or permitted limited fact check. The report's claimed success is evidence
to examine, not a verdict. Verifier does not create subgoals or choose retries.

### 7.2 Formal verification and GT visibility

In simulation, Verifier calls limited goal checks and receives per-check results and
necessary facts. Planner receives those results and useful explanations. Complete hidden
state is debug-only and must not enter Planner, Verifier or Evolver context automatically.
Enforce evidence visibility in the provider boundary.

Formal reports must agree with available authoritative GT facts. The gate validates
criterion version, required-check coverage and factual consistency; the agent still
chooses observations and explains uncertainty. Separate optional diagnostics from
required conditions. Skill preferences cannot alter benchmark success standards.

Real hardware uses visual/device-signal providers and retains unknown. A new view
requiring base/arm movement needs an upper-level decision unless specifically authorized
within the current observation scope. Read access alone grants no physical task changes.

Each goal/attempt has one final-verdict owner in v1. Multiple specialist verifiers need
an explicit aggregator and rules; conflicting reports cannot both become final truth.

## 8. Evolver and the skill experience loop

### 8.1 Trigger, inputs and completion

Always record ordinary run evidence, but do not start Evolver for every execution.
An explicit upper-level retry registers a recovery chain and sends a fresh Evolver
the failure, original recovery goal, changes, readable records and expected output.

v1 uses one Evolver assignment per chain. Subsequent attempts enter through explicit
messages/subscriptions. Different chains do not share context. A long chain may produce
a structured handoff for a replacement instance.

Recovery success means formal verification of the original goal. For example, a replan
may add “open the cabinet”; that prerequisite succeeding does not prove “cup inside
cabinet.” Planner requests a recheck of the original goal at the end of multi-step recovery.

Failed/abandoned recoveries remain records and do not produce successful-recovery
skills. Policy claims, exhausted budgets and human prose do not replace the verifier's
result. Evolver failure must not block task completion: preserve pending records and
later delegate summarization with a new explicit brief.

### 8.2 Skill content and generalization boundaries

Skills serve Planner and Verifier: triggering situations, observable evidence, decision
heuristics, verification pitfalls, prerequisites and counterexamples. Robot coordinates,
joint indices and environment-instance IDs stay in referenced evidence, not generic rules.

Skills may be retrieved within their declared scope without per-item manual approval.
Keep source, version and applicability complete. An entry without transfer evaluation
is source_validated / transfer_unvalidated, not proven universal. Incompatible retrieval
returns a mismatch reason; matching a task name alone is insufficient.

Success after a change supports a hypothesis, not proof of a unique cause. Record
multiple simultaneous changes faithfully instead of attributing success to one factor.

### 8.3 Skill bundle

```text
skills/
  reobserve-ambiguous-target/
    SKILL.md
    metadata.json
    references/
      recovery-evidence.json
      transfer-notes.md
```

SKILL.md is the readable entry point. Metadata carries retrieval fields, version,
capability prerequisites, validated configurations, evidence and status. Reference
raw video/trajectories through evidence URIs rather than copying them into every skill.
Provider boundaries allow filesystem, index or remote storage replacement while
reusing DSH discovery and on-demand loading.

This is a format illustration, not experience from a real experiment:

```markdown
---
name: reobserve-ambiguous-target
description: Help the upper layer reobserve and verify after an unsuccessful attempt with ambiguous target binding.
---

# Applicability

Several similar objects are visible, target-binding evidence is insufficient,
and the current goal check has not passed.

# Planning cue

Request a fresh observation or explicit target binding before deciding to retry;
do not merely repeat the same instruction.

# Verification cue

Confirm that the checked entity is the intended target. Policy termination alone
does not prove goal completion.

# Limits

A valid new observation must be available. This does not imply that all failed
grasps are caused by target ambiguity.

# Sources

Metadata and references link the failure, changes and verified recovery evidence.
```

### 8.4 Working state, records and long-term knowledge

| Category                   | Lifetime                                          | Visibility                                                                  |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Agent conversation         | One assignment                                    | That instance; not automatically copied                                     |
| Initialized SceneState     | Retained Session environment and scene generation | Versioned, evidence-backed state; explicit role queries and console updates |
| Task facts/entity bindings | Current task, with time and evidence              | Briefs, messages or explicit queries                                        |
| Episode evidence/events    | Persistent audit records                          | Scoped reads with preserved visibility                                      |
| Skill library              | Cross-task knowledge                              | Explicit retrieval, compatibility filtering and on-demand loading           |

Task completion returns results and recovery/skill references. A fresh agent on the
next task retrieves relevant knowledge rather than inheriting the previous conversation.

Environment initialization creates a persistent `SceneState`. Initial permitted
observations populate the visible scene; later observations, perception results and
supported verification facts incrementally update that same state identity. Records
retain observation time, coordinate frame, model provenance and uncertainty. Delayed
results cannot overwrite newer current observations. Tasks in the same retained
environment query its current revision; reset starts a new scene generation and
preserves earlier records as history. Restart requires backend identity reconciliation
before historical positions can be treated as current. Agent contexts remain
independent and retrieve only explicitly requested information. The
[scene-state design](implementation/spatial-memory-proposal.md) defines the accepted
lifecycle and proposed interfaces; implementation and actual acceptance are pending.

Sensor metadata is persisted through a run-scoped `SensorSamples` catalog. Each sample
and its image references are immutable; repeated identical publication is idempotent.
UpperRun checks assignment grants before retrieval and agent visibility before delivery.
Historical records are read on demand. Storage presence grants no model access. Current sensor projections
remain available to the console. Binary media binding, reference-set growth and
disk retention have separate implementation and acceptance requirements. See the
[perception storage guide](../harness/agent-runtime/perception/README.md).

The native DSH attachment service now has an EDH local image provider using pinned
DSH normalization/publication code. It supports durable image bytes and route-specific
request projection, with explicit operation limits and lifecycle. The application owns
the attachment context and supplies its service to deployment, environment and task
factories. Authorized model tools read images by persisted run/evidence/attachment
identity. The console displays evidence references and Agent trace. Headless camera
video is recorded on the simulator host and transferred after execution.
Live VLM image transport and native observation round trips are verified. Built-in
native retention binds image references and explicit source leases; additional
extension formats require their own complete owner declarations.
See the [image storage guide](implementation/image-storage.md).

The domain journal supports explicit atomic compaction of superseded mutable-record
versions. Current key/value pairs, CAS versions, write sequence and independent history
records remain available. The console supplies an idle-only maintenance operation with
an inspected-sequence precondition; terminal task scopes finish before publication.
Compacted journals use a versioned checkpoint prefix and require a compatible reader.
Image inventory reports original and model-request-cache usage. Explicit cache cleanup
requires an idle workspace and a current service revision, preserves original objects,
and permits request variants to regenerate on demand. Custom providers advertise this
optional maintenance capability. Built-in native deployments provide distinct-key,
original-image and Session/audit retention with explicit archive/inspect/retire
admission and immutable request tombstones. See the
[maintenance guide](implementation/storage-maintenance.md).

Native audit inspection uses bounded assignment and event pages. The console selects
one role assignment and a fixed published event range, with earlier/later navigation
and an explicit latest-page refresh. An uncommitted suffix remains hidden. Event
offsets preserve the stored native event sequence without resuming any execution.
See the [audit API and acceptance](implementation/session-audits.md).

Workspace SKILL inspection resolves explicit recovery/run/session ownership, checks
the recorded original-goal failure and accepted success, and lists evidence/image
metadata dependencies. Published recovery event indexes and source bodies are inspected
individually with immutable-version, increasing-sequence and published-boundary checks.
Inline recovery events must match their recorded run sources. Missing source records are reported as incomplete; inconsistent
records fail. This is a read-only metadata check. It grants no model-context access,
certifies no transfer performance and authorizes no source deletion. New experience
limitations reflect the declared simulation, hardware or test-fixture origin. See the
[source inspection API and acceptance](implementation/skill-provenance.md).

The local image provider can collect original objects outside an explicit complete
retained-ID set, with image-revision checks and exclusive reader/writer admission.
Structured journal reference inspection includes current historical and extension
records and bounds example ownership keys. External and prose-only references need
their own declarations. Configured reference sources pin their images through explicit
leases. The server checks all SKILL sources and closed/released sessions, holds journal
writes, previews retained/unreferenced counts and revalidates versions before collection.
The console exposes inspection and deletion through a single-use preview token. Complete
external ownership remains a deployment responsibility; unresolved provider resources
block collection. See the [retention API and responsibilities](implementation/image-retention.md).

### 8.5 Complete recovery sequence

![Execution, verification and recovery sequence](architecture/assets/async-recovery-sequence.svg)

[Open the sequence SVG](architecture/assets/async-recovery-sequence.svg)

### 8.6 Agent-directed experience retrieval

Experience enters an assignment through an explicit search-and-load cycle. Planner
may search when prior experience could help a planning decision or failed attempt;
Verifier may search when it has a verification question. Neither role receives the
entire SKILL library at startup or after another role publishes an experience.

1. The agent formulates a focused query from the current task and question.
2. `skills.search` returns metadata without SKILL bodies. The agent evaluates task
   relevance, required capabilities, limitations and validated configurations.
3. `skills.load` returns the selected skill's metadata and Markdown into the calling
   assignment's native DSH context. Optional `sections` selects named chapters while
   retaining the preamble, applicability, limitations and source. The result identifies
   included and omitted sections. Omitting the parameter reads the full document.
   The agent may request additional sections, load another skill, refine the search,
   or proceed with current observations and evidence.
4. The agent reuses guidance already available in context. A changed question or
   content removed by context maintenance may justify another retrieval.
5. Delegation includes explicit applicable guidance or a skill reference and its
   limitations. Each recipient decides what it needs in its independent context.

Retrieval is agent-directed; the implementation currently uses keyword matching over
`task_semantics`, capped at 20 metadata records per search. Semantic embeddings and
relevance ranking remain unimplemented. CommonMark section selection preserves source
text and reference targets; reads leave stored/exported documents unchanged. Current prompts
instruct selective loading; the runtime does not deduplicate deliberate load calls.
Native tool-call records expose queries and selected versions for inspection.

Knowledge remains advisory across simulation and hardware. Source references grant
no additional evidence permissions, and matching task semantics do not establish
cross-embodiment validity. Formal verification uses current authorized evidence and
the admitted task conditions. See the [memory implementation](../harness/agent-runtime/memory/README.md).

## 9. Replaceable components and adapter contracts

A unified interface specifies inputs, outputs, semantics and compatibility. It does
not imply that arbitrary models, devices and environments are interchangeable.
Preflight failures must explain the concrete mismatch.

| Component             | Required contract                                                                | Compatibility and optional capabilities                                                              |
| --------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Model provider        | DSH model interface; images, tools and structured-output support                 | Different roles may use different models; check actual supported inputs                              |
| Tool provider/catalog | ID, description, input/output schemas, executor, scope, effects and resources    | Native TS, Python/HTTP or MCP; expose only selected compatible tools                                 |
| Policy provider       | Subgoal/observation input, action/status output, version and input/action specs  | Cameras, proprioception, control mode/frequency and instruction granularity                          |
| Embodiment adapter    | Device/joint/sensor IDs, coordinate frames, units and observation/action mapping | Fixed arm, mobile manipulation or dual arm; no navigation requests to a body without that capability |
| Environment adapter   | Observations, entities, run source and task/evaluator mapping                    | reset/step/snapshot/GT are explicit simulation capabilities, not mandatory hardware methods          |
| Hardware backend      | Connection, state, streams, commands and confirmed stopping                      | DiMOS/SDK/ROS2; declare actual pause/resume support                                                  |
| Verification provider | Registered checks, criterion versions, value/unknown reason and evidence         | Simulation GT or real sensor evidence; unsupported is not fabricated false                           |
| Memory provider       | Query, write, version retrieval, applicability filtering and evidence linkage    | Filesystem, index or remote storage; traceable retrieval                                             |
| Role/router           | InvocationBrief, outputs, subscriptions and independent context                  | New roles do not change the base envelope; control permissions are explicit                          |

### 9.1 Observation and action semantics

Observation semantics include observation ID, capture time, source sequence,
stream/sensor/device IDs, coordinate frame, media references, visibility and relevant
calibration version. Preserve per-camera timestamps rather than pretending streams
are synchronized. Pin evidence references in verifier requests; later frames must not
change what a previously issued reference identifies.

ActionSpec declares robot, joint order, units, control mode, frequency and limits.
Matching tensor shape is only the first check: two seven-joint arms can have different
joint order and gripper units.

In v1, only one active execution owns a given actuator resource. Agents may observe
and analyze concurrently but cannot issue conflicting arm commands. Physical resource
ownership cannot rely solely on serial tool execution inside one DSH agent.

### 9.2 Simulation, hardware and replay

All three use common task events and observation views, with the source clearly marked.
Simulation can advance simulated time and query GT. Hardware evolves in real time.
Replay reproduces only recorded events and observations.

Replay can test perception, verifier output, message handling and skill extraction.
It cannot prove that a new action would succeed or resend recorded actions to a robot
as “resume.” Backends report job/device state and takeover behavior after disconnection;
models cannot infer a stopped arm merely from a log.

### 9.3 Extension examples

For RoboCasa, implement observation/entity/task-check mapping, bind its robot and a
compatible policy, and run the same Subgoal/Verification contract suite. The base
Planner/Verifier/Evolver communication protocol remains unchanged.

For a real arm, select DiMOS or a direct SDK backend, declare cameras, joints, gripper
and stopping capabilities, match policy inputs/action semantics, then configure real
verification evidence. Device connection alone does not establish a usable subgoal policy.

### 9.4 Complete tool catalog

The dotted names below identify EDH logical capabilities. Each selected tool has
its own model-facing schema and recorded logical-ID to native DSH wire-name mapping.
The [tools module](../harness/agent-runtime/tools/README.md) owns parameter preparation;
DSH owns registration, validation and dispatch.

| Toolset            | Minimum capability                                                           | Default consumer                        | Source/adaptation                                      |
| ------------------ | ---------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| planning           | Read/write plans, goal dependencies and criterion links                      | Decision owner                          | Legacy todos; DSH display plus durable task plan       |
| workspace/files    | Read/write/edit/list/search working notes and intermediate files             | Explicitly configured roles             | DSH file/search capabilities and private workspaces    |
| team               | List members, delegate, send, request context and query status               | Planner and authorized roles            | DSH scoped factory plus EDH routing                    |
| perception.read    | Capture, segment, detect, estimate depth and localize; optional point clouds | Planner, Verifier and perception roles  | Legacy capture/detection, depth and SAM adapters       |
| observation.active | Turn view/look at a target and return a new observation                      | Planner and explicitly authorized roles | Legacy rotate-camera and actual device controls        |
| execution          | Start/query/pause/resume/stop jobs; optional gripper/reach primitives        | Configured decision/pause owners        | Asynchronous execution and resource services           |
| verification       | Check goal, read evidence and submit formal result                           | Current final verifier                  | Limited facts provider and formal-verdict protocol     |
| task_memory        | Query facts, record observations and bind entities                           | Planner and authorized roles            | Source-linked task facts replacing global scene state  |
| skills             | Search/load applicable knowledge with versions                               | Planner, Verifier and selected roles    | DSH discovery/loading plus EDH compatibility retrieval |
| experience         | Read recovery, save skills and report experience                             | Evolver                                 | Recovery chains, evidence and versioned memory         |

Examples of logical tool IDs are `perception.capture`, `perception.segment_objects`,
`observation.turn_view`, `execution.start`, `skills.search` and `skills.load`.
The [logical inventory](../harness/agent-runtime/tools/definitions/planned-tools.json)
records implemented and planned entries. Source checks require its implemented IDs
to match the 36 core tools exactly. Assignment-specific schemas retain role outputs,
device capabilities, bounds and actual argument sources.

Expose perception tools only when a provider is available. Missing depth/segmentation
must not appear usable and then return fake data. Users can add SAM3-like segmentation,
other detectors/depth models or private services without wrapping them as agents.
Direct VLM image reasoning and external perception tools can coexist.

### 9.5 Upper-level tools and Deep Agents migration

The old `agents/top_agent.py` combines perception/memory tools and relies on
`create_deep_agent` for basic capabilities such as `write_todos` and file operations.
Preserve these capabilities while replacing the runtime with DSH. Migrating only
policy tools would omit essential planning and working-memory support.

| Legacy capability              | EDH behavior                                                                        | Constraint                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| write_todos                    | Create/read/update plans with goal IDs, dependencies, states and success references | Plan state does not replace formal verifier facts                                   |
| read_file/write_file/edit_file | Private assignment workspace for progress, analysis and intermediate artifacts      | Other roles' files require explicit handoff                                         |
| File discovery/search          | Search only the workspace and explicitly mounted read-only material                 | DSH fs-search subprocess paths must obey the same visibility boundary as file tools |
| Subagent delegation            | `team.delegate` returns assignment/agent identity without waiting for a long task   | No inherited parent conversation or tools                                           |
| Context compaction/persistence | Reuse DSH capabilities within the current session                                   | Not a mandatory manual user tool; cannot introduce other agents' context            |
| On-demand experience           | Search/load skill versions with applicability                                       | Knowledge enters fresh tasks through explicit tool results                          |

In the inspected DSH baseline, `todo_write` belongs to one agent and its UI projection
clears at the next turn. It is not a durable cross-turn task-plan database. EDH maintains
a task-scoped PlanDocument owned by decision_owner, with stable goal IDs and plan
versions. DSH todo/UI may display a summary. Verifier/Evolver may keep their own work
lists but cannot modify Planner's authoritative plan.

The target PlanDocument includes task ID, version, owner assignment and items with
goal ID, description, dependencies, state, success-contract reference and optional
last-verification reference. Updates check expected versions. Completion requires a
matching passed verdict. TaskGoals validates configured and Planner-created bindings
before publication; TaskPlans enforces ownership, dependencies, versions and
immutable executed criteria. See [goal admission](../harness/agent-runtime/tasks/README.md#goal-binding-admission).

Files are private by default. Cross-role handoff uses immutable artifact references or
explicit read-only mounts of specific versions, not a mutually writable scratchpad.
General shell access is not a default for every role; users may select a digital tool pack.

### 9.6 Perception and SAM-style integration

Bind perception requests to an existing observation ID and frame, not an implicit
mutable “latest image.” Results preserve provider/model version, source observation,
coordinate convention, detections and evidence:

```json
{
  "observation_id": "obs_120",
  "provider_version": "user-sam-adapter-v1",
  "instances": [
    {
      "detection_id": "det_4",
      "label": "cup",
      "score": 0.91,
      "bbox_xyxy": [0.12, 0.3, 0.28, 0.68],
      "bbox_space": "normalized_image",
      "mask_ref": "artifact_mask_4",
      "entity_id": null
    }
  ],
  "overlay_ref": "artifact_overlay_4",
  "depth": { "status": "unavailable" }
}
```

A detection ID is not a stable world-entity ID. Fill entity_id only after tracking or
explicit binding. Without depth, calibration or a reliable estimate, do not invent
metric distances. Provider confidence is not necessarily calibrated and is not GT.
Masks, overlays and RGBD retain source-frame and processing provenance.

SAM3.1 runs as a separately configured, source/checkpoint-identified service.
YOLO26 depth runs in its own service and preserves prediction/calibration metadata.
Native RGB-D measurements retain sensor, calibration, units and coordinate identity.
Back-projection, range and coordinate reductions fail at the calculation site
on arithmetic overflow, invalid operations or division by zero. Successful
measurements retain native equations, values, units and source identities.
Providers load their dependencies only when selected. Commands and original model,
mask and geometry evidence are in the [perception guide](../harness/agent-runtime/perception/README.md).

### 9.7 Active observation is a scheduled physical capability

`observation.turn_view` requests a changed view; an adapter resolves the real motion.
The legacy rotate_camera wording suggests camera-only motion, but the BEHAVIOR
motion.rotate implementation uses base yaw and head pitch.

For a desktop pan/tilt camera, lock `camera_pan_tilt`. For an R1Pro yaw view, the resource
may be `base`. If a policy owns the base, queue the observation or return resource_busy
so Planner can decide whether to pause or change the schedule. Never rotate the base
silently alongside the active policy.

Inputs identify intent, camera/entity references, requested angle or look-at target and
budget. Resolve actual effects/resources before execution. Results include requested
and achieved pose, completion/failure reason, new observation and actual time/steps.
Acceptance of a request does not mean the camera reached its destination.

Role configuration and the current InvocationBrief jointly authorize observation
motion. Planner has this capability by default; Verifier defaults to reading
and checking. If a team gives active observation to Verifier or a user role, the brief
must authorize the actual device-action range. Resource scheduling still applies;
route changes, retry and policy resume remain decision-owner actions.

Track observation-action budgets and total task cost. Do not hide physical steps to
bypass policy budgets. Verification requiring unapproved base/arm motion asks the upper
layer rather than executing silently.

### 9.8 ToolDefinition and integration paths

A tool declares logical ID/version, description, input/output schemas, executor,
effect, capability requirements, resource resolution, sync/async lifecycle and output
media. Tool packs may define timeouts; physical motion also obeys task budgets.

```yaml
schema_version: physical.tool.v1
tool_id: perception.segment_objects
version: '1'
description: Return instance segmentation for a text prompt on a referenced observation frame
input_schema: builtin:SegmentationRequest.v1
output_schema: builtin:SegmentationResult.v1
executor:
  kind: python_rpc
  provider: sam_local
  operation: segment_objects
effect: read_observation
required_capabilities: [rgb_observation]
resource_policy: provider_serialized
result_media: [json, image_ref, mask_ref]
```

Support native DSH/TypeScript integration, Python-provider RPC, and existing MCP tool
bridges. Configuration selects a provider for a model-facing tool; replacing SAM need
not change the role prompt.

Native and external execution paths share call records and visibility enforcement.
MCP schemas are only an entry point: EDH must map physical effects, resources, media and
compatibility rather than assuming every external tool is read-only. High-volume streams
remain outside ordinary text messages.

The target ToolResult distinguishes completed, running with operation ID, failed and
unknown, and records call/agent/assignment identity, tool version, input/output evidence,
effects, actual resources and errors. Errors include invalid_input, unsupported,
observation_stale, provider_unavailable, resource_busy, timeout and execution_state_unknown.
Read-only inference may return an error; uncertain physical timeouts require state
reconciliation before any further motion. DSH tool receipts identify their native
call and assignment. Execution jobs retain their own task, attempt, budget,
generation and confirmed device-boundary identity. Source checks and original
request readers validate their fields; loaded provider behavior retains native
acceptance in the [release guide](implementation/release-validation.md).

Declared concurrency is only a preliminary filter. A SAM session may need serial
provider access; active observation may need device resources. Actual resolved resources
determine scheduling. Registration, role selection, model-visible schema and runtime
permission must agree; hiding a tool in the UI is not authorization enforcement.

## 10. Control console

The unified workspace connects to actual role, plan, tool, execution and verification
events. Simulator-host recordings provide camera playback after a headless task.

### 10.1 Required work areas

| Area                 | Display and interaction                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Task/instructions    | Goal, constraints, additional input, run source and config version; distinguish received/effective input                          |
| Observation evidence | Source identities and timestamps in tool/debug records; model tools receive images, and simulator-host video records camera views |
| Agents               | Instances, roles, callers, private sessions, current assignments, waiting dependencies, received briefs/messages                  |
| Team/Role            | Team version, member aliases and instances, definitions, effective tools and startup errors                                       |
| Tool calls           | Category, provider, source observation, annotated results, actual resources and state                                             |
| Embodiment           | Connection, actuator state, job, budgets and confirmed pause/stop; render according to device capabilities                        |
| Subgoals/recovery    | Goals, attempts, changes, decision ownership and original recovery-goal state                                                     |
| Verification         | Post-end assignment, individual checks, GT source, unknown reasons and evidence                                                   |
| Experience           | Evolver trigger, read evidence, output skill version/scope and later retrieval                                                    |
| Timeline             | Causally linked user input, messages, execution, pause, checks, retries and skills                                                |

### 10.2 Interactions

Users issue tasks/constraints, request pause/termination, and inspect evidence/history.
A user resume request reaches Planner and becomes an explicit decision. Until device
acknowledgement, show “pause requested” or “state unknown,” not stopped based on prose.

History is read-only and clearly labels attempt/time. Playback position is not current
device state. Label debug GT as agent-invisible; screenshots of mixed UI must not leak
hidden state into agent input.

The message view should answer: Why did execution stop? Why did Planner retry? Which
failure did Evolver use? What context did this new agent actually receive? Show explicit
decision explanations, tool calls and evidence, not inferred private model reasoning.

v1 supports file-configured teams and dynamically created instances. A drag-and-drop
workflow editor is optional. Headless video uses native simulation timestamps and
retains frame/segment provenance. The console does not download live camera images.
Qwen, the Agent server, policies and simulator may run on one GPU host; the browser
then receives trace/status events. See [headless simulation](implementation/headless-simulation.md).

### 10.3 Incremental event delivery

The console obtains current state and reads the latest bounded history page at a fixed
event boundary, then receives contiguous event batches and current projections through
SSE. Batch admission and client merging validate the run
identity, cursor and event order. Last-Event-ID supports connection resumption; a
projection is displayed after its preceding event batches have arrived. Text-only
model updates carry no repeated event history. Native run-change notifications carry
identity/state/timestamp; consumers request a full snapshot when needed.

The active UpperRun retains its projection and published event count. Event bodies
are written individually and loaded through history reads. Publication writes the
event before the versioned projection and advances the in-memory count only after
both writes succeed. Unpublished suffixes remain outside visible history. Event
volume has no fixed task-lifetime cutoff; agent-authored message admission uses a
separate delivery counter. Explicit full snapshots reconstruct the complete history.

The browser retains up to 500 recent events with a 2 MiB encoded-body target, preserving
one oversized latest event. Its absolute stream cursor survives event eviction. Event
log provides bounded backward/forward inspection on the same page while live state
continues updating. Range-local filtering and recent-activity search identify their
scope. Current TODOs, plans, verdicts and recovery status use explicit projections.

Event batches are limited to 128 entries and a 256 KiB encoded-body target. A larger
single event remains atomic. The server reads only the requested event page for an
incremental update. Projection size and cumulative server/browser storage require
separate retention limits. See the implemented
[stream protocol and acceptance](implementation/run-stream.md).

LocalStore retains byte positions and version/checksum metadata in memory, reading
record bodies on demand from its existing journal. Startup replay, history validation
and SKILL scans process records incrementally. The key index and caller-owned task/UI
histories require separate lifetime limits. See the [storage implementation](../harness/agent-runtime/storage/README.md).

## 11. User-defined teams and roles

Composable agents mean user-authored role teams: define responsibility, choose tools,
join a team and delegate through the harness. Adding a role does not require copying
a builder, changing fixed Python role enums or writing a model loop.

### 11.1 Minimum authoring workflow

1. Select a built-in team or copy a team.yaml.
2. Create a ROLE.md with responsibility and tool needs.
3. Add the role file to the team's members.
4. Select the team in the console, inspect resolved members/tools/bindings and start
   through the normal task workflow; no additional per-role approval is required.

Existing registered tools need only configuration. A new model/device service still
requires a provider; natural-language role descriptions do not implement missing tools.
The [examples](../examples/README.md) provide role and Team definitions consumed
by the implemented [Team loader](../harness/agent-runtime/teams/README.md).

### 11.2 Custom role example

File: `roles/scene-analyst.md`:

```markdown
---
role_id: scene-analyst
description: Identify target objects and spatial relationships using available perception tools and return evidence to the caller.
tools:
  - perception.capture
  - perception.segment_objects
  - perception.estimate_depth
---

You are the scene analyst. The caller supplies the task and context through an InvocationBrief.

Inspect the referenced frames. Capture a new observation or segment candidate
objects when needed; estimate spatial relationships only when depth is available.
Return candidate entities, evidence references, uncertainty and any missing context.
Do not treat detections as ground truth, retry physical tasks or move the robot.
```

To authorize turning for a new view, select `observation.turn_view` and explicitly
supply allowed motion and budgets in the brief; no new agent implementation is needed.

Every role can report insufficient context through the framework's report protocol;
normal handoff does not require an additional custom tool. Explicit communication
tools use assignment authority and private workspaces. An `insufficient_context`
report retains the assignment for an explicit caller response. A later versioned
report can complete that assignment after its own context receives the response.

Output uses the AgentReport.v1 envelope. A stricter role may declare
`output_schema: ./schemas/scene-assessment.json`; the loader validates a role-local
object schema in DSH's supported subset and binds it to the native reporting tool's
result argument. Identity and routing remain framework-owned. See the
[implemented report protocol](implementation/upper-runtime.md). An omitted model uses the team/deployment
binding, not temporary caller-instance settings.

### 11.3 Team example

For a team.yaml next to its roles directory:

```yaml
schema_version: physical.team.v1
team_id: household-team
entrypoint: lead
members:
  lead: builtin:planner
  verifier: builtin:verifier
  evolver: builtin:evolver
  scene: ./roles/scene-analyst.md
bindings:
  decision_owner: lead
  final_verifier: verifier
  recovery_evolver: evolver
tool_bindings:
  perception.segment_objects: sam_local
```

`sam_local` refers to a deployment-registered provider, potentially a Python service
or another implementation. Checkpoints, secrets and endpoints belong in deployment
configuration, not public role instructions. The repository example resolves its role
path relative to `examples/teams/household.yaml`.

Default collaboration: entrypoint receives the task; decision_owner may delegate to
members; final_verifier gets a complete brief after eligible execution ends; recovery_evolver gets
one on retry. Matching events reach the active assignment in the relevant scope. Adding
scene makes it addressable, not automatically active or subscribed to the whole history.

An illustrative invocation uses the complete brief fields:

```yaml
operation: team.delegate
member: scene
assignment_key: inspect-cup-before-attempt-2
brief:
  objective: Distinguish the left and right cups and report a candidate binding for the user's target
  task_scope:
    task_id: task_42
    goal_id: goal_store
  expected_output:
    schema: AgentReport.v1
    recipient: planner_1
  entities: {}
  success_contract:
    id: identify_target
    version: '1'
    all:
      - check: target_identity_supported
        args: [left_blue_cup]
  known_facts:
    - statement: The target is the left blue cup; its stable entity ID is not yet established
      observed_at: '2026-09-07T00:00:00Z'
      evidence_refs: [obs_120]
  history_summary: Inspect the target before a second placement attempt
  changes: []
  evidence_refs: [obs_120]
  tools_and_limits:
    allowed_tools: [perception.capture, perception.segment_objects, perception.estimate_depth]
    allowed_actions: [observe]
```

The call returns assignment ID, agent ID and accepted status. The recipient works in
a fresh context and returns a structured report; the caller decides whether to use
the binding. An analysis report marked completed does not mean the robot goal passed.
The identity-check name above illustrates a role-specific output requirement; it is
not a currently registered runtime check.

### 11.4 Required fields, defaults and validation

| Definition              | Required content                                                                        | Defaults and checks                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| RoleDefinition          | role_id, description, tools and nonempty Markdown instructions                          | Intended role schema version defaults to physical.role.v1; model defaults to team; InvocationBrief input and AgentReport output |
| TeamDefinition          | schema_version, team_id, entrypoint, members, responsibility bindings                   | Referenced members and built-in/relative role files must exist                                                                  |
| Role tools              | Registered logical IDs; optional toolsets resolve to fixed IDs                          | Reject unknown tools, missing schemas or incomplete effect declarations before activation                                       |
| Responsibility bindings | decision_owner, final_verifier; recovery_evolver when learning is enabled               | One decision owner per task, one final verifier per goal, appropriate tool capabilities                                         |
| AgentReport             | Assignment/scope identity, status, summary, structured result where needed and evidence | Completed/failed/insufficient-context/cancelled semantics; empty evidence allowed, fabricated references forbidden              |

The Role/Team ID pattern is `[a-z][a-z0-9_-]{0,63}`. Tool lists are deduplicated.
Reject unknown fields outside documented extensions. Resolve relative files from the
owning role/team file; reserve `builtin:` for built-in references. The loader validates
referenced schemas, role paths, providers and responsibilities before freezing the Team.

Definitions are shared read-only; sessions and workspaces are private. Snapshot resolved
team, role and tool versions at run start. File edits affect future runs, not silently
replace active instances. Hot reload is outside v1.

### 11.5 Advanced composition and dynamic instances

v1 supports delegation and subscriptions. Optional subscription definitions identify
event type, member, scope filter and delivery mode. Deliver only to matching activated
assignments. A trigger creating a new instance needs a complete caller-provided brief;
a bare event is insufficient context.

Member aliases are not instance addresses. `team.send` targets an assignment ID;
multiple active instances must not create an ambiguous “some verifier” destination.
New work uses delegation; follow-up messages remain within that assignment's context.

Users may replace Planner, add a scene analyst or object-state verifier, or disable
Evolver for ablation. Validate responsibilities by capabilities, not role names.
Without Evolver, explicitly mark recovery learning disabled. Final-verifier ownership
and the budget verification gate remain required for the default physical-task profile.
Specialists report to the designated final verifier; final authority stays unambiguous.

Authorized members need not form a fixed manipulation/navigation tree. Team-run routing
controls permissions; caller relations express delegation and handoff responsibility.
Custom roles and analysis tools do not automatically gain motion, retry or replan authority.

### 11.6 Loader/factory and authoring acceptance

Load files → resolve role/tool/schema references → expand defaults/toolsets → check
responsibilities/model/device compatibility → freeze TeamRunSnapshot → create a target
DSH scope → inject role instructions and the explicit caller brief.

Build the target role's composition rather than inheriting the parent's defaults.
Shared model clients, connection pools and read-only providers do not imply shared
prompts, sessions or mutable tool state. Every call carries assignment scope; stateful
perception providers isolate or serialize their own sessions.

The console exposes team selection, members, role preview, effective tools and missing
dependency diagnostics. File-based authoring is the v1 priority, not a visual editor
or marketplace. Acceptance adds scene-analyst through files/configuration, swaps its
segmentation provider without changing the role, and inspects the brief, actual model
tool list, evidence and returned report. No fixed role enum or special builder changes.

## 12. Implementation structure and legacy migration

### 12.1 EDH ownership and selective DSH absorption

EDH owns its monorepo. The server and console assemble the product. Both runtime sides live under `harness/`, with public wire contracts alongside them.
The TypeScript `agent-runtime/` and Python `physical-runtime/` can run separately while
remaining parts of one physical-agent framework. Domain modules cover agents, teams, models, tools, communication, planning, files, tasks, execution,
perception, observation, verification, memory, storage and contracts. The current
[module map](architecture/modules.md) is the source of actual code paths.

DSH supplies implementations to absorb; do not rewrite its loop. Validate source and
runtime dependencies, preserve licenses and record original/destination paths.
The provenance checker verifies 128 selected files and 25 module bindings.
Every selected implementation remains in its responsibility's module.

The wire schema has one source. TypeScript is generated; executable Python boundary
validation uses that same source. Production owners enforce authorization and
state transitions at their domain boundaries.

### 12.2 Legacy EAF migration map

| Legacy implementation             | Preserve                                                               | Change                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| execute_subtask                   | Separate instructions and success criteria; closed-loop responsibility | Fixed manipulation/navigation becomes capability binding; blocking text becomes jobs/events/reports |
| Context projection                | Relevant region/object summaries                                       | InvocationBrief with instance/time/evidence; no implicit global scene graph                         |
| top_agent core tools              | Todos, files and delegation                                            | DSH bridges, durable PlanDocument, private assignment files                                         |
| Perception/SAM/depth              | Capture, segmentation, overlays and localization                       | Replaceable providers, explicit observation/calibration, no global spatial-memory side effects      |
| rotate_camera                     | Active viewpoint acquisition                                           | Resolve actual head/base resources and report achieved pose                                         |
| ExecutionReport                   | Execution summary and final observation                                | Policy success is diagnostic; formal verification is separate                                       |
| Verification                      | Independent post-end checks with confirmed boundary evidence           | DSH verifier, mandatory budget trigger, separate facts and recovery suggestions                     |
| Verification bundle               | Per-attempt evidence                                                   | Versioning, causality, device confirmation and actual model-visible inputs                          |
| Policy registry/contracts         | Type specifications, lazy loading and remote inference                 | Check units, frames, joints, frequency and compatibility                                            |
| Lessons                           | Failure evidence as input                                              | Retry-driven Evolver and scoped successful-recovery skills                                          |
| Global trace/scene graph/counters | Underlying responsibilities                                            | Task/attempt scope; remove implicit cross-task sharing                                              |
| BEHAVIOR backend                  | Existing real environment integration path                             | Extract common boundaries; keep R1Pro binding in configuration                                      |
| Deep Agents builders              | Useful role ideas and prompt content                                   | DSH runtime; no second model loop                                                                   |

Legacy code does not implement full RoboCasa/RoboTwin support. Mocks do not establish
support. Do not migrate autonomous local retries from old navigation/manipulation agents.

## 13. Milestones and acceptance

These are capability groups; the implementation plan defines construction order.
Contract and stored-data validation can run without a simulator; physical capability
acceptance requires actual model, policy and simulator execution. No timeline is estimated without staffing and compute information.
M0–M3 form v1, M4 evaluates broader
configurations, and M5 covers actual hardware.

| Milestone                                | Deliverable                                                                                             | Completion evidence                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| M0: Teams/tools/context                  | Loader, catalog, role factory, briefs, routing and provider capability checks                           | Config-only role addition, no inherited tools/history, no duplicate actions                                                     |
| M1: Tools and simulation                 | Persistent plans/files, perception/active observation, BEHAVIOR worker, policy interface, GT verifier   | Observe/plan/change view/execute; mandatory budget checks; actual resources and steps traceable                                 |
| M2: Post-execution verification/recovery | Nonblocking jobs, pause acknowledgement, formal post-end checks, owner retry/replan and recovery chains | Running/paused attempts never start Verifier; eligible confirmed ends do; owner-only attempts and actual provider stop handling |
| M3: Experience/console                   | Retry Evolver, skill version retrieval and production UI                                                | Traceable successful recovery; fresh next-task agent explicitly retrieves skill; UI explains the process                        |
| M4: Extensibility                        | Second real environment/body, minimal DiMOS experiment and hardware contracts                           | Adapter addition without core changes; real/test/replay validation distinguished                                                |
| M5: Real hardware                        | Bound robot, compatible policy and real evidence provider                                               | Actual task/stop/disconnection behavior and unknown handling reported independently                                             |

Even without a robot, v1 tests different capability declarations, asynchronous data,
pause/stop acknowledgement and reconnect states. Try minimal DiMOS interoperability
when dependencies are available; otherwise report it unverified, not supported.

### 13.1 Required contract and integration checks

| Scenario                      | Required observation                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Independent context           | A marker withheld from the brief is absent from the recipient's actual model input; appears only after explicit handoff |
| New task, reused role         | Fresh session without previous objects, messages or working memory                                                      |
| Insufficient context          | Explicit context request rather than hidden access to other sessions                                                    |
| Incompatible capabilities     | Reject before execution with the missing camera/control/check mapping                                                   |
| Budget exhaustion             | Stop actions, preserve boundary and trigger formal verification even without a model tool request                       |
| Stale evidence or verdict     | Old attempt/frame cannot complete the current attempt                                                                   |
| Ordinary pause                | Request and acknowledgement remain distinct; no Verifier starts, and only Planner resumes or creates an attempt         |
| Redelivery/reconnection       | Idempotent job; query uncertainty before further physical commands                                                      |
| GT isolation                  | Only authorized facts enter agents; debug state remains inaccessible                                                    |
| Retry and learning            | Only explicit upper retry starts Evolver; normal success does not; failed chains yield no successful skill              |
| Replan prerequisite           | Prerequisite success does not close the original recovery goal                                                          |
| Skill applicability           | Preserve source configuration, reject mismatches and retain authoritative conditions                                    |
| Role replacement              | New role/subscription uses configuration without a fixed role enum                                                      |
| User-authored team            | A new role file/member completes a delegation without a dedicated builder                                               |
| Tool isolation                | Perception role lacks execution.start in both model schema and execution authorization                                  |
| Files and plans               | Same-named files do not collide; plans persist; todos cannot fabricate success                                          |
| Provider replacement          | Same role/observation works with another conforming segmentation provider                                               |
| Active observation            | Gimbal/base resource resolution differs by body; conflicting policy motion does not run concurrently                    |
| Missing optional dependencies | CPU profile starts without SAM/GPU; selecting an absent provider yields a clear diagnostic                              |

### 13.2 Evaluation

Report task and first-attempt success, retry/replan counts, recovery success, control
steps, wall time, model calls/cost, post-end verification latency, pause-ack latency
and verification coverage. Report unknown outcomes separately rather than dropping them.

Compare no experience, raw episode records and distilled skills. Measure
post-execution verification separately from execution throughput. Keep tasks,
policy, budgets and GT visibility matched so extra oracle information is not credited
to memory.

For transfer, align task semantics, object roles, required capabilities and criteria.
Freeze the source library before target evaluation. Separate target-side skill updates
from source-skill transfer gains. Record skill versions, task order and seeds; distinguish
online accumulation from frozen-library evaluation.

Measure adapter effort through files/changes, core modifications and conformance results.
A cheap mock adapter does not prove easy integration with every physical robot.

## 14. Deployment bindings and evolution

Bind the following to actual resources before dependent implementation:

- A subgoal-capable checkpoint, GPU, input/action specs and supported instruction granularity;
  incompatible policies require a separate training/fine-tuning work package.
- Actual task, scene and body configurations for BEHAVIOR, RoboCasa and RoboTwin.
  All three providers require complete real acceptance for v1.
- Post-end verification latency, model/execution budgets and latency targets, based on measurement.
- Robot model, cameras, DiMOS/SDK/ROS2 backend and actual stop/resume/evidence capabilities.
- Release details, dependency locks and model/data permissions. EDH-authored framework
  code uses AGPL-3.0-only; the standalone SAM service and its invocation example retain
  MIT. Preserve upstream notices and the independent terms of model weights and
  datasets. Exact file scope is specified in the [license notices](../THIRD_PARTY_NOTICES.md).

Filesystem skills and a single host/worker deployment are v1 defaults, not architectural
limits. Changes to role ownership, context isolation or verification gates require a
documented decision rather than an adapter-specific bypass.

## 15. Sources and current status

### 15.1 Reference basis

| Source                                                                                                                                                                  | Use and limits                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/tree/d347e703908d0406b7a7ef80e3a0e594d86b2215)                                                       | Pinned runtime/session/tool/plugin/UI research; module map and key-path inspection, not a line-by-line audit of every file          |
| [DSH agent](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/core/agent/README.md)                                | Scoped creation, followup/steer/inject and lifecycle; model-step delivery is not hard-real-time handling                            |
| [DSH subagent control](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/subagent/tool-subagent-control/README.md) | Default parent/child messages; arbitrary task routing belongs to EDH                                                                |
| [DSH skills](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/skill/skill-filesystem/README.md)                   | Discovery/loading; EDH adds compatibility and evidence versioning                                                                   |
| [DSH presets](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/preset/agent-presets/README.md)                    | Composition reuse; explicitly verify target-role isolation from parent composition                                                  |
| [DSH todo](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/todo/tool-todo/README.md)                             | Session list/UI projection, not a durable shared task plan                                                                          |
| [DSH files](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/fs/tool-fs/README.md)                                | Read/image/write/edit with assignment-scoped workspace access                                                                       |
| [DSH file search](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/fs/tool-fs-search/README.md)                   | Glob/grep subprocess paths need the same workspace restriction                                                                      |
| [DSH MCP](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/mcp/mcp-client/README.md)                              | External tools; EDH supplies effect/resource/result mappings without assuming resource/prompt support                               |
| Legacy EAF                                                                                                                                                              | Commit `714e00ca83999da2df7221dcf205968adde5b441`; execution, verification, context projection, policies and evidence               |
| [DiMOS](https://github.com/dimensionalOS/dimos)                                                                                                                         | Modules, typed streams, blueprints, hardware protocols and MCP; optional backend candidate, not installed or interoperably verified |
| [ASPIRE](https://research.nvidia.com/labs/gear/aspire/)                                                                                                                 | Inspiration for evidenced recovery/transfer boundaries; EDH skills target upper decisions and verification; no reproduced results   |

See [provenance](provenance/README.md) for the source audit. Historical ideas are
reference material; simulation-only scope and automatic replanning at budget expiry
are superseded by the confirmed decisions here.

### 15.2 Current status

Delivered: selected DSH runtime, native tools/TODOs, immutable Teams,
independent role Sessions, explicit context/evidence, versioned plans/private files,
post-execution verification, Planner recovery, selective SKILL reads, durable domain
records, complete built-in retention, HTTP/SSE Console and packaged Desktop launcher.
Cloud OpenAI-compatible and local vLLM configuration use native DSH model transport.
Policy client/server modes pass all proposed actions through ActionGate.

Actual Qwen/Pi0.5 RoboTwin and RoboDojo tasks have retained-scene retry, fresh
formal success, source-bound actions/video and released resources. RoboCasa has
actual Qwen/GR00T CloseDrawer success and retained-scene recovery. BEHAVIOR
preserves its observed unsuccessful learned-policy outcome. Native SAM/YOLO,
source-bound RGB-D and R1Pro active observation have separate acceptance.
The CPU campaign verifies source, preallocation, process/thread/connection
ownership and original histories with models and simulators unallocated.

Current-code loaded-provider faults, multi-goal completion, Tower, original BEHAVIOR
success and the full installed configuration matrix retain their native gates.
Evolver is paused, SceneState is deferred and real hardware follows its selected
deployment. Concurrent physical goals and nested independent recovery chains are
outside the current implementation. Exact evidence and remaining requirements are
in [progress](implementation/progress.md) and the [v1 register](implementation/v1-delivery.md).

## 16. Work packages, source entry points and first CPU scenario

This is a self-contained implementation handoff. Source references guide migration;
legacy prompts and installation workarounds are not new user instructions.

### 16.1 Source entry points

DSH paths below are relative to the pinned upstream checkout, not EDH's folder layout.
Use the [pinned source tree](https://github.com/deepseek-ai/deepseek-harness/tree/d347e703908d0406b7a7ef80e3a0e594d86b2215)
if the research checkout is unavailable.

| Purpose                   | DSH source paths                                                                                                                           | Verify during implementation                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Independent instances     | `packages/core/agent/src/index.ts`, `packages/core/agent/src/runtime-types.ts`                                                             | Actual create/setup-scope/send/followup/steer signatures                       |
| Model/tool loop           | `packages/core/agent-loop/src/index.ts`, `packages/core/agent-loop/src/tool-calls.ts`                                                      | Reuse original loop; physical ownership is not single-agent tool serialization |
| Role composition          | `packages/preset/agent-presets/src/index.ts`, `packages/preset/agent-presets/src/mount.ts`, `packages/preset/agent-presets/src/session.ts` | Explicit target preset/scope; avoid parent composition inheritance             |
| Tool registration/results | `packages/core/tools/src/index.ts`, `packages/core/tools/src/types.ts`                                                                     | Registry, cancellation, structured/multimodal results                          |
| Background communication  | `packages/subagent/tool-subagent/src/index.ts`, `packages/subagent/tool-subagent-control/src/index.ts`                                     | Parent/child restrictions and EDH router integration                           |
| Plans/files               | `packages/todo/tool-todo/src/index.ts`, `packages/fs/tool-fs/src/index.ts`, `packages/fs/tool-fs-search/src/index.ts`                      | Persistence, private workspaces and search scope                               |
| External tools            | `packages/mcp/mcp-client/src/index.ts`                                                                                                     | Media references, cancellation and reconnection                                |
| State/UI                  | `packages/core/session/src/types.ts`, `packages/api/gateway/README.md`, `packages/client/ui-tool/src/client/index.ts`                      | Durable events/projections rather than parsed model prose                      |
| Skills                    | `packages/skill/skill-filesystem/README.md`, `packages/skill/tool-skill/src/index.ts`                                                      | Discovery/loading and EDH metadata indexing                                    |

Legacy EAF paths are relative to a separately obtained legacy checkout:

| Purpose               | Legacy source paths                                                                                                                              | Preserve/change                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Upper tools/prompts   | `src/eaf/agent/agents/top_agent.py`, `src/eaf/agent/agents/prompts/top.py`                                                                       | Planning/files/perception/facts; remove robot constants                          |
| Perception            | `src/eaf/agent/tools/perception.py`                                                                                                              | Capture, segmentation, overlays, depth/localization; remove global side effects  |
| SAM/depth providers   | `src/eaf/agent/interfaces/sam_backend.py`, `src/eaf/agent/interfaces/da3_depth.py`, `src/eaf/agent/interfaces/lingbot_depth.py`                  | Replaceable lazy providers; recheck actual APIs/dependencies                     |
| Active observation    | `src/eaf/agent/interfaces/http_backend.py`, `src/eaf/sim/behavior/motion.py`                                                                     | Actual base/head resources and achieved pose                                     |
| Subtasks/verification | `src/eaf/agent/orchestration/subtask_executor.py`, `src/eaf/agent/orchestration/verification.py`, `src/eaf/agent/orchestration/verify_bundle.py` | Explicit inputs, independent checks, evidence and async identities               |
| In-flight monitor     | `src/eaf/agent/runtime/rollout_monitor.py`                                                                                                       | Historical reference only; current Verifier begins after confirmed execution end |
| Policy/environment    | `src/eaf/contracts.py`, `src/eaf/sim/schemas.py`, `src/eaf/sim/behavior/session.py`                                                              | Calls and budgets; no environment-private types in generic tools                 |

The legacy prompt and orchestration sources provide behavior guidance without
introducing their agent implementation into EDH:

| Legacy source                                        | Retained principle in EDH                                                                                                                                                                                                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/eaf/agent/agents/prompts/top.py`                | Planner perceives and plans, gives one bounded action instruction with an explicit criterion, and changes its approach when it explicitly retries.                                                                                                                                     |
| `src/eaf/agent/agents/prompts/manip.py` and `nav.py` | The former execution agents returned a self-report and `final_observation_ref`. EDH directly calls a policy job; its stop reason, counts and final observation remain evidence, not a verified success claim.                                                                          |
| `src/eaf/agent/agents/prompts/verifier.py`           | A fresh Verifier judges one criterion, treats execution claims as untrusted, accounts for camera-pose changes between authorized before/after evidence, and reports concrete facts with a reasoned basis. EDH also admits limited native GT checks under the current visibility rules. |
| `src/eaf/agent/orchestration/subtask_executor.py`    | The historical order was executor report, then independent verifier. EDH preserves this temporal boundary while Planner directly invokes the policy.                                                                                                                                   |

Evolver belongs to EDH's recovery mechanism: a formal failed verdict followed by
Planner's explicit retry or replan starts its evidence record. A reusable SKILL is
published only after formal success of the original recovery goal.

### 16.2 Initial work packages

W01–W07 group responsibilities. The implementation plan splits UI, real adapters and
acceptance into separate steps. Target interfaces may exist in bootstrap; their presence
does not satisfy functional completion.

| ID  | Work                               | Output                                                                                           | Acceptance                                                                                                               |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| W01 | Single protocol source             | Role/Team/Tool/Brief/Envelope/Report/Plan/Observation/Result schemas and cross-language fixtures | Matching versions, valid inputs accepted, malformed structures and invalid references rejected at appropriate boundaries |
| W02 | Team/Role loader and catalog       | Resolution, preflight and immutable snapshots                                                    | Config-only role addition, deterministic missing-binding errors                                                          |
| W03 | DSH role factory and communication | Fresh scopes, nonblocking delegation, send/reply/context requests/subscriptions                  | No prompt/tool/workspace leakage; correlate brief and actual model input                                                 |
| W04 | Upper-level tools                  | Persistent plan/todo mapping and scoped files/search                                             | Plans survive turns, version conflicts rejected, private files explicitly handed over                                    |
| W05 | Full tool execution slice          | CPU capture/segmentation, active observation, jobs/checks, results and resources                 | Scene-role report, head/base conflicts and no GPU dependency                                                             |
| W06 | Verification and recovery          | Mandatory post-end formal checks, pause acknowledgement, owner retry and Evolver                 | Budget must verify; only owner creates attempts; original-goal success enables skills                                    |
| W07 | UI and actual adapters             | Team/role/tool console, BEHAVIOR/provider migration, optional SAM                                | Real events replace demo data; dependencies and unverified capabilities are explicit                                     |

W01–W06 schema and persisted-data validation can run without a GPU. Simulator and
checkpoint availability determine actual physical acceptance. Structural checks do not
prove policy effectiveness.

### 16.3 Real-environment acceptance scenario

Use a real VLM, policy service and supported simulator with native observations,
actions and limited GT. Preserve model requests, action receipts, boundary IDs,
timestamps and provider source revisions:

1. Resolve the actual task instruction, criterion, simulator scene, model binding and
   policy ActionSpec. Planner captures a native observation, records its plan and
   invokes `execution.start` for one bounded policy job.
2. During `running` and an ordinary confirmed `paused` state, inspect the role
   assignments and evidence grants: no Verifier exists or receives running frames.
   Planner may resume the same job within its admitted budget.
3. When execution ends with `policy_stop`, `planner_stop`, `episode_terminated`, or
   `budget_exhausted`, confirm the native device boundary and final execution report.
   Start a fresh Verifier with the criterion, budget and authorized before/after
   evidence. Record each limited GT result and its source.
4. Interpret the actual formal verdict. Planner owns retry or replan after a
   failed verdict and supplies the next attempt's explicit context. Evolver remains
   paused for the active work scope. Its separately enabled publication workflow
   requires original-goal formal success and complete experience provenance.
5. Confirm external cancellation and backend errors remain failed or unknown, and
   verify final resource release. Inspect persisted DSH requests, tool calls, native
   receipts and replay evidence rather than inferring success from model narration.

### 16.4 Build, checks and handoff report

Current commands are in [development setup](development/setup.md):
`pnpm install --frozen-lockfile` and `pnpm check`. The
[CPU campaign](implementation/cpu-release-validation.md#consolidated-cpu-campaign)
executes actual configured production diagnostics and original-record readers.
The [native campaign](implementation/native-release-campaign.md) owns loaded-model,
simulator and complete task acceptance. Base Python interfaces import independently
of optional GPU SDKs; each provider uses its configured isolated dependencies.
Reports retain source identity, original inputs, observed results and acceptance limits.

### 16.5 Change log

- v1.0 (2026-09-06): DSH-based physical loop, independent contexts, async Verifier,
  retry Evolver, adapter boundaries and console direction.
- v1.1 (2026-09-07): Team/Role authoring, full tool capabilities, role-scope isolation,
  source entry points, CPU slice and handoff acceptance.
- v1.2 (2026-09-07): Step 00–16 sequence, explicit actions/gates, CPU/simulation/hardware
  boundaries and interrupted-work handoff; SVG diagrams retained.
- v1.3 (2026-09-07): EDH-owned repository, intuitive flat modules, selective DSH absorption,
  provenance, skeleton bootstrap and a separate canonical implementation plan.
- v1.4 (2026-09-07): English public documentation and diagrams. Preserve requirements
  and explicitly distinguish intended contracts from partial skeleton declarations. Group
  both runtimes and shared contracts under `harness/` (decision 0002).

## 17. Step-by-step implementation plan

[implementation/plan.md](implementation/plan.md) is the single maintained plan.
Skeleton Bootstrap is a separate delivery stage. Interfaces and directories do not
complete the functional acceptance gates of Steps 00–16.

## Implementation update: upper application first (2026-09-08)

The current implementation order prioritizes the DSH-backed upper application and
console before physical runtime providers. Historical CPU fixture results cover role
isolation, native tool calls, planning/files, verification, recovery and experience
publication. See [progress](implementation/progress.md) for actual physical acceptance.

The recovery activation point is now explicit: **formal failed subgoal -> decision
owner accepts replan/retry -> explicit failed-attempt handoff -> Evolver records
planner and execution progress -> original-subgoal formal success -> SKILL**.
The Evolver receives scoped messages rather than shared agent histories. Both
replan and retry enter one recovery; a later retry does not duplicate the Evolver.
Recovery traces persist references to published run events. Progress delivery reads
ordered pages of at most 32 events with a 64 KiB encoded-body target; a larger event
is delivered alone. Native delivery of each batch settles before the next batch,
and original-goal success follows all preceding progress. Explicit inspection can
reconstruct the complete trace. See [recovery storage and delivery](implementation/multi-goal-runtime.md#recovery-progress-storage-and-delivery).
See [decision 0004](implementation/decisions/0004-recovery-observation-and-action-admission.md).

Physical providers must separate policy inference from action admission and device
execution. Pause invalidates queued/late policy chunks and requires a separate
controller acknowledgement. Resume is a decision-owner action. Device-specific
buffering and interruption granularity remain explicit provider capabilities;
software gate closure does not establish that physical motion has stopped.

### v1.8 clarification: observability and delivery order

Upper work continues before physical providers. Reuse the native DSH TODO plugin
and expose real model output, tool arguments/results/errors, assignment/turn/step
identity, explicit context and TODO history. Concise decision notes are useful;
missing provider reasoning must never be fabricated. Agent-reported TODO completion
is separate from verifier-accepted physical success. The final console must show
key agent, task, execution, verification and recovery state together in one
workspace, without page/tab switching for essential state. The unified console now
implements this layout, with stacked sections on narrow screens and scrollable details.

### Implemented role reporting clarification

Framework-provided agent.report and team.query now return versioned, identity-bound
AgentReport records through native DSH inbox delivery. Custom role schemas constrain
report.result using DSH-supported JSON Schema. Exact retries return the same receipt;
final results cannot be rewritten. Native idle state is not a role result or physical
verdict. Decision owners finish tasks through existing task tools. Native raw tool
definitions invoke DSH input validation explicitly; schema declaration alone does
not validate arguments. No new registry, model loop or physical middleware is added.

## Implementation update: plan-selected subgoals (2026-09-09)

The native `tasks.select_goal` tool selects an admitted plan goal. `planning.read`
exposes the deployment-bound check catalog; Planner may compose subgoals from those
exact checks or use predefined bindings. The final task criteria and executed goal
history remain immutable. Dependencies require their own latest accepted verdicts.
Switching requires confirmed ended execution and formal verification. Returning to a
failed goal requires explicit retry; attempt budgets apply per goal.

A recovery can span a successful repair prerequisite and ends only at formal success
of its original failed goal. SKILL publication is then allowed while later task goals
continue. Evolver model failures remain learning failures. No new DSH loop or dispatcher
was introduced. [Runtime guide and SVG](implementation/multi-goal-runtime.md) specify
current tool semantics, limits and the CPU acceptance scenario.

## Implementation update: caller report acknowledgement (2026-09-09)

Roles now have native team.ack_report. The fixed caller explicitly accepts/rejects
an exact published report version. Acknowledgement is an immutable recorded assessment,
separate from DSH delivery settlement and from physical verification. Report history
retains a published version chain. Startup marks unsettled delivery interrupted while
preserving receipts; it does not resume sessions or replay physical actions.
The [illustrated protocol guide](implementation/report-acknowledgements.md) contains
tool arguments, permissions, replay semantics, crash boundaries and acceptance tests.

## Implementation update: asynchronous provider reads (2026-09-12)

Upper perception and verification calls may resolve asynchronously. Pass the native
DSH cancellation signal into providers and reject late results before changing
assignment evidence or checked facts. Formal check requests carry their expected
execution and stopped boundary IDs; revalidate them after remote completion. The
backend query method is an immediate client-side projection, refreshed before
stream callbacks. Transport implementation and physical acknowledgement remain
separate integration work. See [execution boundary](../harness/agent-runtime/execution/README.md).
