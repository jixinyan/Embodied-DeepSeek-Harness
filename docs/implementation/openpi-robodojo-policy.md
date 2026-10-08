# RoboDojo ARX X5 OpenPI policy

EDH owns the identified native inference entry point, checkpoint verification and
the JSON policy bridge. The installed XPolicyLab SDK supplies the Pi0.5 model,
ARX X5 input/output transforms and native OpenPI WebSocket service. Policy output
enters the existing EDH PolicyRequest/ActionChunk boundary and ActionGate.

## Installation identity

The XPolicyLab source revision is `bb9a0b5f5136a74503b679af830bfd0a3a837d5c`.
Use the dedicated `.local/envs/robodojo-openpi` environment and install the SDK
and its `packages/openpi-client` from the EDH-owned dependency directory.
[The dependency patch](../../examples/policies/openpi-robodojo-numpy2.patch)
declares NumPy 2 support in both packages. The selected versions are NumPy
`2.2.6`, JAX `0.5.3`, Torch `2.10.0+cu128`, LeRobot `0.4.4` and Rerun SDK
`0.26.2`. The SDK's model-import path also requires pytest `8.4.2`.
[The constraints](../../examples/policies/openpi-robodojo-constraints.txt)
record the additional selected versions. Install these dependencies with an
isolated cache and temporary directory under `.local`, then run `uv pip check`
using that environment's Python. The September 30 installation passes checks
for all 189 installed packages and imports the native trained-policy loader.

## Checkpoint identity

The selected Hugging Face dataset revision is
`35efbc7dedfdbeeb6e95fb749bd885d73d483e41`. The inference directory is
`ckpt/RoboDojo/Pi_05/RoboDojo-sim-arx_x5-joint-0/59999` and includes
`assets/arx_x5_sim/norm_stats.json`. Its 18 inference files total
`12,440,992,402` bytes. All files match the inventory's upstream LFS SHA256
digests. The aggregate identity is
`fbf1abbda5863ebe4193754a9db16a1637d9127f042052b828e2aaeee7cc5dc7`.

`verify_checkpoint` verifies every inference file, rejects missing, duplicate or
additional files, and hashes a canonical path/size/SHA256 inventory. The selected
inference contents are `_CHECKPOINT_METADATA`, `params/` and `assets/`.
Training optimizer state is outside this inference directory.

## Services

Start [the native service](../../examples/policies/serve_openpi_robodojo_native.py)
with an explicitly selected GPU, `XLA_PYTHON_CLIENT_PREALLOCATE=false`,
`--checkpoint`, `--inventory`, `--verification-output` and `--port`. It requires
`XLA_FLAGS=--xla_gpu_enable_triton_gemm=false` for the selected B300 deployment,
using the installed cuBLAS GEMM compiler path. It requires
one visible JAX GPU. The native entry admits a fixed `--port` in `1..65535`,
verifies the pinned 18-file checkpoint, validates its fourteen-channel state/action
normalization and publishes its verification report
before importing JAX or OpenPI. Filesystem errors terminate startup at their
source. JAX device selection then precedes loading
`pi05_base_aloha_full_sim_arx-x5_seed_0`. Its welcome metadata identifies the
checkpoint, absolute checkpoint directory, model config, backend, action dimensions,
continuous gripper semantics and the imported OpenPI Python source inventory.
Each inference identifies its sequence and SHA256 of the actual input
state and all three camera arrays.

The producer also accepts `--checkpoint-sha256` for another complete compatible
ARX X5 checkpoint inventory. The computed file digest must equal the selected
digest before SDK imports. The default retains the recorded eighteen-file artifact.
Pass the same selected digest to the JSON bridge. See
[checkpoint bindings](checkpoint-bindings.md) for identity and compatibility rules.
Both producer and JSON bridge admit digest syntax before optional SDK imports.
The producer's saved normalization has finite mean/std/q01/q99 statistics,
nonnegative standard deviations and ordered quantiles. Its file hash and byte
count match the complete inventory; its identity accompanies the verification
report. [Normalization provenance](../provenance/openpi-normalization.md) records
the selected SDK's configuration and loader behavior.

