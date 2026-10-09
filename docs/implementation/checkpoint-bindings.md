# Checkpoint bindings

Native policy startup accepts the checkpoint directory and an optional
`--checkpoint-sha256`. The selected service checks that digest before importing
its model SDK. Deployment configuration owns these command arguments; the
Console's checkpoint label describes the same selected artifact. A new compatible
checkpoint is a new configured profile with its own directory, identity and label.
Each native profile accepts `checkpointSha256` alongside the readable `checkpoint`
label. Admission requires 64 lowercase hexadecimal characters before environment
allocation. The prepared deployment, Console API, Session and run configuration
retain that selected identity in immutable profile metadata.

## Runtime admission

Learned-policy profiles copy `checkpointSha256` into the Worker's
`policyCheckpointSha256`. A directly authored Worker binding also supplies the
profile identity; conflicting declarations fail configuration admission.
Initialization transmits and confirms `policy_checkpoint_sha256` before execution.
ActionGate retains that value through request creation and ordinary pause/resume.

`PolicyRequest`, `ActionChunk` and `ActionSegment` accept optional
`checkpoint_sha256`. A selected request requires an identified response with the
same digest before client acceptance or Gate dispatch. The JSON service's
`checkpoint_sha256` reader supplies its own verified artifact identity, admits
requests before inference and publishes response identity. Native GR00T/LeRobot
services use their computed digest; OpenPI uses the validated producer metadata.
Missing or different service identity fails the request and releases its connection.

Hybrid profiles use the digest on their lower-policy proposal request. The
TypeScript proposal client checks its returned scope, action specification and
checkpoint before review. Direct model profiles use the model binding and accept
no learned-policy digest. Existing profiles without an explicit digest retain
ordinary checkpoint/source validation and optional identified responses.

The recorded reader verifies identified requests and native segments against
the actual service artifact. Historical records retain their original fields.
CPU inspection of declared selection metadata preserves original action values;
loaded native inference and task success require their separate acceptance.

## Service selection

| Service | Selected digest | Compatibility owner |
| --- | --- | --- |
| GR00T / BEHAVIOR | `checkpoint_identity(...).checkpoint_digest` | R1Pro modalities, relative/absolute group semantics, 32-step horizon and 23 native channels |
| GR00T / RoboCasa | `checkpoint_identity(...).checkpoint_digest` | PandaOmron modalities, 16-step horizon and native action conversion |
| LeRobot Pi0.5 / RoboTwin | `checkpoint_identity(...).checkpoint_digest` | Aloha AgileX features, tokenizer, normalization, absolute joint targets and 14 channels |
| Native OpenPI / RoboDojo | `verify_checkpoint(...).checkpoint_sha256` | ARX X5 transforms, saved normalization and finite 50-by-14 native action output |

The three GR00T/LeRobot services use the same
[`checkpoint_identity`](../../harness/physical-runtime/src/physical_harness/policies/provenance.py)
reader. It hashes every discovered `.safetensors`/`.bin` weight and the declared
model/processor/statistics configuration files, then hashes the canonical sorted
path-to-SHA256 mapping. A known upstream revision is returned only when that
complete mapping equals the service's reference manifest. Other artifacts retain
their own digest and `checkpoint_revision: null`.
Startup and every inference record include `checkpoint_files_sha256`, covering
configuration files as well as weights. The recorded identity reader verifies
that complete mapping, its aggregate digest, weight subset and reference revision.

BEHAVIOR's default requires its known checkpoint revision. Supplying the selected
digest admits another checkpoint for the existing R1Pro adapter. RoboCasa and
RoboTwin retain their existing directory selection and can explicitly require
the chosen digest. All three services reject a different computed digest before
model imports. Their adapter compatibility checks remain mandatory during native
initialization and inference.

Native OpenPI verifies the complete inference inventory through
[`verify_checkpoint`](../../harness/physical-runtime/src/physical_harness/policies/openpi_checkpoint.py).
Its canonical digest includes each file's path, size and SHA256. The default
selects the recorded eighteen-file RoboDojo checkpoint. A configured digest admits
another complete inventory for the same `pi05_base_aloha_full_sim_arx-x5_seed_0`
model configuration. The service preserves the supplied inventory revision and
the actual file digest in its verification report and welcome metadata.

