# CPU release validation

The checks exercise production configuration, journals, HTTP services and policy
transport without starting models or simulators. Original record inspection
preserves source hashes and identifies its acceptance scope. GPU task success
continues to require the [native campaign](native-release-campaign.md).
The base Python package includes Pillow for PNG observation encoding; WebSocket
inference and original-journal inspection use the `policy` and `diagnostics` extras.

## Consolidated CPU campaign

[run-cpu-release-campaign.mjs](../../scripts/run-cpu-release-campaign.mjs) executes
sixteen existing source/production diagnostics sequentially and fails on the first
unsuccessful component. Each component retains stdout, stderr and its original
report; `completed.json` retains completed components even after a later failure.
The final `acceptance.json` records original-input hashes, diagnostic source hashes
and every original report digest. Source and input hashes are rechecked after
each component. Output requires a new directory beneath ignored `.local/work`.

Use the [configuration example](../../examples/deployments/cpu-release.example.json)
with actual original inputs. Paths resolve relative to that configuration. The
Python executable preserves its virtual-environment symlink and requires the base
package plus `policy`, `diagnostics`, `recording` and `robodojo` extras. Node/pnpm
use the project's installed dependencies. The process/group checks require POSIX.
`packageManagerCommand` is an explicit argument array: `["pnpm"]` uses PATH;
`["/absolute/node", "/absolute/pnpm.mjs"]` selects an isolated installation.
Arguments execute directly without shell interpolation. File inputs and Python
paths resolve against the configuration directory; command arguments retain
their declared values.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/run-cpu-release-campaign.mjs \
  --config /absolute/path/cpu-release.json \
  --output .local/work/<new-cpu-campaign>
```

The required workspace contains actual model/provider/Team configuration. The
worker configuration is an original native deployment; the canonical policy
request uses RoboDojo dual ARX X5 scope. Policy transport takes its own original
request and policy audit journal. Each original Agent journal must contain at
least one completed native assignment with three image-bearing surface groups,
an actual three-view user message and an actual text input. No record is generated
to satisfy an input requirement. Original journals are copied before writable
readers inspect them. All child commands receive CUDA invisibility and CPU-only
diagnostics; readiness allocates no provider and registers no successful response.

On 2026-10-08, the current macOS source passes all sixteen components, including
85 process/wire/resource cases, six native visual-context cases, twelve original
native context reads and four-provider readiness. All original inputs retain their
hashes. There are no model calls, policy results, simulator allocations or controls.
Evidence: `.local/work/v1-cpu-release-campaign-20261008-final/acceptance.json`.
Loaded-model/device behavior and original task completion retain the
[native campaign](native-release-campaign.md) requirements.

## ActionGate stop ownership

[action_gate.py](../../harness/physical-runtime/src/physical_harness/execution/action_gate.py)
retains one stop task independently of caller cancellation. Concurrent and
repeated callers receive its original result. Action/resume failure handling
preserves the original operation error and every stop error together, including
their identities and complete receipt text. Unconfirmed stopping keeps its
boundary unavailable and its motion authority retained.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-action-gate-owner-offline.py \
  --request /absolute/path/original-robodojo-policy-request.json \
  --output .local/work/<new-action-gate-owner-check>
```

Four cases use an unallocated production RoboDojo device, actual OS resource
locks, original request scope/ActionSpec, source-file reads and OS pipes. They
cover cancelled/concurrent stop waiters, actual stop deadline expiry, original
FileNotFoundError with a closed-owner stop error and original FileNotFoundError
with a stop deadline error. Every boundary remains unconfirmed; diagnostic
leases release only after owner drain. The original input retains its SHA-256.
There are zero inference tickets, returned actions, stop acknowledgements,
model calls, native environment allocations and unobserved loop errors.
Evidence: `.local/work/v1-shared-failure-action-20261008-final-02/acceptance.json`.
These checks validate stop ownership and production failure aggregation;
loaded dispatch/resume/device confirmation remain native campaign gates.

Frozen `8fbd934` passes four ActionGate and four Session resource cases, ten
actual client/host processes and full project checks under isolated Linux
Python 3.12.14. All source hashes and complete ActionGate/Session reports match
their macOS originals; nested receipt text retains each original cause.
The canonical checkout status remains unchanged and GPU jobs remain zero.
Evidence: `.local/work/v1-cpu-source-20261008/linux-action-error/`; archive SHA-256
`4a7245bf6dba5e3b6b1bfd76c8728c354473561489f3e2d6af458d1d387a9e64`.
This identifies the verified source revision; shared failure handling
has its additional checks below.

## Shared rollout failure handling

`ActionGate.stop_after_failure` owns failure-time stopping for actual action,
resume, PolicyRollout and Worker paths. It preserves both original exceptions
when stopping fails, retains an already active stop reason and propagates an
existing error group when it already contains that same stop exception.
PolicyRollout shutdown attempts device stopping and policy closure, then
propagates their original single or grouped errors.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-rollout-failure-offline.py \
  --request /absolute/path/original-robodojo-policy-request.json \
  --output .local/work/<new-rollout-failure-check>
```

Three actual CPU cases use the original RoboDojo scope/ActionSpec, production
PolicyRollout/WebSocketPolicyClient/Worker, an unallocated production device,
OS resource leases and actual source-file/pipe operations. The policy cases
connect to a bound, non-listening local TCP port. The original connection
failure comes from the actual client and accompanies closed-owner or stop-deadline
failure. Operating systems may report ConnectionRefusedError or the client's
actual TimeoutError; the report retains its observed type and traceback.
The Worker case executes its original closed-owner path and publishes one scoped
background fault with both errors. Every boundary remains unconfirmed and motion
authority remains retained until diagnostic owner drain. All diagnostic threads,
sockets and leases release. The cases perform two actual connection attempts and
issue two admitted inference tickets; there are zero model/policy-server calls,
environment allocations, actions and stop acknowledgements.
macOS evidence: `.local/work/v1-rollout-failure-20261008-03/acceptance.json`.
The four ActionGate cases additionally verify repeated error-group identity.
Current resource/client/host reports are under
`.local/work/v1-shared-failure-session-20261008-final/`,
`.local/work/v1-shared-failure-client-20261008-final/` and
`.local/work/v1-shared-failure-host-20261008-final/`.
Loaded model, simulator observation/control and SDK stopping remain native gates.

Frozen `2ae6eaa` passes full project checks and all twenty-one affected cases
under isolated Linux Python 3.12.14: four ActionGate, four Session resource,
three rollout/Worker and ten actual client/host process cases. Thirty-eight
source-hash comparisons match macOS, with identical ActionGate/Session reports
and complete original fault receipts. Linux reports ConnectionRefusedError for
its two TCP attempts; macOS reports the client's actual TimeoutError. Both
preserve their original trace and stop error. Canonical checkout status remains
unchanged. Reports and verified summary are under
`.local/work/v1-cpu-source-20261008/linux-shared-failure/`; archive SHA-256:
`1f44d790a234c38307cc393fd96735f33201f40b43276449f0aa34d2f5c7e0dd`.
All GPU/model/policy-server/environment/action/stop-acknowledgement counts are zero.

## Native device owner lifecycle

[native_device.py](../../harness/physical-runtime/src/physical_harness/execution/native_device.py)
owns queued simulator operations and a single shared shutdown task. Caller
cancellation preserves the actual thread operation. Close rejects new admission,
drains existing work and publishes the closed state after executor shutdown.
Repeated or concurrent callers receive the same completion or original aggregate
error. Queued binding, stop and resume operations recheck closure after their
owner-thread barrier before publishing a result.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-native-device-owner-offline.py \
  --output .local/work/<new-native-device-owner-check>
```

