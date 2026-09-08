# User-defined teams

[loader.ts](src/loader.ts) loads team YAML and ROLE.md, checks model/tool/provider availability and role path containment, and freezes resolved bindings. Configuration is not executable provider loading; application assembly supplies native factories.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
