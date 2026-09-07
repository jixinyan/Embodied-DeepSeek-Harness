# models

VLM / LLM routing into DSH; no independent agent loop.

**Status:** interface skeleton only. Implementation begins in Step 00 of
[the implementation plan](../../../docs/implementation/plan.md).

- Public boundary: `src/index.ts`.
- Wire data: [contracts](../../contracts/README.md); do not maintain a second schema.
- Concrete adapters, authorization and lifecycle enforcement are not implemented.
- Module tests will accompany behavior as it is implemented; scaffold checks only
  establish valid types, references and configuration examples.

See [module responsibilities](../../../docs/architecture/modules.md) for dependencies,
source provenance and the intended direction of calls.
