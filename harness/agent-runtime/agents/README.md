# agents

Independent role sessions backed by selected DSH implementations.

**Status:** interface skeleton only. Implementation begins in Step 03 of
[the implementation plan](../../../docs/implementation/plan.md).

- Public boundary: `src/index.ts`.
- Wire data: [contracts](../../contracts/README.md); do not maintain a second schema.
- Concrete adapters, authorization and lifecycle enforcement are not implemented.
- Module tests will accompany behavior as it is implemented; scaffold checks only
  establish valid types, references and configuration examples.

See [module responsibilities](../../../docs/architecture/modules.md) for dependencies,
source provenance and the intended direction of calls.

## Step 00 runtime seam

[createDshSession](src/runtime.ts) now creates an actual scoped session using the
absorbed DSH factory. It installs the supplied instructions/tools before publication
and returns the native owned handle. It is a trusted host primitive; the Team-level
AgentFactory, InvocationBrief validation and role permissions remain future work.
See [integration evidence](../../../docs/implementation/dsh-integration.md).
