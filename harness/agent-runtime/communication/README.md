# communication

Explicit delegation, context requests and durable scoped messages.

**Status:** interface skeleton only. Implementation begins in Step 04 of
[the implementation plan](../../../docs/implementation/plan.md).

- Public boundary: `src/index.ts`.
- Wire data: [contracts](../../contracts/README.md); do not maintain a second schema.
- Concrete adapters, authorization and lifecycle enforcement are not implemented.
- Module tests will accompany behavior as it is implemented; scaffold checks only
  establish valid types, references and configuration examples.

See [module responsibilities](../../../docs/architecture/modules.md) for dependencies,
source provenance and the intended direction of calls.
