# CPU release validation

The checks exercise production configuration, journals, HTTP services and policy
transport without starting models or simulators. Original record inspection
preserves source hashes and identifies its acceptance scope. GPU task success
continues to require the [native campaign](native-release-campaign.md).
The base Python package includes Pillow for PNG observation encoding; WebSocket
inference and original-journal inspection use the `policy` and `diagnostics` extras.

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

On 2026-10-07, 95 original telemetry events across three policy requests pass.
The actual upstream connection times out, both clients discard their connections,
the authenticated server rejects unauthorized admission and its listener closes.
Evidence: `.local/work/v1-policy-transport-offline-20261007-02/acceptance.json`.

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