The diagnostic uses the production RoboDojo adapter in its unallocated state,
actual source files and OS pipes. It performs no reset, SDK initialization,
observation, policy inference or control. Six cases verify original source reads,
cancelled operation/close waiters, three concurrent close callers, original late
FileNotFoundError propagation and shutdown during queued bind/stop/resume barriers.
Every case confirms an absent executor thread and empty operation records.
Closing barriers produce no stop acknowledgement. There are no unobserved loop
errors, GPU jobs or environment allocations. macOS Python 3.14 evidence is
`.local/work/v1-native-device-owner-20261008-final/acceptance.json`.
Loaded SDK lifecycle and device confirmation retain their separate native gates.

Frozen `3f2a7ee` passes the same six cases and full project checks under isolated
Linux Python 3.12.14. All four source hashes and complete result payloads match
macOS exactly. Canonical checkout status remains unchanged; GPU jobs remain zero.
Reports and verified summary are under
`.local/work/v1-cpu-source-20261008/linux-native-device/`; the archive SHA-256 is
`db37d77993a66fd1c6c2faaf01eee55bd5336077e91b687235c3b31e6d3af538`.

## Native Session resource closure

Native operation error receipts retain their existing `type` and `message`
fields. Grouped failures use Python's standard `TracebackException` formatter
with local-variable capture disabled and complete group depth/width. Every
original nested failure remains visible in the message. Single failures retain
their original text. The actual resource diagnostic also validates these
production receipts, JSON round trips and each original error type/message.
Current macOS receipt evidence:
`.local/work/v1-shared-failure-session-20261008-final/acceptance.json`.
Nine actual client-process cases retain their original scoped errors and release
outcomes in `.local/work/v1-shared-failure-client-20261008-final/acceptance.json`.

[worker.py](../../harness/physical-runtime/src/physical_harness/execution/worker.py)
owns a shared explicit Session-close operation. Cancellation of a caller leaves
task stop/drain and resource finalization owned by that operation. Communication
termination joins an existing Session close; otherwise it drains policy/stop/pump
work and checks motion-resource release before finalization. Device and recording
finalizers share a separate operation. Both execute, and every original failure
propagates. An uncertain motion boundary retains its resource authority.

The CPU check requires the package's `robodojo` and `recording` extras:

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-native-session-owner-offline.py \
  --output .local/work/<new-native-session-owner-check>
```

Four cases exercise the actual Worker, unallocated RoboDojo device, OS pipes and
empty recording journals: normal release, actual late FileNotFoundError, actual
IsADirectoryError during manifest publication and both original errors together.
Cancelled/concurrent close and disconnect callers retain shared result identity.
Every device thread and recording journal closes; failed manifest publication
remains failed. There are zero camera frames, model calls, controls or environment
allocations. This validates resource finalization without simulating an execution
or publishing device evidence. macOS evidence:
`.local/work/v1-native-session-owner-20261008-final/acceptance.json`.
The nine real client-process cases and the original RoboTwin missing-source host
path also pass against the current Worker. Native SDK/pump/device-boundary
integration still requires the consolidated loaded-provider campaign.

Frozen `8486afd` passes full project checks, four Session resource cases, six
device-owner cases, nine actual client processes and the missing-source host
path under isolated Linux Python 3.12.14. The complete Session/device reports
match macOS exactly; all sixteen client/host source hashes match their originals.
The canonical remote checkout retains its before/after status. No GPU, model,
policy or native environment starts. Verified reports are under
`.local/work/v1-cpu-source-20261008/linux-native-session/`; the archive SHA-256 is
`79cc8868d9d618ef941aacf5ecf57d97060dc598d7ebd4b0d97a38fececac53b`.

## Native Console process ownership

Workspace and single-provider CLI entries share
[console-process.ts](../../apps/server/src/console-process.ts). The workspace
installs signal handlers before asynchronous configuration; both CLI forms
install them before server initialization.
SIGINT/SIGTERM requests during initialization are retained until resource ownership
is established. Server shutdown and proxy disposal share one operation, including
repeated requests; startup errors retain their original cause after cleanup.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-startup-offline.mjs \
  --config /absolute/path/original-native-workspace.json \
  --output .local/work/<new-native-startup-check>
```

The diagnostic starts the actual configured native CLI with CUDA invisible.
Three initialization cases send SIGTERM, SIGINT and repeated signals at the
production journal's actual writer-lock creation, before URL readiness. Two
running cases inspect actual HTTP configuration before single/repeated signals.
All five require exit status zero, released writer locks/listeners and absence
of both owned Node processes. Original configuration and implementation hashes
remain unchanged. No model call, policy call, Session or environment is admitted.
The workspace output is
`.local/work/v1-native-startup-owner-20261008-current/acceptance.json`.
Repeat with `--provider robodojo`, `robotwin`, `robocasa` or `behavior` and a new
output directory to exercise its actual standalone entry. All twenty provider
cases also pass. Their source-bound outputs are
`.local/work/v1-native-startup-<provider>-20261008-final/acceptance.json`.

Two additional actual CLI invocations encounter the running Console's occupied
writer or port. Both fail with exit status one, preserve the existing owner and
HTTP service, and leave no candidate process group. The port-conflict invocation
releases its own writer; closing the original Console releases its writer and
listener. Original configuration bytes remain unchanged. Evidence:
`.local/work/v1-native-startup-owner-20261008-current/conflicts/acceptance.json`.

Frozen `f52fc28` passes full project checks and all twenty-five entry cases on
isolated Linux with Node 24.21.0, pnpm 11.19.0 and the Python 3.12.14 CPU environment.
Each implementation/model/provider configuration hash matches its macOS source.
All six original configuration sources retain their bytes; only the
diagnostic workspace's path references identify the isolated source and private
output locations. The canonical server checkout's before/after status is identical.
No model, policy, environment or GPU work executes. Retained reports and the
verified summary are under `.local/work/v1-cpu-source-20261008/linux-startup/`.
The complete evidence archive SHA-256 is
`126e561418fc228d596a8c64e5c24edde06caf97e8842ef023cd7685d07a9b13`.

## Native scene and configuration ownership

[native-worker-configuration.ts](../../apps/server/src/native-worker-configuration.ts)
owns the schema and its derived `NativeWorkerConfiguration` type. Scene parameters
use Zod's recursive JSON schema: finite scalars, arrays and objects. The environment
factory receives a detached, recursively frozen admission snapshot with its
validated task catalog and policy endpoint, before preparation or process creation.
The host's optional process-start callback remains outside scene data.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-scene-configuration.mjs \
  --config /absolute/path/original-native-workspace.json \
  --output .local/work/<new-native-scene-check>
