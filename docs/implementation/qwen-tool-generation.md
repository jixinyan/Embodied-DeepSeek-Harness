# Qwen tool generation

Validated: 2026-10-07. This acceptance uses the actual Qwen3.8-27B checkpoint,
vLLM 0.30.0, XGrammar 0.2.7 and the native DSH model transport. Tools are inspected
and generated without dispatch; these diagnostics produce zero physical controls.

## Deployment behavior

The Qwen launcher loads
[qwen-bounded-tools.py](../../examples/models/qwen-bounded-tools.py) and selects
`edh_qwen3_xml`. This parser inherits vLLM's `Qwen3EngineToolParser`, including
native XML argument parsing and structural-tag construction. It deep-copies the
native tag and sets `max_whitespace_cnt` on its `qwen_xml` parameter formats.
Each tool's JSON schema, required fields, argument values and surrounding tag
structure retain their native definitions. DSH continues to serialize, stream,
validate and dispatch the tools.

`EDH_QWEN_MAX_WHITESPACE` defaults to 16 and accepts integers from 1 to 1024.
It limits consecutive grammar whitespace between parameter elements. The adapter
does not truncate JSON string values or change their schemas. Invalid settings
and unsupported native parameter formats fail at their source. Requests without
a native structural tag preserve that native result.

Strict tools remain enabled, tool choice remains `auto`, Qwen reasoning remains
enabled and the completion budget remains 8,192 tokens. The complete admitted
plan is still validated by EDH before `planning.update` executes.

XGrammar documents this setting in its
[structural-tag guide](https://github.com/mlc-ai/xgrammar/blob/main/docs/structural_tag/tool_calling_and_reasoning.md).
The official [empty-parameter issue](https://github.com/mlc-ai/xgrammar/issues/802)
and [whitespace discussion](https://github.com/mlc-ai/xgrammar/pull/837) identify
the relevant native grammar behavior. The proposed upstream fix remains open at
the review date; this EDH deployment uses the existing supported grammar setting.

## Actual full-context acceptance

Source Session: `b4c218de-5185-43bb-80c8-225b701c7979`.
Planner assignment: `8f7cc3b1-73fa-4824-a605-d3b8660d5cb2`.
The unchanged native audit prefix ends before the final model step, at sequence
103. Native Session derivation produces 39 messages; actual image serialization
produces 42 wire messages, nine original image attachments and 26 tool schemas.
The actual model reports 38,069 input tokens. The request SHA-256 is
`a947adfb719dea433182085dfe575d5f0b50e7e222f7d7ab664433a22207c678`.

| Actual call | Input tokens | Completion tokens | Elapsed seconds | Accepted output |
| --- | --- | --- | --- | --- |
| HTTP, bounded grammar | 38,069 | 54 | 1.164181 | One `tasks__finish` call with `{}` |
| Repeated HTTP, bounded grammar | 38,069 | 47 | 1.187034 | One `tasks__finish` call with `{}` |
| Native DSH stream, bounded grammar | 38,069 | 59 | 9.699174 | One translated tool-call block with `{}` and native `tool-calls` finish |

All calls preserve the original 8,192-token budget. Actual token IDs, HTTP
responses, decoded generation and DSH stream chunks are retained. Native DSH
also retains the model's returned reasoning. These timings are individual
diagnostics; they do not establish complete-task latency or a new task outcome.

The native grammar reference on this same context consumes 8,192 output tokens
and 155.432185 seconds. Its retained raw token sequence repeatedly emits carriage
returns in the empty parameter area. The original task audit separately records
its own model-step duration; original task success and retry evidence are retained
in [single-GPU native acceptance](single-gpu-native-acceptance.md).

The production grammar checker verifies all 26 original parameter schemas,
permits only the whitespace setting to differ and compiles the resulting tag with
the actual checkpoint tokenizer. Native tag SHA-256:
`93a088a5a85e0bd0c82132f6532bcda64360f4622a5413c0f1d61430cdcbf0f4`.
Bounded tag SHA-256:
`5b46c8456270c2be730d63988744cb3b2ffe886d63c6a8b8c0069513c7428f8e`.

## Reproduce read-only checks

Use the installed isolated model environment and actual retained request. Generated
outputs require new private directories. `wire-request.json` contains the actual
serialized model request; `native-request.json` contains the native audit header.

```sh
"<vllm-environment>/bin/python" scripts/check-qwen-tool-whitespace.py \
  --request .local/work/qwen-full-context-20261007/wire-request.json \
  --checkpoint "<workspace>/checkpoints/Qwen3.8-27B" \
  --output .local/work/qwen-grammar-check

"<vllm-environment>/bin/python" scripts/check-qwen-tool-generation.py \
  --request .local/work/qwen-full-context-20261007/wire-request.json \
  --checkpoint "<workspace>/checkpoints/Qwen3.8-27B" \
  --base-url http://127.0.0.1:18080/v1 \
  --expected-tool tasks__finish \
  --output .local/work/qwen-generation-check

pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-recorded-plan-model.mjs \
  --events "<retained-task-directory>/events.json" \
  --configuration "<retained-acceptance-directory>/configuration.json" \
  --models examples/models/qwen38-vllm.yaml \
  --profile robodojo-general_pickup-pi05 --member lead \
  --native-request .local/work/qwen-full-context-20261007/native-request.json \
  --output .local/work/qwen-plan-check
```

The plan checker uses the recorded role's complete native header and actual
`planning.read` receipt. HTTP and native DSH streaming each exercise strict
`auto` and `required` tool selection. Returned `planning__update` arguments must
equal the original `planWrite`, preserving the full nested object, admitted
identities, versions, items and criteria. The checker executes no tools.
All four actual responses pass complete schema validation and exact `planWrite`
comparison, with returned Qwen reasoning retained. The source-bound acceptance
is stored in `planning-native-schemas-preserved/result.json`.

## Resource and evidence scope

This deployment uses only physical GPU 2, UUID
`GPU-aa3aa801-a799-81e2-996e-e949b2405898`. Process ancestry, creation identity and
NVIDIA XML verify the actual Qwen engine placement. No simulator or policy runs
as part of these diagnostics. GPU selection remains deployment configuration.

Original requests, raw generations, stream chunks, grammar checks, plan checks
and device/service records are retained under
`.local/work/qwen-full-context-20261007/` on the GPU host and local checkout.
Both owned model services stop after zero running and waiting requests. Their
recorded process groups exit; the final NVIDIA XML contains no owned Qwen engine
context. `service-77545-closed.json`, `service-92824-closed.json`,
`gpu-after-close.xml` and `evidence-acceptance.json` retain the closure checks.
Unrelated workloads retain their ownership.
These files remain outside Git. Further multi-goal task acceptance, original
Tower completion, BEHAVIOR success and release gates remain in the
[v1 register](v1-delivery.md).
