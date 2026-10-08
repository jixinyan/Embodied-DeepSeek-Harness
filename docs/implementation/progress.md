# Implementation progress

Spec: v1.80. Current checkpoint: **shared native policy-thread ownership and actual CPU cancellation/recording checks; tools-owned detached model schemas and actual recorded request/plan checks; separate native host/Session/transport/recording modules; actual CPU worker pipes, request cancellation and host initialization cleanup; policy telemetry and tool scope checks; actual CPU foreground-service lifecycle; complete native worker preallocation checks; four-provider offline readiness; native Qwen/Pi0.5 task success and retained-scene retry; bounded native Qwen tool generation; DSH failed-step recovery and JSON portability; complete default native retention; packaged Desktop two-task execution and cleanup; scoped Planner turn completion; native background faults and owned process cleanup; unified native profiles and Teams**. Full v1 acceptance remains in progress.
This page supersedes the pre-upper-runtime status at `d1fe6f4`. Historical evidence
remains in Git. [Capability map](features.md) separates working code from targets.

## 2026-10-08 policy inference ownership

GR00T/RoboCasa, GR00T/BEHAVIOR, LeRobot Pi0.5/RoboTwin and OpenPI/RoboDojo
service entry points use one production owner in `policies/inference.py`.
The owned thread includes model work, completed records and exclusive audit files.
Caller cancellation preserves that operation until completion; concurrent
admission fails and actual model/recording errors emit scoped evidence before
propagation. Shutdown rejects new work, shares its completion and drains the
actual thread even when a close waiter is cancelled.