```

Four original configured scenes preserve their parameters and JSON round trips.
Caller mutation of command, environment, scene and catalog leaves the admitted
snapshot unchanged; direct writes to that snapshot fail. Forty-eight scene cases
reject positive/negative numeric overflow, nested overflow, NaN and unsupported
JavaScript values through both the schema and production environment factory.
Every issue identifies `sceneConfiguration`. No Worker process, environment or
inference starts, and the production image context disposes. Original source
hashes remain unchanged. Local evidence:
`.local/work/v1-scene-json-owner-cpu-20261008-current/acceptance.json`.

The worker host diagnostic also accepts `--mutate-caller`. After invoking the
actual environment factory, it changes the caller's command, working directory,
Python environment, source path and scene before asynchronous startup resumes.
The actual CPU Worker still uses its original admission: its genuine missing-SDK
source error returns intact, close is confirmed and its process/image context
release. Both BEHAVIOR and RoboTwin pass with CUDA invisible in
`.local/work/v1-worker-host-caller-<provider>-20261008-current/acceptance.json`.
This checks initialization ownership without allocating a native simulator.

Frozen `f365135` passes the same scene/admission and caller-mutation checks,
four-provider readiness and full project checks on isolated Linux. Every original
scene, rejection and implementation/provider hash matches its macOS report; only
the private workspace's path references change. The canonical server checkout's
before/after status is identical. Reports and verified summary are under
`.local/work/v1-cpu-source-20261008/linux-scene-owner/`; the archive SHA-256 is
`880ce01308396e7691ee5733539d318df468e1e8849f4d04681cc5f308e1c01b`.

## Native Worker startup observer ownership

The transport's asynchronous `NativeWorkerTransport.create` establishes pipes,
listeners and process ownership before calling the configured host observer.
Initialization waits for synchronous or asynchronous observer completion. Observer
failure closes the actual Worker and confirms process-group release before the
original error returns. Cleanup failure retains both errors.

The [client diagnostic](../../scripts/check-worker-client-offline.mjs) exercises
eight actual CPU process cases: the existing communication/cancellation/deadline
cases, successful asynchronous startup-file publication and synchronous/asynchronous
startup reads of an absent file. The latter preserve actual ENOENT errors and
require the owned process/group to be absent when creation rejects. No initialize
request, SDK allocation, inference or controls execute in the observer cases.
Evidence: `.local/work/v1-worker-startup-observer-20261008-final/acceptance.json`.

The [host diagnostic](../../scripts/check-worker-host-offline.mjs) accepts
`--startup-file-error` and optional `--async-startup` to exercise the same file
failure through the production environment factory and configuration schema.
Both paths preserve the original error and release their actual process/group,
image context and empty policy-record directory. The local reports are under
`.local/work/v1-worker-startup-host-sync-20261008/` and
`.local/work/v1-worker-startup-host-async-20261008/`.

Frozen `4a3fc5d` passes the eight client cases, both observer-error host cases,
both caller-mutation host cases, finite-scene admission, four-provider readiness
and full project checks in isolated Linux dependencies. All forty-three
implementation/provider hash comparisons across the five process reports match
their macOS reports. The canonical checkout's before/after status is identical.
The reports and verified summary are under
`.local/work/v1-cpu-source-20261008/linux-worker-observer/`; the archive SHA-256 is
`2c012c161e99f28c11300ba940f6b5c2c587c693d07034c8ccdbaac444e5285e`.

## Native finite-JSON request admission

The host transport validates request envelopes before serialization, timer
creation or pending-request publication. Operation names contain one to sixty-four
characters with nonblank content; arguments contain recursively finite JSON data.
Successful response values use the same JSON domain before request retirement.

The client diagnostic's ninth case rejects twelve unsupported argument values
and seven invalid operation values synchronously. Its actual CPU Worker remains
connected, returns the original error for a valid unknown operation and confirms
clean close. The other eight process cases continue to pass. Evidence:
`.local/work/v1-worker-finite-json-client-20261008/acceptance.json`.

The [initialization interruption diagnostic](../../scripts/check-native-worker-disconnect.ts)
waits for the actual process-start observer, signals that owned process and inspects
the original initialization/cleanup errors. It requires process/group absence;
device/resource confirmation remains unknown following the interrupted transport.
If initialization returns an environment, the diagnostic owns its close. Its
output retains configuration and implementation hashes and requires a new file.
Actual RoboTwin-configured CPU startup interruption passes in
`.local/work/v1-worker-initialize-interrupt-20261008/acceptance.json`: the owned
process/group is absent, original initialization and release errors retain their
shared identity and device/resource state remains unknown. The diagnostic
configuration disables CUDA and names an absent SDK source directory.

Frozen `f22f0af` passes all nine client cases, four host cases, initialization
interruption, finite-scene admission, four-provider readiness and full checks on
isolated Linux. Forty-seven implementation/provider comparisons match their
macOS reports; the interruption retains unknown device/resource state and absent
owned processes. Canonical checkout status remains unchanged. Reports and verified
summary are under `.local/work/v1-cpu-source-20261008/linux-worker-json/`.
Archive SHA-256:
`8d8b62d1a30b777c38b4c67287d2732f2a1b2cffe73c48f2b0d1f0cfc937da62`.

## Native diagnostic entries

All nine `scripts/**/*.ts` entries participate in the project TypeScript check,
and `format:check` includes TypeScript diagnostics. RoboCasa worker and metric
entries await the current `describeTasks({ signal })` API and select the configured
`nativeTaskId`. They own the image context and admitted environment throughout
startup, task checks and release. Results publish after all owned cleanup stages;
task/cleanup/output failures retain their original errors, and new output files
are required. A rejected allocation retains unconfirmed environment-resource state.

Both actual RoboCasa CLI entries pass their policy-endpoint preallocation failure
check with production configuration, an original recorded request and CUDA
invisible. They preserve field-specific Zod errors, dispose the image context,
publish failed results and exit with status one. No Worker, SAM service, model,
simulator or controls execute. Original input and entry-point hashes remain
unchanged. Evidence:
`.local/work/v1-casa-entry-admission-20261008-final/acceptance.json`.

The scene/configuration diagnostic additionally checks fifteen invalid policy
endpoint values across four original profiles. All sixty fail schema and factory
admission with `policyUri` issues and zero Worker starts; original valid endpoints
remain unchanged. URL syntax validation completes before protocol/credential/
fragment checks. The same invocation preserves its forty-eight finite-scene
rejections and admitted snapshot checks. Evidence:
`.local/work/v1-endpoint-scene-admission-20261008/acceptance.json`.

Frozen `9d15198` passes full project checks with all nine TypeScript diagnostics,
the forty-eight scene and sixty endpoint rejections, four-provider Console
readiness, both actual RoboCasa entry failures and all nine client process cases
on isolated Linux. Every scene/error result and all twelve CLI/client source
hashes match the macOS reports. Original scene/deployment/implementation hashes
also match; only private workspace path references change. Canonical server
checkout status is unchanged. No GPU/model/simulator work executes. The verified
summary and reports are under
`.local/work/v1-cpu-source-20261008/linux-diagnostic-entry/`.
Archive SHA-256:
`f77af3406c326a926aaee558f77ed5cf8bc020219556818a548896177f9df57a`.

## Native context and scope ownership

Selected DSH `token-meter` source belongs to `harness/agent-runtime/memory`,
alongside its context installer and compaction services. Native registration
scope primitives belong to `harness/agent-runtime/foundation`, shared by Agents,
Sessions and tools. Their original import names and all selected source hashes
remain unchanged. Type aliases, provenance destinations and workspace dependencies
describe the same ownership.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-context.mjs \
  --data-directory /absolute/path/original-native-journal \
  --data-directory /absolute/path/another-original-native-journal \
  --output .local/work/<new-context-check>
```

