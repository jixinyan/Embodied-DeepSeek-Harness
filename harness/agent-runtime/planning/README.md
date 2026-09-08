# Plans and native TODOs

[workspace.ts](src/workspace.ts) stores versioned task plans with decision-owner and accepted-verdict gates. [DSH TODO](src/dsh/todo/index.ts) supplies session-local lists and history. Completing a TODO never establishes physical task success.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
