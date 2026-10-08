# Native deployments

Each native module default-exports a `DeploymentFactory` for the desktop launcher
and starts its console when executed directly through `tsx`. Importing the module
does not start a server, allocate an environment, or send model requests.

| Module              | Required configuration variable | Default console port |
| ------------------- | ------------------------------- | -------------------- |
| `robotwin-live.mjs` | `EDH_ROBOTWIN_CONFIG`           | 4323                 |
| `behavior-live.mjs` | `EDH_BEHAVIOR_CONFIG`           | 4334                 |
| `robocasa-live.mjs` | `EDH_NATIVE_WORKER_CONFIG`      | 4318                 |
| `robodojo-live.mjs` | `EDH_ROBODOJO_CONFIG`           | 4318                 |
| `native-workspace.mjs` | `EDH_NATIVE_WORKSPACE_CONFIG` | Configured |

Execute a selected module through `pnpm exec tsx --tsconfig tsconfig.runtime.json`
with its path as the final argument. The named variable points to an actual JSON
configuration. The shared configuration loader and factory belong to
[native-deployment.mjs](../../apps/server/src/native-deployment.mjs); workspace
composition belongs to [native-workspace.mjs](../../apps/server/src/native-workspace.mjs).
The example entries select a provider and invoke those production modules.
The desktop launch configuration selects the same provider module as
`deployment`, supplies its environment file, and controls console port and data
directory. See the [desktop launcher](../../apps/desktop/README.md).

The [native workspace](../../docs/implementation/native-workspace.md) loads multiple
configured providers and Teams into one Console. It reuses these native factories,
one shared model catalog and each selected profile's original task/checkpoint bindings.

Configuration requires `modelConfiguration`, `dataDirectory`, and an actual native
`worker`. RoboTwin, BEHAVIOR and RoboCasa have one `worker` and `checkpoint` at the
top level. RoboDojo has a `profiles` object whose entries contain `worker`,
`checkpoint`, and an optional `plannerModel`. Every worker selects its provider,
`nativeTaskId`, native scene configuration, policy identity, and catalog. The catalog
must contain exactly that task. Task definitions and native success checks pass
the production validators; provider initialization checks the actual installed
task and embodiment before execution.

The shared `nativeWorkerConfigurationSchema` validates all worker fields at
configuration loading and again before environment allocation. Policy endpoints
use `ws:` or `wss:` without embedded credentials or fragments. Action limits,
monitor cadence, transport/device/policy deadlines, lifecycle timeouts, recording
flags and output directories have explicit bounds. RoboTwin and BEHAVIOR require
their installed `sourceRoot`; RoboCasa and RoboDojo use their existing SDK/backend
bindings. Unknown worker fields fail validation. Decision-owner and final-Verifier
models must advertise image input when using a configured model catalog.