The reader opens private copies of actual simulation or hardware journals through
LocalStore and SessionAudits. The production DSH host installs context services
without model bindings. Independently scoped native Sessions retain each original
event prefix and provider usage. Full and prefix reads verify stable, detached
measurements, isolated replay state and the native usage/pressure/composition
projections. Creation and disposal events reach only their own registration scope;
every attached Session and scope releases before host disposal. Model-free image
pressure uses the native fixed heuristic, recorded explicitly in the result.

On 2026-10-08, two original RoboDojo/RoboTwin journals pass with nine native
assignments, 392 original events, 60 original tool calls and 24 prefix reads.
The source journals and restored events retain their hashes. No tool calls are
replayed, and no model, policy or environment is allocated.
Evidence: `.local/work/v1-context-ownership-cpu-20261008-02/acceptance.json`.
The original RoboDojo journal also passes nine interrupted-call recovery prefixes
through the selected DSH recovery functions without replaying physical dispatch.
Compaction summaries and route-specific image pricing keep their model-driven
acceptance requirements.

The configured four-provider Console also passes factory/Team/profile/model
readiness with this source organization. Its actual HTTP reader returns RoboDojo,
RoboTwin, RoboCasa and BEHAVIOR metadata, then releases its journal writer and
listener with zero managed service processes. Evidence:
`.local/work/v1-context-readiness-20261008/readiness.json`.

Frozen `4391298` source passes the same context/recovery readers and full project
checks on Linux with isolated Python 3.12.14, Node 24.21.0 and pnpm 11.19.0.
All nine assignments, 392 events, 60 original tool calls and 24 prefix reads
match the local source-journal hashes and measurement/projection values.
Implementation hashes match the current module sources. Both registration scopes
and every attached Session release; the original server checkout's before/after
status is identical. No model, policy or environment is allocated.
The server-retained complete archive has SHA-256
`df0f973f61c109bf566a033f157a4698277db5a57bcaa2dd2dc6db0da9656fdb`.
The downloaded check/source/ownership summary is under
`.local/work/v1-cpu-source-20261008/linux-context/`; its source archive
`cpu-context-summary.tar.gz` has SHA-256
`ddbe38fd5eb67286d20ab60fe975cba13ac60bd760db9305487322745fc1045c`.

## Native visual-context admission

[check-recorded-visual-context.mjs](../../scripts/check-recorded-visual-context.mjs)
reads private copies of original native journals through LocalStore and
SessionAudits. A production DSH host mounts its native loop, token meter and EDH
visual-history policy with automatic summaries disabled and no registered model.
Each case creates two independently scoped Agents with the same original history.
Only one Agent receives an exact original text or three-image message as follow-up.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-visual-context.mjs \
  --data-directory /absolute/path/original-native-journal \
  --data-directory /absolute/path/another-original-native-journal \
  --output .local/work/<new-visual-context-check>
```

Two original RoboTwin journals supply 226 events, nine/twelve retained original
image blocks and actual text/image messages. Six cases verify text-only
continuation, fresh observation and an over-budget fresh batch through native
pre-step admission. A six-image budget retains complete groups and reserves all
three incoming views. Each omitted group records its exact original attachment
IDs and source/replacement sequences. Original audit events and admitted incoming
messages remain unchanged. Restoring actual generated events reproduces the
surface and token measurements; each measurement identifies its own log revision.
A three-image batch under a two-image budget fails before surface changes.

The native driver retains its actual missing-provider/model error after otherwise
valid pre-step admission. No successful response is supplied. Every sibling context
remains unchanged, all twelve Agent/Session contexts release, source journal hashes
remain unchanged and original tools are never replayed. Source-bound event files
and reports are under `.local/work/v1-visual-context-20261008-final/`.
GPU/model/policy/environment allocations are zero. Model-driven summaries,
adapter image resolution and fresh tool-image delivery retain their native gates.

## Configured native startup

```sh
EDH_NATIVE_WORKSPACE_CONFIG=/absolute/path/native-workspace.json pnpm start
```

The production command loads the configured native workspace and its existing
factories. Missing configuration fails with the exact
`EDH_NATIVE_WORKSPACE_CONFIG` field before server allocation. On 2026-10-08,
the actual command starts the configured four-provider Console and serves its
profile/model/Team metadata with zero Sessions, model calls or managed services.
SIGTERM closes the journal writer, listener and both owned Node processes with
exit status zero. Evidence:
`.local/work/v1-native-start-cpu-20261008/acceptance.json`.
This is configured application startup/shutdown acceptance; task execution
retains the native campaign's requirements.

## Model-visible tool schemas

`harness/agent-runtime/tools/src/model-schema.ts` owns production parameter
generation and canonical domain projection. The server, role-workflow checker
and original plan reader use its public exports. Each assignment's parameters
are detached from canonical core fields and caller-supplied plan/role schemas.
Native DSH continues to register, dispatch and validate these tools.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json --test tests/runtime/model-tool-schema.test.ts

pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-tool-schemas.mjs \
  --requests /absolute/path/original-model-requests \
  --descriptions /absolute/path/original-tool-source.json \
  --output .local/work/<new-tool-schema-check>

pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-plan-writes.mjs \
  /absolute/path/original-replay-directory
```

Three CPU checks cover required canonical nested plan fields, isolated mutable
parameter results and decision-owner-only execution.query turn completion.
The recorded-request reader checks native DSH schema validity, original tool
descriptions, separate Planner/Verifier authority and exact canonical plan structure.
It also verifies independent parameter edits against each original planning header.
Original request, description and schema sources retain their hashes; implementation
hashes identify the production module and reader. No model call or physical effects
are replayed. The plan reader uses this same production parameter builder before
checking original calls, formal verdicts and versioned writes.

