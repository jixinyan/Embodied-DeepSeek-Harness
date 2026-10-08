# CPU release validation

The checks exercise production configuration, journals, HTTP services and policy
transport without starting models or simulators. Original record inspection
preserves source hashes and identifies its acceptance scope. GPU task success
continues to require the [native campaign](native-release-campaign.md).
The base Python package includes Pillow for PNG observation encoding; WebSocket
inference and original-journal inspection use the `policy` and `diagnostics` extras.

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
32-MiB input boundary, oversized input, invalid UTF-8/JSON/constants, malformed
envelopes, duplicate active identities and a disconnected response channel.
Failure cases retain an open input pipe until the worker exits independently.
Every child reaches process close without forced termination or an unobserved
Task/Future exception. Source hashes and original stderr remain preserved.

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
