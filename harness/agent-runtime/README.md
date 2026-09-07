# Agent runtime

The TypeScript side of the EDH harness owns agent/model integration, independent
sessions, user-defined teams, explicit communication, tool exposure, planning,
task/recovery coordination, formal verification and experience management.

Modules are grouped by responsibility without an additional package-wrapper directory:

- `agents`, `teams`, `models`, `communication`: role execution and cooperation.
- `tools`, `planning`, `files`: upper-level working capabilities.
- `tasks`, `execution`, `perception`, `observation`, `verification`: the embodied task loop.
- `memory`, `storage`: scoped evidence, experience and persistence.
- `foundation`: plugin context, schema helpers and runtime support.

The [module map](../../docs/architecture/modules.md) defines each boundary.
Shared wire definitions live in [contracts](../contracts/README.md). Real policy
stepping and simulator/device providers belong to [physical-runtime](../physical-runtime/README.md).

**Status:** selected DSH source is absorbed and the Step 00 host/session seam is
verified. Team-level and physical capabilities are still interfaces. See the
[integration guide](../../docs/implementation/dsh-integration.md).
