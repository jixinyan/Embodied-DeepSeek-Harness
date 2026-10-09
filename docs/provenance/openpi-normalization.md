# OpenPI ARX X5 normalization

The installed XPolicyLab SDK is revision
`bb9a0b5f5136a74503b679af830bfd0a3a837d5c`. EDH's native producer selects
`pi05_base_aloha_full_sim_arx-x5_seed_0`, whose data asset is `arx_x5_sim` and
whose model is Pi0.5. Its data configuration enables quantile normalization.
The trained-policy loader loads saved checkpoint statistics from
`assets/arx_x5_sim/norm_stats.json`. The native Aloha transforms take fourteen
state/action channels, three configured cameras and the original instruction;
outputs retain the fourteen native action channels.

The selected SDK serializes normalization as a `norm_stats` object containing
`state` and `actions`. Each group has mean/std arrays and q01/q99 quantiles.
Quantile transforms require both quantiles and use an epsilon in the denominator.
Equal quantiles remain permitted. EDH's preallocation checks use standard JSON
decoding and the existing JSON Schema library, require fourteen finite entries,
nonnegative standard deviations and ordered quantiles, and preserve the original
file's hash and bytes. The trained-policy loader retains ownership of model
loading, saved normalization and inference transforms.

## Inspected installed source

Paths are relative to the installed SDK's `src/openpi/`. The files were read on
2026-10-08 and 2026-10-09. The selected transform pipeline additionally runs on
actual original requests in the CPU diagnostic, with no model allocation or SDK
source changes.

| Source | SHA256 |
| --- | --- |
| `policies/policy_config.py` | `aaf42ab04a33b6c91d2447926211646c33ebd8ebfa427f026d7b6c4f7c45ec52` |
| `training/config.py` | `9d4d131807ebcdc91845288f6012124ca3fc43f5faf9d79ee1f4d681a4e0eff9` |
| `training/checkpoints.py` | `3cc32682ec3609e9075dabd991488edb9d7f6c045443f58963d733f99c468dbd` |
| `shared/normalize.py` | `6c2cea4946fb07e51801530400d2b2fd94730e195cd290d6b6960114eca9739d` |
| `transforms.py` | `7feaa7189bfcac3e3d205484ce9b3fd74fcf597cedc48e74e6d39c4bdffaa0e6` |
| `policies/aloha_policy.py` | `c37aa90797665b1ec57cd5286fa5d6cbf29af0559ffce36d3fed98c02329eaea` |
| `policies/policy.py` | `5a19b73e8d9c60a9e21849bf482c0e9c72f454c3aa88f2de544a24f209913b99` |
| `models/tokenizer.py` | `965be8b3c393a6811875bbc32da9e01a5d01cc2f87802de801cf7293e049748c` |

The selected Policy composes and calls `_input_transform` and `_output_transform`.
EDH binds its input/output admission to these existing callables after native
policy construction. Input processing retains Aloha camera mapping, quantile
normalization, real PaliGemma tokenization, image resizing and 32-channel padding.
Output processing retains saved quantile inversion, absolute joint reconstruction
and native fourteen-channel selection. The admission functions preserve the SDK's
prepared input values and check float32 range before the native response cast.
The JSON bridge retains continuous gripper clipping and the requested prefix.

The [actual SDK diagnostic](../../scripts/check-openpi-transforms-offline.py)
uses the same selected configuration and saved checkpoint statistics without
constructing a model. Its normalized output inputs are explicit SDK derivatives
of recorded native actions, with declared padding to model capacity. Original
normalized network predictions are outside these retained records. Imported SDK
source hashes must match the original identified inference inventory. See
[CPU transform validation](../implementation/cpu-release-validation.md#openpi-checkpoint-model-transforms).

The original RoboDojo normalization file has 3,407 bytes and SHA256
`ad7dea3e3d2bcdb348945fe03422ab1adccd03baf67318b1a1d153dfe8694db5`,
verified within the complete eighteen-file checkpoint inventory. Original artifact
admission and explicitly invalid derivative rejection have CPU diagnostics.
These checks provide no model inference or physical-task result. See
[checkpoint bindings](../implementation/checkpoint-bindings.md) and the
[native policy guide](../implementation/openpi-robodojo-policy.md).
