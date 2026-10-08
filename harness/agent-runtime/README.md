# Agent runtime

The TypeScript side of the EDH harness owns agent/model integration, independent
sessions, user-defined teams, explicit communication, tool exposure, planning,
task/recovery coordination, formal verification and experience management.

Modules are grouped by responsibility without an additional package-wrapper directory:

- `agents`, `teams`, `models`, `communication`: role execution and cooperation.
- `tools`, `planning`, `files`: upper-level working capabilities.
- `tasks`, `execution`, `perception`, `observation`, `verification`: the embodied task loop.
- `memory`, `storage`: context measurement/compaction, scoped evidence, experience and persistence.
- `foundation`: plugin context, native registration scopes, schema helpers and runtime support.

The [module map](../../docs/architecture/modules.md) defines each boundary.
Shared wire definitions live in [contracts](../contracts/README.md). Real policy
stepping and simulator/device providers belong to [physical-runtime](../physical-runtime/README.md).

Native upper roles, tools/TODOs, explicit communication, plans/files, verification,
recovery and storage run through the selected DSH services. Actual Qwen/learned-policy
workflows have retained-scene retry and formal-success evidence on RoboTwin,
RoboDojo and RoboCasa. BEHAVIOR preserves its observed failed task outcomes.
CPU transport, ownership, source/record readers and scoped context checks have
separate production validation. Evolver is paused and SceneState is deferred.
See the [upper-runtime guide](../../docs/implementation/upper-runtime.md),
[code map](../../docs/development/code-map.md) and
[v1 register](../../docs/implementation/v1-delivery.md).