On 2026-10-08, 16 original Qwen requests pass with 344 checked schemas: twelve
Planner requests and four Verifier requests, including twelve canonical planning
headers. Evidence: `.local/work/v1-tool-schemas-cpu-20261008-final/acceptance.json`.
Original task histories `ef8f9d03`, `686c9767` and `7dfb663e` preserve ten accepted
object-valued plan writes, eight rejected string-valued writes and thirteen
read-only templates. Their new private journals are under `.local/checks/recorded-plans-*`.
The plan reader also applies production TaskGoals admission before each original
plan write and checks all seven original execution requests against the preceding
committed plan, ready dependencies, owner, per-goal attempt limit, criteria,
entities, capabilities and budget. Event/run source hashes remain unchanged.
These checks establish CPU schema/record behavior. Current-code model-driven
multi-goal and simulator completion require their actual native acceptance.

The same schema tests, original request inspection and original custom-role plan
reader pass on Linux from committed `6488510` source. Its isolated Python 3.12.14
environment and Node 24.21.0/pnpm 11.19.0 workspace use frozen dependencies.
Full `pnpm check` passes, including 58 Python compilations, 19 base imports,
128 pinned DSH files, 25 source bindings, ten Teams and 868 documentation links.
The canonical server checkout has identical before/after Git status. No native
environment, model inference or controls are allocated. Retained output is
`.local/work/v1-cpu-source-20261008/linux-tools/`; the original
`cpu-tools-evidence.tar.gz` has SHA-256
`636f0b8a07a3d5763beabff7f68a0fe1807408080e4edbb1c3337db8785d18f7`.

The actual four-provider Console also passes readiness at that source revision
in `.local/work/v1-tools-readiness-20261008/`. Configured Teams, models, policies,
checkpoints and RoboDojo Tower prerequisite checks retain their original bindings.
Shutdown releases the journal writer and listener with zero managed processes.

## Policy transport

Install the `policy` and `diagnostics` extras in the isolated Python environment.
Supply an original canonical request and original policy audit journal:

```sh
.venv/bin/python scripts/check-policy-transport-offline.py \
  --request /absolute/path/original-policy-request.json \
  --telemetry /absolute/path/policy-audits/events.jsonl \
  --schema harness/contracts/schema/physical.schema.json \
  --output .local/work/<new-policy-check>
```

The check reads JSON Lines through its declared library. It checks the original
codec contents, telemetry scope/Session/sequence and source hashes. A production
EDH policy server forwards the actual request to an unavailable local endpoint;
the observed connection failure must reach the client as a generic inference
error. Authentication, discarded connections and listener shutdown are checked.
No action result is supplied by the diagnostic.
The production recorder also saves the exact original request, checks private
POSIX file permissions and rejects an actual second write without changing the
stored content. Recorder source and original record hashes remain unchanged.

The same production decoder serves client responses and server requests. Its
standard JSON numeric hooks reject NaN/Infinity constants and overflowing
floating-point tokens; duplicate-field rejection applies inside nested objects.
Seven malformed messages pass direct rejection and actual authenticated server
rejection with close code 1011, generic public errors and zero inference admission.
Each exact rejected wire body and SHA-256 remains in the diagnostic output.
The original finite request still round-trips and records exactly; all 95 original
telemetry events retain their scope and sequence. Current macOS evidence:
`.local/work/v1-policy-json-transport-20261008-bounded/acceptance.json`.
The report binds codec, server, recorder, diagnostic and original source hashes.
These checks return no policy actions or model results.
The finite codec's current source also passes four client-close cases, nine
inference-owner cases and three rollout/Worker cases under
`.local/work/v1-policy-json-client-20261008/`,
`.local/work/v1-policy-json-inference-20261008/` and
`.local/work/v1-policy-json-rollout-20261008/`. Full project checks pass.

Frozen `da0b17f` passes all twenty-three affected cases and full project checks
under isolated Linux Python 3.12.14. Thirty-one original/source hash comparisons
match macOS, including all seven exact rejected wire bodies. Actual service logs
retain seven decoder errors and one original TCP connection error with tracebacks.
Normal close, caller drain, thread ownership and resource release checks agree
across both systems; the original TCP exception retains its platform-specific type.
The canonical checkout status remains unchanged, with zero GPU/model/environment
allocation or control. Evidence and verified summary:
`.local/work/v1-cpu-policy-json-20261008/linux/`; archive SHA-256:
`ca8d6ae8b0548b11d2872f762746d5f03278031b72acb8a63fe67090ec4862a2`.

On 2026-10-07, 95 original telemetry events across three policy requests pass.
The actual upstream connection times out, both clients discard their connections,
the authenticated server rejects unauthorized admission and its listener closes.
Evidence: `.local/work/v1-policy-transport-offline-20261007-02/acceptance.json`.

## Policy service startup

The four EDH JSON service entries bind their configured port before checkpoint
or upstream initialization and before importing their optional model SDKs.
They use `serve_policy(..., start_serving=False)` and the actual WebSocket Server's
asynchronous context manager. `server.start_serving()` opens connection admission
after the selected policy is ready. Startup failure closes the bound listener;
normal shutdown closes connections/listeners and drains the inference owner.
The OpenPI JSON bridge also closes its actual upstream connection. Ready metadata
reports the actual bound port, including a deployment-selected ephemeral port.
The default `start_serving=True` remains available for ready inference callbacks.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-policy-startup-offline.py \
  --request /absolute/path/original-robodojo-policy-request.json \
  --python .venv/bin/python \
  --output .local/work/<new-policy-startup-check>
```

Install the base package and `policy` extra in the isolated Python environment.
Twelve actual subprocess cases cover five CLI help commands, four occupied ports
and three missing-checkpoint failures. Existing listeners retain actual connection
acceptance after each candidate exits; failed-startup ports become reusable.
Help completes without optional SDK imports, including the native OpenPI producer.
That producer retains its original upstream service/model-loading sequence; this
CPU check makes no native producer startup claim beyond argument help.

Actual production listener checks cover bound-but-unstarted admission, explicit
`start_serving`, context-managed source-file failure and an occupied listener.
The started Server forwards the exact original PolicyRequest to an unavailable
endpoint. Its actual network error remains in the log and its generic public
error reaches the client. All connections close and ports become reusable.
macOS observes TimeoutError for both unstarted handshake and upstream access.
No model inference result or action is supplied. Evidence:
`.local/work/v1-policy-startup-20261008-final/acceptance.json`.
The report records ten executable/schema source hashes and the original request
SHA-256 `147d6c1fc75af0589138d1bdd60746a7a45a2876a79e1a78d91cc9df9ccff57d`.
Current-source inference-owner, connection-close and policy-wire checks retain
separate reports. GPU/model/environment allocation and controls remain zero.
Loaded checkpoint initialization, native producer service readiness and complete
task execution require the consolidated native campaign.

Frozen `9b3b4a8` passes all twelve startup cases, four connection-owner cases,
nine inference-owner cases, seven malformed-wire cases, 95 original telemetry
events and full project checks in isolated Linux Python 3.12.14. Thirty-two
original/source hash comparisons match macOS. Linux preserves its actual
ConnectionRefusedError for the unstarted listener and unavailable endpoint;
macOS preserves TimeoutError. All compared admission, release and failure fields
agree. The canonical server checkout retains its exact before/after status.
GPU/model/environment allocation and controls remain zero. Verified summary:
`.local/work/v1-cpu-policy-startup-20261008/linux/verified-summary.json`;
archive SHA-256:
`e4b80ba4ca0865f37c8cd4474ef0aa8d4754f7b257f11ad6513d965fb72335a2`.

Current-source production readiness for all four configured providers and
preparation of eight actual task definitions pass under
`.local/work/v1-policy-startup-readiness-20261008/` and
`.local/work/v1-policy-startup-campaign-20261008/`. These paths perform no task,
model or simulator execution.

## Policy client connection ownership

[`WebSocketPolicyClient`](../../harness/physical-runtime/src/physical_harness/policies/client.py)
owns one actual connection-close operation and one full shutdown operation.
Cancelled waiters preserve those operations. Concurrent callers wait for their
original result; pending or failed connection closure rejects new inference.
Full shutdown drains the captured inference caller and attempts connection
closure, retaining every original failure. Caller-local cleanup may join the
connection operation while external shutdown awaits that caller's complete exit.
Closing from a policy event/tool callback stops subsequent response handling.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-policy-client-owner-offline.py \
  --request /absolute/path/original-robodojo-policy-request.json \
  --output .local/work/<new-policy-client-owner-check>
```