Native OpenPI also checks `assets/arx_x5_sim/norm_stats.json` before importing its
SDK. JSON Schema validates the required state/actions groups and their fourteen
mean/std/q01/q99 entries. Values must be finite, standard deviations nonnegative
and quantiles ordered. The normalization file's byte count and SHA256 must match
the complete verified checkpoint inventory. Its source identity, dimensions and
quantile mode accompany the verification report. Saved SDK normalization and
model/action transforms continue through the trained-policy loader. See
[normalization provenance](../provenance/openpi-normalization.md).

The JSON OpenPI bridge admits its required `--checkpoint-sha256` syntax before
opening its listener or importing the client SDK. That value must equal the
native producer's selected digest. It validates that identity and the original request/instruction/
state/camera hashes on every inference. All resulting action proposals continue
through ActionGate.

## Configuration

### GR00T configuration admission

Both GR00T adapter constructors call their production
`verify_checkpoint_configuration` before importing `Gr00tPolicy` or loading
weights. The shared [configuration reader](../../harness/physical-runtime/src/physical_harness/policies/gr00t_checkpoint.py)
checks `config.json`, `processor_config.json` and `statistics.json` under the
selected checkpoint directory and returns their individual SHA256 values.
JSON Schema and semantic admission require:

- Ordered camera, state and action keys; one language key; current-frame input
  indices and the exact configured future action sequence.
- The supported absolute/relative action representations, group sizes and state
  references; BEHAVIOR's relative groups and coarse-action instruction key.
- Matching model/processor backbone identity, state/action capacities and horizon
  capacity, including any configured state sine/cosine expansion.
- Complete finite normalization statistics with native group dimensions,
  nonnegative standard deviations, consistent shapes and ordered finite ranges.
  BEHAVIOR relative statistics may retain their saved per-step horizon dimension.

Incompatible configuration raises at constructor admission before SDK imports.
Compatible fine-tuned artifacts still require their selected full checkpoint
identity and actual native model/task acceptance. This metadata reader performs
no model construction or inference and preserves the original SDK transforms.

```sh
CUDA_VISIBLE_DEVICES='' PYTHONPATH=harness/physical-runtime/src \
  .venv/bin/python scripts/check-gr00t-configuration-offline.py \
  --provider behavior --checkpoint /path/to/original/gr00t-r1pro \
  --output .local/work/gr00t-r1pro-configuration
```

Select `robocasa` with its original PandaOmron checkpoint for the other adapter.
The diagnostic requires original reference metadata hashes and retains declared
invalid copies with their individual hashes. Each invalid sample calls the actual
adapter constructor; reaching an optional SDK import fails the diagnostic.

### Profile commands

For each profile, retain the existing service entry and provide its selected
checkpoint directory and digest in the managed service's `command` array.
These arguments execute directly. The configured Python environment supplies the
corresponding SDK; deployment device selection controls its hardware allocation.

```sh
python -m physical_harness.policies.services.gr00t_n1d6_behavior \
  --checkpoint /path/to/checkpoints/my-r1pro-policy \
  --checkpoint-sha256 "$EDH_CHECKPOINT_SHA256" \
  --device cuda:0 --port 8007
```

For native OpenPI, additionally supply the artifact's complete `--inventory` and
an output file for `--verification-output`. Use the same selected digest for its
JSON bridge. A malformed digest fails argument admission. A well-formed digest
that differs from the actual files fails checkpoint admission. Report-path errors
terminate native OpenPI before SDK imports.

Digest admission identifies files. Native SDK compatibility, learned-policy
effectiveness and complete task success require the selected configuration's
loaded-policy and simulator acceptance.

## CPU validation

The [startup diagnostic](../../scripts/check-policy-startup-offline.py) checks both
module/example entries, including malformed selected digests before SDK imports.
The [checkpoint binding diagnostic](../../scripts/check-checkpoint-binding-offline.py)
reads actual original checkpoints for all four providers, accepts their selected
digests, rejects different digests and preserves their original identities/files.
The native producer's two entry forms additionally reach actual report-directory
errors and reject mismatched digests before SDK imports.

```sh
CUDA_VISIBLE_DEVICES='' PYTHONPATH=harness/physical-runtime/src \
  .venv/bin/python scripts/check-checkpoint-binding-offline.py \
  --behavior-checkpoint /path/to/checkpoints/gr00t-r1pro \
  --robocasa-checkpoint /path/to/checkpoints/gr00t-pandaomron \
  --robotwin-checkpoint /path/to/checkpoints/pi05-aloha \
  --robodojo-checkpoint /path/to/checkpoints/pi05-arx-x5 \
  --robodojo-inventory /path/to/original-robodojo-inventory.json \
  --output .local/work/checkpoint-binding-check
```

