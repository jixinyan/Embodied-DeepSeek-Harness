# Upper model configurations

- [cloud-api.yaml](cloud-api.yaml): a cloud OpenAI-compatible API with an environment
  credential. Replace the illustrative provider address and model name with actual values.
- [local-vllm.yaml](local-vllm.yaml): a vLLM server at the configured loopback address.
  `local-vlm` must match that server's served model name. This file does not launch vLLM.

Both files keep the `brain` model alias so Team/Role references remain stable when
the selected configuration changes. JSON files accept the same fields. A configuration
can contain multiple endpoints and model aliases, including cloud and vLLM together.

Use `readModelConfiguration` and `createConfiguredModels` from `@edh/models` in the
deployment factory. See the [configuration API](../../docs/implementation/model-configuration.md)
for assembly, authentication, image resolution and acceptance limits. Model configuration
does not install physical providers or declare checkpoint/embodiment compatibility.

## Live Qwen camera and tool checks

The GPU-host acceptance on 2026-09-23 used an isolated Python 3.12 environment with
vLLM 0.30.0, PyTorch 2.13.0 and Transformers 5.17.0. The locally supplied
checkpoint reports `model_type=qwen3_5` and
`Qwen3_5ForConditionalGeneration`. It was served as `qwen3.8-27b` through
Chat Completions on loopback port 8002. The deployment used a 32,768-token
model context and a 2,048-token completion limit in DSH. The DSH check installs
context management with a compaction threshold of 0.7, a retention ratio of
0.15, 4,096 headroom tokens, an 8,192-token compaction response limit and a
12-image visual history limit. Its short test turns do not trigger compaction.

From the repository root, with the isolated vLLM executable and checkpoint
paths supplied by the deployment:

```sh
mkdir -p .local/work
export TMPDIR="$PWD/.local/work"
export HF_HOME="<workspace>/cache/huggingface"
export VLLM_CACHE_ROOT="<workspace>/cache/vllm"
export CUDA_VISIBLE_DEVICES="<selected-gpu>"
export VLLM_USE_FLASHINFER_SAMPLER=0
"<vllm-environment>/bin/vllm" serve "<checkpoint>" \
  --host 127.0.0.1 --port 8002 --served-model-name qwen3.8-27b \
  --dtype bfloat16 --max-model-len 32768 --max-num-seqs 8 \
  --gpu-memory-utilization 0.45 --attention-backend FLASH_ATTN \
  --enable-auto-tool-choice --tool-call-parser qwen3_coder \
  --reasoning-parser qwen3
```

With a real RoboCasa PandaOmron camera PNG saved by the simulator checker,
both checks consume that same frame:

```sh
"<vllm-environment>/bin/python" examples/models/check-qwen38-native.py \
  --base-url http://127.0.0.1:8002/v1 --model qwen3.8-27b \
  --camera .local/work/robocasa-installation/robot0_agentview_left.png
EDH_MODEL_BASE_URL=http://127.0.0.1:8002/v1 \
EDH_MODEL=qwen3.8-27b \
EDH_CAMERA_PATH="$PWD/.local/work/robocasa-installation/robot0_agentview_left.png" \
pnpm exec tsx --tsconfig tsconfig.runtime.json \
  examples/models/live-robocasa-camera.mjs
```

The native check requires a function call followed by a final visual response.
The DSH check runs independent Planner and Verifier turns. Each turn requires
one tool call, a matching tool result containing the admitted image attachment,
and a completed DSH turn. This acceptance uses a static reset frame. Simulator
task execution and formal environment checks are recorded with the physical
provider acceptance.
