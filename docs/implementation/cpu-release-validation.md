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
