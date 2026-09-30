set -euo pipefail

: "${EDH_VLLM_ENV:?Set the isolated vLLM environment directory}"
: "${EDH_QWEN_CHECKPOINT:?Set the Qwen3.8-27B checkpoint directory}"
: "${EDH_MODEL_GPU:?Select the inference GPU devices}"
: "${EDH_MODEL_WORK:?Set an ignored runtime working directory}"
: "${EDH_MODEL_IPC_DIRECTORY:?Set a short ignored directory for local process sockets}"

mkdir -p "$EDH_MODEL_IPC_DIRECTORY" "$EDH_MODEL_WORK/cache"
export TMPDIR="$EDH_MODEL_IPC_DIRECTORY"
export VLLM_RPC_BASE_PATH="$EDH_MODEL_IPC_DIRECTORY"
export VLLM_CACHE_ROOT="$EDH_MODEL_WORK/cache"
export CUDA_VISIBLE_DEVICES="$EDH_MODEL_GPU"

exec "$EDH_VLLM_ENV/bin/vllm" serve "$EDH_QWEN_CHECKPOINT" \
  --host 127.0.0.1 --port "${EDH_MODEL_PORT:-18080}" \
  --served-model-name Qwen/Qwen3.8-27B \
  --dtype bfloat16 --tensor-parallel-size "${EDH_MODEL_TP:-1}" \
  --max-model-len "${EDH_MODEL_CONTEXT:-131072}" \
  --max-num-seqs "${EDH_MODEL_MAX_SEQS:-8}" \
  --gpu-memory-utilization "${EDH_MODEL_MEMORY_FRACTION:-0.4}" \
  --attention-backend "${EDH_MODEL_ATTENTION:-FLASH_ATTN}" \
  --limit-mm-per-prompt '{"image":12,"video":0}' \
  --enable-auto-tool-choice --tool-call-parser qwen3_xml \
  --reasoning-parser qwen3
