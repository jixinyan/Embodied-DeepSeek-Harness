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

`user.ask` lets the decision owner request missing user information at a confirmed
stopped execution boundary. It stores a question and signals native turn conclusion;
the accepted answer returns through DSH followup to the same assignment. See the
[interaction protocol and acceptance](../../../docs/implementation/user-clarification.md).

The [logical inventory](definitions/planned-tools.json) records implementation status
for the core tool pack and planned provider tools. `pnpm check:contracts` requires its
implemented IDs to match `CORE_TOOLS` exactly, checks unique IDs and validates role
references. This check reads schemas and authored definitions; it invokes no model or
physical provider. Runtime tool registration and validation remain native DSH services.
