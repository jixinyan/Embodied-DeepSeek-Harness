# Native simulator inspection

`perception.inspect_simulator` is an optional decision-owner tool for inspecting
current native conditions during a policy execution. Enable it explicitly with
`worker.enableSimulatorInspection: true` in a RoboDojo deployment. The default is
false. Enabled configurations for other providers fail admission until their
native inspection implementation has actual acceptance. Hardware deployments
provide no implicit simulator-ground-truth substitution.

The input is `{"checkIds":["tower_base_structure"]}` using the exact IDs
advertised by the current task catalog. The model schema enumerates admitted final,
predefined-goal and allowed-subgoal checks. The host requires its current Planner
assignment and admitted task/goal/attempt/recovery execution. The worker checks
the execution identity, control generation, task scope and live lease before and
after its serialized native operation. Cancellation or a changed execution scope
rejects evidence admission.

The single simulator-owner operation reads native conditions and captures fresh
images at the same native control boundary. The returned receipt includes source,
executionId, taskScope, controlGeneration, native controlSteps and rawSimSteps,
facts with their evidence references, and the authorized sample with capture time
and images. RoboDojo structure facts retain the original native predicate and
read-only source audit identity. Native reads preserve physical and reward state.
Action status may advance after the capture; the retained capture counts and
timestamp identify the observation used for the Planner decision.

Inspection supplies no verdict, verification request, StopAcknowledgement or
execution-state transition. Planner chooses continued motion or execution.end.
A dependent goal and durable done status require the fresh independent Verifier's
passed result after confirmed ending. The original task criteria remain unchanged.
Tool results use native DSH image delivery and ordinary evidence retention;
`perception.simulator-inspected` retains the exact execution, assignment, scope,
generation, facts and evidence dependencies.

Source checks and actual native task acceptance are recorded separately. A fresh
RoboDojo execution with real model inspection calls remains required for this
interface's running-decision acceptance.
