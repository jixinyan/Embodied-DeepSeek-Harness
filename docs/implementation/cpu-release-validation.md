# CPU release validation

The checks exercise production configuration, journals, HTTP services and policy
transport without starting models or simulators. Original record inspection
preserves source hashes and identifies its acceptance scope. GPU task success
continues to require the [native campaign](native-release-campaign.md).

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

On 2026-10-07, 95 original telemetry events across three policy requests pass.
The actual upstream connection times out, both clients discard their connections,
the authenticated server rejects unauthorized admission and its listener closes.
Evidence: `.local/work/v1-policy-transport-offline-20261007-02/acceptance.json`.

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