Four POSIX cases use real WebSocket connections and a production policy server
in a diagnostic-owned child process. The OS pauses that peer while the client
sends its close frame. Three concurrent close waiters, including one cancelled
waiter, retain the actual closure until the peer resumes. Idle, active inference,
repeated inference cancellation and caller-local cleanup all finish with normal
close code 1000, no retained caller/connection and server exit code zero.
Production recording preserves three original requests and the input SHA-256.
It returns zero policy responses and allocates no model, native environment,
GPU job, control or stop acknowledgement. macOS evidence:
`.local/work/v1-policy-client-owner-20261008-final/acceptance.json`.
Client source SHA-256:
`f5914bd09782e7e18462099265b15ba10a77257a70ed756edb40775f2c4f6266`.

The same client source passes nine actual inference-owner cases in
`.local/work/v1-policy-client-inference-20261008/`, three actual rollout/Worker
failure cases in `.local/work/v1-policy-client-rollout-20261008/`, and production
transport with 95 original telemetry events in
`.local/work/v1-policy-client-transport-20261008/`.
Loaded-policy cancellation and physical stopping retain native acceptance gates.

Frozen `d720790` passes these four client cases, nine inference-owner cases,
three rollout/Worker cases, 95 original telemetry events and full project checks
under isolated Linux Python 3.12.14. Twenty-eight original/source hash comparisons
match macOS. Actual OS-specific TCP failures retain ConnectionRefusedError on
Linux and TimeoutError on macOS; all other compared ownership/release fields match.
The canonical server checkout remains unchanged. Evidence and verified summary:
`.local/work/v1-cpu-policy-client-20261008/linux/`; archive SHA-256:
`84dd96926afda9433806d1ed9b63fecf5e3b33d2651d013962e76b32c3255f29`.
No GPU, model, native environment, control or stop acknowledgement is allocated.

## Policy inference ownership

All four native policy service entry points use production `ThreadedInference`
and `recorded_inference` from `physical_harness.policies.inference`. One thread
owns model execution and its audit writes. Concurrent admission fails; caller
cancellation leaves that operation and its records owned until completion.
Original errors propagate after their scoped failure record. Close drains the
thread, rejects new admission and remains shared across concurrent or cancelled
waiters. Standard `asyncio.wait` retains the operation independently of its caller.

```sh
PYTHONPATH=harness/physical-runtime/src \
PYTHONDONTWRITEBYTECODE=1 PYTHONASYNCIODEBUG=1 CUDA_VISIBLE_DEVICES='' \
.venv/bin/python scripts/check-policy-owner-offline.py \
  --request /absolute/path/original-policy-request.json \
  --output .local/work/<new-policy-owner-check>
```

Install the `policy` and `diagnostics` extras in the isolated environment.
Nine actual CPU cases pass on 2026-10-08 with Python 3.14. Original request recording
uses production exclusive file creation. A second write raises FileExistsError
and releases its owner for an actual source read. OS-pipe operations establish
concurrent rejection, caller cancellation with retained ownership, an original
late recorder failure and cancelled-close thread draining. The production server
and two actual WebSocket clients also check concurrent rejection and a real server
deadline while the operation remains owned. Both clients discard their connections;
the late recorder failure drains and the listener closes. A strict JSON Lines reader
verifies all five original recorder/admission/deadline failure records, including
three complete execution/task/observation scopes and their tracebacks.
No unobserved asynchronous errors or owned threads remain. Source bytes,
failure-log digest and service/helper implementation hashes are retained in
`.local/work/v1-policy-owner-transport-cpu-20261008-final/acceptance.json`.
No model result, environment or control is supplied by the diagnostic. Loaded-model
cancellation and physical task acceptance require the subsequent native campaign.
Full source checks compile 59 physical-runtime files and all seven policy service
and diagnostic entry points; 20 base modules import without loading model SDKs.

The same nine cases and full project checks pass on Linux from committed
`870806e` source in isolated Python 3.12.14 and Node 24.21.0/pnpm 11.19.0
environments. Helper, diagnostic, transport and service-entry source hashes match
the local source. Five original failures preserve the same classifications and
three full scopes; both clients, listener and owner threads close. The canonical
server checkout's before/after status is identical. CUDA remains invisible,
with no model, simulator or control allocation. Retained output is
`.local/work/v1-cpu-source-20261008/linux-policy-owner/`; its downloaded
`cpu-owner-evidence.tar.gz` has SHA-256
`bef0237d5ad37ea56fdefe5edd17093467f0d54f8264ac1764ded1abb44f89cf`.

## Worker process transport

The worker remains runnable through `python -m physical_harness.execution.worker`.
`execution/worker.py` owns NativeWorkerSession operations,
`execution/worker_transport.py` owns the host connection and request tasks, and
`execution/policy_records.py` owns original policy request/control recording.
BEHAVIOR and RoboTwin source directories are checked before importing their
optional SDK providers. [Source entry points](../development/code-map.md) identify
these files alongside the upper runtime and Console.

```sh
node scripts/check-worker-transport-offline.mjs \
  --python /absolute/path/isolated/python \
  --output .local/work/<new-worker-transport-check>

pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-worker-host-offline.mjs \
  --config /absolute/path/original-deployment.json \
  --python /absolute/path/isolated/python \
  --output .local/work/<new-worker-host-check>
```

The first check starts actual EDH worker subprocesses with CUDA invisible. It
verifies 24 scoped responses, 20 batched close requests, task-identity rejection,
unknown-operation and invalid-argument errors, enabled diagnostics, the exact
32-MiB input boundary, oversized input, invalid UTF-8/JSON/constants, overflowing
numeric values, duplicate JSON fields at envelope/nested argument levels, malformed
envelopes, duplicate active identities and a disconnected response channel.
Failure cases retain an open input pipe until the worker exits independently.
Every child reaches process close without forced termination or an unobserved
Task/Future exception. Source hashes and original stderr remain preserved.
JSON decoding uses the standard library's object/number validation hooks.

