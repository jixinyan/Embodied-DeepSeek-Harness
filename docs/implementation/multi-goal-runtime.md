# Plan-selected subgoals and recovery

Implemented in the upper application with a deterministic CPU fixture. DSH owns
model turns, scoped tool dispatch, sessions and explicit followups. EDH supplies
physical task identity, goal admission and verification/recovery rules.

![Multi-goal recovery](../architecture/assets/multi-goal-recovery.svg)

## Run the example

Start `pnpm demo`, open the local console, and choose **Placement → access repair →
storage**. The HTTP scenario name is `multi-goal-recovery`. No model key or simulator
is required. Synthetic cabinet state changes are CPU fixture transitions, not robot
motion or evidence of learned planning competence.

| Order | Planner-selected goal | Formal result | Recovery / task meaning |
| --- | --- | --- | --- |
| 1 | Place cup | Failed | Failure alone does not start the Evolver |
| 2 | Replan: add access prerequisite | Planner decision | Fresh Evolver receives failed attempt, evidence and proposed changes |
| 3 | Open cabinet | Passed | Dependency can be marked done; placement recovery stays open |
| 4 | Return to placement, explicitly retry | Passed | Original placement recovery resolves; its SKILL can be published |
| 5 | Close cabinet with cup inside | Passed | Final task criteria pass; Planner completes the plan and task |

The failure-to-success sequence is predetermined by the test model and backend.
The resulting skill identifies observations and hypotheses separately. This is no
causal study or demonstration of transfer between environments or embodiments.

## Bind task criteria and available checks

`ApplicationOptions.goal` is the required final task, including its success contract,
entity bindings, capability requirements, source configuration and execution budget.
`allowedSubgoalChecks` registers exact `SuccessCheck` objects, including bound entity
arguments. `predefinedGoals` optionally supplies complete deployment-owned bindings.

For example, the storage fixture supplies `inside(cup, cabinet)`, `open(cabinet)` and
`closed(cabinet)`. The final task requires both inside and closed. Planner may combine
registered checks using `all` or `any`; it cannot change the object from `cup` to a
new arbitrary object or invent an unsupported predicate.

`planning.read` returns the complete plan, owner IDs, active goal/attempt, final goal
ID, admitted bindings, allowed checks and `subgoalSource`. New Planner-authored
contracts use that exact source. Its current wire representation is
`{ kind: "user", reference: "planner-subgoals:<finalGoalId>" }`: this records delegated
user-task planning authority, not a claim that the user manually authored each subgoal.
The wire schema still has only user/benchmark source kinds.

Dynamic goals inherit the root binding's entities, capabilities, budget and source
configuration; their description augments task semantics. Use predefined bindings
when a subgoal needs different deployment-provided budgets or capabilities. General
predicate parameter discovery and arbitrary environment entities are future provider
work. Complete goal criteria become immutable on admission, even before execution.

## Native tool sequence and guards

1. Call `planning.read`, then `planning.update({ plan, expectedVersion })`. Retain the
   final goal and every executed goal with the exact criteria used for execution.
   Updates are owner-only, versioned, cycle-free and bounded to 64 admitted goal
   identities across the task's history, including goals later removed from a plan.
2. Call `tasks.select_goal({ goalId })`. The selected goal must be in the plan and
   not abandoned. Every dependency must be done and reference its own latest formal
   passed verdict matching its latest request. Selection waits for confirmed ended
   execution and formal verification of the previous job's latest boundary.
3. Call `execution.start({ instruction })`. The selected binding supplies the
   SubgoalRequest's identity, criteria, budget and capabilities. The tool rechecks
   dependencies and rejects duplicate submission of an already-started attempt.
4. After an eligible `ended` state with a confirmed device boundary, a fresh Verifier
   receives the current request's criteria. Ordinary confirmed pauses remain with
   Planner and do not create a formal assignment. Checking and submission are bound
   to that execution and boundary. Old verifier assignments cannot verify a later
   goal or attempt.
5. Following formal failure, `tasks.replan` or `tasks.retry` must include an attempt
   summary and proposed changes. Replan before selecting a different repair goal.
   Returning to the failed goal restores its prior attempt; call `tasks.retry`
   explicitly before starting again. The limit is three actual executions per goal,
   not three executions for the entire multi-goal task.
