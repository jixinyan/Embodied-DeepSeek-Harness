# DSH model bindings

Selected original DSH model implementations are absorbed under `src/dsh`.
`OpenAICompatibleAdapter` reuses DSH serialization, SSE and tool-call translation for
local vLLM and remote Chat Completions endpoints. The original DSH loop owns tool
execution and retry. Local HTTP tests exercise text/images, tool results and failure
paths; no actual VLM endpoint has been evaluated.

See the [model and policy adapter guide](../../../docs/implementation/model-policy-adapters.md)
for configuration, private credentials, image resolvers, the runnable console example
and current limits. Default demo models remain scripted.

`readModelConfiguration` and `createConfiguredModels` load cloud API and vLLM bindings
from YAML/JSON, validate authentication/capabilities, connect the native image service
and return the deployment's model fields. Endpoint configuration is included in the
deployment digest without credential values. See the
[configuration guide](../../../docs/implementation/model-configuration.md) and
[examples](../../../examples/models/README.md).
