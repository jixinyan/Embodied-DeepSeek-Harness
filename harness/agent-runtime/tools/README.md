# Tools

Native tool authoring, registration, dispatch and input/output validation come from
DSH. `@edh/tools` re-exports the exact native `defineTool` function and tool types.
Register the result in the DSH agent scope; no additional EDH generic executor exists.
The host/runtime tests exercise this path, including scalar results and invalid input/output.

EDH's `PhysicalToolCatalog` and `PhysicalToolProvider` are unimplemented provider
metadata/transport interfaces below a future DSH tool body. The `PhysicalToolCall`,
`PhysicalToolDefinition` and `PhysicalToolResult` aliases describe that domain wire
boundary. Ordinary native tools do not need these envelopes. A physical adapter adds
job identity, evidence, resources, budgets and device acknowledgement.

See [reuse decision](../../../docs/implementation/decisions/0003-reuse-dsh-mechanisms.md),
[native runtime integration](../../../docs/implementation/dsh-integration.md) and
[physical boundary checks](../../../docs/implementation/boundaries.md).

Upper tool definitions use the original DSH validator explicitly before domain
effects. Raw ToolDefinition does not acquire argument validation merely by declaring
parameters; defineTool wraps this automatically. Role result schemas use the same
native supported subset. EDH separately enforces input-size and version limits.
