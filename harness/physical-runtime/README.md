# Physical runtime

The Python package owns policy execution and environment/device/provider boundaries.
The optional `policy` extra supplies a WebSocket inference client/server wrapper.
Execution includes a deterministic action gate and bounded PolicyRollout composition.
The native worker owns a simulator and its renderer on one Python execution thread,
while policy inference runs asynchronously. Its host connection carries bounded
requests and publishes status after actual control-command boundaries. A retained
scene can serve successive session tasks with distinct run identities. RoboCasa
reset, three-camera capture, native checks, and host process-fault handling have
been exercised in the isolated GPU environment. A learned-policy action remains
pending service acceptance.
See the [adapter guide and runnable example](../../docs/implementation/model-policy-adapters.md).

Executable boundary validation now uses `jsonschema`. Follow the CPU-only
[development setup](../../docs/development/setup.md), then run `pnpm test:contracts`
for shared TS/Python cases or `pnpm check:python` for module import checks.

Wire schema lives in `harness/contracts/schema/physical.schema.json`. Construct
`physical_harness.validation.ContractValidator.from_path(schema_path)` with an
explicit path; Python does not maintain a second copy or infer a working directory.

This is the device/policy side of [one EDH harness](../README.md), alongside the
[agent runtime](../agent-runtime/README.md) and [shared contracts](../contracts/README.md).
