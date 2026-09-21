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

[history.ts](src/history.ts) publishes immutable events and versioned run projections,
reads bounded event pages and reconstructs full history on request. Active UpperRun
state contains an empty event array and its published count. Full event inspection
uses `snapshot()` or the paginated HTTP history endpoint. Event publication does not
impose a task-lifetime event count limit. See the [event guide](../../../docs/implementation/run-stream.md).

[recovery-history.ts](src/recovery-history.ts) persists selected event references,
reads recovery progress in bounded pages, and reconstructs complete recovery traces
for explicit inspection. Original run events remain the authoritative bodies.
See [recovery delivery](../../../docs/implementation/multi-goal-runtime.md#recovery-progress-storage-and-delivery).

[assignment-history.ts](src/assignment-history.ts) archives retired assignment payloads
and checks exact read-back before compacting their run summaries. TeamSessions uses
the durable brief reader after native retirement. The console reads selected details,
TODOs and last observations through a run-scoped HTTP endpoint. See
[assignment history](../../../docs/implementation/assignment-history.md).

See [multi-goal runtime](../../../docs/implementation/multi-goal-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