6. Mark completed plan items with their own latest verdict IDs. An old success cannot
   hide a later failed or unverified attempt. Call `tasks.finish` only when the final
   task goal passed at the backend's latest confirmed stopped boundary and all plan
   rows are done or explicitly abandoned. The final goal cannot be abandoned.

New attempts receive unique increasing ordinal IDs. `RunState.attempt` identifies the
currently selected attempt; it can temporarily return to an older ordinal when
selecting a previously failed goal, before an explicit retry allocates a fresh ID.
`activeGoalId`, `finalGoalId` and `activeRecoveryId` make these states explicit.
`recoveryId` retains the most recently opened recovery for existing history inspectors.
The initial Planner brief stays immutable; verdict followups explicitly provide the
current subgoal context. A new role assignment never inherits Planner conversation.

A completed dependency is a historical formal result, not a continuously true world
invariant. Planner must create a new goal identity to re-establish a previously passed
condition when later work invalidates it. The final task checks its required conditions
again at its own latest execution boundary. Passed goals are not blindly rerun under
an already-completed attempt ID.

## Recovery lifetime

One recovery chain observes at a time. It can encompass several repair goals and
retries without changing its original failed goal. Only a passed result for that
original goal, contract and recovery identity resolves it. Successful prerequisites
are progress, not recovery completion. Resolved records and Evolver assignments keep
their own goal/failed-verdict/success-verdict provenance while the task continues.

Recovery creation captures the complete brief before asynchronous role creation.
Evolver startup/model work does not gate policy execution. Explicit progress batches
are ordered after its start message; success follows those batches. `skills.save`
uses the recovery's captured success, not whichever unrelated verdict is now last.
A failed Evolver model writes `recovery.failed` and a durable error; the Planner and
Verifier can still complete the physical task. No success skill is fabricated.

## Recovery progress storage and delivery

RecoveryHistory stores the explicit failed-attempt context, result, learning error
and published trace count under `recovery:<id>`. Each `recovery-event:<id>:<index>`
stores an immutable reference to an already published run event. The recovery record
contains no accumulated event bodies. Failed learning can retain subsequent progress
for later inspection. A resolved recovery accepts no additional events.

Readers use recovery indices because selected run sequences can contain gaps. Pages
contain at most 32 events and target 64 KiB of encoded event bodies. An oversized
individual event remains intact in its own batch. Page reads validate reference order,
the published run boundary and the referenced event. Unpublished references stay
outside the recovery count. Legacy inline traces remain readable.

UpperRun starts one progress drain after the Evolver's start message has completed.
It reads each batch when ready to send and advances its cursor after native DSH
delivery settles. Incoming progress grows the durable trace without queuing arrays
of event bodies. Concurrent flush requests await the active drain and check for
remaining progress. The original-goal success message waits for progress delivery.
Errors propagate to the existing learning-failure handler and preserve the stored
trace; restarting the server never resumes an Evolver or replays task actions.

The existing recovery HTTP endpoint explicitly reconstructs a complete trace for
inspection. This response and legacy inline records can allocate the requested
history. Agent session context, indexed reference count, journal disk usage and
working-file limits have separate lifecycles. Delivery settlement means native
session quiescence; it does not prove the quality of learned guidance.

`pnpm test:history` includes actual journal checks for ordered selection, stable page
boundaries, detached bodies, UTF-8 byte sizes, large individual records, legacy reads,
reopening, invalid references and traces exceeding the 8 MiB record limit. These
checks use authored history documents and do not simulate model or physical behavior.

## Acceptance and next work

[Runtime acceptance](../../tests/runtime/upper-run.test.ts) executes native DSH calls
for the full sequence, denies premature publication and stale verifier control,
checks dependency/switch/retry guards and per-goal budgets, and injects an Evolver
model failure. [Planning tests](../../tests/runtime/planning.test.ts) reject criterion
changes, dropped executed goals and stale success references. HTTP tests check the
new scenario binding. A regression also runs the normal demo timing (140 ms model
delay, 650 ms backend ticks), requiring both task success and SKILL publication.
Session audits append native events independently so total history can exceed the
8 MiB single-record limit. The repository-wide command is `pnpm check`.

Current limits: one active local run, sequential physical jobs, one observing recovery
chain, fixed deployment-bound check arguments, bounded session/event/file budgets and
read-only interrupted-run history. Concurrent physical goals, independent nested
recoveries, resumable sessions, delivery reconciliation, retention/compaction and actual
simulation/policy/perception providers remain follow-on work. See [progress](progress.md).
