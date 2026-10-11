# Plans and native TODOs

[plans.ts](src/plans.ts) stores versioned task plans with decision-owner and accepted-verdict gates. [DSH TODO](src/dsh/todo/index.ts) supplies session-local lists and history. Completing a TODO never establishes physical task success.

`TaskPlans.read` admits each stored PlanDocument through the canonical schema and
requires its task identity and document version to match the requested key and
storage version. `PlanOwner` and `PlanWrite` describe the actual public method
inputs/results. The module entry point exports the production planning service.

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

The [original-record CPU diagnostic](../../../docs/implementation/cpu-release-validation.md#model-visible-tool-schemas)
checks production reads, goal admission and writes against original model/tool
events. It also checks declared invalid derivatives, final-plan reopening and
journal compaction with released writers. Original model/simulator execution is
not replayed by this command.

[Configured task-plan CPU checks](../../../docs/implementation/cpu-release-validation.md#configured-task-plan-storage)
use the published Tower catalog and production planning/storage services. Source CI
requires this report and its actual journals as part of consolidated source-bound
CPU validation.
