# Consolidated native release campaign

The campaign uses the production Console and the existing live acceptance driver.
Its preparation mode allocates no environment and starts no model or policy
service. Actual execution processes cases sequentially, with one Session per
case and the case's tasks submitted to that retained environment in order.

## Prepare the actual deployment

Run the [offline workspace check](native-workspace.md#offline-readiness) against
the installed configuration. The resulting `readiness.json` identifies the EDH
revision, actual configuration hashes, deployment digest, compatible profiles,
Team/model bindings and admitted native task checks.

The [campaign definition](../../examples/deployments/native-release-campaign.json)
selects the configured RoboDojo Tower, RoboTwin bottle, RoboCasa drawer and
BEHAVIOR trash profiles. Adapt profile identities to the installed workspace.
Every task must match its profile's actual environment-owned catalog; requesting
multiple goals requires admitted prerequisite checks. Tower requires at least
three completed goals. Each second task requires zero new controls, learned
inferences and native physics steps while independently verifying the retained
terminal scene. These are acceptance requirements, not recorded task outcomes.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/run-native-release-campaign.mjs \
  --manifest examples/deployments/native-release-campaign.json \
  --readiness .local/work/<readiness-directory>/readiness.json \
  --output .local/work/<new-prepared-directory> --prepare
```

Preparation validates the original configuration hashes and saves the case
definitions with the selected profile matrix. It sends no Console requests and
performs no native task execution. Changes to configuration require another
readiness check. Actual execution additionally requires the same committed EDH
revision with no source changes and the exact Console deployment digest.

## Execute and retain actual evidence

Use the configured Desktop or native workspace launcher. Deployment configuration
owns CUDA and graphics selection. Current EDH work on `jd_B300` may use at most
one physical GPU from GPUs 2–4; all model, policy and simulator components must
use that same physical device. Confirm their actual process placement separately.
The campaign serializes Sessions and does not assign GPUs or stop external services.

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/run-native-release-campaign.mjs \
  --manifest examples/deployments/native-release-campaign.json \
  --readiness .local/work/<readiness-directory>/readiness.json \
  --output .local/work/<new-actual-campaign-directory> \
  --url http://127.0.0.1:<console-port>
```

Each case retains its driver log, exit status, Session request, configuration,
catalog, task submissions, complete event histories and closure receipts.
The driver preserves the original task outcome and collects before/after-close
histories. Failure stops the campaign. Interruption signals the campaign-owned
driver. The driver interrupts reads and polling, retains an already submitted
admission response, captures evidence and closes its exact owned Session before
exiting. Cleanup HTTP calls continue under their bounded deadlines. The campaign
checks the persisted admission request against the active
Session and closes only an exact matching request/profile/deployment identity.
Cleanup failure accompanies the original error. Unrelated Sessions retain their
ownership. Each accepted case requires released Session resources and zero owned
service processes or leases before another case starts.

The terminal workflow audit requires:

- Original simulation identity, complete ordered events and zero host/native DSH tool errors.
- A completed original final goal and the requested number of completed goals.
- Independent retired role Sessions and one fresh Verifier created after each confirmed execution end.
- Eligible confirmed execution ends with matching scope, criterion and boundary.
- Passed prerequisite verdicts and committed completed plan rows before dependent execution.
- Planner-owned retry decisions, original failed verdicts, explicit changes and matching recovery execution.
- Completed Planner TODOs, requested native tools and the actual owner-authorized `tasks.finish` receipt.

`requireRecovery: true` makes a failed-then-recovered execution mandatory for a
selected task. It does not inject failures or change the original criterion.
`minimumControls` and optional `maximumControls` check original execution counts.
A maximum of zero also requires zero policy calls and native physics steps.

## Inspect retained task histories without GPU work

The same audit reads existing complete live-acceptance directories:

```sh
node scripts/check-native-campaign-records.mjs \
  --manifest /absolute/path/recorded-campaign.json --case <case-id> \
  --directory .local/work/<original-acceptance-directory> \
  --output .local/work/<new-recorded-audit>.json
```

The reader verifies Session membership and its actual released closure receipt.
It preserves hashes of the manifest, Session and original run/event files. Output
must be new and remains under `.local/work`. No model request or simulator control
is performed.

On 2026-10-07, the reader accepts original runs `551fa79d`, `a5d9132e`,
`897f215d` and `ca43312e`: three retained-scene recovery tasks and one unchanged
terminal task with zero controls/inferences/physics steps. The separate original
failed BEHAVIOR run `96c0b983` remains ineligible for task-success acceptance.
Evidence: `.local/work/v1-campaign-recorded-20261007/`.

Frozen `f3e373c` passes actual four-provider readiness and prepares four cases
with eight planned task submissions on 2026-10-08. Readiness retains each selected
Team, model, checkpoint, policy, task criterion and admitted prerequisite check.
Writer/listener resources release and no managed process, model or environment
starts. Evidence:
`.local/work/v1-cpu-release-preparation-20261008-validated/campaign/campaign-plan.json`.
The actual Console separately rejects release execution from a modified checkout
before any Session or service allocation. Evidence:
`.local/work/v1-campaign-admission-20261007/`.

## Acceptance boundary

The campaign's accepted output establishes production HTTP workflow checks.
Original simulator source, checkpoint, policy requests/responses, ActionGate
receipts, calibrated observations, video decoding and process placement require
the [recorded source audit](../../scripts/REPLAY.md). Interrupt-triggered owned
Session cleanup during native execution and the complete new campaign require actual native execution.
CPU admission interruption has separate production acceptance using an actual
occupied Console endpoint; see [CPU release validation](cpu-release-validation.md).
Neither preparation nor recorded-history inspection establishes current-code
physical task success. The [v1 register](v1-delivery.md) remains authoritative
for the full release.
