# Release validation

Each accepted configuration identifies its committed EDH revision, Team/model,
immutable task catalog, checkpoint files, simulator source and actual outcome.

## Source checks

Run from the checkout with its isolated Python environment installed:

```sh
pnpm install --frozen-lockfile
pnpm check
git diff --check
```

`pnpm check` verifies read-only formatting, generated wire declarations, authored
role/tool workflows, selected DSH provenance, TypeScript, local documentation links,
Python compilation/base imports and SVG XML. GitHub Source checks executes this
same command. Its report contains no model inference or simulator task result.

The [CPU validation guide](cpu-release-validation.md) adds production
host/worker pipes, independent assignment schemas, original goal/plan admission,
policy transport/thread ownership, managed services and retained-record checks.
These checks use actual files, processes and connections with CUDA invisible.
Their acceptance boundaries remain separate from current-code model, simulator
and native task evidence.

## Native task acceptance

The [consolidated native campaign](native-release-campaign.md) connects actual
workspace readiness to sequential provider Sessions, same-environment tasks,
formal-verdict and retry checks, source retention and owned cleanup. Its separate
preparation mode performs no GPU or simulator work.

Start the configured native deployment through the
[Desktop launcher](../../apps/desktop/README.md) or
[provider factory](../../examples/deployments/README.md). Select compatible model,
environment, embodiment, mode and checkpoint. Use task identifiers from the actual
allocated Session catalog.

The HTTP driver creates one Session, submits tasks in order, captures production
event history and closes the Session with confirmed resource release:

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/run-live-acceptance.mjs \
  --url http://127.0.0.1:<console-port> \
  --profile <configured-profile-id> \
  --task <native-task-id> --task <native-task-id> \
  --output .local/work/<unique-acceptance-directory>
```

The output directory must be new. Both tasks retain the same native environment.
Configuration, catalog, submissions, runs, events, results and closed Session
receipts preserve their original identities. Failed/unknown outcomes cause the
success check to fail while retaining evidence and cleanup. An already-ended
episode's second task needs the separate
[zero-action terminal audit](session-task-catalogs.md).

The driver retains `session-request.json` before admission. An admission failure
can leave an error Session; cleanup reads its actual request identity and closes
only the Session created by that invocation. Each admitted task also retains its
complete `before-close-run.json` and `before-close-events.json`, including when
its acceptance deadline expires. Normal `run.json` and `events.json` capture the
terminal history after close. The original failure still exits unsuccessfully;
capture or release errors accompany it through an `AggregateError`.

The recorded failure reader checks real deadline/admission records and the
unsuccessful process exit:

```sh
node scripts/check-live-acceptance-cleanup.mjs \
  --directory .local/work/<failed-acceptance-directory> \
  --mode task-deadline \
  --error-log .local/work/<original-driver-log> \
  --exit-code .local/work/<original-driver-exit-code> \
  --output .local/work/<cleanup-audit>.json
```

`admission-failure` checks a genuine recording-directory preflight failure with
zero admitted tasks. `task-deadline` checks an active native task's original event
prefix, cancellation, retired roles and confirmed resource release. These checks
establish failure capture and cleanup; native task success retains its separate
full workflow audit.

Audit original native action receipts, sensor samples, learned request/response
files, source/checkpoint hashes and camera journals using
[recorded run verification](../../scripts/REPLAY.md). Check independent formal
roles at confirmed eligible execution ends, completed TODOs, terminal tool receipts,
retired assignments and released resources. Retained-scene retry requires an
actual failed verdict and an explicit Planner decision.

## Product and safety acceptance

Run actual tasks through packaged Desktop and preserve selected configurations,
Session/task identities, model output, tools, plans, TODOs and cleanup. Validate
configuration switching, owned service leases/restart and maintenance against
the same production records.

Native safety checks use real provider operations and learned-policy responses.
Expired observations must prevent action admission; connection loss and watchdog
expiry require confirmed stopping and resource release. Failed/unknown receipts
retain their observed outcome. Capability exposure and calibrated geometry require
evidence for each supported body and camera.

Combine original task trace with worker-local video using the
[recorded demo workflow](recorded-demos.md). MP4 delivery requires source integrity,
complete decoding, timestamp mapping and text-boundary checks. Private events,
credentials, frames, checkpoints and generated media stay outside Git.

The [v1 register](v1-delivery.md) records release gates and accepted combinations.
Tagging requires all agreed active gates to pass. Paused Evolver and deferred
SceneState retain their documented scope.
