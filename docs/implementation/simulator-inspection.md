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

An actual native worker acceptance used immutable source
`7adaa4368db4ce2f594ecb95e86f794c071ad64d`, the original RoboDojo build_tower
instruction and criteria, and the original Pi0.5 checkpoint with its 50-action
response. Execution `f54eb5d3-60fd-457c-89c1-f22ce2defe05` returned a running
inspection at generation 0 after two controls and 20 physics steps. Its three
advertised native checks were false. The capture included all three native
cameras. Stale generation 9 and an unadvertised check ID were rejected at the
production worker boundary.

An ordinary confirmed pause advanced generation to 1. Two subsequent inspections
retained two controls and 20 physics steps, identical native state and PNG bytes,
and identical check values. The gate remained paused. Inspection created no
formal Verifier or execution ending. The original worker/native close completed
at `2026-10-03T14:13:58.600392Z`; actual SDK PID 339615, checker PID 339543 and
its process group were absent at `2026-10-03T14:23:41.055818Z`.

The original private bundle is
`.local/work/native-simulator-inspection-20261003/inspection-proof.tar.gz`,
48,162,893 bytes, SHA256
`5e1f45d6ed809aa88baf9a6878b4cc3ff50c75d0bca41890e02b7a2f4f05b756`.
It retains the original requests, native control receipts, source identity,
checks, captures, calibration arrays, native dependency records, close result and
OS inventory. This acceptance covers the native inspection primitive. Real Qwen
tool admission, image delivery, Planner decisions and formal stage progression
require the separate complete Console workflow acceptance.
