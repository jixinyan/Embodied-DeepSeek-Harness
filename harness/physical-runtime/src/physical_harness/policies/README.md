# Policy services

`SubgoalPolicy` defines `infer(request)` and `close()`. `WebSocketPolicyClient` sends
one bounded EDH JSON request at a time. `serve_policy` validates the request and
response and exposes a deployment-owned inference callback. The two providers below
use a single inference thread and keep it reserved until GPU work finishes, including
when the requesting client disconnects.

## GR00T N1.6 for RoboCasa PandaOmron

The adapter in `gr00t_n1d6_robocasa.py` uses
`NVIDIA/Isaac-GR00T` branch `n1d6` at commit
`9b37aa1ce69c73c6d165233fa88128283bba4508` and
`nvidia/GR00T-N1.6-3B` at revision
`d0814e7ecb19202e7c8468b46098b0b7ef3a6d61`. The checkpoint's
`ROBOCASA_PANDA_OMRON` processor defines three 256×256 RGB cameras, five
proprioception groups, and 16-step actions. The exact camera, state, and native
12-channel action mapping is recorded in
[`examples/policies/gr00t-n1d6-robocasa.json`](../../../../../examples/policies/gr00t-n1d6-robocasa.json).

Install the pinned upstream source and `edh-physical-harness[policy]` in a dedicated
Python 3.12 environment. The upstream package installs PyTorch 2.7.1 with CUDA 12.8.
It also imports DeepSpeed, which requires the CUDA 12.8 compiler in `CUDA_HOME`.
Keep this compiler in a separate user-owned directory; do not change a host CUDA or
driver installation. Start the service from the repository root with the checkpoint
and compiler paths set for the host:

```sh
CUDA_HOME=/path/to/cuda-12.8 \
CUDA_VISIBLE_DEVICES=3 \
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
python examples/policies/serve_gr00t_n1d6_robocasa.py \
  --checkpoint /path/to/checkpoints/gr00t/base/GR00T-N1.6-3B \
  --host 127.0.0.1 --port 8003 --device cuda:0
```

The RoboCasa worker supplies the three PNG camera frames and the five native
proprioception arrays. It also supplies the full `ActionSpec` for
`robosuite.hybrid_mobile_base` at 20 Hz. The service rejects mismatched mappings,
nonfinite output, or actions outside the controller bounds. It converts the
checkpoint's gripper and control-mode probabilities with the official PandaOmron
threshold of 0.5.

## LeRobot π0.5 for RoboTwin Aloha-AgileX

The adapter in `lerobot_pi05_robotwin.py` uses `huggingface/lerobot` version 0.6.1
at commit `7e241bd630a3719a56157a497ce5d08f244784f1` and the Apache-2.0
checkpoint `SidneyXie/pi05_robotwin` at revision
`e49e2ab6c11f07511573b67261bd129e88d0a416`. Its saved processor requires
the gated `google/paligemma-3b-pt-224` tokenizer. Download that tokenizer through
an authorized Hugging Face account at revision
`35e4f46485b4d07967e7e9935bc3786aad50687c`; store it under the checkpoint
directory. The adapter verifies the six tokenizer files by SHA-256, loads all model
parameters with strict key matching, and uses the saved preprocessor, postprocessor,
and action normalization. The complete camera, state, and 14-channel joint target
mapping is recorded in
[`examples/policies/lerobot-pi05-robotwin.json`](../../../../../examples/policies/lerobot-pi05-robotwin.json).

Install `lerobot[pi]==0.6.1` and `edh-physical-harness[policy]` in a dedicated
Python 3.12 environment. Start the service with local checkpoint and tokenizer
directories:

```sh
CUDA_VISIBLE_DEVICES=4 \
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
python examples/policies/serve_lerobot_pi05_robotwin.py \
  --checkpoint /path/to/checkpoints/lerobot/robotwin/pi05_robotwin \
  --tokenizer /path/to/checkpoints/lerobot/paligemma-3b-pt-224 \
  --host 127.0.0.1 --port 8004 --device cuda:0
```

The RoboTwin worker supplies three 640×480 RGB PNG cameras and its 14-value
`joint_action.vector` of native drive targets. The service accepts only the exact
`robotwin.qpos_target` `ActionSpec`, returns absolute joint targets, and rejects
nonfinite values or targets outside the declared joint ranges.

Both services emit one JSON record per completed inference with checkpoint
identity, request and execution identifiers, observation identifier, reception and
completion timestamps, duration, and returned action chunk. `checkpoint_identity`
hashes the actual weight, processor, and configuration files. The known repository
revision is recorded only when every hash matches the checked manifest; another
compatible checkpoint records a local `checkpoint_digest`, its individual weight
hashes, and a null revision. Service startup also records the listening address.

On 2026-09-23, the GR00T service loaded on an NVIDIA H20G and processed a
genuine RoboCasa OpenCabinet observation into 16 native 12-channel actions.
In a complete worker check, RoboCasa confirmed six native control commands and
150 MuJoCo physics steps for the same execution; the environment reported
`task_success=false`. The LeRobot π0.5 service loaded its complete weights,
local tokenizer, and saved processors and listened on an NVIDIA H20G. Its
RoboTwin observation-to-action check awaits a native simulator reset. The
deployment keeps raw service logs under its ignored `.local/work` directory.
