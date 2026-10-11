# Model configuration and transport

Selected original DSH model implementations are absorbed under `src/dsh`.
`OpenAICompatibleAdapter` reuses DSH serialization, SSE and tool-call translation for
local vLLM and remote Chat Completions endpoints. `OpenAIResponsesAdapter` binds
cloud Responses endpoints through the same native DSH model service. Model
configuration declares protocol, capabilities, context capacity, output defaults,
authentication and image limits. Native DSH owns streaming, tool execution,
model retries and cancellation.

`src/model-failures.ts` owns shared HTTP error admission for both adapters.
Bounded JSON error fields identify explicit context overflow and terminal quota
conditions; HTTP status retains authority for authentication, rate limits,
server errors and timeouts. The error retains status, request ID and positive
`Retry-After` timing without exposing provider prose. Responses failure events
use the same structured code/type classification. Adapters make one request;
native DSH extensions own recovery. The
[CPU failure checks](../../../docs/implementation/cpu-release-validation.md#model-failure-admission)
separate authored classification checks and actual production HTTP errors from
loaded-model/context-recovery acceptance. Field definitions follow the official
[Response error type](https://github.com/openai/openai-python/blob/main/src/openai/types/responses/response_error.py)
and [stream error type](https://github.com/openai/openai-python/blob/main/src/openai/types/responses/response_error_event.py).
Quota codes and retry guidance follow the official
[API error guide](https://developers.openai.com/api/docs/guides/error-codes).

`src/model-images.ts` owns shared image-reference and request-version admission.
Both adapters check the intrinsic attachment identity, complete request metadata,
encoded byte length and cancellation, then retain detached metadata/data snapshots.
Display names and original-dimension annotations may differ for the same image.
The native DSH attachment service owns image decoding, normalization, compression
and storage. `src/responses-input.ts` owns Responses message conversion and caches
each image once per request. Each represented occurrence counts toward its image
and byte budgets; the complete serialized request has a separate final byte check.
Chat Completions keeps the selected native DSH image serializer and offloading.
The [original-image CPU diagnostic](../../../docs/implementation/cpu-release-validation.md#model-image-request-admission)
checks actual stored contexts and image services without HTTP/model requests.

`src/responses-function-calls.ts` admits Responses function-call event fields,
sequence order, output/item/call identities and complete argument consistency.
The adapter requires streamed calls to agree with completed response output before
DSH dispatch. Replay output follows the function calls retained in the native DSH
message, including after token truncation or context pruning. SSE decoding uses
the installed `eventsource-parser`; this module owns protocol admission only.
Field definitions follow the official [streaming event reference](https://developers.openai.com/api/reference/resources/responses/streaming-events)
and [function-call type](https://github.com/openai/openai-python/blob/main/src/openai/types/responses/response_function_tool_call.py).
The [recorded CPU diagnostic](../../../docs/implementation/cpu-release-validation.md#responses-function-call-and-replay-admission)
preserves original output, argument segments and journal identities without model
requests. Actual provider streaming retains its native acceptance requirement.

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

Configuration reading checks protocol-specific request options. Nondefault
Chat Completions role/token/reasoning/tool/extension settings require that protocol.
Responses uses its native instructions, output-token field and replay. The
authored [configuration tests](../../../tests/runtime/model-request-options.test.ts)
exercise the published model files without provider allocation.

Per-Session context measurement and compaction belong to
[memory](../memory/README.md). Model adapters supply route metadata and declared
image pricing to those native services.