The host check reads an original configured BEHAVIOR or RoboTwin deployment and
uses the production TypeScript environment factory and native transport. Its CPU
binding selects an actually absent SDK source directory. Initialization returns
the original FileNotFoundError; the existing close protocol confirms shutdown,
the worker process is absent, the recording probe is removed and the native image
context closes. No simulator or model is allocated. The original configuration,
wire schema and implementation sources retain their hashes.

On 2026-10-08, all 13 process cases pass, together with both provider host checks.
Evidence: `.local/work/v1-worker-transport-cpu-20261008-final/`,
`.local/work/v1-worker-host-behavior-cpu-20261008-final/` and
`.local/work/v1-worker-host-robotwin-cpu-20261008-final/`.
The original policy request also passes exclusive recording, duplicate-write
rejection and transport checks in
`.local/work/v1-policy-recording-cpu-20261008-final/`.
Active native SDK interruption and physical stopping retain their separate
actual-environment acceptance requirements.

The expanded sixteen-case check passes locally on 2026-10-08, including decimal
overflow and both duplicate-field cases, in
`.local/work/v1-worker-json-cpu-20261008/acceptance.json`. Invalid input terminates
the actual Worker while the caller retains its input pipe; all sixteen children
close at the process boundary without forced signals or unobserved exceptions.
No native environment, model inference or controls are allocated.

The expanded sixteen-case check and original-plan admission also pass on Linux
from frozen `6031766` source with isolated Python 3.12.14 and frozen Node
24.21.0/pnpm 11.19.0 dependencies. Two original histories preserve four execution
requests, six accepted plans and eight read-only templates. Full `pnpm check`
passes with 58 Python compilations, 19 base imports and 869 documentation links.
The canonical remote checkout's status is unchanged. Source-bound reports and
complete check output are retained under
`.local/work/v1-cpu-source-20261008/linux-json/`; the downloaded
`cpu-json-evidence.tar.gz` has SHA-256
`3f4e98cd5ab8a88346be64784f17f1d93467a78d2aeb4ce4e43baac9c492b10f`.

The host connection implementation is
`apps/server/src/native-worker-transport.ts`. It owns worker pipes, pending requests,
publication delivery and confirmed process-group release. The Session/task/image
implementation remains in `native-worker.ts`. Complete response validation precedes
request retirement, with Python error text preserved and input-pipe errors observed.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-worker-client-offline.mjs \
  --config /absolute/path/original-deployment.json \
  --python /absolute/path/isolated/python \
  --output .local/work/<new-worker-client-check>
```

Five actual production-client cases cover 20 concurrent original operation errors,
bounded request admission, read cancellation followed by the original response,
a real request deadline, actual child SIGTERM and an absent executable's ENOENT.
Every pending request completes, repeated close calls share one Promise and each
owned child/process group is absent at completion. Faulted cases preserve unknown
device state and reject clean-close acceptance. These checks allocate no environment
and perform no inference or controls. Local evidence:
`.local/work/v1-worker-client-cpu-20261008-final/acceptance.json`.

The same five client cases and both provider host checks also pass on Linux from
frozen `5a4a605` source, using the isolated Python 3.12.14 environment and a newly
installed frozen-lockfile Node 24.21.0/pnpm 11.19.0 workspace. Full `pnpm check`
passes with 58 Python compilations, 19 base imports and 857 documentation links.
The original server checkout's before/after status is identical. CUDA remains
invisible and no environment, inference or controls are allocated. The archive
under `.local/work/v1-cpu-host-20261008/` retains source-bound client/host reports,
full check output and installed Python versions. Its SHA-256 is
`6762e806aaee23b92eedbd0ebddf6c7db5af41a73efc12074f6c4743f3708bb3`.

The same 13 process cases and both TypeScript host checks also pass on `jd_B300`
with Python 3.12.14, Node 24.21.0 and pnpm 11.19.0. The frozen `feb8cc9` source
is installed in its own CPU Python environment and its own frozen-lockfile Node
workspace. Full `pnpm check` passes: 58 Python files, 19 base modules, 128 pinned
DSH files, 25 source bindings, 10 Teams, 36 core tool descriptions and 850 local
documentation links. CUDA is invisible throughout; no SDK environment is allocated.
Source and outputs are under
`.local/work/v1-cpu-source-20261008-final/source/` on that host. The retained
`cpu-evidence.tar.gz` SHA-256 is
`50a3b2ab28b0718381405f917308369f5c9a10a654489bcc8abd700e661255f0`.
The archive includes original process stderr, host/source hashes, complete check
output and the installed Python dependency versions.

## Managed foreground service

The production service manager supports an actual foreground service with its
configured HTTP/WebSocket readiness check. A CPU-only Console process can verify
ownership and cleanup without model inference:

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-service-lifecycle.mjs \
  --provider <provider> --config /absolute/path/deployment.json \
  --models examples/models/qwen38-vllm.yaml --id <configured-service> \
  --output .local/work/<new-service-check> --port <unused-console-port>
```

Two leases share one actual process. Releasing the first retains the process;
releasing the last stops it. Restart creates a new process. An observed unexpected
process exit aborts its lease and rejects admission until that failure is handled.
The separate `--close-held` invocation closes the server while one lease remains
and requires that process to terminate, with zero final leases and owned PIDs.

Both paths pass on 2026-10-07 using the actual four-provider EDH native workspace
Console as the configured foreground service. Evidence:
`.local/work/v1-cpu-service-lifecycle-20261007/` and
`.local/work/v1-cpu-service-close-held-20261007/`.

## Managed service startup ownership

The production ManagedServices owner starts the actual configured four-provider
Console as its foreground service. Three cases exercise operator cancellation
during startup, global close during startup and cancellation of one of two
simultaneous startup admissions.
Shutdown waits for both the leader's exit and complete owned process-group absence
under the configured graceful deadline. Forced termination also has a bounded
drain and retains the original graceful/release errors. Confirmed group release
clears PID ownership; an uncertain boundary retains it.
An EPERM group probe retains ownership and waits within the same bound; it does
not establish absence. Only ESRCH confirms that no group remains. These meanings
follow the [Apple kill(2) reference](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/kill.2.html).

```sh
CUDA_VISIBLE_DEVICES='' pnpm exec tsx --tsconfig tsconfig.runtime.json \
  scripts/check-service-startup-owner-offline.mjs \
  --workspace /absolute/path/original-workspace.json \
  --output .local/work/<new-service-startup-owner-check>
```

The diagnostic requires POSIX process groups. It preserves the actual model and
provider bindings, selects a new private writer directory and unused Console
port, and starts the production workspace CLI. It observes original writer
creation before the OS suspends the owned process. Cancellation/closure stays
with its actual process owner; resuming allows the installed signal handler to
complete closure. Two startup admissions share one PID. Cancelling the first
retains the second's lease, and that second admission receives the actual Console
readiness response before release.

