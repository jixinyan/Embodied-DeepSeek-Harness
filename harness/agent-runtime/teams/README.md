# User-defined teams

[loader.ts](src/loader.ts) loads team YAML and ROLE.md, checks model/tool/provider availability and role path containment, and freezes resolved bindings and role-local DSH result schemas. Every role receives the framework report/query tools. Configuration is not executable provider loading; application assembly supplies native factories.

The available tool list must have valid logical IDs and distinct native names.
The tools module owns that admission, including DSH's reserved transport name.
Deployment additions also require distinct names across the complete core pack.

Decision-owner and formal-verifier bindings also select their shared numbered
workflows. Their contents contribute to the Team source digest. See
[prompt composition and schemas](../../../docs/implementation/prompt-workflow.md).

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