Nine CPU cases pass with the original PolicyRequest, production recorder, real file
reads, OS pipes, production policy server and two actual WebSocket clients.
Concurrent requests fail while a server deadline leaves its actual thread owned.
Strict JSON Lines inspection retains five genuine recording/admission/deadline
failure records with original identities and tracebacks. Both client connections,
listener and owner threads close; source bytes remain unchanged.
Full checks compile 59 physical
files and seven policy entry points, with 20 base imports. These checks perform
no inference, environment allocation or controls. Commands and source-bound
evidence: [CPU owner validation](cpu-release-validation.md#policy-inference-ownership).
Current-code loaded-model cancellation and physical task acceptance remain open.

Committed `870806e` source passes those nine cases and full project checks on
Linux with isolated Python 3.12.14 and frozen Node dependencies. The source hashes
match the local helper, diagnostic, transport and service entry points. Five
original errors retain their classifications and three full scopes. Both clients,
listener and owner threads close; the canonical remote checkout stays unchanged.
The retained archive has SHA-256
`bef0237d5ad37ea56fdefe5edd17093467f0d54f8264ac1764ded1abb44f89cf`.
No GPU/model/simulator work is started during this CPU phase.

Frozen `6031766` source also passes all sixteen Worker subprocess cases and
production original-plan admission on Linux in its isolated CPU environment.
Both original histories preserve four execution requests and six accepted plans;
canonical remote Git status remains unchanged. The downloaded evidence archive
has SHA-256 `3f4e98cd5ab8a88346be64784f17f1d93467a78d2aeb4ce4e43baac9c492b10f`.

## 2026-10-08 tool ownership and scoped parameters

The original-plan reader verifies seven actual execution admissions across three
native histories through TaskGoals and TaskPlans. Each request retains its
preceding committed plan, admitted criteria/budget/entities/capabilities, decision
owner and unique attempt identity. Per-goal execution limits remain enforced and
both original event/run hashes remain unchanged. These source inspections perform
no model inference or physical execution.

Actual Worker process checks now cover sixteen cases, including duplicate JSON
fields at envelope and nested argument levels and decimal numeric overflow.
Standard-library JSON hooks reject them before operation dispatch. Each child
reaches process close without forced signals or an unobserved exception; no
environment or model is allocated. Evidence:
`.local/work/v1-worker-json-cpu-20261008/acceptance.json`.

`harness/agent-runtime/tools/src/model-schema.ts` prepares model-visible parameters
and canonical schema projection alongside the logical core definitions. Application
assembly, role checks and original plan readers consume its public exports. The
reference-parser dependency belongs to that module. Each parameter result is a
detached object, including supplied plan/role schemas and device arrays. Native
DSH retains tool registration, dispatch, cancellation and validation.

Three CPU schema checks pass: required canonical plan fields, caller/canonical
parameter isolation and decision-owner-only query turn authority. The source-bound
reader validates 344 original tool schemas from 12 Planner and four Verifier requests,
including twelve unchanged canonical plan headers and independent generated
parameters. All original request/description/schema hashes remain unchanged.
Three actual task histories preserve ten accepted object-valued plan writes,
eight rejected original string-valued writes and thirteen read-only plan templates.
These checks perform no model inference, simulator allocation or physical controls.
Exact commands and artifacts: [CPU tool validation](cpu-release-validation.md#model-visible-tool-schemas).

Frozen `6488510` source passes the same tool/plan checks and complete project
validation in an isolated Linux workspace. All 344 original schemas and three
parameter tests pass without allocating an environment or running a model.
The canonical server checkout remains unchanged. The retained evidence archive
has SHA-256 `636f0b8a07a3d5763beabff7f68a0fe1807408080e4edbb1c3337db8785d18f7`.
Actual four-provider Console readiness also passes at this revision with its
original configuration hashes, zero service leases and released writer/listener.
The multi-goal guide records the original RoboDojo base/middle/final criteria and
the independent formal-verification requirement for each dependency transition.

## 2026-10-08 native worker organization and CPU process checks

Host communication belongs to `apps/server/src/native-worker-transport.ts`; native
Session/task/image assembly remains in `native-worker.ts`. Response validation
precedes pending-request retirement and retains Python's original error text.
Input-pipe errors are observed by the same transport owner. Five actual CPU client
cases verify concurrent operation errors, cancelled-read response draining,
request expiry, child SIGTERM and executable ENOENT. All requests complete, repeated
close calls share their completion and every owned child/process group is absent.
Faults preserve unknown device state and reject clean-close acceptance. Source-bound
checks and entry points are in [CPU validation](cpu-release-validation.md) and the
[code map](../development/code-map.md).
The same production-client and host checks pass on Linux from frozen `5a4a605`
source with isolated Python/Node dependencies. Full project checks pass and the
server checkout's original status is unchanged. Exact source hashes, process
outcomes, check output and dependency versions are retained in the
[CPU evidence archive](cpu-release-validation.md#worker-process-transport).

`execution/worker.py` owns NativeWorkerSession and the process entry point;
`worker_transport.py` owns bounded UTF-8 JSON host requests, fd-3 publications,
request-task exceptions and pipe shutdown; `policy_records.py` owns original
policy request/control persistence. The worker entry and wire responses remain
stable. BEHAVIOR and RoboTwin initialization checks the installed source directory
before importing its optional SDK provider. The
[code map](../development/code-map.md) identifies exact upper/physical runtime,
deployment and Console files; module READMEs describe the same responsibilities.

Thirteen actual CPU subprocess cases pass. They verify batched scoped responses,
operation errors, diagnostics, the exact 32-MiB boundary, malformed/oversized input,
duplicate active identities and output disconnection. Input remains open during
failure cases; every worker exits without forced termination or unobserved
Task/Future errors. Production TypeScript host-to-worker checks independently
confirm BEHAVIOR and RoboTwin missing-installation errors, normal close-protocol
cleanup, absent child processes, removed recording probes and disposed image
contexts. Exact source hashes remain unchanged. The original policy request also
passes exclusive private recording and actual duplicate-write rejection.

The Python source check now includes native Session, transport and record modules:
58 files compile and 19 base modules import on the CPU host. These checks allocate
no simulator and invoke no model or policy inference. Full current-code native
tasks, multi-goal completion and active-SDK interruption retain their actual
acceptance requirements. Evolver remains paused and SceneState remains deferred.
Commands and original artifacts: [CPU release validation](cpu-release-validation.md).
The base Python package declares Pillow for the worker's PNG observation encoder,
alongside boundary validation and resource locking dependencies. Model and SDK
packages retain their configured optional dependency environments.
The same process/host checks and full `pnpm check` also pass on Linux using frozen
source `feb8cc9`, Python 3.12.14, Node 24.21.0 and pnpm 11.19.0. Python and Node
dependencies are installed in isolated CPU/source environments. The original
server checkout remains unchanged; only its remote Git references are refreshed.
The source-bound archive retains stderr, source hashes, check output and installed
dependencies. CUDA remains invisible, with zero model or simulator allocation.

## 2026-10-07 CPU transport and service ownership

The Python policy client checks telemetry identities, one native context and
increasing sequences before publishing events. Tool requests require unique
nonblank call identities, current request scope and object arguments/results.
Inference failure preserves any connection-cleanup failure. Private server
diagnostics retain source frames and request identity; public errors remain generic.

Original telemetry inspection accepts 95 events across three requests. Actual
WebSocket bearer admission, upstream connection timeout, error propagation,
connection discard and listener shutdown pass. The actual four-provider Console
also passes shared foreground-process leases, last-lease shutdown, restart,
unexpected exit and server closure with a held lease. Source files retain their
original hashes. See [CPU release validation](cpu-release-validation.md).
No model, policy inference or simulator task is started by these checks.

The actual native admission driver handles SIGINT/SIGTERM through evidence capture
and matching Session closure. Reads/polling stop promptly; submitted admission
responses remain observable before cleanup. Production admission-conflict and
interrupted-admission checks confirm released Session resources, zero allocated
workers/tasks and owned process leases, unchanged configurations and closed writer
locks/listeners. In-flight simulator interruption retains its native test requirement.

Production CPU readers also verify the original 141-event role-context workflow,
actual BEHAVIOR two-task history and DSH interrupted tool prefixes. Original
RoboCasa, RoboTwin and RoboDojo metric records pass source-bound recomputation with
reported float64 coordinate roundoff. Raw calibration, PNG/mask hashes, identity
and counts remain exact. These checks start no model inference or physical controls.

The current Python package also passes all 56 compilations and 16 base imports
on `jd_B300` in the isolated Python 3.12 LeRobot environment with CUDA invisible.
An original recorded Pi0.5 action passes the production Torch CPU converter;
unchanged arm channels and native gripper conversion are checked independently
of inference. The conversion report explicitly leaves original-request identity
unchecked in its conversion-only mode. The recorded-input endpoint driver is
prepared for actual policy validation with scoped hashes and private output.

## 2026-10-07 native configuration readiness

The consolidated native campaign prepares four actual profiles and eight task
submissions without allocation. Tower requires three completed goals; second
tasks require independent terminal verification with zero new controls,
inferences or physics steps. Actual execution requires the same unchanged
committed EDH revision, original configuration hashes and deployment digest.
The production Console rejects a modified checkout before allocating a Session.

The shared workflow reader passes four original task histories across three
Sessions: `551fa79d`, `a5d9132e`, `897f215d` and `ca43312e`. It checks independent
retired contexts, Planner-owned recovery, confirmed formal boundaries, completed
plans/TODOs, host/native tool results, requested tools and released Session resources. The original failed
BEHAVIOR outcome remains ineligible for task-success acceptance. These checks
perform no model inference or physical controls. Full current-code campaign,
multi-goal execution, interrupt cleanup and original source/action/video acceptance
retain their actual native testing requirements. See
[consolidated release campaign](native-release-campaign.md).

One complete worker schema now validates the deployment loader and native
environment allocation. It covers WebSocket endpoints, action/monitor limits,
transport/device/policy/lifecycle deadlines, recording flags and provider-specific
source requirements. Configured decision-owner and final-Verifier model bindings
require image input. The native factory identity is `factory-v5`.

The actual four-provider workspace passes production HTTP configuration, Team,
profile/checkpoint/mode/model and service projection checks. There are zero active
Sessions, simulator allocations, model inferences or owned service processes.
Shutdown releases the writer lock and listener; all original configuration hashes
remain unchanged. Evidence: `.local/work/v1-offline-readiness-20261007-03/`.
This checkpoint establishes configuration readiness; current-code native task,
multi-goal, safety and complete release acceptance remain pending.

The shared Planner workflow specifies admitted prerequisite checks, exact source
and criterion identities, dependency ordering, and a committed passed-verdict
plan update before selecting the dependent goal. Evolver remains paused and
SceneState remains deferred. GPU experiments are held until the consolidated
implementation and validation preparation is ready.

## 2026-10-07 Qwen full-context tool generation

The EDH Qwen launcher inherits vLLM's native XML parser and configures XGrammar
to admit at most 16 consecutive whitespace characters in tool parameter formats.
The configured range is 1–1024. All 26 recorded native parameter schemas retain
their original contents and compile with the actual checkpoint tokenizer.

On the actual final Planner context from run `551fa79d`, both HTTP calls and the
native DSH stream retain 38,069 input tokens, nine real image attachments and
the original 8,192-token output budget. They return valid empty-argument
`tasks__finish` calls in 54, 47 and 59 output tokens respectively. The DSH stream
finishes in 9.699 seconds with returned reasoning retained. Raw native tokens,
grammar hashes and complete model responses remain preserved.

Actual recorded `planning.read` validation uses the role's complete native tool
header and checks nested `planning.update` arguments through HTTP and DSH
streaming, with strict `auto` and `required` tool selection. All four responses
preserve the receipt's exact `planWrite`. These are read-only model diagnostics
with zero physical controls. Only GPU 2 is used. Sources,
commands and acceptance limits: [Qwen tool generation](qwen-tool-generation.md).

## 2026-10-06 single-GPU native integration

Actual Qwen/Pi0.5 RoboDojo run `551fa79d` completes a failed 32-control attempt,
Planner-authorized retained-scene retry and successful 29-control continuation.
Its 308 events, 61 original actions, four identified learned requests, 610 native
physics steps and six camera videos pass the production audit with zero tool
errors. Both formal Verifiers use independent contexts, all ten TODOs complete,
terminal receipts precede native turn completion and Session resources release.
The source-bound MP4 contains Agent output, plan/TODO state and all three native
camera views; its 1,172 frames fully decode, with zero recorded tool errors and
checked text bounds.

OpenPI connection reuse and interleaved clients have four actual checkpoint
inferences with request/instruction/state/image identity checks. The task bridge
then admits the already-used native service at counter 4. Qwen IPC path validation
and the recorded admission/deadline/conflict checks pass; owned services exit
after zero active Sessions or model requests. Compute and graphics contexts use
only physical GPU 2. Full-context model generation has its separate accepted
grammar setting in [Qwen tool generation](qwen-tool-generation.md).
Exact sources and acceptance boundaries:
[single-GPU native acceptance](single-gpu-native-acceptance.md).

## 2026-10-03 native v1 integration

### Current deployment GPU allocation

Current EDH work on `jd_B300` uses at most one physical GPU selected from GPUs
2–4. The 2026-10-06 integration selects GPU 2 for Qwen, native OpenPI and the
simulator. CUDA and graphics-renderer selections are checked separately against
the same physical UUID. Completed records retain their original device identities.
GPU selection belongs to deployment configuration and does not constrain the
framework's portability.

### Native RoboCasa task success

Independent run `7e3f76b6` also accepts successful retained-scene recovery on the
original CloseDrawer criterion. Planner ends an operator-requested first review
at 84 controls; a fresh Verifier fails that assessment. Planner authorizes retry,
and 306 further controls reach native success with a separate passed Verifier.
All 685 events, 390 action receipts, 50 identified inferences, six native videos
and thirteen completed TODOs pass source checks with zero tool errors. Session
close releases resources and recorded owned processes exit. The 108.167-second
Agent-trace MP4 passes complete decoding and text bounds. This run uses only
physical GPUs 2–4. Ended-scene sequential-task source acceptance remains separate.

Qwen/GR00T `CloseDrawer` run `043520a2` completes the original native criterion
after 382 controls and 48 identified inferences. Five running reviews precede its
confirmed episode end and fresh independent Verifier. Planner consumes the passed
verdict, commits plan version 2, completes seven TODOs and finishes the task.
All 598 events have zero tool errors; both roles retire, their terminal receipts
precede completed native turns and normal Session close releases resources.

The 765-file frozen source, all original learned/action records, 390 sensor samples,
three 382-frame native videos, timestamp mapping and owned-process cleanup pass
production checks. The 81.250-second composite includes all three views and 15
original model-analysis events; full decoding and every text boundary pass.
This first-attempt success has no recovery chain. Other Casa task bindings and
ended-scene multi-task behavior have their own acceptance. Exact sources, native
physics reporting limits and records: [native Casa success](robocasa-native-success.md).

### Planner observation turns and native fault ownership

`execution.query` accepts optional `completeTurn: true` for the decision owner and
the current admitted task/goal/attempt/recovery scope. The actual status receipt
commits before DSH completes that turn. Planner uses this explicit boundary after
deciding to continue motion or await pending formal verification; the same role
context receives subsequent bounded observations and verdicts. Ordinary status
queries retain their informational behavior. All native Planner instructions and
host follow-ups describe this workflow. Actual Qwen Tower run `949ece77` records
the current running receipt at sequence 168, matching native tool result at 169,
and completed turn at 170, 24 milliseconds after the receipt. Its next bounded
three-image review arrives after that completed turn. This running prefix contains
zero Verifier assignments, verdicts or tool errors. Full native multi-goal acceptance
remains open in the [running review guide](planner-running-review.md).

Actual production run `ff830ddc` receives one genuine GR00T response after its
owned BEHAVIOR SDK is suspended. The scoped device timeout fails the run, retires
its Planner and creates no Verifier or StopAcknowledgement. Its 110-event journal,
original request/inference, 763-file source inventory and fault identity pass the
production reader. Session close reports HTTP 400 and unknown device/resources;
OS inspection independently confirms absence of the owned worker, SDK, process
group, Console, policy listener and writer lock. Historical execution counters and
earlier active-observation controls retain their distinct scope. Exact evidence:
[native Console fault acceptance](native-console-fault.md).

Native owner-call cancellation preserves unfinished operations while returning to
the caller's deadline. A separate real BEHAVIOR suspension/restoration check
returns after 0.75334951 seconds under its 0.75-second bound, then confirms original
observation completion, unchanged scene/cameras/counters and successful native
close. Fault diagnostics additionally record actual gate/device counters and
pending owner operations; their numerical production acceptance has its own
source-bound record.

### Packaged Desktop tasks and synchronized success recording

The packaged Electron application creates native Session `30d91ef8` and submits
two actual RoboTwin tasks through its Console. Run `bd3e1606` verifies independent
SceneAnalyst communication, 64-control formal failure, explicit retained-scene
retry and 37-control formal success. Its 724 original events, seven identified
Pi0.5 inferences, 101 action receipts, 493 sensor samples and six native camera
videos pass complete checks. All nine TODOs complete and four assignments retire.
The subsequent `9f81a1ec` task explicitly selects earlier task context and obtains
a fresh passed verdict on the same terminal scene, without new controls or policy
requests. All eight TODOs complete and its three independent assignments retire.

Actual Session close and service stop release resources and writer ownership,
exit children and close listeners; browser errors are absent. Production readers
verify both tasks on a copy of the unchanged closed journal. Local and remote
751-file source inventories match immutable `d1dc4ab`; native evidence archive
digests match across hosts. Independent native terminal-source verification for
the zero-control task is unavailable in this original source.
The Agent-trace/camera composite fully decodes 2,004 frames over 167 seconds with
verified text bounds and source hashes. Exact identities, digests and scope:
[native Desktop acceptance](desktop-native-acceptance.md).

### One native workspace with profile-specific Teams

`native-workspace.mjs` composes actual configured RoboDojo, RoboTwin, RoboCasa and
BEHAVIOR providers under the existing DSH host and Console. Each immutable launch
profile carries its trusted Team and role directory; startup validates and hashes
each resolved Team. Shared model/perception settings are checked before startup.
Component selectors continue to admit only complete compatible profiles, while
the selected Team drives both the graph and assignment sidebar. Disabled learning
is visible in experience/recovery projections.

Actual production startup reads four original native configurations. Browser
selection verifies all four environment/body/checkpoint bindings, the independent
RoboTwin SceneAnalyst Team, disabled learning and zero browser errors/warnings.
Normal close releases the writer lock and loopback listener; original configuration
hashes remain unchanged. `pnpm check`, read-only native-module formatting and
whitespace checks pass. Evidence: `.local/work/native-workspace-20261003/`.
This establishes configuration, selection and cleanup without simulator allocation
or model inference. Installed multi-provider task switching has separate acceptance.

Allocated BEHAVIOR and RoboCasa profiles also pass sequential Session creation,
native three-camera capture, actual Qwen inspection and confirmed close through one
Console. Both use their own Team and preserve original source, checkpoint, scene,
criterion and budget. This inspection advances no learned controls and supplies no
formal task result. Original paired RGB-D geometry and resource-release records are
retained in [allocated profile acceptance](native-workspace.md#allocated-profile-switching-acceptance).

### DSH recovery and engine portability

Checkpoint `d4e010d` applies upstream
`6a6f350b9437cf24e34a34f39ee4dfd107897d0c` and
`068c552b1e057aa580ef2875efdaafcdfa2aacfb` from reviewed
`dsh-v0.2.0-rc.1` source `4878cdabd87d4041bdaff61d04c966883b9fd07a`.
The 128-file import manifest preserves original source hashes and records each
adapted local hash. Live failed-step recovery and durable-prefix repair share the
owned Session tracker. Completed results remain immutable; missing results become
`TOOL_OUTCOME_UNKNOWN` or `TOOL_NOT_STARTED` in existing `role: user` tool-result
blocks before step closure. Original errors propagate, and publication failure
preserves both errors. Recovery never replays physical dispatch.

Actual Qwen acceptance uses read-only repository files and a real exclusive-file
publication failure. Four model requests and four file reads verify recovery,
serialized Session restoration, subsequent model-visible results, independent
contexts and original-error preservation, including failed recovery publication.
Evidence: `.local/work/dsh-tool-recovery-live-ygLra4/acceptance.json`.
Five retained native journals verify 149 actual interrupted call prefixes, balanced
restoration and unchanged original source digests. The production-reader checks
perform zero physical dispatches. Their evidence directories are
`.local/work/dsh-recovery-history-2mBGjK/`,
`.local/work/dsh-recovery-history-JsL4Zx/`,
`.local/work/dsh-recovery-history-tSng0E/`,
`.local/work/dsh-recovery-history-ND5HZA/` and
`.local/work/dsh-recovery-history-aJVRIK/`.

Actual Node/V8 and native JavaScriptCore checks use the real import manifest in
same-engine and cross-realm contexts. Both engines accept plain JSON objects/arrays
and reject custom prototypes; JavaScriptCore's actual multiline intrinsic text
is retained in `.local/work/dsh-json-portability-YAW7sV/acceptance.json`.
Public executable checks are documented in the
[DSH adaptation guide](dsh-release-adaptation.md). TypeScript, script type checking,
source provenance, read-only formatting, structure and whitespace checks pass.

### Default native retention and Desktop lifecycle

Checkpoints `f60ede6`, `782696c` and the native factory integration bind complete
built-in native record/image ownership. Explicit payload formats, private files,
SKILL provenance, native audits and source leases participate in maintenance
admission. Unknown extension formats fail inspection. Archive, inspection and
retirement preserve immutable request identities and require an idle workspace;
original-image collection has separate explicit admission.

Private copies of five actual histories contain 3,202 records and 19 archived
request identities. Independent selection of Session
`7ab8cc59-203f-4a75-b794-7c136e5c8a71` retires 455 selected records and preserves
three other Sessions, their three runs and 407 records through restart.
The default-factory HTTP/browser check retires 626 copied records, retains two
request identities and explicitly collects 180 unreferenced private originals
covering 69,077,537 bytes. Original journal and image digests remain unchanged.
Evidence: `.local/work/native-retention-http-3i2P0k/http-acceptance.json`.

The packaged Electron application opens the unified console from an actual saved
RoboTwin/Qwen/Pi0.5 configuration and selects its compatible native profile.
Separate Stop service and application-quit cycles release the writer lock,
terminate owned service children and close the loopback listener. Browser errors
are absent; sandbox/context isolation remain enabled with no Node access.
This accepts configuration and process lifecycle without model inference or native
environment allocation. Evidence: `.local/work/native-desktop-PVdQ8t/acceptance.json`.
Checkpoint `1b42751` documents executable setup, packaging and native deployment
instructions. Signed distribution and full installed task execution remain open.

### Retained native task and terminal episode boundaries

Provider checkpoint `1ed875e` supplies authoritative `episode_terminated()` for
all four native environments and rejects controls after their actual ended state.
Host/worker checkpoint `0b08ff1` checks that state before creating the policy client.
An already-ended episode receives a fresh ActionGate-confirmed `episode_terminated`
boundary and current observation, with zero new controls, physics steps or policy
requests. The task's execution resources release while its native environment
remains allocated. A fresh Verifier receives the new task/execution scope.

Sequential task admission preserves the allocated environment and immutable
configured benchmark criterion; different-scene tasks require a new Session.
Checkpoint `85740a5` records these semantics in
[Session task catalogs](session-task-catalogs.md). Actual RoboDojo Session
`88b93ebe-b2df-48f9-8170-30a724c0c0f9` completes first run `897f215d` and then
second run `ca43312e` on its unchanged ended native episode. The second task uses
a fresh confirmed execution boundary and independent Verifier, with zero new
controls, physics steps, policy requests and tool errors. All twelve model-facing
camera comparisons match the final original native NPZ; native counter 1424 and
simulation time 5.696000270545483 seconds remain unchanged. Session resources release.
The dedicated audit checks actual inference files, source-bound actions, ordered
task membership and unchanged source journal SHA-256. Checkpoints `a1fecec` and
`3406f71` supply its executable acceptance. Local evidence:
`.local/work/retained-terminal-05-accepted/acceptance.json`. This zero-action
acceptance is separate from the first task's positive learned-policy execution.
Evolver is paused and SceneState is deferred.

### Configured service ownership and strict Qwen tools

Checkpoint `871b29b` exposes optional OpenAI-compatible `strictTools` and
`toolChoice` settings; the local Qwen example requests strict parameter decoding.
Checkpoint `b956833` validates all 25 actual Planner tools, including the native
DSH Todo registration. Four actual Qwen calls cover native Chat Completions and
DSH streaming with `auto` and `required` choices. Structured plans validate against
the production schema, with model reasoning retained and zero schema issues.

Checkpoints `dc1d5bc` and `456209f` bind configured model/policy services to
owned process lifetimes and shared leases. Actual Pi0.5 processes verify readiness,
two-lease sharing, continued service after the first release, termination after the
last release, restart, unexpected exit and server-close cleanup. The console
displays current service states and timestamps unavailable status; Session controls
remain disabled until validated configuration arrives. These checks establish
service and UI lifecycle separately from physical task acceptance.

### Native custom-role RoboTwin task

Clean run `a5d9132e-f4fb-438e-8c71-e81394cffd39` uses immutable source
`871b29b`, strict Qwen tools, native RoboTwin and the identified Pi0.5 checkpoint.
Planner, SceneAnalyst and two fresh Verifiers have four independent contexts.
The original 773-event audit verifies explicit report/acknowledgement, 64-control
failed execution and 49-control successful retained-scene retry, eight learned
inferences and 10,494 physics steps. All twelve owner TODOs complete, all assignments
retire and Session `c55621de` releases resources. Tool errors and post-terminal
model steps are zero. Production-reader validation covers 528 sensor samples,
409 native frame groups, all six camera videos and three typed plan writes.
The original 742-file source inventory matches the immutable snapshot. Evidence:
`.local/work/v1-robotwin-20261003-clean/audit.json`. The synchronized 276-second
MP4 includes 26 model analysis events and passes complete decoding/source checks.

Run `66ff9b47-9e2d-4514-904c-cd61c869b44c` uses native Qwen/Pi0.5 with
independent Planner, SceneAnalyst and two fresh Verifiers. Its saved outcome is
`succeeded`: attempt one ends after 64 controls with failed formal verification;
the explicit retained-scene retry ends after 40 controls with native success and
passed formal verification. Recorded totals are 104 controls, seven policy calls
and 10,087 physics steps. All four assignments retire and Session
`e59cbd72-c1b3-4e42-8497-30e73109c98a` closes with resources released.
The original 765-event trace retains two tool errors, so clean-workflow acceptance
is false. Evidence: `.local/work/v1-robotwin-20261003/acceptance/`.
This is a separate run from zero-tool-error recovery run `686c9767` below.

### Native RoboDojo task

Clean run `897f215d-119f-4880-9030-1d9edeb9fabb` uses immutable source
`2abd647`, strict local Qwen tools and the identified native ARX X5 Pi0.5 checkpoint.
Attempt one ends at its 32-control budget with failed formal verification. Planner
opens a new attempt on the retained scene; 26 additional controls reach original
native task success and a passed independent Verifier. The complete 304-event
audit verifies 58 admitted controls, 580 actual physics steps, four source-bound
learned requests, two fresh formal roles and one recovery chain. All eleven owner
TODOs complete, every terminal tool concludes its turn, tool errors are zero and
there are no post-terminal model steps. All six native camera videos decode with
zero timestamp error. Original NPZ actions, camera records, simulator counter
increments, checkpoint files and policy-service logs are verified independently.
Evidence: `.local/work/v1-robodojo-20261003-05/audit-task-1.json`.
The following same-Session task passes the dedicated unchanged-terminal acceptance
described above, and the Session releases resources.

RoboDojo run `02475b82-b6b6-457f-8cf8-3199ef265bc6` uses local
Qwen3.8-27B Planner/Verifier and the identified native OpenPI Pi0.5 checkpoint.
It records 59 admitted controls, four learned inferences and native
`task_success=true`, followed by one fresh independent passed Verifier and
Planner task completion. Both assignments retire and the Session releases its
native resources. The simulator's original summary records `native_success=true`,
`complete=true`, `valid_for_success_rate=true`, step 59 and a 200-control limit.
The trace contains one rejected string-valued plan argument; clean-workflow
acceptance is false. Canonical provider prompts now use structured
`planning.read.planWrite` arguments.

The source audit checks 223 ordered events, 121 immutable sensor samples,
four source-matched PolicyRequests, 59 exact admitted action receipts and three
fully decoded native camera recordings. The composite MP4 retains the actual
model text, tools, plan, verification and camera timeline: 962 frames,
80.166667 seconds, 1920×1080, H.264/yuv420p at 12 FPS. Full decoding, original
source hashes and every rendered text boundary pass. This run's reported step
counter does not independently establish native physics-step totals. Native
counter instrumentation is under acceptance.

Private evidence is retained under `.local/work/v1-20261003/` on the local and
deployment hosts. The code snapshot is independent of the remote dirty checkout;
the worker interpreter is the EDH-owned `.local/envs/edh-v1-worker`. Qwen uses
GPU 2, RoboDojo uses GPU 0 and its learned policy uses GPU 6. Completed run
services have been terminated; the shared Qwen service supports the next active
acceptance experiment. No unrelated workload is stopped.

Verified source checkpoints:

- `b6ae21d`: complete typed plan-write templates and the configurable SceneAnalyst Team.
- `0a8a64f`: independent device watchdog, OS-backed leases and hardware capability/stop interface.
- `4c08135`: production-reader audits of actual retained Session and goal histories.
- `031efb4`, `ec0ef2d`: identified OpenPI checkpoint/action audits and actual HTTP task driver.
- `663efdb`, `27d00b0`: native task catalog configuration and retained record ownership,
  immutable archived request identities, HTTP/console cleanup and restart checks.
- `7431f77`: import-safe factories for all four native providers; actual saved
  configuration, production Team/catalog and server startup checks pass.
- `ec9ae85`: consistent structured planning workflows in provider role prompts.

The remaining native gates include additional explicit-context role workflows,
original build_tower stage progression, calibrated metrics across providers,
native fault handling and the complete installed configuration matrix. Evolver
remains paused; SceneState remains deferred.

## 2026-09-30 delivery boundary

### Idle-service handoff

Completed EDH experiments have no remaining simulator, policy, console or recorder
processes on the checked hosts. The idle Qwen/vLLM service on `jd_B300:18080`
was stopped with SIGTERM after its live metrics reported zero running and waiting
requests. Its API process, inference engine and resource tracker have exited; its
listening ports and GPU context are absent. GPU 2 usage decreased from the engine's
112,314 MiB allocation to 1 MiB total. Other active experiments remain running.
The next model-driven experiment requires starting the configured model service
and checking its readiness. Recorded task evidence and shutdown audits retain
their original service states.

Native worker tools declare a 120000-ms DSH budget; ordinary worker requests retain
their 60000-ms bound. Configurable output transmission defaults to 30 seconds and
formal native checks revalidate the connected task lease/boundary around owner
operations. Actual worker-pipe checks confirm continued communication after a
12.051-second reader pause and lease termination after a 32.009-second pause.
These process checks contain no simulator task. The actual Qwen/Pi0.5 custom-role
task verifies the selected deadlines and connected post-execution checks described
below. Endpoint-failure and rotation checks retain separate acceptance records.
See [native tool boundaries](native-tool-boundaries.md).

Native RoboTwin run `4a65da16-f64d-4eb2-9d33-7873fa8247cc` verifies a real
unavailable Pi0.5 endpoint after an execution-start receipt. The 99-event record
retains the original connection error, a confirmed `backend_error` boundary,
zero controls, zero physics steps and zero completed learned inferences. No
Verifier is assigned and no formal verdict is produced. Task and owned service
resources release. Eleven actual model requests expose exactly the device-supported
tool subset declared in their briefs; this fixed-camera provider exposes neither
`observation.turn_view` nor `observation.rotate`. Its source audit binds 496 files
from the private overlay. This accepts failure after policy-job admission;
provider-start rejection before an execution receipt requires separate validation.
The original zero-frame native recording exports with byte-identical manifest and
empty journal, no camera video and explicitly unavailable native rollout frames.
Actual successful recordings with 446 frame groups retain their original hashes.
Evidence is retained under `.local/work/custom-role-demo-20260930/failure-endpoint/`.

Native R1Pro active-observation validation passes six actual OmniGibson trials in
`picking_up_trash`, instance 0: yaw ±15 degrees, camera pitch ±10 degrees, initial
cancellation and in-motion cancellation. All achieved yaw/pitch targets are within
the 1.5-degree tolerance. The source audit checks 170 controls, 680 physics steps,
unchanged task criteria, held non-motion joints, fresh RGB identities and clean
native shutdown. Three camera videos fully decode all 170 frames. Evidence is
retained under `.local/work/behavior-rotation-20260930/`. No policy task success is
claimed for these observation motions.

Production-worker run `8f35aca4-e71a-41cb-936d-2a0ab8d21a2c` verifies actual Qwen
capture → yaw +15 degrees → yaw −15 degrees → explicit user confirmation.
The two completed rotations consume 145 observation controls and 580 physics
steps; policy controls remain zero. Native initialization takes 523.553 seconds
in this recorded deployment.
Five actual model requests expose the canonical rotation schema and descriptions.
For each capture/rotation receipt, all three original image digests and byte counts
match an actual subsequent model request. Nine 256×256 PNG files fully decode.
All 709 private-source files pass SHA-256 verification. The original task criterion
matches the catalog, brief and plan. Four factual TODOs complete and the remaining
confirmation item stays in progress. The pre-close snapshot contains 63 events
and a pending user question; closing the Session yields `cancelled` with 66 events
and released resources. There are zero tool errors, policy jobs, policy requests
and formal verdicts. All owned worker/native/compile processes and console/recorder
services exit; GPU contexts release and the shared Qwen service remains available.
This accepts active observation and model image transport, without a task-completion
claim. Evidence is retained under
`.local/work/behavior-rotation-planner-20260930/remote-evidence/`; its local
source/image audit and checkpoint are in the parent directory.

Five [recorded Agent workflow MP4s](recorded-demos.md) retain native RoboTwin
failed-attempt recovery and success, native RoboCasa retry exhaustion, and actual
SAM/YOLO pre-motion grounding with user clarification, BEHAVIOR retry exhaustion
and successful custom-role delegation with retained-scene recovery.
Source hashes and immutable image bytes pass integrity checks.
All 1,217 / 1,424 / 481 / 1,546 / 2,269 encoded frames fully
decode; dimensions, FPS, duration and text bounds pass. These are replays of the
source records described below. BEHAVIOR records one tool error and a failed native
task; zero-tool-error and task-success acceptance remain pending. The custom-role
task succeeds with eight recorded plan-parameter errors; zero-tool-error planning
and additional role/task combinations remain pending.

Custom-role run `ef8f9d03-c9e6-4671-aac4-99c965631ae4` verifies four independent
Qwen Sessions, explicit three-camera evidence transfer, a selected-schema specialist
report, Planner query/acknowledgement and actual Pi0.5 recovery. The original task
receives failed formal verification after 64 controls and passed verification
after its 60-control retry. Its 415-event audit checks 124 actions, eight identified
inferences, 11,366 physics steps, 446 native frame groups and six fully decoded
camera videos. All assignments retire, TODOs complete and resources release.
Both formal checks declare a 120000-ms tool deadline and complete once, in
1.023/1.029 seconds. Eight rejected plan-parameter calls remain in the actual
source; `cleanWorkflowAcceptance` is false. Thirty-four model requests expose
754 checked schemas. Its exact private-source/configuration SHA inventories and
original process wire are retained under
`.local/work/custom-role-demo-20260930/remote-acceptance/`. This validates native
tool budgets and connected post-execution checks; it precedes the new rotation
and capability-filter implementation.

Native BEHAVIOR run `0b7da1de-19c2-4f9f-8229-bb346a178c16` retains 399 events,
three identified GR00T inferences, 48 controls, 192 physics steps and three confirmed
16-control execution endings. Three independent Verifiers find the original
`picking_up_trash` criterion false. Planner accepts two retries, completes 11 factual
TODOs and concludes failure. Four role assignments retire; the Session resources
release. All nine native camera videos decode with exact journal timestamps.
The original trace contains one unsupported active-view call, and its audit declares
`cleanWorkflowAcceptance: false`. This recorded worker predates the current native
budget/capability changes. Evidence is retained under
`.local/work/behavior-workflow-demo-20260930/`.

Responsibility-bound numbered Planner/Verifier workflows load across all six live
Teams and contribute to their source digests. All 34 core tools have argument and
receipt guidance; the canonical plan projection retains domain bounds in model-visible
annotations. Authored role/schema checks, formatting, type checks, source provenance
and structure checks pass. Recorded actual model requests verify independent role
workflows, parameter descriptions and structured plan schemas. See
[prompt workflows](prompt-workflow.md).

Run `686c9767-746a-430e-ba81-900eef3fb09c` verifies actual recovery in native
RoboTwin `adjust_bottle`, `demo_clean`, seed 0. The original task criterion and
environment persist. Attempt one exhausts its admitted 64-control budget and
receives a failed Verifier result. Planner accepts retry, captures the retained
scene and starts attempt two; its 49 controls terminate with native success and
a passed result from a fresh Verifier. All six TODOs complete and resources release.
The source audit covers 292 events, eight identified Pi0.5 calls, 113 controls,
10,662 physics steps, zero tool errors and zero post-terminal model steps. The
actual request audit checks 12 Planner and four Verifier requests, containing 344
serialized tool schemas. All six
native camera videos pass full decoding and timestamp comparison.

Lossless SAM mask storage fully decodes bounded single-frame PNG inputs and retains
their exact bytes, dimensions and SHA-256 identity through the existing immutable
publisher. Two recorded native SAM masks pass byte-identical save/read checks;
non-PNG mask admission is rejected. Attachment content identity preserves media
type, dimensions and byte count; sample-local display names and input dimensions
retain their own presentation context.

Run `0b6b7450-0bb9-483a-9ff4-2631d65530df` verifies the complete actual Qwen
capture → SAM3.1 → YOLO26 masked-depth → user-confirmation sequence. The matching
640 × 480 source/mask pair retains 18,202 selected pixels, identical to SAM's
reported area, and a meter-valued axial median of 0.5965579. The mask attachment
identity matches the depth service's PNG digest. Prediction accuracy remains
unverified for that camera. Five actual model requests expose 110 checked schemas,
including the nested plan annotation and precise image/mask-reference paths.
There are zero native tool errors and zero physical controls; Session resources
release. This acceptance covers the grounding round, without a task-success claim.
Evidence is retained under .local/work/prompt-grounding-20260930/.

Run `7dfb663e-debb-44fb-a4da-96be2b88e664` verifies native RoboCasa OpenCabinet
retry exhaustion. Qwen owns planning and three fresh Verifiers; GR00T supplies
24 identified learned inferences and 192 controls across three 64-control attempts.
All three authoritative native checks fail; Planner accepts two retries, retains
the required goal and original criterion through plan versions 1–4, completes
13 factual assessment TODOs and concludes with `tasks.abandon`. The 467-event audit
verifies 4,800 physics steps, nine fully decoded native camera videos, zero tool
errors, zero post-terminal model steps, four retired role assignments and released
Session resources. Actual wire auditing checks 616 schemas across 22 Planner and
six Verifier requests. This validates retry and unsuccessful completion; the
RoboCasa task remains failed. Evidence is retained under
.local/work/robocasa-workflow-finalization-20260930/.

Current live Teams disable recovery learning. Recovery history retains its attempt
links; no Evolver or new SKILL is created. SceneState work is deferred. Independent
DSH contexts, durable plans/TODOs/files, scoped evidence and on-demand keyword SKILL
search/selective loading remain available. The
[current Agent loop](current-agent-loop.md) lists actual prompts, memory and retry rules.

Run `5e05df06-6892-4024-b065-cb7a2ac09248` verifies real Qwen capture → SAM3.1
segmentation → YOLO26 masked-depth estimation → user clarification, without motion.
Its Session releases resources. Native RoboCasa Qwen run
`e4c1038f-cb92-4664-a79e-6760aa2e5241` verifies capture → SAM → source-bound
RGB-D measurement → structured plan → selected goal → GR00T execution. Independent
native measurement checks verify camera/world geometry, provenance, stopped-state
authority and source consistency. Raw monocular depth remains accuracy-qualified;
two actual source regions show approximately 0.373 m and 0.102 m median errors.
Provider task outcomes and clean lifecycle acceptance are recorded independently.

Native RoboCasa run `e6ebc3f3-37e5-4274-a51f-2d49584af534` verifies the strict
running `execution.query` path without transmitting live camera images: its
8-control receipt references saved, scoped event evidence. The run completes
64 GR00T controls and an independent failed GT verdict; it is a query/lifecycle
check and does not establish task success or a zero-error complete Planner run.

BEHAVIOR lifecycle 13 verifies three real GR00T inferences, 18 R1Pro controls,
72 physics steps, confirmed pause/terminal-stop and full native SDK shutdown with
exit code 0. The task GT is false. Native worker initialization and close deadlines
are configurable separately; BEHAVIOR selects 600000/900000 ms while ordinary
device/observation budgets retain their existing bounds.

Actual BEHAVIOR console run `c9c3809c-374c-437f-b131-12977a44044a` completes
16 controls/64 physics steps, confirmed budget exhaustion, a fresh Qwen Verifier
with native failed GT and Planner `tasks.abandon`. Both role Sessions retire; the
user Session closes with resources released and the worker/native processes exit.
All three 16-frame native videos decode. The shared numbered Planner workflow and
failed-outcome completion are verified by the RoboCasa run above. A zero-tool-error
BEHAVIOR upper-loop run with the current workflow remains pending.

RoboDojo Pi0.5 native services verify 18 checkpoint inference files and dependency
consistency across 189 isolated packages. Two sequential inferences use retained
native three-camera RGB and 14D state, return finite 50×14 horizons and identified
EDH chunks, and match native input hashes. This scope contains zero physical controls.
Learned/hybrid physical rollout and task success remain separate acceptance gates.
The [OpenPI provider guide](openpi-robodojo-policy.md) records reproducible service
configuration and the exact source/checkpoint identities.

The trace-review milestone is complete after run `6610a9f4-29b8-499c-82ed-d81aab542e13`:
116 real Pi0.5 controls, eight identified policy requests, 10,767 native physics
steps, a confirmed terminal boundary, independent Qwen Verifier success and
Planner completion. Its user Session is closed with resources released. Three
worker-local MP4 files each contain 419 actual frames with zero decoded timestamp
error against the simulator journal. The browser requests no camera assets;
authorized model captures and formal-verification images remain available.
The [Qwen headless handoff](qwen-headless-checkpoint.md) records actual
provider status, source evidence, preserved work and the resumption boundary.
Active work continues on reliable upper-agent retry, source-bound perception
and native provider lifecycle acceptance under the current user scope.

The complete 238-event trace passes `--require-clean-role-completion`: all five
Planner TODOs completed, zero native tool errors and zero subsequent model steps
after terminal tools in the same turn. Native DSH commits each terminal receipt
before completing the turn. Plan writing, goal selection and execution admission
await their preceding receipts. Configured denoising is applied before native
camera creation; the running console displays the actual execution state.
The composite MP4 passes complete decoding and all source-text bounds checks.
Actual custom-role structured reporting and multi-goal acceptance remain pending.
The earlier cloud-model task and provider evidence remain in the
[September 30 provider handoff](pause-2026-09-30.md).

The goal remains to complete and verify all agreed v1 capabilities. SAM 3.1
segmentation and YOLO26 depth are selected for replaceable perception services.
Native DSH SAM/YOLO tool calls and source-bound native geometry checks pass. The user selected
an initialized, continuously updated Session scene state for spatial memory. The
[spatial-memory design](spatial-memory-proposal.md) specifies initialization,
incremental observations, revisions, reset and evidence handling; runtime
implementation and actual acceptance are deferred by the current user scope.
Remaining simulator, policy, lifecycle and release work is tracked in the
v1 acceptance register for resumption.

## 2026-09-29 execution-policy observability checkpoint

RoboDojo run `2c974465-f035-4d1d-a913-fba5a4688c02` uses the real cloud
Astra endpoint, native DSH Planner and execution-policy Sessions, three native
640×480 cameras, RGB-D grounding, wrist depth and numerical motion preparation.
The task instruction is "Pick up the mint green scissors by 10 cm." The run
records 42 controls and eight policy calls through ActionGate. Native execution
ended with `episode_terminated` and a confirmed device boundary; a fresh Verifier
then checked the unchanged criterion and submitted `passed` for
`task_success=true`. Planner marked the durable goal done and called `tasks.finish`.
The completed export contains 2,153 events, 42 recorded frames per camera,
two independent upper Sessions and one independent execution-policy Session.
The recorded-loop audit passes all observed scope, sequence, boundary, criterion
and completion checks. There was no retry or Evolver in this run; recovery and
cross-Session SKILL acceptance remain pending. The user Session closed with
`resources=released`, and its owned native simulator process exited.

Policy tool declarations specify complete local subtask fields and both arm
target formats through native DSH schemas. Motion reasons carry an explicit
left/right format. Text streams publish actual text/reasoning deltas; tool
arguments remain in native tool events. TypeScript and Python/structure checks
pass. The current composite renderer passes source-text bounds and complete
MP4 decoding using the retained real RoboCasa recording. These checks do not
establish task success or recovery acceptance.

Distributed RoboDojo deployments can bind the local policy gateway port and the
worker-reachable WebSocket URI explicitly. Native task configuration retains its
instruction alongside scene metadata, including when the user adds task guidance.
Native owner-thread invocations accept typed positional/keyword parameters.
The composite MP4 renderer includes native execution-policy output, local plans
and tool events, preserves camera aspect ratios and validates successful sources
against a recorded formal success verdict. The successful composite MP4 contains
2,152 frames at 10 fps, 1920×1080 resolution and 215.2 seconds duration. Every
rendered source-text page passes its bounds checks; complete FFmpeg decoding
passes. Its initial observation and 42 rollout frames per camera share the
recorded event timeline with native model/tool outputs, plans and formal success.
The endpoint returned no reasoning content blocks; the video displays actual
assistant text and tool arguments. No hidden reasoning is inferred.

The successful run took 1,283.093 seconds of recorded wall time. Its eight direct
policy decisions contain 41 native DSH model steps and 56 policy tool calls;
the 42 physical controls represent 1.68 seconds of simulator control time.
Planner, execution policy and Verifier used independent GPT-6 Astra Sessions
with `xhigh` reasoning effort. Direct mode generates grounded target poses;
numerical IK, ActionGate and the native controller execute admitted motions.
This run used no learned VLA checkpoint. The video compresses recorded wall time
at 16× and adds labeled reading holds; it preserves the original timestamps.

Direct motion rechecks ActionGate state and generation after each awaited
observation, motion preparation and provider control-source selection. Pause
cancels an active policy request while the generation-fenced device completes
its stop acknowledgement. Provider status updates may coalesce the internal
stopping phase into a confirmed `running` → `paused` publication; all device
boundary, ownership, budget and counter checks remain required. Python and
TypeScript checks pass. RoboDojo run
`806e8b33-4764-4458-87fc-2f99443e63d6` confirms an ordinary pause after one
actual control, unchanged counters during the held boundary, and Planner-owned
resume followed by a second actual control. The original cumulative 200-step
budget remains unchanged, and no Verifier assignment or verdict is created.
Run `ac7133e1-c807-41ea-a0a6-fd76500755d8` verifies operator cancellation during
actual direct motion: two admitted controls, confirmed `user_stop`, unchanged
counters during the held terminal boundary, zero formal verdicts, Session
`resources=released`, native simulator exit and a responsive console afterward.
All 93 exported events pass the recorded-loop audit. Operator stop is tracked by
run settlement before Session task retirement; channel readers respect closure,
and scoped policy telemetry remains available during shutdown.

EDH owns the DSH role and GPT-policy Sessions, tool declarations, worker client,
execution lifecycle and ActionGate. The native server, RGB-D capture, numerical
motion tools, FK checks and service launcher now have EDH-owned source. Independent
pinned SDK checkouts, isolated native packages and a content-verified asset copy
are provisioned. Native check `efc74efc-5c30-4b1b-9173-5c0c47d51039` confirms
reset, three RGB-D cameras, measured FK, numerical preparation, two actual
ActionGate controls, pause/resume, terminal user stop and owned-process exit.
Native task success is false in the manual check. Owned-service Astra run
`c62651a0-f681-4303-9476-3c0301754833` then passes two actual controls, held
pause, Planner-owned resume, confirmed user cancellation, Session resource release
and native process exit. Its recorded-loop audit validates all 204 events with one
upper Session, two independently scoped policy Sessions and zero formal verdicts.
Atomic readiness selects an owned port from port `0`; 6,417 recorded module
origins contain no external LitchiAgent or GPT-as-Policy path. Task success,
recovery and experience publication in this owned deployment remain pending.
The selected IsaacLab/Isaac Sim package requirements contain an incompatible
Starlette/FastAPI constraint; the installer checks and reports dependency consistency.
The current
priority is real agent-loop debugging, measured efficiency improvements, then
a natively successful `build_tower` task and composite agentic-trace MP4.
See [independent RoboDojo deployment](robodojo-standalone.md). Compilation, source
structure and TypeScript checks pass; these checks do not certify native acceptance.

Native DSH policy Sessions publish scoped model messages, returned reasoning,
tool calls/results, local plans, status and decisions through the physical worker
into the same run journal and console. The console can filter execution-policy
activity and inspect its local subtask status. Telemetry preserves independent role
contexts and grants no control or verification authority. See
[policy observability](policy-observability.md) for identity, limits and acceptance.

Grounded RoboDojo profiles expose the provider's velocity-limited numerical target
tools. The lower-policy WebSocket request releases its abort listener when the
request settles. TypeScript checks, console syntax checks, Python compilation/base
imports, SVG XML and source structure pass. Direct-policy telemetry and task
acceptance pass with the recorded native rollout above; hybrid acceptance remains pending.

The authorized simulator uses configurable GPU device 7. Other GPU devices were
available at the latest inventory; no existing job was interrupted. The selected
Pi0.5 checkpoint download contains all 18 inference files at the pinned dataset
revision. The isolated EDH-owned OpenPI installation imports JAX, Torch, OpenPI
and its client from its own SDK checkout. Its dependency consistency check reports
the selected Rerun SDK's NumPy requirement against OpenPI's NumPy bound.
Identified checkpoint inference, artifact checksum verification and hybrid task
acceptance remain required.

## 2026-09-29 architecture and RoboDojo deployment checkpoint

README presents the framework architecture, component responsibilities, extension
points and configuration guides. The shared architecture SVG covers user-defined
teams, independent DSH contexts, upper model adapters, learned/direct/hybrid
execution, ActionGate, simulator/hardware boundaries, post-execution verification
and on-demand cross-Session SKILL retrieval. Development evidence remains in this
document and the v1 acceptance register. Commit `8a5e685` publishes this entry point.

The console launch selection includes `executionMode` and admits complete compatible
profiles. The RoboDojo deployment connects native DSH GPT policy sessions to the
worker through scoped read-only grounding, wrist-depth, numerical motion preparation
and FK preview requests. Each actual motion step advances through ActionGate;
model-generated targets and measured arrival remain separate from formal success.
Checkpoint commits: `24fb309`, `f566e1c`, `87eafe1` and `0be3c37`.

The configured Astra endpoint completed a real DSH file-tool round. A native
RoboDojo `build_tower` Session (`873a2df9-3abc-42f4-a036-197ccf4bbfc6`), run
`c05140ba-7b8d-4d55-a073-008b9c6a0453`, recorded reset, three native camera images,
Planner tool calls and TODO updates. The SSH-owned console and simulator processes
terminated when that connection closed. This run establishes no physical task
success. The retained source camera is
`sha256:146b1cf4762204cd059e290552832ede5ce2b67fed47e02161b33b4c33bc99c6`.

Responses tool outputs preserve authorized image attachments with text metadata.
TypeScript checks pass. A real Astra / DSH image-tool round completed using the
retained native RoboDojo head camera: the model called the tool exactly once,
received its authorized attachment and returned a scene description. The probe
ran from the local checkout against the configured cloud endpoint and retained
the source image digest and native Session events. Server-side endpoint access
encountered connection timeouts. Simulator rollout and formal task verification
remain pending.

The official RoboDojo checkpoint repository was fully enumerated at dataset
revision `35efbc7dedfdbeeb6e95fb749bd885d73d483e41` (3,290 entries under
`ckpt/RoboDojo`). The selected inference checkpoint is
`Pi_05/RoboDojo-sim-arx_x5-joint-0/59999`, including
`assets/arx_x5_sim/norm_stats.json`. Its 18 inference files total 12,440,992,402
bytes. The download destination is `workspace/checkpoints/robodojo`, with the
upstream directory layout retained. All 18 files are present at the expected sizes;
checksum verification remains pending. The dataset card declares Apache-2.0; simulator licensing remains
independently scoped.

OpenPI installation uses a dedicated `.local/envs/robodojo-openpi`, EDH-owned SDK
source `bb9a0b5f5136a74503b679af830bfd0a3a837d5c`, private cache and temporary
directories. JAX 0.5.3, Torch 2.10.0+cu128, OpenPI and its client import successfully.
The dependency consistency check reports Rerun SDK 0.26.2's NumPy >=2 requirement
against the selected NumPy 1.26.4 and OpenPI's NumPy <2 requirement. The bridge
files remain local work pending identified inference and hybrid execution checks.

Continuation evidence is in the ignored `.local/work/robodojo-20260929/` directory
on the local checkout and `jd_B300`. It contains the checkpoint inventory,
download/install logs, model-tool probe, retained camera/event data and private
deployment bindings. Required next actions: resolve dependency consistency,
verify checkpoint checksums, validate the bridge with identified native inference,
and run the owned direct/hybrid RoboDojo task through
formal verification. Long-running services must survive the initiating SSH
connection and retain their own shutdown ownership.

## 2026-09-30 RoboDojo and GPT policy checkpoint

The checkout was fast-forwarded from `028c346` to `96d0a17`, then committed as
`bf3af24`; `main` and `origin/main` were aligned before the checkpoint changes.
EDH now contains an external RoboDojo RPC environment
adapter with bounded msgpack/zlib framing, identity checks, native reset,
post-action RGB/state capture, one-action qpos stepping, terminal check and
no-retry close behavior. The native worker accepts provider `robodojo` and echoes
the selected `execution_mode` (`policy`, `direct` or `hybrid`) during
initialization. The adapter does not copy RoboDojo's non-MIT source.

The model configuration accepts `protocol: responses` and routes that endpoint to
the DSH-native `OpenAIResponsesAdapter`. GPT-6 Astra streamed text, reasoning and
function calls are translated into DSH chunks; DSH continues to own tool
execution, cancellation and retries. On 2026-09-30, the configured Litchi runtime
endpoint passed a live EDH Responses text round and live `DshGptPolicy` direct and
hybrid rounds. The physical WebSocket policy boundary now normalizes
LitchiAgent-style direct action and reviewed hybrid envelopes into the same
ActionChunk before ActionGate; the selected mode and `0-shot`/textual/visual
control context are passed with each policy observation. These live model rounds
do not claim a successful physical task.

`DshGptPolicy` is now an EDH execution module that implements the direct and hybrid
tool sequences on top of the existing DSH session. Its tools can read admitted
observations and propose actions, but have no device authority; the worker remains
the only commit path. The live direct/hybrid check used the private endpoint from
the local Litchi runtime configuration without copying its credential into EDH.
The lower-policy bridge still requires deployment wiring for a complete
learned-policy rollout and is not represented as physical task success.

The local RoboDojo Isaac Sim 5.1 server (RoboDojo revision `726e9aa`) passed a
real EDH `build_tower` reset, metadata/action-spec inspection, three-camera RGB
observation and one admitted qpos step on 2026-09-30. The step returned one
executed action and one native simulation step; the episode was nonterminal and
the native task-success check was false. Full pause/stop, learned-policy rollout,
formal verification and task success remain pending.

The RSI research boundary is recorded in
[`docs/research/rsi-harness.md`](../research/rsi-harness.md): experiment identity,
seeds, prompt/policy/mode revisions, proposals, committed prefixes, stop
boundaries, evidence and formal verdicts remain versioned artifacts. A later RSI
evolver may propose harness revisions, while Planner/Verifier ownership and the
ActionGate commit boundary remain authoritative.

The target is a complete v1 covering every agreed capability. The
[v1 delivery register](v1-delivery.md) records implementation gaps, required real
acceptance and the execution order. The current visual deliverable must combine
model output, plans/TODOs, tools, role communication, verification and camera frames
in one time-addressable view.

The offline replay now provides a shared wall-clock cursor for model output,
role status/messages, assignment-specific TODOs, plans, tools, execution, formal
verification and camera videos. Real bc80 records pass browser DOM checks for
backward/forward time selection, final control counts and verdict, camera frame
agreement, category filtering and playback. The 1,440-pixel layout displays the four
information panels together; the 511-pixel layout displays compact cameras and the
first model response within the initial viewport.

The OpenAI-compatible adapter now accepts vLLM's `delta.reasoning` alongside native
`reasoning_content`. Actual streamed inference and persisted DSH Session checks pass
at `3519e34`. Console run `2f06c665-e0ff-4457-be9c-2b0a01aa6db5` also records
provider reasoning through the complete application path, with camera, planning,
TODO and skill-search calls. That run ended with `task_success=false` after 1,050 native
controls and then `UND_ERR_SOCKET`; its physical outcome is failed. The older
bc80 recording retains its original missing-reasoning limitation.

The previous workflow also produced RoboCasa run
`0e9ceb4b-65df-4fa2-be06-4cd7658d4fd4`: two attempts each recorded 1,050
controls, 66 policy calls and 26,250 physics steps. Both formal GT checks returned
false. Planner accepted `tasks.retry` after the first failure and Evolver ran; the
run recorded no `UND_ERR_SOCKET`. After the second verdict, user API cancellation
closed the Session and released the GPU0 worker allocation. This records the previous
running-monitor workflow.

Post-execution-only verification passes a real RoboCasa run at `3998fbc`:
`1df69c9c-7db6-4ae1-9a1c-dd726f44c15c`. An operator pause confirms the device
stopped after 112 controls and publishes a fresh observation. Planner queries the
execution, captures the scene and explicitly resumes the same execution with its
remaining budget. No Verifier assignment exists during running or paused states.
After 256 controls, 17 GR00T calls and 6,400 MuJoCo steps, event 596 confirms
`ended/budget_exhausted`; event 597 creates the single Verifier assignment with
Planner as its caller. Native `verification.check` returns `task_success=false`,
and the Verifier submits a failed verdict. Public stop/close requests then leave
the Session closed with resources released and no native worker process. This
validates scheduling, pause/resume and formal failure, with successful task completion
still pending.
Local evidence is retained in `.local/work/live-robocasa-server-10/`.

The `0ec010a` repeat, run `3b10d1f3-dc53-4cb1-ad4d-8f6c8b1e2bb2`, also
confirms pause at 185 controls and Planner resume of the same execution. Event 598
ends at 256 controls, 17 policy calls and 6,400 physics steps; event 599 creates
the only Verifier. Its first native DSH model-input message contains six image
blocks: three cameras before execution and three after confirmed end. The before
sample retains its task-only scope, original timestamp and `robocasa.camera`
source; the after sample retains the complete goal/attempt scope. The model compares
these observations, calls the actual GT check and submits failed verdict
`2940c04d-9832-49d9-b607-70444d0df50f` with `task_success=false`.
The native input audit and run records are retained under
`.local/work/live-robocasa-server-11/`.

At `6f2e2d3`, RoboCasa run `b35732fb-a365-45b0-8416-73b588198e26`
uses the native instruction `Open the cabinet door.` and an eight-action inference
limit. The first recorded response contains the native 16-action model output and
the exact eight-action prefix transmitted for execution. The execution reaches
1,050 controls, 132 policy calls and 26,250 physics steps, then publishes a confirmed
budget end. Formal verdict `854524a6-c6a6-4586-9010-66ff41fb053b` is failed with
native `task_success=false`. A subsequent Planner model request fails with
`UND_ERR_SOCKET`; the local model tunnel is repaired after the remote service is
confirmed healthy. No retry or successful recovery occurs in this run. Session
`92261f45-1331-4512-befa-9322ec829eec` closes with resources released. Actual request,
policy, verdict and close records are retained in `.local/work/live-robocasa-action8-01/`.

The SAM 3.1 implementation adds the native DSH segmentation tool, assignment-scoped
camera selection, an independent HTTP service and retained mask and overlay images.
TypeScript, formatting and Python syntax checks pass. Standalone GPU inference on
a real 256-by-256 RoboCasa left-camera PNG with the prompt `cabinet` returns two
nonempty masks with areas 6,953 and 17,627 pixels. The retained report identifies
SAM source `2345a4ad109ac29c569da749c91d84f10dc08c40`, checkpoint SHA-256
`0567debeec80ba4ac6369540c6c248025283cb3ff2b92827509e57e2b3541cb6` and
the `sam31-multiplex-init-state-v1` service adaptation. Evidence is retained in
`.local/work/sam31-acceptance/result.json`. This proves actual image inference;
the full native DSH assignment and model-visible retained overlay remain pending.

Seven boundary-admission checks at `6354f1f` use the recorded RoboCasa statuses
with the production validator and LocalStore. They cover eligible-end admission,
running/paused rejection, unconfirmed and external stop rejection, identity
conflicts, write exclusion, immutable records and historical reads after reopening.
These component checks do not execute models or simulate a physical task.

TypeScript, schema, formatting and structure checks pass for the implementation.
The `31aded4` replay export is a 172.1-second 1080p MP4 derived from recorded frames.

The remaining scope covers the DSH-backed upper loop, a real physical worker, BEHAVIOR-1K,
RoboCasa, RoboTwin, and actual VLM/policy services. Implementations must preserve
independent role contexts, Planner decision ownership, post-execution formal verification,
ActionGate admission and verified recovery experience. The
[live integration acceptance plan](live-integration.md) distinguishes provider
installation, native execution and complete application acceptance. No new live
integration is considered verified until its actual checks pass.

RoboCasa 1.0.1, robosuite 1.5.2 and MuJoCo 3.3.1 are installed in an isolated
Python 3.11.16 environment on the GPU host. All 139 installed distributions pass
dependency consistency. A real MuJoCo check advances 100 physics steps and renders
a nonuniform RGB frame using the NVIDIA GPU. GLVND libraries use a deployment-owned
prefix; system Python, global libraries and drivers remain unchanged. Node.js and
pnpm also use a dedicated prefix, and remote TypeScript checking passes.
The installation checker reports Python isolation and actual renderer identity. Vendor
assertions are optional; device selection comes from the deployment environment.
An explicit GPU 1 selection passes the same native rendering check. Shared runtime
code has no host path, GPU model or CUDA device binding. Other GPU models remain
unverified. The `489edc3` checkpoint passed GitHub Framework checks.
The official kitchen asset downloader completed successfully. A real RoboCasa
`OpenCabinet` task reset passed with PandaOmron, the pretrain split and seed 0.
Three native 256 × 256 RGB camera observations passed shape, type and nonuniformity
checks; the checker recorded the task instruction, initial success value, 12-dimensional
action limits, controller layout and 20 Hz control frequency. The native RoboCasa adapter
and ActionGate device now also pass actual manual-control checks: pause and resume,
budget exhaustion, consecutive executions within one retained scene, and interruption
of an action sequence with stable simulation time after confirmed stop. Actual completed
actions and internal physics steps are recorded on the simulator owner thread, including
when an asynchronous caller is cancelled. These checks use explicit manual controls.
The native worker transport also passes real process checks at `4428fb6`: reset,
three image attachments, two independent task run IDs in one scene, native
`task_success=false`, and policy connection failure with a confirmed terminal
device boundary. Interrupted initialization rejects pending requests and leaves
resource release unconfirmed. These worker checks execute zero learned-policy
actions. A subsequent actual GR00T worker check passes six confirmed controls,
150 MuJoCo physics steps, corresponding camera frames, confirmed pause/stop and
a second task in the same scene. Its native `task_success` remains `false`.
The report retains its base revision and working changes. The latest recorded console
task, `bc80d2aa-d6e4-4a38-b370-9efedc887936`, contains Planner-selected execution,
66 GR00T calls, 1,050 admitted controls and 26,250 physics steps. Formal verification
accepted the native failed verdict at the budget boundary. The subsequent Planner
model request ended with `TRANSPORT_ERROR`; its precise cause remains under investigation.
Its inspectable replay retains 2,300 events, 3,165 original images and three camera
videos with 1,050 source frames each. Browser checks confirm all three videos load
with 256 × 256 dimensions and 52.4997-second durations. This run contains no Planner
retry, Evolver recovery or published SKILL.
Successful task and recovery acceptance remain pending.
[Deployment isolation, source pins and actual checks](gpu-integration.md).

Live camera display now uses decoded three-camera updates with a bounded latest
waiting frame and persistent image elements. Operator-only simulation frames are
available through their recorded event identities while Agent received views retain
explicit context semantics. A real moving RoboCasa run publishes about 4.1 frames/s
across 581 controls. Browser samples show 4.2–6.0 frames/s, 22–23 ms image loading
and 0.33–0.74 s capture-to-decode delay. These are observed samples, not fixed rates.
Cancelling a read-only native capture also passes a real check: subsequent capture,
GR00T control, GT verification and confirmed stop remain available.

RoboTwin's pinned SAPIEN renderer passes native GPU rendering and 100 physics
steps on the allocated device, with matching reported PCI identity. Its actual
`adjust_bottle` reset also passes with Aloha AgileX, three 640 × 480 camera images,
fourteen joint/gripper targets and native GT failure. Learned-policy control remains
pending. The selected RoboTwin pi0.5
checkpoint and processor weights are downloaded under `checkpoints/`; their
SHA256 values match the fixed upstream revision. All three simulators use dedicated
`data/` directories, and RoboCasa's native reset/render checks pass after relocation.
RoboCasa camera preprocessing matches the official evaluation wrapper exactly:
all three decoded EDH PNG arrays pass numerical equality against the same native
reset observations. RoboTwin policy inference from its actual task remains pending.

BEHAVIOR-1K v3.9.2 resets the native `picking_up_trash` instance with R1Pro and
returns three 256 × 256 cameras, 21 state groups, a 23-channel action specification
and native GT failure. Independent native checks now complete a new capture and
clean shutdown with exit status 0 and released GPU memory at `bff3492`. Policy
controls and complete application acceptance remain pending.

An isolated Qwen VLM served by vLLM now passes actual image/tool checks on an available
GPU. Native API completion returns `tool_calls` followed by `stop`. Independent native
DSH Planner and Verifier sessions each call one camera tool, receive the actual RoboCasa
image attachment and finish with `turn/end=completed`. The checks validate matching
call/result identifiers and image identity. They use a static native reset frame;
complete successful model-driven tasks and recovery remain pending.
[Live VLM evidence](gpu-integration.md#live-vlm-image-and-tool-checks).

The latest upstream DSH release review covers `dsh-v0.1.7-rc.2`
(`477b4f420553e8a52c2fbccc464d7561b239c443`, 2026-09-24 prerelease).
Actual vLLM acceptance confirms that a tool registered between two turns of the
same DSH Session is called in the second turn. Native Unicode pruning and persisted
Session restoration checks pass. The current OpenAI-compatible route continues to
send its complete tool list. Release monitoring runs weekly.
The preceding rc.1 adaptation provides the following absorbed changes:
Serial agent initialization, output-aware compaction, cancellation records and nested
secret redaction are implemented with exact source provenance. Native initialization,
disposal, HTTP cancellation, secret traversal and budget-admission checks pass.
An oversized initial or dynamically selected output cap fails before HTTP transport;
disabling automatic compaction retains direct transport behavior. Actual GPU VLM
image/tool checks also pass with native context management enabled at `1a571e2`;
these short rounds do not exercise automatic summarization. The complete GitHub
Framework checks pass at `4b1fd1d`, including all 387 runtime checks. The
[release adaptation guide](dsh-release-adaptation.md) records the model, image and
stored-history compatibility boundaries and required acceptance checks.

RunEventReferences declares event and message dependencies using the existing domain
readers. It covers delegation, observations, reports, verification, recovery pages,
clarification identities and versioned custom reference inspection. The same inspector
composes with legacy inline run history. Forty-nine retention checks pass using authored
documents and actual journals, including compaction and reopen. TypeScript and changed
source formatting pass. No model or physical provider executes in these checks.
The preceding `81e6e90` checkpoint passed GitHub Framework checks.
[Event source rules](domain-retention.md#event-and-message-owners).

The user has authorized GPU-host inspection and simulation integration. The next delivery
priority is a real simulator-to-console workflow through the existing policy transport
and action gate, with explicit environment, embodiment and checkpoint compatibility.
BEHAVIOR-1K, RoboCasa and RoboTwin remain required targets. Complete simulator preparation,
worker integration and real provider acceptance are pending. Remaining upper retention
owners and reviewed deletion admission remain tracked separately.

Three run owners now declare the run projection, configuration and restart annotation
dependencies. Published events, typed task sources, exact sensor snapshots, selected
historical task context and same-session ownership are checked. Nonempty legacy inline
events require versioned payload reference inspection. Forty-two retention checks pass
using authored documents and real journals, including 130-event history, missing or
rewritten sources, configuration conflicts, membership migration and reopen. No model
or physical provider executes. Event/submission/plan/file/clarification/native-audit
owners, archived identity lifecycle and reviewed host/console admission remain pending.
[Run source rules](domain-retention.md#run-configuration-and-restart-owners).
TypeScript, changed-source formatting and 577 local documentation links pass. The
preceding `546be3e` checkpoint passed GitHub Framework checks.

Three task owners now declare assignment archive, recovery and recovery-event sources.
Brief facts, last observations, callers, reports and verification contexts retain their
explicit dependencies. Recovery retains accepted failed/successful verdicts and every
published event index/source, with original-goal, actor and immutable-version checks.
Pending recovery and explicit legacy inline sources remain inspectable. Thirty-four
retention checks pass using authored documents and real journals; no model or physical
provider executes. The preceding `a957c9c` checkpoint passed GitHub Framework checks.
TypeScript, changed-source formatting and 574 local documentation links pass.
Event/submission/plan/file/clarification/native-audit owners, archived identity lifecycle and
reviewed host/console admission remain pending.
[Task source rules](domain-retention.md#assignment-and-recovery-owners).

Four report owners now declare sender/recipient, evidence, history and receipt
dependencies. AssignmentReports validates persisted shapes, immutable archives and
receipts, latest logical/CAS versions and predecessor identity/status. Retention and
history readers share that predecessor check. Current-only legacy report sources
remain readable. Twenty-five retention checks and seven report-history checks pass
using authored documents, real journals, HTTP and constrained-heap processes. No model
or physical provider executes. Complete event/submission/plan/file/clarification/audit ownership,
archived identity lifecycle and reviewed host/console admission remain pending.
[Report source rules](domain-retention.md#report-and-receipt-owners).
TypeScript, changed-source formatting and 571 local documentation links pass. The
preceding `068fca2` checkpoint passed GitHub Framework checks.

Five evidence/verification owners declare sensor metadata, stopped boundaries, formal
contexts and verdict dependencies. They reuse existing scoped readers, validate exact
verifier/context/fact agreement and protect archived assignment sources. Shared image
reference validation is exported by perception and reused by ownership inspection.
Nineteen domain-retention and eight sensor-record checks pass with real journals, the
project PNG and authored documents. No model or physical provider executes. TypeScript
and changed-source formatting pass. The preceding `c4e12aa` checkpoint passed GitHub
Framework checks. Complete event/submission/plan/file/clarification/audit ownership, archived
identity lifecycle and reviewed host/console admission remain pending.
[Evidence ownership and acceptance](domain-retention.md#evidence-and-verification-owners).

Session/request retention now has seven explicit namespace owners. They cover open
requests, task requests, task catalogs, published membership and reverse run ownership.
SessionTaskHistory enumerates complete published history with immutable identity and
position checks, including missing intermediate records. Legacy inline histories remain
readable. Retained request records continue to protect replay sources. Fourteen domain
retention checks pass using authored documents, real journals and file locks. Event,
submission, plan, file, clarification and audit ownership plus reviewed host/console
admission remain pending. [Owner inventory](domain-retention.md#session-and-request-owners).
Seven session-history and seven request-replay checks also pass, including 2,000
stored task memberships, SQLite history consistency and journal reopen. TypeScript,
changed-source formatting and local documentation links pass. The preceding `1ac9e40`
checkpoint passed GitHub Framework checks; live model/provider acceptance remains separate.

DomainRetention accepts versioned record owners and leased external reference sources.
It checks every declared edge, retains SKILL provenance and durable request identities,
requires closed/released sessions, and binds atomic deletion to a single-use preview.
Unknown owners, incomplete sources, changed revisions, retained incoming references
and concurrent operations fail. External leases remain held through journal publication.
Eight actual journal/file-lock checks pass, including cancellation, source changes and
reopen. No model or physical provider executes. A complete EDH ownership policy, host
idle admission and console selection remain pending.
[API, ownership responsibilities and acceptance](domain-retention.md).

Shutdown acceptance uses a real native pre-step cancellation and an actual journal
write hold to check retirement cleanup and deduplicated audit failures. No model
adapter is registered for that check. Budget rejection asserts the structured
ContractValidationError and offending field. These checks do not establish live
model/provider task acceptance.

SKILL source inspection now reads every published recovery event index and its source
run event individually. Returned dependencies include their keys/versions. Missing
indexes or event bodies mark the source incomplete; rewritten versions, unordered or
unpublished references and conflicting event identities fail. Inline recovery/run
histories remain readable with exact event-body agreement. Unpublished suffixes are
excluded. Existing image-retention admission therefore requires intact recovery
history alongside verdict, session and sensor sources.

Fifteen provenance checks and eight image-retention checks pass using authored
documents, actual journals, image files and HTTP. New checks exercise actual record
retirement, reopen, missing intermediate records, conflicting references and inline
source formats. TypeScript and changed-source formatting pass. No model or physical
provider executes. [Source inspection rules](skill-provenance.md). Domain retention
still needs a complete built-in record ownership policy and reviewed console admission;
these references alone do not authorize deletion.

Tool inventory validation compares all implemented logical IDs against `CORE_TOOLS`,
including `user.ask`, before checking role references. Generated-schema equality and
all six authored wire documents, roles/team/tool references and rejection checks pass
through `pnpm check:contracts`. This establishes structural consistency; live runtime
acceptance remains separate.

LocalStore now supports explicit batch retirement under a current global sequence.
It validates the selected keys, preserves retained values/CAS versions/order, and
publishes one synchronized checkpoint atomically. Retirement advances the global
sequence once. V2 checkpoints preserve sequence accounting after deletion, including
an empty store; headerless journals and v1 checkpoints remain readable. Write holds
and observer mutation guards cover retirement. The workspace SQLite index reconciles
removed records and ownership after publication; an index failure stops the writer
and is recovered from the durable source on reopen.

Twenty-seven storage/admission checks and fourteen workspace journal/SQLite/HTTP/process
checks pass. New cases cover stale/missing/duplicate selections, empty-store restart,
corrupt/incomplete v2 checkpoints, actual SQLite contention, actual process termination
and more than 96 MiB of journal input under a 64 MiB V8 old-space limit. No model or
physical backend executes. This is a trusted storage primitive with no HTTP deletion
route. Domain ownership, preserved request identities, SKILL-source closure, external
reference leases and reviewed console selection remain required for application
retention. [Retirement API, format and acceptance](storage-maintenance.md#record-retirement).
TypeScript, changed-source formatting, 128 pinned DSH source checks and 551 local
documentation-link checks pass. Domain retention admission and interrupted-session
continuation remain open alongside live provider/model acceptance.

Upper model configuration now loads YAML/JSON for cloud OpenAI-compatible APIs and
vLLM servers. One configuration can contain both, with stable role aliases, explicit
environment credentials or unauthenticated access, image capability/capacity declarations
and endpoint request options. Assembly reuses the existing native adapter and image service.
Unknown fields/routes, conflicting capabilities and missing credentials fail before
inference. Credential rotation remains private; endpoint/request configuration contributes
to deployment admission identity and recorded HTTP/run metadata.

Seven configuration/native-service checks use actual files, environment lookups, DSH
registration and attachment services. They cover both hosting modes, authenticated vLLM,
the project PNG's request-image path and byte-limit rejection before network dispatch.
No generated model response or physical backend executes. Live cloud/vLLM inference
and complete task acceptance remain pending, as requested until services are available.
[Model configuration API and examples](model-configuration.md).
TypeScript, formatting, pinned DSH source verification and 547 local documentation
links pass. Domain retention admission remains the next upper capability.

The desktop application selects a versioned local launch configuration, executes its
trusted deployment factory in a fresh owned process and opens the existing console.
It reuses `startServer`, tsx runtime aliases and the checkout's installed dependencies.
Configuration paths, optional environment-file loading, remembered selection, loopback
readiness, output inspection and graceful stop/quit are implemented. A startup failure
remains visible and a subsequent launch waits for the prior child to exit. Unexpected
exit never certifies physical resource release. The local application package includes
Electron/Node and uses an external prepared checkout. Signed distribution remains open.

Six actual file/process checks and one actual Electron DOM/IPC check pass. They cover
path validation, secret-free configuration metadata, missing module exports, repeated
launch, startup cancellation, saved selection and isolated window capabilities. These
checks execute no model or physical backend. Successful live deployment startup,
console task execution and provider cleanup still need acceptance with configured
services. [Launcher configuration and ownership](../../apps/desktop/README.md).
The macOS arm64 application builds successfully, and the same DOM/IPC acceptance
passes against both development Electron and the packaged executable. TypeScript,
formatting, 128 pinned-source checks and 533 local documentation links pass.

Follow-up work prioritizes missing upper-runtime capabilities before retrieval,
performance or appearance refinements. Live model evaluation is deferred until a
service is available. Domain retention, interrupted-session continuation and actual
provider discovery/execution acceptance remain open.

New sessions capture a task catalog from registered deployment definitions or the
allocated environment's `describeTasks`. The host validates complete task definitions,
stores immutable ownership/revision/content records and publishes a compact descriptor.
The console reads that session's tasks and criteria, disables submission during failed
or pending reads, and confirms the catalog digest on submission. Backend task creation
receives the selected definition and digest. Startup validates retained catalogs without
allocating providers. Four authored catalog/journal checks, fourteen task/session request
checks and twenty-five console checks pass (43 total). The console catalog check uses
actual HTTP and stored documents. TypeScript, formatting, pinned-source provenance and
523 documentation-link checks pass. No model or environment allocation executes in these
checks. Actual provider discovery/task execution, catalog scale limits and full console
acceptance with those providers remain open, alongside upper lifecycle/retention.
[Catalog interface and acceptance](session-task-catalogs.md).

Configured and Planner-created goals use complete GoalBinding validation. Entity maps,
capabilities, task semantics, identity and configuration are checked alongside the shared
wire success-condition and budget definitions. Construction, preparation and batch admission
enforce the 64-goal task limit; existing bindings are immutable. UpperRun prepares validated
goals before its plan journal write, then admits detached copies. Invalid batches leave
the catalog unchanged. Four authored document/journal checks and seven task-admission checks
pass. TypeScript, formatting, pinned-source provenance and 513 documentation-link checks
pass. No model or physical provider executes. Provider-backed criteria discovery, live-model
acceptance and upper-runtime lifecycle/retention work remain open.
[Goal admission API and tests](../../harness/agent-runtime/tasks/README.md#goal-binding-admission).

`skills.load` accepts optional section names and returns selected Markdown with full
metadata, included/omitted section lists and source/returned byte counts. Preamble,
applicability, limitations and source accompany every selected read. CommonMark parsing
preserves nested content and reference-link targets, including definitions in omitted
sections. Complete stored/exported SKILL documents remain unchanged. Built-in Planner
and Verifier prompts describe focused reads; the extension interface exposes the same
selection types. Six actual document/journal/native-tool checks and eleven provenance
checks pass. TypeScript, formatting, pinned-source provenance and 508 local documentation
links pass. These checks execute no model or physical provider. Semantic ranking,
live agent retrieval decisions and upper-runtime lifecycle/retention work remain open.
[Section API and acceptance](../../harness/agent-runtime/memory/README.md#selective-section-reads).

Formal verification admission persists the original stopped status under a run,
execution and boundary identity. Continuous paused updates reuse that admission only
while preserving stopped facts. New stops and terminal transitions require fresh
identities; different executions may use the same boundary label. Publication failures
and identity conflicts propagate through the existing run failure/stop path. The service
has no separate resident history collection; LocalStore key-index and disk growth
remain open. Authored protocol documents and actual journals verify admission semantics;
live model/provider ordering and device stop acceptance remain separate requirements.
Seven boundary-admission, four verification-context and ten native role-lifecycle
checks pass (21 total). TypeScript, formatting, pinned-source provenance and 506 local
documentation-link checks pass. No model or physical provider executes in this checkpoint.
[Boundary rules and tests](verification-boundaries.md).

Accepted verification results are archived before their summaries enter run state.
Summaries preserve identity/status and a bounded explanation preview; Planner decisions,
assignment inspection, selected task context and SKILL provenance resolve full records.
The console loads one accepted result at a time with explicit selection and refresh.
Six actual journal/HTTP/process checks cover publication, immutability, scope,
missing/conflicting records and more than 100 MiB of authored verdict documents under
a 64 MiB V8 old-space limit. Nine assignment-history, seven task-admission and eleven
SKILL-provenance checks pass, alongside 24 console checks. No model or physical
provider executes. Browser DOM checks using production controls/readers cover selected
full results, literal HTML text, refresh, missing-record errors, empty selection and
close. TypeScript, formatting, pinned-source provenance and 500 local documentation
links pass. Cumulative summary metadata, domain retention and live provider
acceptance remain open. [Verdict history semantics](verdict-history.md).

Session records hold task count/latest identity and publish immutable per-task
membership records. Startup migrates legacy arrays while preserving their order and
configuration. Task admission/replay and SKILL source inspection read selected
memberships; missing SKILL membership is incomplete and conflicting records fail.
Seven actual journal/SQLite checks cover migration/reopen, publication order,
interrupted writes, stale source/head conflicts, indexed history/replay and 2,000
memberships in one compact session record. Six task-admission, ten SKILL-provenance,
seven session-request and twelve workspace checks cover the connected source paths.
The workspace pressure case still traverses over 100 MiB under a 64 MiB V8 old-space
limit. Twenty-four console checks, TypeScript, formatting, provenance and 490 local
documentation-link checks pass. No model or physical provider executes. Distinct-key/disk retention, cumulative
active run metadata and real provider lifecycle acceptance remain open.
[Task membership semantics](user-sessions.md#task-membership-history).

Session opening resolves repeated request IDs through immutable journal identities
and reads only the matching source session. Profile, deployment digest and the full
serialized configuration must agree. New admission publishes the session and request
identity before calling its environment factory. Startup reconciles missing identities,
rejects duplicate/conflicting sources and interrupts unfinished sessions without
activating resources. Seven actual journal/document checks and five task-admission
checks pass. Twelve workspace checks include more than 100 MiB of authored documents,
32 repeated old/new request lookups and full history traversal under a 64 MiB V8
old-space limit. No model or physical provider executes in these checks. Startup
source traversal, distinct request-key growth and provider-backed lifecycle acceptance
remain open. [Session request semantics](user-sessions.md#session-open-request-identity).

The Assignment inspector reads formal-check contexts, source observations and accepted
verdicts together. Waiting for facts, saved checks and settled verdicts have distinct
statuses; an accepted unknown result remains unknown. Scope, request, execution,
boundary, criteria, native role identity, facts and evidence references must agree.
A published-context marker survives assignment archival and makes missing records
explicit. UpperRun rejects further check publication after a formal verdict settles.
Nine actual assignment journal/HTTP/process checks, four context checks and ten native
lifecycle checks pass, alongside 24 console checks. TypeScript, formatting, source
provenance and 478 documentation-link checks pass. Browser DOM acceptance through
the production reader covers waiting/checked/unknown states, literal text, role changes,
missing-context errors, refresh, empty selection and close. These checks use authored
documents; live model/provider verification remains required.
[Inspection API](assignment-history.md#read-api-and-console).

VerificationContexts stores check identities, scopes, facts and evidence references in
versioned records. Its active registry retains only assignment IDs and record versions;
UpperRun releases them on native retirement and after task shutdown drains. Referenced
observations remain available through SensorSamples. Reopening retains inspection
without reactivating verification. Four actual journal/document checks and ten native
lifecycle checks pass, alongside eight evidence-storage checks. Full live-model/provider
verification, cumulative verdict metadata and domain retention remain separate work.
[Verification context ownership](../../harness/agent-runtime/verification/README.md).

WorkspaceHistoryIndex stores source-bound summaries in SQLite and updates them after
durable source writes. Ordered/scoped queries read at most 33 candidates and return at
most 32 summaries with a 256 KiB page target. Pages read no full source bodies; one active
session configuration remains an explicit source read. Startup and compaction reconcile
source revisions. Real SQLite lock failures stop admission after source publication and
recover on reopen. Source file changes and corrupt summary reads fail explicitly.
Twelve actual journal/SQLite/HTTP/process checks pass, including over 100 MiB of authored
documents indexed and traversed under a 64 MiB V8 old-space limit. Nineteen storage checks
cover source revisions/observers, file identity, compaction and recovery. Remaining
cumulative run metadata, startup costs and domain retention still need lifecycle work.
[Workspace history API and acceptance](workspace-history.md).

Retired assignment details are stored and read back before releasing their full brief,
TODO/report bodies, last observation and stream from the run projection. TeamSessions
uses a verified archive reader after native cleanup. The console reads selected role
details, historical TODOs and observations explicitly. Seven actual file/HTTP/process
checks and nine native lifecycle checks pass, including over 100 MiB of authored brief
documents under a 64 MiB V8 old-space limit. Compact metadata and remaining cumulative
run collections still need lifecycle limits. [Assignment history](assignment-history.md).

Role-report queries and the console inspector read bounded published-version pages.
Agents select earlier receipts and optionally load their report bodies through
`team.query`; native input validation keeps those controls optional. Acknowledgement
and startup reconciliation traverse stored reports individually. Seven actual
journal/HTTP/process checks pass, including report history exceeding 100 MiB under a
64 MiB V8 old-space limit. Retired report bodies are omitted from run updates and remain
available through explicit report inspection.
[Report API and remaining costs](report-acknowledgements.md#bounded-history-reads).

Planner `user.ask` persists a scoped question and concludes its native DSH turn.
Accepted answers are immutable, retain retry identity, and return to the same Planner
through native followup after the asking turn becomes idle. Execution must be absent
or confirmed stopped before asking; continued motion requires an explicit Planner
decision. The console preserves drafts and shows response/delivery status. Native/file,
HTTP and browser component acceptance is available; live-model/provider continuation
remains required. [Interaction guide](user-clarification.md).

Native audit publication and delivery-error inspection read the original DSH event
sequence directly. Published audits bind their native Session identity, and adopting
older unbound histories validates every published event. Audit export holds individual
event bodies. Native Session history now releases older resident event bodies after
verified publication, retaining absolute event identities and archived reads. Default
checkpoint limits are 256 events and 8 MiB of encoded bodies. Eleven native/file/process
checks cover this path, including an active Session storing over 100 MiB under a 64 MiB
V8 old-space limit. Active model surface and application projections have separate costs.
[Residency policy and acceptance](session-history.md).
[Publication semantics](session-audits.md#native-publication).

Native role retirement removes Agent/Session registry entries, includes scoped-cleanup
events in the final audit, and releases assignment evidence permissions. Creation
publication failures also dispose acquired handles. Late grant extensions fail, and
cleanup errors remain observable at shutdown. Nine native/file lifecycle checks
exercise this behavior without a model or physical backend. Active-context and retained
application-history limits remain open. [Lifecycle guide](assignment-lifetime.md).

Configured image retention connects original-image reference inspection and collection to
idle server admission and the console. Configured reference sources hold their own
images, journal writes pause during inspection/deletion, and every SKILL source and
stored session resource state is checked. Complete external ownership is a deployment
responsibility; unresolved resources or source records block collection.
SKILL source inspection uses recorded recovery ownership,
accepted failure/success verdicts and run/session/evidence/image references. Missing
source records are explicit; conflicting records fail. Bounded assignment/event audit browsing, image inventory,
explicit request-cache cleanup, atomic journal compaction and idle-only console
maintenance remain available.
Application-owned image storage and scoped HTTP reads support the observation renderer.
Durable evidence, paged history and incremental
transport support upper-first integration. Model/policy adapters and standalone action
admission are described in the [adapter guide](model-policy-adapters.md).
`pnpm demo` starts a local console at `http://127.0.0.1:4317`. A scripted model emits
native DSH tool calls; a CPU fixture backend supplies labeled synthetic observations
and execution states. This validates orchestration, not model intelligence or robotics.

The console now uses a unified workspace for agent activity, TODOs, sensors, execution,
verification and recovery. Desktop panels remain visible together without tabs; smaller
screens stack sections and long content scrolls. See the [console guide](../../apps/console/README.md).

## Implemented and exercised

| Area                | Current behavior                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context management  | Opt-in native compaction/token estimates, embodied summaries, scoped authoritative context and audited maintenance                                                                                                |
| DSH runtime         | Original loop, native tools/validation, model services, scoped sessions, inbox/followup, cancellation and cooperative timeout plugin                                                                              |
| Teams               | YAML/ROLE.md preflight, frozen configuration, explicit model/tool bindings, independent assignment contexts, completion at quiescence and retained report identity; concurrent duplicate admission rejected       |
| Communication       | Versioned role reports/query, configured result schemas, explicit briefs, authenticated caller identity from tool scope, delegation/send/context exchange, evidence grants, native DSH delivery and audit exports |
| Tools               | Native tool API, role exposure and owner checks; trusted custom native tools share run lifetime and activity tracking                                                                                             |
| Planning/files      | Original DSH TODO; versioned dependency plans, immutable executed/final criteria, registered subgoal checks, owner-selected goals and private files                                                               |
| Execution boundary  | Replaceable EmbodiedBackend port, nonblocking jobs and budgets; real RoboCasa confirms device pause, fresh observation and Planner-owned resume within the same execution.                                        |
| Verification        | Real RoboCasa validates one fresh Verifier after confirmed budget end, zero Verifier assignments while running/paused, and a native failed GT verdict. Unknown cannot become success.                             |
| Recovery            | Formal failure followed by Planner replan/retry opens one recovery and Evolver; explicit progress batches continue until original-goal success                                                                    |
| Experience          | Versioned SKILL export/search/load; failure signals, possible causes, avoid rules, success/verification guidance and provenance; fixture skills labeled and separated                                             |
| Persistence         | Single-writer CAS journal, fsync, integrity checks, torn-tail recovery, separate immutable events and run projections; read-only historical session audits                                                        |
| Deployment assembly | Explicit task presets, native DSH model aliases/adapters, tools and backend factories; preflight, source checks, configuration-bound requests and historical snapshots                                            |
| Server/console      | Local HTTP/SSE, request admission deduplication, one active run, reconnect snapshots, history/restart interruption, output/tool/TODO/brief/recovery inspection                                                    |

## Acceptance and limits

Local environment: Node 25.4, pnpm 11.19.0, Python 3.14. CI uses Node 22/Python 3.11.
The complete check command is `pnpm check`.

Earlier CPU acceptance included 89 runtime tests and shared TS/Python cases using
explicit fixtures. Those results document orchestration behavior; current image and
storage acceptance uses actual files, HTTP sockets and authored documents:

- Historical runtime coverage: original DSH seams, native tool schemas/timeouts, custom-role
  isolation and extensions, storage/configuration, full recovery, unknown/error,
  pause/resume/cancel, HTTP/SSE/idempotency, deployment admission and interrupted restart.
- 256 shared wire/lifecycle/physical-boundary cases in TypeScript and Python,
  plus non-JSON rejection tests; generated contract types match the schema.
- 17 Python policy/action-gate tests use real localhost WebSockets and CPU devices.
- 128 pinned DSH source files and 25 referenced module bindings verified.
- Formatting, strict TypeScript, public English/local links, Python imports and SVG
  XML checks pass. Tests use fixtures; no live model, GPU policy or robot is evaluated.

Current focused checks: four verification-context checks, ten native assignment-lifecycle
checks and eight evidence-storage checks pass (22 total). Strict TypeScript, formatting,
source provenance and documentation links pass. The evidence is actual files, native
services and authored documents; no model or physical provider executes.

The workspace-index checkpoint passed twelve workspace-history checks, 19 storage checks and 24 console
tests pass (55 total). Actual HTTP checks preserve cursor, filter and active-record
semantics. The preceding browser component DOM checks cover session/task pagination,
scope selection, separate active metadata and retained task-context selections across
pages. Strict TypeScript, formatting, source provenance and local documentation checks
pass. No model/backend execution or new browser UI behavior is claimed.

The assignment-history checkpoint passed seven assignment-history checks, nine native
assignment-lifecycle checks and 24 console tests (40 total). The console selection check uses real HTTP
and stored assignment documents to exercise cancellation and missing-record errors.
Browser component DOM checks cover selected
archive details, role switching, empty selection and historical TODO/observation reads.
Strict TypeScript, formatting, provenance and structure checks pass. Scripted runtime
tests were not executed for this checkpoint.

The report-history checkpoint passed seven report-history checks and 23 console tests (30 total).
The preceding checkpoint passed eleven native history checks, nine clarification checks,
sixteen native audit checks, eight assignment-lifecycle checks and 23 console tests
(67 total). Prior checkpoints passed eight retention/admission checks,
nine original-image collection checks, 23 image/lifetime/HTTP checks, 16 storage/admission
checks, nine SKILL provenance checks, eight evidence-storage checks and 16 history tests.
Browser component DOM checks cover report-version paging, latest navigation, assignment
selection and empty report history. Earlier checks cover audit
assignment selection, event navigation and empty history; previous checks cover actual
image loading, cache cleanup and journal compaction. TypeScript, formatting, provenance
and structure checks pass. Scripted runtime tests were not executed for this checkpoint.

Remaining: live VLM and sensor-provider acceptance; host-to-Python worker
transport; actual simulator, learned policy, perception and hardware adapters; resource
arbitration/watchdog and real device acknowledgement. Model HTTP transport, policy
WebSocket transport and interruptible action admission are now locally exercised. The upper runner
coordinates plan-selected subgoals and one observing recovery chain at a time.
Concurrent physical subgoals, nested independent recovery chains, distributed delivery
guarantees, resumable DSH sessions, long-horizon evidence/event retention and multi-user hosting remain open. Native model-context
compaction, structured HTTP overflow recovery and whole-message visual retention are opt-in; semantic frame selection and live summary evaluation remain open.
Native delivery completion means session quiescence, not exactly-once business execution.
Cooperative cancellation cannot forcibly stop an uncooperative external device/tool.

## Step status and next implementation sequence

| Step  | Status in this checkout                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00–01 | DSH integration and shared contract acceptance complete                                                                                                         |
| 02–05 | Upper configuration, roles, explicit handoff, plans/files implemented; role result schemas now bind to native DSH validation; distributed delivery remains open |
| 06–07 | Upper port, CPU fixture and standalone action gate implemented; worker/resources/perception providers pending                                                   |
| 08–10 | Upper verification/recovery/experience loop exercised with fixtures; actual provider evidence still required                                                    |
| 11    | Recovery and custom-role CPU scenarios pass; full physical-provider replacement scenario remains open                                                           |
| 12    | Unified debugging console implemented and browser-checked with CPU fixtures                                                                                     |
| 13–16 | Real simulation, release/transfer evaluation and hardware not started                                                                                           |

1. Complete bounded evidence/events and idle/terminal cleanup for the upper runtime.
   Whole-message visual retention now runs through native DSH surface replacement. Evaluate model behavior against an available live
   endpoint; localhost protocol fixtures do not establish VLM task performance.
2. Extend goal/recovery acceptance to longer plans and deployment-specific evaluators.
   Plan-selected sequential goals and prerequisite recovery now run with CPU fixtures.
3. Extend the implemented report acknowledgements/startup reconciliation with durable
   business transactions only where needed; preserve the original DSH inbox.
4. After upper acceptance, connect the policy client/action gate to an owned Python
   worker and the upper EmbodiedBackend port; add resource/watchdog lifecycle and
   state events. Historical sessions must never silently resume physical commands.
5. Bind one actual simulation/policy/perception configuration after worker acceptance.
   Run physical execution, interruption and formal-verification acceptance.
6. Continue console usability refinement as live provider and sensor states become available.

These are follow-on tasks, not claims that all upper components are complete.
Read [extension guide](upper-runtime.md), [plan](plan.md), and decisions
[0003](decisions/0003-reuse-dsh-mechanisms.md) /
[0004](decisions/0004-recovery-observation-and-action-admission.md) before continuing.

## Version checkpoints

- `1d59ff4`: immutable teams and versioned upper-domain storage.
- `a4c0680`: DSH role workflow, formal recovery and explicit Evolver progress.
- `4fad838`: runnable HTTP/SSE console and durable history.
- `e36d210`: native output/tool/TODO observability and separate event persistence.
- `1212ca9`: custom extension lifetime, concurrent assignment admission and isolation acceptance.

Preserve these commits and push verified phase checkpoints. Do not rewrite published history.

## Role-report checkpoint (2026-09-08)

Added framework-provided agent.report and team.query tools. Role-authored result
schemas are loaded within the role root, checked using the original DSH object
schema subset and frozen into the team digest. AgentReport identity/scope/recipient
come from the assignment, not model-supplied fields. Missing-context reports can be
followed by explicit context and a completed result. Final reports are immutable;
exact retry returns a durable receipt without another caller message. Report delivery
state is inspectable and distinct from business acknowledgement.

Fixed a discovered raw ToolDefinition input-validation gap: unlike defineTool, raw
definitions must invoke the native validator explicitly. Upper tools now call DSH's
validator before domain effects and enforce EDH size/version admission limits.
Forged fields and malformed execution/report calls fail without creating physical work.

Twenty runtime tests pass, including actual native report calls and caller model
inputs, schema preflight, missing-context handoff, immutable replay and persisted
reports across restart. No generic dispatcher or agent loop was added.

- `c622252`: versioned role reports, native result schemas, query/receipts and raw-tool input validation fix.
- `77f6b5c`: immutable goal admission and current-verdict planning foundation.
- `0705381`: native plan-selected execution, original-subgoal recovery and independent learning failures.

## Multi-goal foundation checkpoint (2026-09-09)

TaskGoals now admits Planner-authored subgoals from deployment-registered checks,
retains immutable final task criteria and checks formally verified dependencies.
Plan updates retain executed goals and reject stale completion references. Two new
focused tests and strict TypeScript pass. This checkpoint supplies the domain
foundation only; selection and multi-goal execution are not yet wired into UpperRun.

## Multi-goal execution checkpoint (2026-09-09)

The foundation is now connected to native DSH tools. Planner selects admitted goals,
waits for verified dependencies, explicitly authorizes retries and retains per-goal
attempt budgets. Fresh verifier briefs use the selected goal's immutable contract;
stale verifier control is rejected. Final task completion requires the final goal's
latest stopped-boundary verdict and a completed plan.

The multi-goal CPU fixture runs placement failure, Planner replan, verified cabinet
opening, placement retry success and final cabinet closure. Opening cannot authorize
a recovery SKILL; placement success can, even before the final task completes.
Evolver model failures are persisted independently from task outcomes. The console
scenario selector exposes this fixture without changing the provisional layout.

Validation: `pnpm check` passes with 30 runtime tests, 230 shared TS/Python cases,
93 pinned DSH files, strict TypeScript, formatting, Python and document checks.

## Normal-speed audit regression and fix (2026-09-09)

A manual run at the demo defaults (140 ms model delay, 650 ms control ticks) completed
the physical fixture task but failed learning because a whole-session audit exceeded
the journal's 8 MiB per-record bound. The failed run remains preserved as evidence.
SessionAudits now appends individual native events and publishes a count index only
after the event writes. Audit reads reconstruct the same API payload and remain
compatible with historical array snapshots. A partially written suffix stays hidden
until its matching index is committed. This does not resume any model or motion.

The fixture Evolver also writes concise progress notes with event sequence references;
the original handoff and full evidence remain in the run/recovery records. Tests cover
an aggregate audit over 8 MiB, duplicate append, restart/legacy reads, conflicting
suffixes and the exact normal-speed multi-goal scenario. The manual rerun completed
all four verdicts, published one SKILL and returned readable audits with no learning
error. Retention and native model-context compaction remain separate future work.

## Caller acknowledgement and interrupted report delivery (2026-09-09)

Every role now has team.ack_report alongside agent.report and team.query. The native
caller explicitly accepts/rejects a particular published report ID; identity comes
from its assignment, the receipt is immutable, and exact replay emits no duplicate
event. This is a reported assessment, not physical verification or proof of exactly-once
business effects. New report versions require separate acknowledgements.

Report versions retain a published predecessor chain. Unpublished immutable records
cannot be acknowledged. On startup, queued/missing delivery receipts become
interrupted, preserving existing caller acknowledgements and settled/failed records.
No model turn or physical command is replayed. HTTP run projections include report
history, delivery state and caller confirmation, including after restart.

Validation: 30 runtime tests and the full shared contract/check suite pass.
See [report acknowledgement guide](report-acknowledgements.md) for exact semantics.

## Unified console checkpoint (2026-09-12)

The tabbed inspector was replaced with a single developer workbench: history and
agent sessions, goal plans/native TODOs, agent activity, and embodied telemetry.
Desktop sizes of 1440 × 900 and 1280 × 800 and a 390 × 844 mobile viewport were
inspected. Long panels scroll; mobile sections stack without page-wide overflow.
At shorter desktop heights, recovery's header reports its state even when detail
requires scrolling. This is a local fixture console, not a connected robot UI.

Browser checks exercised a new recovery run (failed first attempt, successful retry,
three completed TODOs, accepted verdict and one SKILL), pause/device confirmation,
resume-request submission, stop/read-only history, native TODO history, tool-name
search and full call/result inspection. Actual resumed motion was not separately
asserted in the UI check; runtime acceptance covers Planner-owned resume semantics.
Historical runs and evidence were preserved across preview server restarts.

Display fixes include request-derived budgets, numbered/selectable goals, actual
assignment status, distinct learning failures, source-correct synthetic cabinet
geometry, search empty states and protection against stale history responses.
Search accepts displayed dotted tool names as well as native records. No new agent
loop, backend, transport or simulator integration was added.

Validation: the full `pnpm check` suite passed (30 runtime tests and 230 shared
TS/Python cases); browser interaction checks complement the existing runtime suite.

## Asynchronous provider-read checkpoint (2026-09-12)

The upper EmbodiedBackend port now accepts asynchronous capture and GT checks and
forwards DSH cancellation into provider calls. Formal checks carry the expected
execution/boundary IDs. On return, the upper runner rechecks the current scope,
stopped boundary and device acknowledgement before storing facts or granting
observation evidence. Late cancelled reads cannot update the assignment, and a
late resume acknowledgement cannot resurrect a terminal run.

The immediate `query` method remains a client-side status projection; the future
transport must update it before delivering backend events. No Python worker,
network client, action gate or physical provider was implemented by this change.
See the [execution boundary guide](../../harness/agent-runtime/execution/README.md).

Three new native DSH acceptance cases cover asynchronous successful recovery,
late observation after stop, and stale verification after boundary replacement.
The runtime suite now contains 33 tests. Remaining priorities include deployable
model/backend assembly, storage retention and recovery, and real provider transport.

## Configurable local deployment checkpoint (2026-09-12)

`startServer` now accepts explicit ServerDeployment bindings. CPU fixtures are supplied
by a separate `createDemoDeployment` configuration, preserving `pnpm demo`. Task IDs,
instructions, final criteria, model aliases, native adapters and additional tools are
resolved before admission; invalid metadata/team bindings fail before opening the store.
Backend factories receive shutdown cancellation, and late returned instances are closed
without starting a task. A declared source must match the allocated backend.

Each run stores its public deployment/team snapshot. Request IDs are bound to the
configuration digest; changed configuration cannot silently replay an old admission.
The console reads task presets and source labels from the API, preserves historical
roles/configuration, and labels missing legacy snapshots explicitly. Provider imagery
is not implemented; the synthetic cabinet remains limited to fixture sources.

Validation: `pnpm check` passes with 37 runtime tests, 230 shared TS/Python cases,
93 pinned DSH files and 20 bindings. A browser run of the custom example completed
placement, three TODOs and formal verification. The original seven local demo histories
were preserved and their legacy snapshot labels inspected. See the
[deployment guide](deployments.md) and [runnable example](../../examples/deployments/local-cpu.mjs).
Implementation commit: `6a70456`.

Next: harden long-run retention/checkpoints and restart/shutdown error reconciliation;
bind a live DSH model only when an explicit provider configuration is available.
The server still admits configured task presets, one active run, and one observing
recovery chain. It does not yet accept unrestricted mission text or supply live model,
Python transport, camera rendering, policy, simulator or hardware providers.

## Restart and shutdown checkpoint (2026-09-13)

RunHistory restores only published event prefixes and stores restart annotations
separately. Startup migrates legacy inline history without rewriting the full event
array into one journal record. An ordinary event written before its projection remains
unpublished, including an orphan success event. Restart never replays model or physical
work. Missing published events are reported as corruption rather than silently omitted.

Cleanup now attempts all owned stages even when backend stop/close, session auditing
or host disposal fails. Repeated close calls share completion. Team shutdown drains
late session creation; native handles are disposed even after audit failure. Failed
journal initialization removes only the writer lock acquired by that constructor.
Errors are retained through AggregateError rather than reported as successful cleanup.

Validation: full `pnpm check`, 41 runtime tests and 230 shared TS/Python cases pass.
Acceptance includes a 9 MiB published event history with an unpublished success suffix,
legacy migration and interrupted annotation publication, failing stop plus close,
failed native audits, late native creation, and journal-open failure. Commit `e16c822`.
This fixes failure paths, not retention/compaction or automatic physical recovery.

The user next explicitly prioritizes OpenAI-compatible API/vLLM model bindings and
WebSocket policy client/server adaptation with an action gate before device execution.
Actual simulator/policy checkpoints and hardware acceptance remain separate integrations.

## Model and policy adapter checkpoint (2026-09-13)

- `8c5b473`: OpenAI-compatible adapter using four further pinned DSH serialization,
  SSE and tool translation files; local vLLM and remote compatible endpoints share
  the same native model boundary. Includes tool-result image replay and stream failure tests.
- `ea900b7`: optional WebSocket policy client/server, canonical chunk/segment/receipt/stop
  contracts, deterministic action admission and bounded rollout composition. Seventeen
  Python tests cover socket failures, budgets, stale chunks and pause/resume races.
- `e16c822` / `c11c864`: restart publication integrity and failure-tolerant shutdown
  implementation/documentation remain part of this delivered phase.

Acceptance: `pnpm check`; 44 upper/runtime tests, 248 shared contract cases, 17 additional
Python policy/gate tests; 97 pinned files and 20 bindings. The standalone CPU example
executes four actions, reports a confirmed budget stop and requires formal verification.
The new SVG was rendered and inspected. Public spec is v1.11.

No paid or local VLM endpoint, learned policy weights, simulator or real device was
used. The default console physical backend remains synthetic. The optional model
example can call an explicitly configured API but does not supply real sensor frames.
Next action: implement the host-to-worker execution bridge, device event mapping,
resource/watchdog lifetime and mandatory verifier wake-up using these tested components.
Do not claim that independent adapter tests establish a full simulation MVP.

## Planner perception and native image checkpoint (2026-09-13)

The Planner directly consumes images from perception tools, plans and owns decisions.
Verifier verdicts now carry the actual checked image references and sample metadata
back to the Planner. Async monitors receive native images; explicit optional specialist
handoff preserves independent contexts. Planner/verifier can read granted evidence.
The single-goal fixture observes before planning; this is a native DSH loop, not a
new ReAct implementation.

Added bounded sensor metadata admission and immutable evidence/attachment identity
checks. Raw bytes remain in a deployment-owned attachment store, resolved only for
model requests. A matching resolver and admitted refs are required; no live camera or
new console media endpoint is supplied. Four tests cover capture-to-HTTP image payload,
role isolation, bad metadata/rebinding and Planner image/plan/action/verdict flow.
Current acceptance is 48 runtime tests plus the preceding shared/Python suites.
Next integration remains the host-to-worker bridge, resource/watchdog and real providers.

## Execution authority checkpoint (2026-09-13)

Upper resume now requires a confirmed, admitted pause, a formal result for the exact
boundary and the Planner's native tool call. BackendResumeOptions carry execution,
boundary and state version. An ephemeral matching decision authorizes the transition;
the host no longer treats a backend's knowledge of the request owner ID as permission.
Concurrent resume calls are rejected before dispatch. Missing state acknowledgement
fails the run and requests stop. A newer pause during acknowledgement is preserved.

Provider admission also rejects a replacement execution ID for the same attempt,
foreign observation scope and an over-budget initial status. Six new upper tests
exercise these cases. `pnpm check` passes 54 runtime tests, the existing 248 shared
cases and 17 Python policy/gate cases. See the
[execution provider contract](../../harness/agent-runtime/execution/README.md).
The preceding image-loop checkpoint `02e2fe5` also passed GitHub CI.

Next: the host-to-worker bridge must map resume boundary preconditions to action-gate
control generations, reconcile transport updates and publish actual stop state.
Long-running monitor assignment lifetime and context retention still need refinement;
real simulator/policy and hardware acceptance remain open.

## Monitor lifetime checkpoint (2026-09-13)

Successive frames now continue one independent monitoring assignment through native
DSH followups. The Planner is its caller; goal, request, budget and image references
arrive explicitly. Pending frames coalesce rather than spawning a new agent for each
observation. Pause/end closes admission and requests native cancellation immediately;
formal verification proceeds in a fresh assignment. Resume creates a fresh monitor.
A monitor whose creation finishes after the boundary changes is retired without
receiving stale frames. Final role reports also end their monitor assignment.

TeamSessions retirement retains identity/audits while releasing native handles and
preventing ID reuse. Cleanup is idempotent, attempts final audit after native disposal,
and participates in shutdown error reporting. The console projection records retired
status. No DSH loop or pinned upstream source was changed.

Acceptance adds five tests: 70 observed frames share one monitor; pause cancels an
in-flight model request while a fresh formal verifier runs; resumed monitoring gets a
fresh session; late monitor creation receives no stale frame; and repeated retirement
releases capacity across 66 assignments. The pause/resume assertions share one test. A fifth test reproduces and fixes
self-cancellation of a Verifier-initiated stop acknowledgement: the run now owns and
tracks accepted pause requests independently of the monitor cancellation signal.
Providers still own bounded acknowledgement latency and actual device confirmation.
Full acceptance: 59 runtime tests, 248 shared cases and 17 Python policy/gate tests.
All use local CPU/transport fixtures, not a live VLM, simulator or hardware.

This fixes monitor handle lifetime, not context compaction or every role's retirement.
Long-run context/history budgets and other completed assignments still need bounded
lifecycle work. The host-to-worker bridge, resources/watchdog and provider acceptance
remain pending; do not infer a runnable physical MVP from this checkpoint.

## Completed assignment checkpoint (2026-09-13)

Normal completion now closes new message/domain-tool admission without cancelling
the final native turn. DSH can return the final receipt and output, then the existing
retirement path exports the audit and releases the handle. Shutdown still cancels
in-flight draining work; repeated completion/retirement share cleanup outcomes.
The native turn deadline remains active. No replacement loop or DSH source change.

Final role reports and accepted formal verdicts use this path. Recovery Evolvers
release after a settled success delivery with a published SKILL; failed learning
also retires its session without failing verified task completion. Missing-context
reports remain available, and the Planner stays live for report inspection until
shutdown. Caller query includes whether the assignment still accepts messages.

A late child report to a finished parent remains stored with failed delivery; it
neither reactivates the parent nor grants new evidence. Exact report replay is tested
inside the author's final native turn. The caller can query and acknowledge the
persisted report after handle disposal, and report storage remains idempotent.

Acceptance: 61 runtime tests, 248 shared cases and 17 Python policy/gate tests under
`pnpm check`. Two new tests cover normal final-output draining, repeated completion
across 66 assignments, and shutdown/audit failure while draining. Expanded native
role tests exercise missing context, final receipt/replay, late child reporting and
retired-parent inspection. Multi-goal recovery verifies all non-Planner handles are
released; obsolete live scopes still fail current-attempt authority checks.

Remaining upper work: model-context budgets/compaction, bounded long-run event and
evidence retention, abandoned/idle role policies and terminal task cleanup. The 64
live-session limit remains. Model requests, adapters and all execution
in this acceptance are fixtures/local protocol tests; real provider integration is
still pending. Keep the physical-worker bridge and watchdog as separate integration work.

## Native context management checkpoint (2026-09-14)

The host now optionally mounts absorbed DSH token measurement, basic compaction and
text pruning. The sole native behavior patch is the embodied summary instruction;
loop, transactional replacement, span balancing and cancellation remain upstream.
Deployment policy is immutable and public; automatic mode preflights model capacity
before opening run history. Compaction/usage events appear in the existing console feed.

Native dynamic context refresh restores assignment criteria/limits and scoped admitted
execution state after lossy summaries. Only the decision owner gets the selected goal
and current run state. No other role's conversation, private file or implicit evidence
is shared. Six added tests cover compaction failures/cancellation/continuation, dynamic
context restoration, configuration identity and a completed metered CPU server run.
See [context management](context-management.md) for exact configuration and limits.

An initial full run exposed an SSE connection reset under concurrent test load.
Socket tracing established that fetch reused a pooled connection after the server
idle timeout; no SSE request reached the route. The test now owns a dedicated event
stream connection and drains ordinary responses. It does not retry an uncertain
command. The full 72-test runtime suite passes with the regular concurrency setting.
Remaining work includes HTTP overflow classification, bounded visual/context/evidence
retention, idle/terminal role cleanup and live VLM evaluation. Physical workers and
providers are still pending.

## Provider configuration requirements (2026-09-19)

The upper system is now provider-independent at the profile boundary. `resolvePhysicalRuntimeProfile` validates immutable simulator, embodiment and policy metadata before allocation; role prompt context is injected during team preflight. See [physical profiles](physical-profiles.md). Upcoming simulation profiles target the
latest stable BEHAVIOR-1K, RoboCasa and RoboTwin releases, pinned to immutable source
revisions after an official release audit. R1Pro and arm-focused configurations are
separate embodiment selections, with capability-specific role context and tools.
Do not infer embodiment from simulator name or silently enable navigation tools.

Policy profiles prioritize pi0.5/openpi and GR00T, including fine-tuned checkpoints.
Checkpoint, normalization, camera/state mapping and action conventions must travel
together. Native transports are adapter-specific; arbitrary policy support means an
extensible adapter interface, not that one WebSocket JSON protocol fits every server.
All resulting actions must continue through the interruptible action-admission layer.
Configuration-only switching applies to installed compatible adapters and validated
profiles; it must reject missing providers or incompatible embodiment/action bindings.

## Profile acceptance checkpoint (2026-09-19)

Simulation/embodiment/policy profile schemas now share the contract source. Resolution
rejects placeholders, missing normalization or mappings, unsupported declared
embodiments and differing canonical ActionSpecs. Installed provider validators must
accept SDK-specific settings before any backend allocation or history mutation. No
real robot action dimensions or model compatibility are guessed from release names.

The snapshot reaches scoped role prompt additions, the backend factory and public/
historical deployment identity. Three profile tests and two server tests prove
mismatch rejection, member isolation, immutable snapshots and two synthetic config
selections through a completed DSH task. Eight new shared shape cases pass in both
languages. Official release references and actual remaining integrations are in the
[profile guide](physical-profiles.md); no real provider is marked supported.

Acceptance: full `pnpm check` passes with 72 runtime tests, followed by a passing
shared-contract rerun after adding the profile shape fixtures (256 shared cases total,
plus non-JSON cases and 17 Python policy/gate tests). 122 pinned DSH source files and
25 referenced module bindings pass provenance checks. SVGs are English; the profile
diagram was rendered and visually checked. No live VLM or robot was evaluated.

Next upper work: canonical HTTP context-overflow handling and bounded image history,
then long-run evidence/events, idle-role and terminal-run cleanup. Real providers
remain a separate implementation gate, with Action Gate mandatory between policy
inference and execution. The main goal is still open.

## HTTP context-overflow checkpoint (2026-09-19)

The OpenAI-compatible adapter now classifies explicit bounded JSON context overflow
and passes DSH its canonical error code. It reads at most 64 KiB (or the smaller
configured response bound), retains HTTP status/request identity and never includes
provider error-body text. Malformed/oversized bodies, prose-only matches, ordinary
400/413, auth, rate-limit and server failures do not become context overflow.
Cancellation and deadline remain active during error-body reads.

Three added local HTTP tests cover classification, cancellation/deadline, and the
native loop's success/repeated-error/no-reduction paths. The successful path executes
its scene tool once, summarizes historical context, retries the model request and
retains the original tool audit. A repeated overflow is bounded; a non-shrinking
summary cannot authorize a retry. No new retry loop or upstream source patch.

The console workflow test now uses explicit short-lived HTTP connections and a
dedicated SSE connection. This avoids a same-process test artifact where synchronous
journal writes delay idle-socket handling. A separate test asserts that sequential
API requests reuse the exact same keep-alive socket. No server timeout, production
retry or reduced test concurrency was introduced.

Acceptance: full `pnpm check` passes with 76 runtime tests, 256 shared cases and
17 Python policy/gate tests. Provenance still verifies 122 DSH source files and
25 referenced module bindings. No live model or simulator was evaluated. Remaining upper
work begins with explicit visual history selection, followed by bounded evidence/run
retention and idle/terminal cleanup. Physical providers remain separate. The previous
`ec072b8` checkpoint's GitHub CI is confirmed successful (run 35460671025).

## Visual history checkpoint (2026-09-19)

Optional `contextManagement.visualHistory.maxImages` now bounds incoming model image
blocks through the native pre-step and surface seams. Fresh input and unconsumed tool
images are protected; recent history keeps complete message groups. Older image blocks
become explicit reference markers without changing text, tool identities, evidence grants
or original audit events. Oversized fresh batches fail explicitly before inference.
Configuration is frozen into deployment identity; no upstream loop/source patch.

For a three-camera capture and six-image budget, the Planner receives the two most
recent complete captures. Repeated references still count as separate image blocks.
The console receives correlated visual-maintenance events and keeps original tool
results; replacement copies no longer overwrite tool execution cards.

Seven new runtime tests cover opt-in validation, forty observation batches, isolated
roles, native audit/meter replay, tool images without repeated execution, fresh-batch
failure, native pressure compaction, twenty localhost HTTP requests and upper console
projection. Deployment identity tests also verify the detached frozen visual policy.
Full `pnpm check` passes: 83 runtime tests, 256 shared cases and 17 Python policy/gate
tests. 122 pinned DSH files and 25 bindings still pass provenance validation. No live
VLM, learned policy or simulator was evaluated. Remaining work: bounded events and
evidence retention, idle/terminal cleanup, live VLM evaluation, and later the physical
worker/provider bridge. This is recency-based whole-message retention, not semantic
frame selection or evidence-store garbage collection. Real simulators and policies
remain unconnected; runtime-native persistence/resume remains a separate gate.

## User-session environment ownership checkpoint (2026-09-19)

User sessions now own a retained environment and multiple independent task runs.
Installed launch profiles are preflighted/frozen with role prompts, model bindings and
configuration identity. Native DSH continues to own agent execution. Each task receives
its own backend control scope; normal terminal cleanup drains Evolver publication and
role receipts before releasing that scope. Ending the session cancels active work and
releases the environment. Failed release is recorded as unknown; restart never replays
physical work. Legacy task admission cannot bypass an active session allocation.

Six new acceptance cases cover two-task CPU world continuity and recovery persistence,
rejected second-task port cleanup, active-task session cancellation, late allocation at shutdown, failed-release/restart state and launch preflight/immutable
configuration. The launcher/session guide distinguishes actual behavior from pending
free-form conversation, independent compatible selectors, desktop/service bootstrap and
real simulator/hardware ownership. See [user sessions](user-sessions.md) and the
[legacy migration audit](legacy-migration.md). CPU evidence does not establish robotics
or cross-embodiment transfer performance.

The console now groups runs beneath user sessions and displays the installed profile's
environment, embodiment, policy/checkpoint, model and resource state. New session,
Run task and End session are distinct controls. Workspace experience inspection retains
origin run/session links. Browser acceptance on the CPU preview exercised recovery,
a second task in the same session, session end and experience inspection without browser
errors. Installed profiles provide the authoritative complete configuration combinations.
Implementation ownership checkpoint: `c57106f`.

Validation: full `pnpm check` passes with 89 runtime tests, 256 shared cases and 17
standalone Python policy/action-gate tests (plus the shared Python acceptance classes).
Type checking, 122-file DSH provenance, public language/local links and SVG XML pass.
The new SVG was rendered and visually inspected. No live VLM, simulator, learned policy
or hardware was used. The temporary UI review uses its own data directory and preserves
the existing console history.

## Compatible launcher and branded coordination UI (2026-09-20)

Separate source, environment, embodiment, checkpoint, policy and default-model controls
resolve installed configuration combinations. Parent changes clear dependent choices;
sole valid values are selected automatically. Session ownership locks all six choices.
The same full-combination validator runs in the browser and at server admission, with a
deployment-revision check before environment allocation. Profile-only API callers remain
supported. Resolved per-profile Teams are available for configuration inspection.

The console includes the project logo and a blue/white theme, a locally rendered Mermaid
role graph, assignment-driven role animation, inspectable role/model/tool bindings and
separate observation, planning, execution, verification and experience states. Historical
tasks retain their recorded roles. Full logs, model output, native TODOs and payload
inspection remain available. Reduced-motion settings disable animation. Static asset
delivery restricts public files and installed Mermaid ESM files to their allowed directories.

Validation: `pnpm test:console` passes nine tests for declared catalog constraints,
full-tuple admission, malformed selections and actual static resources/path restrictions.
`pnpm exec tsc --noEmit`, `pnpm format:check`, `pnpm check:structure`,
`pnpm check:provenance` and `git diff --check` pass. Browser component checks use the
production selection controls and Mermaid renderer under the production CSP, with a
repository Team loaded by FileTeamLoader. Checks confirm checkpoint narrowing, dependent
selection updates, session-style input locking, role inspection, SVG nodes and logo loading, with no browser
errors. Catalog examples test selection rules only; no simulator, checkpoint or model was
executed. No end-to-end physical Session claim follows from these checks. The existing
fixture runtime suite was not rerun for this change.

Implementation checkpoints: `26d380b` (shared selection rules) and `64cfc75` (console and admission).

Remaining upper work includes new-criteria admission and active-task clarification,
bounded run/media retention, measured live VLM behavior and desktop/service bootstrap. Real provider
allocation, sensor rendering and the worker/action-admission bridge remain integration work.

## Editable instructions and scoped task history (2026-09-20)

Session task admission accepts a user instruction and explicit same-session history
selection against registered task criteria. It validates allowed presets, input limits,
context ownership and terminal state before allocating a task backend. Saved submissions
include detached goal/context snapshots and source record versions. The entry Planner
receives historical outcomes through its native InvocationBrief; tool evidence grants
and other roles' private contexts retain their existing scope. Request identity covers
the effective instruction and context selection. Replay requires a durable, owned run.
Core checkpoint: `11e08c3`.

The console adds a task composer, criteria/input inspection, actual instruction labels
in history, draft preservation and native browser storage for unconfirmed request IDs.
Changing criteria preserves edited text; resetting to preset text is explicit. Request
acknowledgements cannot clear a newer pending request. A successful run-detail load
releases the pending ID so another intentional task can use the same instruction.

Validation: `pnpm test:admission` passes five checks using the real LocalStore journal
and declared task/history data. They cover immutable criteria, canonical input identity,
invalid input, context ownership, projection limits, detached persistence and durable
request replay. `pnpm test:console` passes nine checks. Type checking, formatting,
DSH provenance, local documentation links and diff whitespace pass. Browser component
checks exercise production composer controls and native session storage: draft retention,
criteria reset, context filtering, session isolation, request retry identity and
acknowledgement ordering. No model or environment execution was performed in this checkpoint.

Remaining: provider-backed discovery of new criteria, active-task user clarification,
bounded event/media retention, live VLM evaluation and local-server bootstrap. These
remain required upper-system work; physical provider integration has separate acceptance.

## On-demand SKILL context (2026-09-20)

Planner and Verifier prompts now specify agent-directed search, applicability review,
selective loading, reuse of available guidance and explicit cross-role handoff. Native
DSH tool definitions describe the distinct search/load/save effects and their limits.
Search continues to return metadata only; load returns the selected immutable SKILL.
Publication persists knowledge without inserting it into other role contexts. The
memory guide and specification Section 8.6 document this context lifecycle.

Validation: the real FileTeamLoader resolves the repository Team and all three role
definitions; the native DSH schema validator accepts all three skill-tool schemas.
TypeScript, formatting, provenance, structure and whitespace checks pass. The existing
five admission and nine console checks pass. No model or physical environment was
executed. Retrieval quality and context savings require live-model evaluation. The
retriever still uses task-semantic keyword matching with a 20-result limit; semantic
ranking, embedding retrieval and section-level loading remain unimplemented.

## Incremental console delivery (2026-09-20)

The console uses an explicit SSE cursor and bounded contiguous event batches. Each
batch has at most 128 events and targets 256 KiB of encoded event bodies; larger
individual events remain atomic. Current projections are delivered when catch-up
completes. Text-only updates reuse browser history and transmit no historical bodies.
The server honors Last-Event-ID, writable backpressure, queued changes and connection
cleanup. Client validation rejects missing/duplicate sequences and conflicting run
identities. Default snapshot subscriptions remain available. Visible event counts
include restart annotations. UpperRun change notifications carry identity/state/time,
removing full-history clones solely for each notification.

Validation: 16 console checks pass, including seven incremental transport cases.
Native Node EventSource reads real HTTP from the production RunEventStream, reconnects
after connection closure and exercises actual write backpressure. Five task-admission
checks pass. TypeScript, formatting, JavaScript syntax, DSH provenance, documentation
links and whitespace checks pass. These checks use authored event documents and real
transport; they invoke no model or physical backend. The existing scripted runtime
suite was not rerun. [Protocol and limits](run-stream.md).

Remaining: bounded journal/browser retention, paginated initial history, retained media
cleanup, provider-backed criteria discovery, active-task clarification, live VLM
evaluation and local-server bootstrap. Physical integration retains its separate acceptance.

## Bounded history reads (2026-09-20)

RunHistory now reads bounded ranges directly from published event records. Initial
console loading fixes an event boundary, requests pages through that boundary and
then subscribes to later updates. Changing the selected run stops additional reads
for the previous selection. The console displays loading progress. SSE projection
construction uses UpperRun.projection plus the requested event page; text-only
updates read no historical event bodies. Explicit full snapshots remain available.
Startup interruption validates pages without collecting another full event array.

The page API preserves detached records, legacy inline data, immutable publication
boundaries and separately stored restart annotations. Unpublished suffixes stay
invisible; invalid cursors and missing requested records fail immediately. The
[stream guide](run-stream.md) documents request fields and remaining memory limits.

Validation: six `pnpm test:history` cases use real LocalStore files for concurrent
append, fixed boundaries, limited reads, UTF-8 size limits, oversized events, restart
annotations, legacy records and reopen behavior. Seventeen console checks pass,
including native HTTP reconnect using partial event windows and absolute cursors.
Five task-admission checks, TypeScript, formatting, JavaScript syntax, DSH provenance,
documentation links and whitespace checks pass. No model or physical provider was
executed; the existing scripted runtime suite was not rerun.

Remaining: cumulative journal/browser retention, media cleanup,
provider-backed criteria discovery, active-task clarification, live VLM
evaluation and local-server bootstrap. Physical provider integration remains separate.

## Indexed journal bodies (2026-09-20)

LocalStore retains latest record locations and integrity metadata; values are decoded
from indexed journal ranges when requested. Startup replay uses the pinned LF reader
incrementally. CAS versions, insertion order, fsync publication, writer exclusion,
incomplete-tail handling and the existing file format remain intact. Read failures
disable further access through that store instance. Writes reject external file-size
changes. Run startup reconciliation, SKILL export and experience search use lazy scans;
search stops after 20 metadata matches.

Validation: six new storage checks cover actual file operations, detached reads,
UTF-8/CRLF positions, blank LF lines, tail recovery, corruption, lazy scans and external
appends. A child process with a 64 MiB V8 old-space limit writes, reopens and scans
128 records whose journal exceeds 64 MiB. Two existing audit checks and two selected
original storage checks pass. Six history, five task-admission and 17 console checks
also pass, for 38 relevant checks. TypeScript, formatting, DSH provenance, structure
and whitespace checks pass. Test data stays under the ignored repository work directory.
No model or physical provider was executed; the scripted runtime suite was not rerun.

Remaining: key-index growth, journal/disk retention, browser history limits,
media cleanup, provider-backed criteria discovery,
active-task clarification, live VLM evaluation and local-server bootstrap. Caller-owned
full list/audit results retain their own memory costs. The storage test does not bound
whole-process RSS or the memory of all application consumers.

## Active event publication (2026-09-20)

UpperRun retains an empty event array and its published count. RunHistory publishes
immutable event records followed by a versioned projection, then advances in-memory
publication state. Complete snapshots reconstruct persisted history; incremental
HTTP/SSE reads retain their bounded page semantics. Event volume has no fixed
task-lifetime cutoff. The agent-authored message admission check uses a separate
delivery counter. Existing runtime history assertions use the explicit snapshot API.

Validation: nine history checks pass against real LocalStore files. Publication failure
leaves the previous count visible, returned bodies are detached, invalid counters fail
before writing, and immutable unpublished records cannot be overwritten. A child with
a 64 MiB V8 old-space limit publishes 4,097 events into a journal larger than 64 MiB,
reopens it and validates every event in pages. Seventeen console checks, TypeScript,
formatting, provenance, structure and whitespace checks pass. These checks execute
storage and transport code; they do not run a model or physical provider. Scripted
runtime tests were updated for explicit snapshot reads and were not executed.

Remaining: key-index/disk retention, media cleanup, provider-backed criteria discovery, active-task
clarification, live VLM evaluation and local-server bootstrap. Full snapshot callers
still allocate their requested history. Physical integration keeps its separate scope.

## Recovery event references and delivery pages (2026-09-20)

RecoveryHistory persists ordered references to published run events and a separate
projection containing the explicit failed-attempt context, result and learning error.
Active recovery observations keep counts and a delivery cursor. Progress pages carry
at most 32 events with a 64 KiB encoded-body target; a larger single event is preserved.
UpperRun reads one batch when native DSH delivery is ready, advances the cursor after
delivery settles, and orders the success notification after pending progress. Incoming
events do not enqueue arrays of event bodies. Learning errors retain the stored trace.

The existing recovery inspection endpoint reconstructs complete history on request,
including legacy inline traces. Evolver instructions describe batch indices, original
run sequences and concise working notes. The multi-goal guide documents storage,
publication, delivery and remaining resource boundaries.

Validation: all 13 history checks and 17 console checks pass. Four new recovery checks
use actual LocalStore journals and authored history documents to cover ordered selection,
fixed read boundaries, detached results, UTF-8 size targets, oversized events, legacy
records, reopening, invalid references, unpublished suffixes and recovery bodies totaling
more than the 8 MiB record limit. TypeScript, formatting, DSH provenance, structure and
whitespace checks pass. Existing scripted runtime assertions now use explicit recovery
restoration and were not executed. Live model delivery, guidance quality and physical
behavior remain unverified by this checkpoint.

Remaining: journal/index retention, media cleanup, provider-backed
criteria discovery, active-task clarification, live VLM evaluation and local-server
bootstrap. Complete inspection responses, native session audits/context and agent working
files retain their own memory/storage costs. No physical provider was added.

## Browser history windows (2026-09-20)

The console initially requests the newest bounded history page at a fixed event count.
Live retention keeps at most 500 events with a 2 MiB encoded-body target and preserves
a single oversized latest event. The absolute received sequence survives eviction and
EventSource reconnects. Projection-only updates preserve the retained array and cursor.

Event log has Earlier events, Later events and Recent events controls, a visible sequence
range and a TODO-updates filter. Historical browsing keeps one bounded page separate
from live activity. Switching tasks or returning to recent events invalidates pending
history responses. Current TODOs, plans and verdicts use projections; recovery status
reads its durable record and remains visible after its events leave the recent window.
The saved-experience indicator follows the selected recovery's skill identity.

RunHistory supports bounded backward reads through `history?before=N`. Forward/backward
parameters are mutually exclusive. Reverse traversal returns ascending sequences,
preserves oversized events and restart annotations, and retains the selected boundary
while later events are published. Recent activity search and TODO shortcuts identify
their scope; earlier records remain available through the event log.

Validation: 15 real-journal history checks and 19 console logic/transport checks pass.
Retention checks cover count and byte limits, absolute cursors, detached history views,
projection updates, invalid windows, and real HTTP/EventSource reconnection with 900
events. Backward history checks cover contiguous traversal, concurrent append, byte
limits, invalid boundaries, missing records, legacy history and restart annotations.
TypeScript, JavaScript syntax, formatting, provenance, structure and whitespace checks
pass. No browser interaction, live model or physical provider execution was performed
in this checkpoint; scripted runtime tests were not run.

Remaining: journal/index retention, media cleanup, provider-backed criteria discovery,
active-task clarification, live VLM evaluation and local-server bootstrap. Event-body
targets do not bound total browser memory, current projection size, full audit/recovery
inspection responses, or oversized individual records.

## Durable sensor metadata (2026-09-20)

UpperRun uses the perception module's SensorSamples catalog for admitted observations
and execution updates. Immutable samples and attachment metadata are stored in the
existing journal under unambiguous run-scoped identities. Exact replay adds no records;
conflicting evidence or attachment identities fail before new publication. Attachment
records precede the sample, so incomplete publication can reserve metadata without
publishing an observation. Reads validate the sample source, identity and referenced
metadata. JSON normalization preserves replay behavior after reopening the journal.

Assignment grants are checked before reading; debug-only evidence is rejected before
model delivery. Catalog persistence creates no new permissions or resumable sessions.
The application retains current sensor projections and reference sets while historical
sample bodies are read on demand. Historical runs retain their original records; missing
catalog entries are not reconstructed. The spec, module guide and perception README
describe the storage boundary and remaining media responsibilities.

Validation: eight `pnpm test:evidence` cases pass using authored metadata documents and
real LocalStore files. They exercise detached reads, immutable replay, conflict preflight,
namespace isolation, debug visibility, source/size/identity rejection, partial publication,
record consistency and reopening. A child process with a 64 MiB V8 old-space limit writes
and rereads 1,600 documents whose journal exceeds 64 MiB. All 15 history and 19 console
logic/transport checks pass, alongside TypeScript, formatting, provenance, structure and
whitespace checks. No model, image-byte resolver, sensor or physical provider was run;
scripted runtime tests were not executed. This acceptance does not bound whole-process RSS.

Remaining: binary media storage/resolution and console rendering; journal/index retention;
grant/reference and native audit/context lifecycle; provider-backed criteria discovery;
active-task clarification; live VLM evaluation and local-server bootstrap. Physical
worker/provider integration retains its separate scope. The next evidence step is the
deployment attachment provider and its authorized byte-resolution path.

## Native local image provider (2026-09-20)

LocalImageStore implements DSH's AttachmentStore using six attachment-local source
files from the existing pinned DSH revision. The provider validates encoded images,
normalizes orientation/color/dimensions, publishes immutable digest-addressed files,
verifies reads and generates deterministic model-request variants. Configuration uses
an explicit directory and frozen image/operation limits. Accepted operations own their
input copies; native Cordis disposal rejects new work and awaits accepted operations.

The source map records two patches: printable filename sanitization and full-decoded,
fail-fast request-cache reads. Sharp is pinned to 0.35.3. The service is available to
deployment-owned contexts and the existing model resolveImage callback. It does not
grant evidence access or mount an HTTP route. Default server assembly, environment
factory injection and console sensor images remain integration work.

Validation: ten `pnpm test:images` cases pass using the actual repository PNG logo and
real files, without model/backend substitutes. They cover native mounting, encoded
prompt admission, concurrent publication, reopen/detached reads, batch rejection,
byte/pixel limits, filename handling, normalized/request images, cache errors, corrupt
objects, invalid references, cancellation, operation limits and disposal during writes.
Eight evidence-storage tests and 19 console logic/transport tests pass. TypeScript,
formatting, 128 pinned source files, structure and whitespace checks pass. No live
model, sensor, simulator or browser was run; scripted runtime tests were not executed.

Next: bind image services into deployment/server lifetime and environment factories,
provide scoped image reads for the console, and validate the image-reference path with
an actual VLM. Binary object/cache retention and reference accounting, journal/index
retention, active-task clarification, new-criteria admission and local-server bootstrap
remain required upper-system work. Physical worker/provider work remains separate.

## Application image service and console reads (2026-09-21)

`startServer` owns a native attachment context, installs LocalImageStore by default,
and exposes its service to an optional deployment factory and the environment/task
factories. Custom mounting uses the same native interface and lifetime. Startup failures
dispose the context; shutdown releases it after consumers. The OpenAI-compatible
example binds request-image resolution through this service. Configuration publishes
image limits without exposing private filesystem locations.

The HTTP image route resolves persisted run/evidence/attachment associations, admits
only agent-visible samples and validates returned bytes against the recorded reference.
Local Host/Origin and browser Fetch Metadata restrictions apply before reading. Responses
use recorded media headers, no-store and same-origin resource policy; missing and corrupt
objects return explicit errors. Disconnect, timeout and shutdown cancel byte reads.

The observation panel renders latest or agent-seen images with multiple slots, loading
and dimension/error status. Identical refreshes preserve existing image elements.
Restricted or empty samples clear the viewer. Test images keep their explicit source
label. The spec, architecture, deployment and console/image guides describe these APIs.

Validation: 17 actual image file/HTTP/lifetime tests and 22 console logic/transport
tests pass. Startup checks exercise the production server entry with incomplete
deployment configuration, native image services and real pending file publication.
Browser component checks load the actual repository PNG through the production reader
and renderer, inspect decoded dimensions, multiple slots, DOM preservation, restricted
and empty states, and a real missing-evidence error. These checks use authored evidence
documents; no model or environment is executed. Full application/provider lifetime and
live VLM acceptance remain required; scripted runtime tests were not run. Eight
evidence-storage tests, TypeScript, formatting, provenance, structure and whitespace
checks pass.

Remaining upper work: binary object/cache retention and reference accounting;
journal/index retention; grant/reference and native audit/context lifetime; active-task
clarification; provider-backed criteria discovery; live VLM acceptance and CLI-free
bootstrap. Physical worker/provider integration remains a separate requirement.

## Atomic journal compaction and maintenance (2026-09-21)

LocalStore now reports current/superseded byte statistics and atomically publishes a
complete checkpoint containing every current record. CAS versions, insertion order,
global write sequence and independent history/evidence records are preserved. A smaller
checkpoint is synchronized before rename and directory synchronization. Headerless
journals remain readable; compacted journals require the versioned checkpoint reader.
Partial checkpoints and detected corruption fail without rewriting authoritative data.

The console's Workspace storage section displays statistics and submits explicit
compaction using the inspected sequence. Server admission excludes open user sessions,
active tasks, concurrent admission/lifecycle work and shutdown. Accepted maintenance
settles/closes retained terminal task scopes before compacting. This is synchronous
idle maintenance; distinct-key/media deletion and background retention are still open.

Validation: 15 storage/admission tests use real files and processes. A 64 MiB old-space
child compacts a journal exceeding 96 MiB, reopens it and reads every latest document.
A separate process is terminated during actual checkpoint publication; reopening
preserves complete current documents. Sixteen history checks include retained published
boundaries after compaction; 17 image checks include exact scoped HTTP reads afterward.
Eight evidence-storage and 22 console logic/transport checks pass. Browser component
acceptance uses actual documents and production markup/controller/storage functions.
No live model or physical provider is executed. Full application drain during live
provider/model work remains an acceptance requirement.

Remaining upper work: distinct-key/run/session retention; binary object/cache reference
accounting and collection; grant/reference and native audit/context lifetime; active-task
clarification; provider-backed criteria discovery; live VLM acceptance and CLI-free
bootstrap. Actual worker/provider integration retains its separate scope.

## Image inventory and explicit request-cache cleanup (2026-09-21)

LocalImageStore streams original/cache file counts and byte usage, returning a busy
state during overlapping mutations. Cleanup requires the current service revision and
excludes publication, model-request reads, inspection and other maintenance. Preflight
rejects unexpected entries and symbolic links before deletion. Recognized derived
variants and cache staging files are removed; original images and original staging
remain available. Subsequent model requests regenerate their variants from the originals.
Cancellation or filesystem failure during deletion can leave a partially cleared cache
and returns an error. Native shutdown waits for admitted cleanup.

The default server image provider exposes inventory and cleanup. Custom native mounts
may return an optional maintenance controller. Configuration reports that capability;
the console displays usage and a guarded cleanup action. HTTP admission uses the same
idle/session/task guard as journal compaction and requires an inspected image revision.
No user data is cleaned automatically.

Validation: 23 actual image-file/HTTP/lifetime tests, 16 storage/admission tests and
22 console logic/transport tests pass. Browser component checks use production markup,
controller and storage operations with an actual PNG and document journal. They verify
cache clearing, empty-cache button state, identical original-image SHA-256 before/after,
and subsequent journal compaction with the document's CAS version retained. TypeScript,
formatting, source provenance, structure and whitespace checks pass. No live model or
physical provider runs in these checks; full application maintenance while draining
live consumers remains unverified.

Next: complete domain-aware retention for run/session/evidence/audit records and original
media references; finish active-task clarification, provider-backed criteria discovery,
live VLM acceptance and CLI-free bootstrap. The actual worker/provider integrations
remain separate physical-runtime work. The upper-runtime objective remains incomplete.

## Bounded native audit browsing (2026-09-21)

SessionAudits exposes assignment-index and forward/backward event pages. Indexes return
at most 64 assignments; event pages contain at most 128 events and target 256 KiB of
encoded bodies, preserving one larger event intact. A fixed published event count
keeps navigation stable across later appends. Invalid indexes, missing published bodies
and foreign cursors fail explicitly. Legacy arrays, original event values and journal
compaction remain supported.

The audit HTTP route returns an assignment index and accepts an explicit assignment
with bounded event offsets. The console retains one index and event page, supports
earlier/later/latest navigation and clears its held contents when inspection closes.
Read-only text rendering, loading/empty/error states and stale-response suppression
belong to the inspector controller. Native DSH sessions and audit publication remain
unchanged. In-process complete-history reads retain their explicit allocation cost.

Validation: `pnpm test:audits` passes nine real-file/HTTP/process checks. A child with a
64 MiB V8 old-space limit writes, reopens and pages through more than 96 MiB of documents.
Twenty-two console logic/transport tests, TypeScript, formatting, provenance and
structure checks pass. Browser component acceptance uses production markup/controller
and query handling over actual stored documents: 300 events, 65 assignments, both
navigation directions, assignment changes, index continuation, empty history and
text-only rendering. No model or physical provider executes. Historical scripted
user-session tests were updated to consume the paged API and were not run.

Next: domain retention and reference accounting for run/session/evidence/audit records
and original media; native active-session and assignment-grant lifetime; active-task
clarification; provider-backed criteria discovery; live VLM acceptance and CLI-free
bootstrap. Audit paging limits browsing allocations and does not establish disk quotas
or complete the upper-runtime objective.

## SKILL source inspection (2026-09-21)

The workspace experience API includes read-only provenance resolved through explicit
recovery ownership. It checks the original-goal failed/passed relationship, the source
run's exact accepted verdicts and origin, optional user-session ownership and immutable
sensor/image metadata. Missing source records or legacy ownership are visible as
incomplete; conflicting present records fail. Source identity follows the recovery
even when the mutable run SKILL index does not list the bundle. Stored SKILL keys must
match their metadata identities. Shared image references are listed once with their
referring evidence identities.

The API scans bundles incrementally, retains the latest 100 and reads their referenced
source records without scanning unrelated runs. The existing Experience library
inspector displays provenance with each bundle. Newly published limitation metadata
uses the declared simulation, hardware or test-fixture origin and preserves explicit
transfer limits. Agent search/load behavior and evidence permissions remain unchanged.

Validation: nine `pnpm test:skill-provenance` checks pass using authored documents,
real LocalStore/image files, the repository PNG and local HTTP. They cover ownership,
detached reads, compaction/reopen, incomplete sources, legacy ownership, inconsistent
goals/verdicts/origins/scopes, exact accepted verdicts, SKILL identity, the latest-100
window, request-origin restrictions and source limitations. Eight evidence-storage and
23 image/lifetime/HTTP checks pass, alongside TypeScript, formatting, pinned DSH source
and structure/link checks. No live model, sensor or physical provider was executed;
scripted runtime tests were not run. HTTP acceptance invokes the production reader and
origin guard; complete live application acceptance remains required.

Source availability describes inspected metadata. It does not certify image bytes,
the complete event history or cross-environment transfer. The dependency list does not
authorize deletion or enumerate all task-owned data. Next: complete domain retention
for task/session/evidence/audit records and original media, preserving SKILL sources;
finish native active-session/grant lifetime, active-task clarification, provider-backed
criteria discovery, live VLM acceptance and CLI-free bootstrap. The upper-runtime
objective remains incomplete. [Source inspection guide](skill-provenance.md).

## Local original-image collection and reference inventory (2026-09-21)

LocalImageStore accepts an explicit complete retained-ID set and a current image
revision for original-object collection. It validates inventory and the presence of
retained originals before deletion, excludes pending readers/writers and rejects new
original consumers during collection. Retained roots are copied at admission. Native
disposal waits for accepted collection; failure and cancellation propagate. Successful
collection synchronizes affected directories and returns removed files/bytes and
retained-object counts. Request-cache files and original staging remain separate.

The storage module also inventories structured attachment IDs across current journal
records. It reads one record at a time, counts each referring record once and retains
at most four example ownership keys per image. Results include the inspected store
sequence. Nested arrays, historical records and extension namespaces are included;
malformed structured IDs fail. Prose-only references and external storage need their
own ownership declarations.

Validation: nine `pnpm test:image-collection` checks pass using actual PNG bytes, native
image transformations, real image files and domain journals. They cover retained-byte
identity, physical deletion, reopening, shared roots, cache independence, stale/missing
roots, reader/writer exclusion, links/invalid entries, cancellation, disposal, detached
inputs, empty roots, staging preservation and journal inventory after compaction.
Twenty-three image/lifetime/HTTP tests and nine SKILL provenance tests also pass.
TypeScript, formatting, pinned-source provenance and structure/link checks pass.
No model, sensor, physical provider or new browser behavior was exercised.

The collector is available to trusted local lifecycle owners. The HTTP API and console
do not invoke it. Complete application reference providers, frozen journal/image
admission and quiescence of external host-path consumers are required for integration.
Next: connect those ownership/lifecycle requirements to retention admission, preserve
SKILL sources during domain-record retention, and continue active-session/grant
lifetime, active-task clarification, criteria discovery, live VLM acceptance and
CLI-free bootstrap. The full upper-runtime objective remains incomplete.

## Configured image retention and console preview (2026-09-21)

LocalServerOptions accepts an explicit versioned image-ownership policy. Journal
references are combined with registered sources that acquire stable reference leases.
The controller checks every SKILL source and requires stored sessions to have confirmed
resource release. Journal write holds prevent new or changed roots during provider
inspection and collection. All acquired leases are released on success and failure.
Custom image providers can expose optional original-object inspection/collection methods.

Idle HTTP admission settles and closes retained task scopes before retention work.
Inspection returns retained/unreferenced file counts and bytes with a detached preview
token. Collection consumes that token and rechecks journal, image and source revisions.
The browser submits no root list or path. Local request checks apply. Scoped image reads
during original collection receive an explicit maintenance conflict. The console exposes
inspection and deletion controls, clears old previews on operations/failures and leaves
deletion disabled for unconfigured ownership or empty candidate sets.

Validation: eight `pnpm test:image-retention` checks pass with actual journals, original
PNG-derived files, external reference files held under filesystem locks and local HTTP.
They cover nested write holds, leased ownership, preview isolation, changed revisions,
single-use tokens, unresolved sessions, incomplete SKILL sources, acquisition/validation
failure cleanup, cancellation and idle/origin/input admission. Nine original-collection,
23 image/lifetime/HTTP, 16 storage/admission and 22 console tests pass. TypeScript and
formatting, pinned-source and structure/link checks pass. Browser component DOM
acceptance uses production markup/controller code, actual image/document files and
reference leases. It verifies retained/unreferenced counts, stale-preview rejection,
disabled controls after rejection, refreshed collection, unchanged hashes for both
retained originals and actual removal of the unreferenced file. No scripted
model/backend tests were run.

HTTP acceptance invokes production controller/admission functions in a component server.
Live application drain, provider-specific reference coverage and hardware resource
reconciliation remain separate acceptance requirements. Domain-record archival/deletion,
active-session/grant lifetime, active-task clarification, criteria discovery, live VLM
acceptance and CLI-free bootstrap remain open. [Retention guide](image-retention.md).

## Native assignment cleanup and evidence permissions (2026-09-21)

AssignmentEvidenceGrants opens from each explicit creation brief, copies incoming
references, and requires an existing scope for extensions. UpperRun releases the set
after role retirement cleanup, including failure, and closes remaining sets at run
shutdown. Historical evidence and briefs remain available through their own readers.
Observation completion extends only existing grant scopes.

TeamSessions disposes native handles acquired before an application publication
failure and preserves cleanup errors. Its final retirement audit follows native
disposal, including events committed by scoped cleanup. Repeated retirement/close
share completions; durable audits and assignment identities remain inspectable.

Validation: seven `pnpm test:assignment-lifetime` checks use actual DSH services,
native scopes, authored documents and LocalStore journals. They cover grant isolation
and release, sequential native capacity across 70 assignments, audit reopening,
cleanup-event publication, pending creation at shutdown, and actual write-hold
failures during publication/retirement. No model adapter or physical backend executes.
Nine audit checks, eight evidence-storage checks and 22 console checks also pass.
Strict TypeScript, formatting, 128 pinned DSH source files, 25 module bindings and
421 local documentation links pass verification. Scripted runtime tests were not run.
These checks do not certify in-flight VLM/provider shutdown or process-memory bounds.

Next: active native context/event retention and retained assignment projections;
domain-record archival preserving SKILL provenance; active-task clarification;
provider-backed criteria discovery; live VLM acceptance and CLI-free bootstrap.
Physical worker/provider integration remains separate. The upper-runtime objective
remains incomplete. [Lifecycle guide](assignment-lifetime.md).

## Incremental native audit publication (2026-09-21)

TeamSessions supplies its native Session to the synchronous audit hook. SessionAudits
captures its event count, reads original events individually, writes the unpublished
suffix and publishes the count after successful writes. Native delivery records its
sequence boundaries and checks that range for turn errors. Both application paths use
the original DSH sequence API without materializing a complete event-array snapshot.

Native audit indexes use v2 with an explicit Session identity. Another native Session
or an unbound array cannot extend them. Existing v1/inline histories remain readable;
native adoption validates the entire published prefix before binding the identity.
Conflicting unpublished events and oversized records fail with the previous published
boundary retained. Stored event versions remain immutable across repeated publication,
adoption, compaction and reopening.

Validation: sixteen audit checks and eight assignment-lifecycle checks pass using
actual native Session/Agent services, authored documents, real journals and HTTP.
The native delivery check exercises an unavailable adapter and verifies persisted
error events. Twenty-two console tests, strict TypeScript, formatting, 128 pinned DSH
source files, 25 module bindings and local documentation links pass. Scripted
model/backend suites were not run; no successful live model call is claimed.

Active native log/surface retention, retained assignment projections and domain-record
archival remain required. Continue those alongside active-task clarification,
provider-backed criteria discovery, live VLM acceptance and CLI-free bootstrap.
Physical worker/provider integration retains its separate scope. The upper-runtime
objective remains incomplete. [Audit publication guide](session-audits.md#native-publication).

## Active-task user clarification (2026-09-21)

UserClarifications records the requesting assignment, native call, goal and attempt,
permits one unanswered question per run, and stores immutable accepted response IDs.
Exact retries return the existing receipt. Question and delivery states distinguish
pending, cancellation, native quiescence, failure and restart interruption. The HTTP
reader resolves durable question state for both current and historical projections.

UpperRun exposes user.ask only through configured native tools and requires the decision
owner and a matching confirmed stopped execution. Native concludeTurn closes the asking
turn. Domain changes remain blocked until the answer is accepted and the original turn
drains. Native followup returns the answer to the requesting Planner. The built-in Planner
can request execution.pause; continuation retains all existing criteria and resume checks.

The console question panel provides suggestions, free text, persistent drafts and stable
retry identity. JSON transport is shared by console components. Response requests permit
96 KiB before field validation to support escaped/multibyte text; other routes retain
their existing default. Late/stale display updates preserve accepted response state.

Validation: nine native/file clarification checks and one actual HTTP check pass.
Together with assignment lifecycle, native audits and console regression checks, 56
checks pass. Strict TypeScript, formatting, 128 pinned source files, 25 module bindings
and 433 local documentation links pass verification.
Browser component DOM checks cover suggestion selection, literal content, refresh,
read-only input, actual journal write exclusion, preserved retry identity, accepted
response storage and stale pending updates. The component has no connected model or
device; delivery remains queued. A live VLM/provider clarification and pause/resume
scenario remains required. No scripted model/backend acceptance was run.

Continue active model-surface limits, compact metadata and remaining run collection
lifetimes, domain-record retention preserving SKILL provenance, provider-backed criteria discovery,
live VLM acceptance and CLI-free bootstrap. Physical worker/provider integration remains
separate. The upper-runtime objective remains incomplete.
