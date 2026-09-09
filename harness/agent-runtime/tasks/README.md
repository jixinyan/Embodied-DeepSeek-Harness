# Tasks, goals and recovery

[goals.ts](src/goals.ts) binds the final task criteria, admits Planner-composed goals
from registered checks and enforces verified plan dependencies. [run-state.ts](src/run-state.ts)
projects active goal/attempt and recovery identity. UpperRun assembles these domain
rules into native DSH tools; it does not replace the agent loop.

The runner executes sequential subgoals and observes one recovery chain at a time.
Repair prerequisites can succeed while the original recovery remains open. Only the
original-goal verdict authorizes its SKILL. Learning failures do not fail the task.
Concurrent physical goals and nested independent recovery chains are not implemented.
The coordinator interfaces in src/index.ts also describe future deployment boundaries.

See [multi-goal runtime](../../../docs/implementation/multi-goal-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
