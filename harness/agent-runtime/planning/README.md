# Plans and native TODOs

[workspace.ts](src/workspace.ts) stores versioned task plans with decision-owner and accepted-verdict gates. [DSH TODO](src/dsh/todo/index.ts) supplies session-local lists and history. Completing a TODO never establishes physical task success.

`TaskPlans.nextWrite` returns complete structured write arguments without changing
the journal. Initial arguments contain the required final goal, actual owner/task
identities and its unchanged criterion. Subsequent arguments clone every existing
item and advance the version once. `planning.read.planWrite` exposes those arguments
to the decision owner; Planner edits descriptions, statuses and dependencies before
calling `planning.update`. The ordinary schema, authority, criteria, dependency and
accepted-verdict checks apply at write time. A template grants no execution authority.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