These checks use original reference artifacts. They supply no fine-tuned-model
result, inference, simulator allocation or physical action. Preserve the output's
source hashes, original file identities, actual errors and child exits.

Clean `d8b3aee` passes this actual-file diagnostic on isolated Linux: three original
GR00T/LeRobot bindings, complete eighteen-file RoboDojo verification and four
native producer entry cases. All original identities/files remain unchanged.
Its full macOS/Linux CPU campaigns each pass twenty-six components and 252
admission/process/wire/resource cases. Independent comparison verifies 216
component source hashes, all fifty-two process receipts and fifty-six actual OS
absence checks. Evidence and the independently verified summaries are under
`.local/work/v1-cpu-checkpoint-binding-macos-20261008/` and
`.local/work/v1-cpu-checkpoint-binding-linux-20261008/`. See the
[CPU guide](cpu-release-validation.md#consolidated-cpu-campaign) for scope and
the verified archive identity.

Clean `43ad63c` repeats all four original bindings after adding native normalization
admission. Full macOS/Linux campaigns each pass twenty-six components and 254
admission/process/wire/resource cases. The eight normalization results and three
source hashes match across platforms; six SDK source hashes match their recorded
provenance. All original files remain unchanged. Current reports and independent
summaries are under `.local/work/v1-cpu-openpi-normalization-macos-20261008/` and
`.local/work/v1-cpu-openpi-normalization-linux-20261008/`.
## Recorded rollout identity

The run's `launchProfile.checkpointSha256` selects the actual checkpoint in
`audit-recorded-run.py`. GR00T/LeRobot custom selections require complete recorded
file mappings, matching weight identities and `checkpoint_revision: null` unless
the complete artifact equals its reference manifest. Every identified inference
must preserve startup identity. Records from a reference service without a complete
mapping retain verification against its original pinned manifest.

OpenPI custom selections require their complete selected inventory, declared
revision, parameter files and inventory-bound fourteen-channel ARX X5 normalization.
Native startup, bridge welcome and each inference must match that selected identity.
The explicit digest identifies a readable checkpoint label without prescribing a
reference checkpoint name. Profiles without an explicit digest preserve the original
reference inventory and label requirements. `audit-openpi-robodojo.py` accepts the
same optional `--checkpoint-sha256` for retained inference inspection.

Both audit paths preserve original request/action/source and formal-verification
checks. An explicit selection does not grant action authority or prove a new task.

The [recorded checkpoint diagnostic](../../scripts/check-checkpoint-audit-offline.py)
passes sixteen checks using original reference runs, requests and native inference
logs. The [profile diagnostic](../../scripts/check-checkpoint-profiles-offline.mjs)
passes twenty actual factory/configuration/HTTP checks across all four providers.
Malformed and inconsistent selections are rejected, original files remain unchanged,
and the Console listener/writer resources release. Clean `6877ce3` includes both
diagnostics in matching macOS/Linux campaigns of twenty-eight components and 290
admission/process/wire/resource cases per platform. Independent verification
matches 318 component source/input hashes, twenty-one diagnostic hashes and
fifty-six process receipts. Sixty-one actual OS checks confirm owned process
release. All eighty-six transferred original artifact files and all four original
checkpoints remain unchanged. Linux verifies the full recorded identities for the
three GR00T/LeRobot checkpoints and the eighteen-file RoboDojo checkpoint, including
its saved normalization. Reports and independent summaries:
`.local/work/v1-cpu-checkpoint-audit-macos-20261008-final/` and
`.local/work/v1-cpu-checkpoint-audit-linux-20261008/`.
These results establish configured reference selection and rejection boundaries.
Custom-checkpoint inference and complete physical workflows require their native
acceptance with actual selected artifacts.

Current runtime-admission checks pass thirty-three original-record/wire/Gate and
actual WebSocket cases plus thirty-six configuration/factory/HTTP cases within
all twenty-eight macOS/Linux CPU components from clean `416a38a`. Each platform
passes 323 admission/process/wire/resource cases. Independent comparison verifies
326 component source/input hashes and fifty-six process receipts; fifty-seven
actual OS checks confirm release. They use original reference identities and
declared invalid derivatives, perform no model inference or controls, and preserve
source files and canonical server status. Evidence and independent summaries:
`.local/work/v1-cpu-checkpoint-wire-macos-20261008-final/` and
`.local/work/v1-cpu-checkpoint-wire-linux-20261008/`.
