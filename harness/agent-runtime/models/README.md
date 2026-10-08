# Model configuration and transport

Selected original DSH model implementations are absorbed under `src/dsh`.
`OpenAICompatibleAdapter` reuses DSH serialization, SSE and tool-call translation for
local vLLM and remote Chat Completions endpoints. `OpenAIResponsesAdapter` binds
cloud Responses endpoints through the same native DSH model service. Model
configuration declares protocol, capabilities, context capacity, output defaults,
authentication and image limits. Native DSH owns streaming, tool execution,
model retries and cancellation.

See the [model and policy adapter guide](../../../docs/implementation/model-policy-adapters.md)
for endpoint configuration, private credentials, image resolvers and policy
boundaries. Actual local Qwen and cloud Astra workflows have independent native
task evidence in the [v1 register](../../../docs/implementation/v1-delivery.md).
Each record identifies its model route, source, task and remaining acceptance.

`readModelConfiguration` and `createConfiguredModels` load cloud API and vLLM bindings
from YAML/JSON, validate authentication/capabilities, connect the native image service
and return the deployment's model fields. Endpoint configuration is included in the
deployment digest without credential values. See the
[configuration guide](../../../docs/implementation/model-configuration.md) and
[examples](../../../examples/models/README.md).

Per-Session context measurement and compaction belong to
[memory](../memory/README.md). Model adapters supply route metadata and declared
image pricing to those native services.
