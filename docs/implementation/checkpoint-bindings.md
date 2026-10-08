# Checkpoint bindings

Native policy startup accepts the checkpoint directory and an optional
`--checkpoint-sha256`. The selected service checks that digest before importing
its model SDK. Deployment configuration owns these command arguments; the
Console's checkpoint label describes the same selected artifact. A new compatible
checkpoint is a new configured profile with its own directory, identity and label.

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