Clean `43ad63c` passes forty-four policy startup cases within all twenty-six CPU
components on macOS and isolated Linux. Eight original-file/declared invalid-input
normalization checks match across platforms, alongside their three source hashes
and six installed SDK source hashes. Linux's complete original checkpoint checks
verify the normalization identity within the unchanged eighteen-file inventory.
The native entry forms retain actual pre-SDK identity/report-path outcomes.
Evidence: `.local/work/v1-cpu-openpi-normalization-macos-20261008/` and
`.local/work/v1-cpu-openpi-normalization-linux-20261008/`. See the
[CPU guide](cpu-release-validation.md#consolidated-cpu-campaign) for the complete
source/process comparison and archive identity. Loaded-policy/task gates remain
independent requirements.

The clean `653a3ea` CPU campaign checks both native entry forms on macOS and
isolated Linux without SDK/model allocation. Linux additionally verifies all
eighteen actual original checkpoint files and their aggregate identity before
both entries reach a named report-directory error. All checkpoint bytes remain
unchanged and the original child processes release. This filesystem acceptance
supplies no learned action or service-readiness result. Commands and scope:
[policy startup checks](cpu-release-validation.md#policy-service-startup).

Start [the EDH JSON bridge](../../examples/policies/serve_openpi_robodojo.py)
with `--native-policy-uri`, `--checkpoint-sha256` and `--port`. It accepts a
fresh native service, decodes the three PNG cameras and validates 14 finite state
values. It checks the returned checkpoint, sequence and input hashes, validates
the finite 50×14 action horizon, clamps the native continuous gripper openings to
`[0,1]`, and returns the requested action prefix. Inference runs on one admitted
executor thread. Transport failures close the native connection and terminate
that inference. The bridge does not replay physical commands.

Set the admitted RoboDojo learned worker's `policyUri` to the JSON bridge.
For hybrid profiles, set `lowerPolicyUri` to the same bridge. The existing
execution lifecycle owns observation freshness, action budgets, cancellation
and device boundaries.

## Validation

[The recorded-observation check](../../scripts/check-robodojo-recorded-policy.py)
loads a retained native NPZ observation with `allow_pickle=false`, validates every
RGB/state field against the native fingerprint and checks the original reset's
state identity and instruction. It sends one actual PolicyRequest through the
JSON bridge and stores the returned ActionChunk. Its scope is learned inference
on retained native sensor data. It performs zero physical controls and cannot
certify hybrid execution or task success.

On September 30, two sequential real requests passed through the same native
service and JSON bridge with `inference_index` values `0` and `1`. Both returned
16 validated actions from a finite 50×14 model horizon. The source episode is
`2734e820225940bf851e11aa257d8fa0`, observation `000000.npz`, with three
640×480 RGB cameras, 14 state values and the original instruction "Pick up the
mint green scissors by 10 cm." Both model-input state/camera SHA256 results
match the bridge's admitted arrays. Request identities are
`c8fde15c-3dc5-48f1-99eb-57118ed77670` and
`811c12df-39df-4873-955a-6361df391596`. The private source and reports are retained
under `.local/work/robodojo-openpi-20260930` on the deployment host.

October 3 run `02475b82-b6b6-457f-8cf8-3199ef265bc6` performs 59 admitted
controls and four learned inferences. The native simulator reports task success;
a fresh Qwen Verifier checks the same criterion and Planner completes the task.
The Session releases its native resources. One plan-argument tool error is retained
in this run; clean workflow, physics counters, interruption, recovery and hybrid
acceptance remain separate requirements.

## Recorded source and rollout audit

`scripts/audit-openpi-robodojo.py` checks retained actual inference reports against
both native and JSON bridge logs and the canonical verified checkpoint inventory.
It validates service startup identities, contiguous inference sequences,
cross-service state/camera hashes, original finite 50×14 actions, the exact
continuous-gripper conversion and preserved response prefixes. Its output keeps
device receipt counts at zero and task-completion acceptance false. Original
PolicyRequest camera arrays remain unavailable in the September 30 retained
reports; that source audit does not claim decoded-input verification.

For a complete actual worker rollout, the bridge's `--audit-directory` retains
`<request_id>.request.json` and `<request_id>.inference.json`. Set
`EDH_POLICY_REQUEST_RECORD_DIR` on the worker to retain its original requests and
the admitted segment/receipt/native-step records. The same directory may contain
both sources because their filenames differ. Capture the original native and
bridge logs and the checkpoint verification file.

`scripts/audit-recorded-run.py` admits the explicit OpenPI inventory profile with:

```sh
.venv/bin/python scripts/audit-recorded-run.py \
  --export .local/work/v1-20261003/export \
  --output .local/work/v1-20261003/rollout-audit.json \
  --sensor-samples .local/work/v1-20261003/sensor-samples.json \
  --policy-requests .local/work/v1-20261003/policy-requests \
  --policy-service-log .local/work/v1-20261003/bridge.log \
  --openpi-checkpoint-verification .local/work/v1-20261003/checkpoint-verified.json \
  --openpi-bridge-audit .local/work/v1-20261003/policy-requests \
  --openpi-native-service-log .local/work/v1-20261003/native-policy.log \
  --openpi-policy-id openpi-pi05-robodojo-arx-x5 \
  --simulation-videos .local/work/v1-20261003/videos \
  --require-clean-role-completion
```

Bind these paths to the retained actual run. The OpenPI profile validates decoded
request PNG→CHW RGB and float32 state hashes, the unchanged worker/bridge request,
the exact returned model prefix, each admitted ActionSegment/ActionReceipt,
native control and physics totals, camera/frame identities, decoded simulator
video and fresh independent formal verification. Explicit learned-source flags
also audit failed/cancelled terminal tasks with recorded controls; they retain
the original task outcome. The selected policy ID and checkpoint label must
match the actual launch profile.

The native service records its absolute checkpoint directory and the imported
OpenPI Python source paths, individual SHA256 hashes and aggregate source digest.
Startup, bridge and inference records must preserve the same identity. Retained
records without these fields expose their availability explicitly. The deployment's
declared XPolicyLab revision and imported file hashes remain separate evidence.
