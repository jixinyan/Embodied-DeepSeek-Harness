# Tasks, goals and recovery

[goals.ts](src/goals.ts) binds the final task criteria, admits Planner-composed goals
from registered checks and enforces verified plan dependencies. [run-state.ts](src/run-state.ts)
projects active goal/attempt and recovery identity. UpperRun assembles these domain
rules into native DSH tools; it does not replace the agent loop.

## Goal binding admission

[goal-binding.ts](src/goal-binding.ts) provides `parseGoalBinding(value, validator)`
for configured and Planner-created goals. It validates goal identity, configuration,
entity names and bindings, capability and task-semantic arrays, and exact object fields.
Text entries must contain non-whitespace content; empty maps/arrays remain valid when
the task requires none. Goal IDs use the wire identifier syntax and 128-character limit.
The shared `SuccessContract` and `Budget` validators own criteria and budget validation,
including unique check IDs, finite positive time and safe-integer control-step limits.
Returned values are detached copies.

TaskGoals validates the root and every predefined goal during construction, before
deployment allocates a backend. Each task retains at most 64 goal identities across
configuration and subsequent plans. Planner preparation validates the plan and derived
bindings before UpperRun writes it through TaskPlans. New Planner goals inherit the
root's environment bindings, capabilities and budget, use registered predicates and
append their description to task semantics. TaskPlans continues to enforce plan ownership,
versions, dependencies and already-executed criteria.

After a successful plan write, batch admission validates every binding and capacity
before updating the catalog. Existing identities require exact unchanged bindings;
invalid batches change no catalog entries. Reads, prepared values and catalog entries
are independent copies. Deployment uses this same admission path for its preset goals.

`pnpm test:goal-bindings` exercises authored configuration/plan documents and an actual
LocalStore journal. These checks cover invalid fields and budgets, capacity, atomic
batch rejection, immutable bindings, detached values and validation before plan publication.
They execute no model, simulator or policy. Provider-backed task discovery and evaluation
remain separate integration requirements.

## Runtime responsibilities

[task-definition.ts](src/task-definition.ts) validates public task definitions and
versioned catalogs using the same goal admission. Server deployment presets and
environment-supplied catalogs share these types. Definitions contain public task
instructions and criteria; executable providers remain application bindings.
See [session catalogs](../../../docs/implementation/session-task-catalogs.md).

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

[verdict-history.ts](src/verdict-history.ts) stores immutable complete accepted results
and derives compact run entries with bounded explanation previews. Explicit readers
validate full archive contents and their agreement with published summaries. Planner,
task context, assignment inspection and SKILL provenance retain full-result semantics.
See [verdict history](../../../docs/implementation/verdict-history.md).

See [multi-goal runtime](../../../docs/implementation/multi-goal-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
