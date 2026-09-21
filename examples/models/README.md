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