Each case requires the original cancellation outcome, absent owned process group,
zero final leases/PIDs, released writer lock and successful listener-port reuse.
Configuration and executable source hashes remain unchanged. macOS evidence:
`.local/work/v1-service-group-owner-20261008-release/acceptance.json`.
These actual process/HTTP cases make no Session, model, policy, simulator or GPU
allocation. Loaded model-service startup interruption remains a native gate.
The same current source also passes shared lease release, actual service restart,
unexpected process exit and server closure with an active lease in
`.local/work/v1-service-group-lifecycle-20261008-release/` and
`.local/work/v1-service-group-close-held-20261008-release/`.

Frozen `1192be3` passes these three startup cases, both actual shared-service
lifecycle scenarios, the eight perception CLI cases below and full project checks
under isolated Linux Python 3.12.14 and Node 24.21.0. Six original configuration
hashes and nine executable hashes match macOS. Startup reports require owned
process-group absence; shared release, actual restart, unexpected process exit
and active-lease server closure retain their original outcomes. The canonical
server checkout's before/after status is identical. No model, policy, simulator
or GPU is allocated. Reports and the verified summary are under
`.local/work/v1-cpu-service-group-20261008/linux/`; archive SHA-256:
`6d2ad725331512f382dbc8949ff64cadd22e93c23173f7a6dd733fb0d044bcc0`.

## Perception service arguments

Standalone SAM3.1 and YOLO26 service CLIs handle argument help, required fields and
port/checkpoint paths before importing their optional model/HTTP SDKs. Valid service
startup imports its required libraries directly and retains original source and
checkpoint verification, model initialization and request schemas. The independently
runnable SAM service retains its MIT notice and imports no EDH runtime or YOLO.

```sh
CUDA_VISIBLE_DEVICES='' .venv/bin/python scripts/check-perception-startup-offline.py \
  --python .venv/bin/python --output .local/work/<new-perception-startup-check>
```

Eight actual subprocess cases cover help, missing required arguments, invalid
ports and absent checkpoints for both services. Each process exits with its
original argparse/field error before SDK admission. No model, checkpoint, SDK,
perception result, environment, GPU or control is supplied by the diagnostic.
Source hashes and complete original stdout/stderr remain in
`.local/work/v1-perception-startup-20261008/acceptance.json`.
Loaded model startup, source/weight validation and segmentation/depth results
retain their native acceptance requirements.
The same eight CLI cases and all three executable hashes also match the isolated
Linux run from frozen `1192be3`; its reports are under
`.local/work/v1-cpu-service-group-20261008/linux/perception-startup/`.

## Native admission and interrupted driver

The [admission diagnostic](../../scripts/check-native-admission-offline.mjs)
starts the production four-provider Console and a production native deployment.
The selected profile requires that Console's occupied endpoint as its managed
service. The existing service owner remains active while native admission rejects
the ownership conflict before starting a worker or loading a model.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-admission-offline.mjs \
  --provider <provider> --config /absolute/path/deployment.json \
  --workspace /absolute/path/workspace.json --models examples/models/qwen38-vllm.yaml \
  --profile <configured-profile> --service <console-service> \
  --output .local/work/<new-admission-check>
```

Repeat with `--interrupt` to send SIGTERM to the actual acceptance driver at
environment admission. Its native factory still performs its original service
checks. The driver retains the submitted response and closes the matching Session.
Both paths require released resources, zero task admissions, zero service leases
or child PIDs, unchanged configuration hashes and released listeners/writer locks.
They pass on 2026-10-07 in
`.local/work/v1-cpu-admission-failure-20261007-02/` and
`.local/work/v1-cpu-admission-interrupt-20261007/`.

## Native geometry and role records

`scripts/check-recorded-metric.py --record DIRECTORY --output .local/work/<new-file>.json`
recomputes original RGB-D measurements through production geometry. Source hashes,
mask/image identity, calibration, pixel counts and original metadata remain exact.
Derived range and camera/world surface coordinates use a reported float64
accumulation allowance: `8 × (n × epsilon / (1 − n × epsilon)) × scale`, where
`n` is the number of valid pixels and `scale` is at least one meter and includes
the original/recomputed coordinate magnitudes. Each coordinate reports its actual
drift and allowance. This numerical allowance represents arithmetic precision;
sensor accuracy and semantic object selection require separate native evidence.
RoboTwin's recorded camera centroid differs by `2.44e-19` m on this host;
the original depth, calibration and PNG sources remain unchanged.

Actual RoboCasa, RoboTwin and RoboDojo records pass recomputation. The production
communication reader also checks all 141 original events of run `04823dd4`,
same-context explicit continuation, report versions, acknowledgement and context-
pending cancellation with released resources. Native DSH recovery readers preserve
original tool results and recover interrupted prefixes without replaying controls.
The actual BEHAVIOR journal verifies a retained two-task Session and its unchanged
failed outcomes through the production history, catalog and verdict readers.
These are CPU checks of original records.

The [RoboTwin action reader](../../scripts/check-robotwin-recorded-actions.py)
uses the actual production Torch converter on recorded model/native action pairs.
`--conversion-only` checks the recorded checkpoint revision, finite action rows,
native horizon, unchanged joint targets and gripper conversion on CPU. The
separate `--request` and `--schema-path` arguments additionally require the exact
original request and verify its identity, channel ranges and action budget.
Reports explicitly state whether that original request was checked.

```sh
python scripts/check-robotwin-recorded-actions.py \
  --record /absolute/path/robotwin-pi05-recorded-actions.json --conversion-only \
  --output .local/work/<new-conversion-check>.json
```

On `jd_B300`, the current 56 Python files and 16 base modules pass compilation
and imports in `edh-lerobot-pi05-py312` with `CUDA_VISIBLE_DEVICES` empty. The
original recorded Pi0.5 action passes production CPU conversion without new
inference or controls. That conversion-only check does not certify request
identity or checkpoint bytes. Its original checkpoint revision is retained.

The [recorded-input endpoint driver](../../scripts/check-recorded-policy-inference.py)
is available for the subsequent actual policy validation. It supports bearer
credentials through a named environment variable, preserves the request hash,
validates the canonical response and requires a new private output file. It
issues an actual inference request when invoked; this CPU phase does not invoke
it against a model service. Its response still requires independent checkpoint
and simulator source acceptance.

## Native configuration and original histories

The [workspace readiness check](native-workspace.md#offline-readiness) validates
all four factories, profile-specific Teams, model/checkpoint/mode bindings and
HTTP projections without environment allocation. The
[campaign reader](native-release-campaign.md#inspect-retained-task-histories-without-gpu-work)
checks original terminal task histories, Planner recovery, native tools,
independent Verifiers, completed plans and Session closure.

`pnpm check` validates formatting, generated schema, role workflows, exact DSH
source provenance, TypeScript, module/document structure, Python compilation/base
imports and SVG XML. These checks establish their declared CPU boundaries.

## Required native release evidence

Current-code multi-goal task execution, native stop/timeout races, policy/model
inference, semantic geometry and complete simulator action/video acceptance use
the actual installed models and environments. Evolver remains paused and
SceneState remains deferred. The consolidated campaign must use at most one
physical GPU from GPUs 2–4 on `jd_B300`, with every EDH compute/render component
assigned to that same device.
