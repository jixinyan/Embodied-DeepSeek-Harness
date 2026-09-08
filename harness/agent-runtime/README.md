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

**Status:** upper roles, native tools/TODOs, explicit communication, plans/files,
verification, recovery and storage run through DSH with a CPU fixture backend.
Physical providers are deferred. See the [upper-runtime guide](../../docs/implementation/upper-runtime.md).
