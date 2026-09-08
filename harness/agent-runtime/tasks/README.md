# Task and recovery state

[run-state.ts](src/run-state.ts) defines the current observable upper state. UpperRun coordinates owner-only decisions, formal verdicts and one original-goal recovery chain. Multi-subgoal scheduling remains pending. src/index.ts includes target boundaries beyond the concrete runner.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
