# Physical runtime

The Python package owns policy execution and environment/device/provider boundaries.
The optional `policy` extra supplies a WebSocket inference client/server wrapper.
Execution includes a deterministic action gate and bounded PolicyRollout composition.
These run with CPU fixtures; no host RPC worker, learned policy, simulator, SAM model
or hardware driver is included. Environment directories do not indicate support.
See the [adapter guide and runnable example](../../docs/implementation/model-policy-adapters.md).

Executable boundary validation now uses `jsonschema`. Follow the CPU-only
[development setup](../../docs/development/setup.md), then run `pnpm test:contracts`
for shared TS/Python cases or `pnpm check:python` for module import checks.

Wire schema lives in `harness/contracts/schema/physical.schema.json`. Construct
`physical_harness.validation.ContractValidator.from_path(schema_path)` with an
explicit path; Python does not maintain a second copy or infer a working directory.

This is the device/policy side of [one EDH harness](../README.md), alongside the
[agent runtime](../agent-runtime/README.md) and [shared contracts](../contracts/README.md).