Check all actual provider files and their Console projections together using the
[offline workspace readiness command](../../docs/implementation/native-workspace.md#offline-readiness).
It opens no environment and starts no model or policy service.

Optional top-level `teamFile` and `roleRoot` select a production `FileTeamLoader`
Team. Relative paths resolve against the repository root. Team validation includes
actual model aliases, role files, tools, provider constraints, and the decision
owner. For the camera specialist workflow select
`examples/teams/robotwin-scene-analyst.yaml` with `roleRoot: "examples"`.

`segmentationURL` enables SAM 3.1 and calibrated native `perception.measure_object`
for all four providers. Native initialization must advertise its actual metric
port. RoboTwin, BEHAVIOR and RoboDojo select their `*-grounded.yaml` Team when SAM
is configured; RoboCasa retains its `robocasa-sam-live.yaml` Team. The grounded
Planner preserves image/mask identity, native calibration, units and stopped-control
requirements. A RoboTwin configuration with both SAM and `depthURL` retains the
existing `robotwin-perception.yaml` Team. `depthURL` enables YOLO26 independently
for every provider; optional `depthIntrinsicsByCamera` retains each camera's
declared calibration. Select a Team with its advertised tools when using depth.

An optional `profile` object accepts `id`, `label`, and `environment` on each worker
configuration or RoboDojo profile entry. IDs must satisfy the console's profile
identity rules. With existing default tasks the profile IDs remain
`robotwin-adjust-bottle`, `behavior-picking-up-trash`, and `robocasa-open-cabinet`.
Other native task IDs derive their profile identity and labels from the selected
task; explicit metadata supports descriptive operator labels. RoboDojo preserves
each existing `profiles` key and `label`.

`EDH_MODEL_CONFIG` can select a configured model file for every provider. Existing
RoboCasa configuration variables remain supported: `EDH_MODEL_BASE_URL` plus
`EDH_MODEL` when a model configuration is absent, `EDH_POLICY_CHECKPOINT_LABEL`,
`EDH_DATA_DIRECTORY`, `EDH_SAM31_BASE_URL`, and `EDH_CONSOLE_PORT`. Existing provider
configuration paths, native scene fields, deadlines, recording fields, and policy
options retain their meaning. Native learned-policy profiles require `policyUri`.
RoboDojo `direct` and `hybrid` profiles bind GPT-6 Astra through `policyModel`, with
their gateway and DSH host owned by the allocated Session environment. Closing
that environment releases those resources and flushes its audit records.
Learned RoboDojo profiles select the `student` source and retain only applicable
student execution metadata. Teacher model, context and prompt provenance fields
belong to a selected GPT policy mode. The native factory also binds the complete
production record/image retention policy for its native providers and built-in
tools through `nativeWorkspaceRetention`.

Optional `managedServices` declares foreground model or policy processes owned by
the console server. Each named service requires `label`, a `command` argument
array, `cwd`, `env`, `startupTimeoutMs`, `probeTimeoutMs`, `probeIntervalMs`,
`shutdownTimeoutMs`, and `readiness`. A `readiness.type` of `http_json` uses an HTTP
`url`, optional `headers`, and a complete JSON `schema` for the real response;
`websocket` uses a `ws:` or `wss:` URL and confirms an actual opening/closing
handshake. HTTP model admission can require the selected model ID in `/v1/models`.
Readiness performs no inference or physical control.

Top-level `serviceIds` applies to every launch profile. RoboDojo profile entries
can add their own `serviceIds`. Every ID must select a declared service, and every
service requires a profile binding. Services start in the declared binding order
when allocating a Session. Concurrent Sessions share a process and hold independent
leases; their final release sends SIGTERM and awaits process exit. POSIX processes
and their children share an owned process group. A shutdown deadline sends SIGKILL
and reports the failed graceful termination. Commands must run the actual foreground
service on the server's host; external/cloud endpoints retain their ordinary model
and policy configuration. Configuration owns host paths, environments and device
selection. An occupied endpoint prevents managed startup.

Optional profile `checkpointSha256` identifies the selected learned artifact and
binds it to actual policy request/action admission. The native learned Worker
receives `policyCheckpointSha256`; conflicting profile/Worker identities fail
before allocation. Hybrid profiles apply the digest to lower-policy proposals.
Direct model profiles use their model binding. Configure the same digest in the
selected service's command arguments. See
[checkpoint binding](../../docs/implementation/checkpoint-bindings.md) for hashing,
wire fields and loaded-model acceptance requirements.

`GET /api/services` and the console's service panel show lifecycle state, lease
count, process ID and failure information. Commands, environment variables and
readiness credentials remain private. An unexpected process exit interrupts its
affected environment, prevents new service leases and remains visible until a new
configured server lifetime. Server close releases Sessions and their services;
startup cleanup also closes the service lifecycle.

The actual process check requires a saved configuration that starts its real
model/policy service:

```bash
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-service-lifecycle.mjs \
  --provider robotwin --config /absolute/path/managed-deployment.json \
  --id robotwin-policy --output /absolute/path/unused-acceptance-directory
```

It checks two shared leases, first and final release, process restart, an explicitly
triggered unexpected exit of its owned process, admission rejection, HTTP status and
server cleanup. Native task acceptance requires its own physical run.
Run the same command with `--close-held` and another new output directory to
confirm actual server shutdown while the final service lease remains active.

The configuration startup check accepts ordinary external service endpoints:

```bash
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-deployment.mjs \
  --provider robotwin --config /absolute/path/deployment.json \
  --models /absolute/path/model.json --journal /absolute/path/closed-console
```

`--journal` is optional and copies existing closed journal bytes into an isolated
directory under `.local/checks`. The check allocates no native environment and
performs no inference. Native task execution, policy acceptance, and formal success
require an actual live run and retained evidence. The YAML files in this directory
remain deployment authoring examples with their own declared requirements.
