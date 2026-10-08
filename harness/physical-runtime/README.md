# Physical runtime

The Python package owns policy execution and environment/device/provider boundaries.
The optional `policy` extra supplies WebSocket inference client/server transport;
the optional `robodojo` extra supplies the external RoboDojo RPC client.

| Code location | Responsibility |
| --- | --- |
| [execution/worker.py](src/physical_harness/execution/worker.py) | Native Session, task lifecycle and execution operations; runnable worker entry point |
| [execution/worker_transport.py](src/physical_harness/execution/worker_transport.py) | Bounded host requests, pipe lifetimes and request-task failures |
| [execution/policy_records.py](src/physical_harness/execution/policy_records.py) | Original policy request and native action-record persistence |
| [execution/action_gate.py](src/physical_harness/execution/action_gate.py) | Action admission, generation, budgets and confirmed boundaries |
| [execution/native_device.py](src/physical_harness/execution/native_device.py) | Simulator owner thread, physical command receipts and stopping |
| [policies/](src/physical_harness/policies/README.md) | Policy client/server, mode normalization and checkpoint adapters |
| [policies/services/](src/physical_harness/policies/services/README.md) | Provider-specific model startup, inference records and runnable service entries |
| [environments/](src/physical_harness/environments/README.md) | Simulator observation, action, task and SDK lifecycle adapters |
| [perception/](src/physical_harness/perception/README.md) | Model-based perception and calibrated RGB-D geometry |
| [backends/](src/physical_harness/backends/README.md) | Device capabilities, connections and confirmed hardware stopping |

The worker owns its simulator and renderer on one Python execution thread, while
policy inference runs asynchronously. A retained scene serves successive Session
tasks with distinct identities. Native events preserve execution, policy request,
segment, physical step and simulation time. RoboDojo uses a separate process with
its own source license. See the [adapter guide](../../docs/implementation/model-policy-adapters.md)
and [RoboDojo guide](../../docs/implementation/robodojo-backend.md).

Executable boundary validation uses `jsonschema`. Follow the CPU-only
[development setup](../../docs/development/setup.md), then run `pnpm test:contracts`
for shared TS/Python cases or `pnpm check:python` for module import checks.

Wire schema lives in `harness/contracts/schema/physical.schema.json`. Construct
`physical_harness.validation.ContractValidator.from_path(schema_path)` with an
explicit path; Python does not maintain a second copy or infer a working directory.

This is the device/policy side of [one EDH harness](../README.md), alongside the
[agent runtime](../agent-runtime/README.md) and [shared contracts](../contracts/README.md).
The [code map](../../docs/development/code-map.md) identifies application and
runtime entry points. [CPU release validation](../../docs/implementation/cpu-release-validation.md)
and [native acceptance](../../docs/implementation/v1-delivery.md) record their
separate executable checks and evidence.
