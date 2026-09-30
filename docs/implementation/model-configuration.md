# Cloud API and vLLM model configuration

The upper runtime supports cloud and local vLLM endpoints. `chat_completions`
selects `OpenAICompatibleAdapter`; `responses` selects `OpenAIResponsesAdapter`,
including GPT-6 Astra tool calling. Both use the native DSH loop, message/image
serialization, streamed output and tool-call translation.
The configured model must support image input and automatic tool calling for Planner
perception/planning. Endpoint configuration does not evaluate those model capabilities.

## Load and assemble

`readModelConfiguration(path)` reads YAML or JSON with strict field validation.
`parseModelConfiguration(value)` accepts an already decoded document.
`createConfiguredModels(configuration, { images })` produces the `defaultModel`,
`models`, `adapters` and `modelConfigurationDigest` fields of `ServerDeployment`.

Inside an existing deployment factory, load the selected model file, pass that
factory's `DeploymentServices.images`, and spread the returned fields into the
deployment object:

```ts
const modelConfiguration = await readModelConfiguration(modelConfigurationPath);
const upperModels = createConfiguredModels(modelConfiguration, services);
return { ...physicalDeployment, ...upperModels };
```

`physicalDeployment` contains the installed team, tasks, tools, launch profiles and
physical provider factories. Its explicit role/profile model aliases must exist in
the selected model file. The desktop launcher can load this same deployment factory;
its optional environment file supplies credentials before the factory executes.

Examples keep alias `brain` for both [cloud](../../examples/models/cloud-api.yaml)
and [vLLM](../../examples/models/local-vllm.yaml). Change the selected file or its
endpoint/model settings to change inference hosting. Teams may also bind different
roles to named cloud and vLLM aliases from one configuration. Session launch choices
continue to use installed complete launch profiles and their existing validation.

## Fields

| Field | Behavior |
| --- | --- |
| `version` | Configuration format, currently `1` |
| `defaultModel` | Existing alias in `models` |
| `endpoints.<id>.hosting` | `cloud_api` or `vllm`; describes deployment location |
| `endpoints.<id>.protocol` | `chat_completions` (default) or `responses`; selects the transport adapter |
| `baseURL` | HTTP(S) API root; includes `/v1` where required; credentials/query/fragment are rejected |
| `authentication` | Explicit `{ type: none }` or `{ type: environment, variable: ENV_NAME }` |
| `systemRole` | Chat Completions: `system` by default; configurable as `developer`. Responses uses `instructions`. |
| `maxTokensField` | Chat Completions: `max_tokens` by default; configurable as `max_completion_tokens`. Responses uses `max_output_tokens`. |
| `timeoutMs` | Positive request deadline; default 120,000 ms |
| `maxRequestBytes`, `maxResponseBytes` | Encoded transport limits; each defaults to 32 MiB |
| `maxImagesPerRequest` | Default 16 image blocks |
| `imageRequest` | Request-image projection policy; default 1,048,576 pixels and 2 MiB encoded-byte target |
| `passReasoningContent` | Chat Completions opt-in for endpoints requiring reasoning-content history replay; Responses preserves returned output items. |
| `extraBody` | Chat Completions generation extensions, including vLLM `chat_template_kwargs`; cannot replace DSH messages/model/tools/generation fields |
| `models.<alias>.endpoint` | Existing endpoint ID |
| `models.<alias>.model` | Exact cloud model ID or vLLM served model name |
| `inputModalities` | Explicit unique list including `text`; include `image` for visual roles |
| `name`, `contextWindow`, `maxTokens` | Optional display name, model capacity and default output-token limit |
| `reasoningEffort` | Optional role/model binding: `low`, `medium`, `high`, `xhigh` or `max` |

All endpoints must have model bindings. Aliases can share one served model when
their declared capabilities agree. Unknown fields, routes, defaults and conflicting
capabilities fail assembly. The image-request byte setting is the native attachment
projection target; the overall transport byte limit remains independently enforced.

For a vLLM server with authentication enabled, use an environment credential exactly
as for a cloud endpoint. Cloud deployments can explicitly select no authentication
when their gateway permits it. No implicit cloud/local authentication defaults apply.
The server address may name a local process or a GPU server on another host.

The vLLM deployment must configure a compatible chat template and tool parser for
its checkpoint. Automatic tool calling requires the server's appropriate options;
consult the [vLLM tool-calling documentation](https://docs.vllm.ai/en/stable/features/tool_calling/).
Native Anthropic/Gemini protocols require their respective adapters.

## Credentials, images and configuration identity

Authentication configuration stores environment-variable names, never API-key values. Assembly
checks configured credentials immediately. Each request reads the current value,
allowing rotation without serializing the credential. Missing/invalid values report
`MISSING_CREDENTIAL` before a network request. HTTP authentication uses Bearer tokens.

Image-capable bindings require the application-owned attachment service. Every
configured adapter resolves admitted image references through `readImageRequest` with
its selected projection policy. Sensor IDs remain in the agent history; actual request
image bytes are supplied when the native serializer constructs the model request.
The original observation/evidence permission checks remain in the upper application.

Responses preserves images returned by tools as `input_image` items in the
corresponding `function_call_output`, alongside textual evidence metadata. A
Planner capture, Verifier check or other authorized image-producing tool therefore
uses the same immutable attachment resolver and request-image limits as an image
in a user message. Model-call history retains provider output items for subsequent
tool rounds. See the official [function-calling guide](https://developers.openai.com/api/docs/guides/function-calling).

`modelConfigurationDigest` hashes the validated configuration and its defaults,
including endpoint address, credential-variable name, capability and request options.
Secret values are excluded. `prepareDeployment` includes this digest in its immutable
metadata and deployment identity; HTTP configuration and stored run configurations
retain it. Changing the endpoint/configuration therefore changes admission identity.
Credential rotation alone preserves it. Keep all returned fields when assembling the
deployment. Executable provider changes still require the deployment's version update.

## Acceptance

`pnpm test:model-configuration` executes seven checks with authored YAML/JSON, real
environment lookup, native DSH model registration and actual attachment-service
lifetime. It covers cloud and vLLM together, capabilities, configuration isolation,
invalid fields/URLs, authenticated vLLM, credential removal before dispatch and configuration
digests. Both bindings read the actual project PNG through the image service and enforce
a configured request byte limit before network dispatch.
No model server, generated response, physical backend or simulated network peer is used.

Live cloud/vLLM inference, visual perception and tool-use quality remain acceptance
requirements once services are available. Existing transport behavior and its limits
are described in the [adapter guide](model-policy-adapters.md).
