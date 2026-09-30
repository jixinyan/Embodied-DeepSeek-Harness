# Execution-policy observability

DSH execution-policy sessions publish their own model output, returned reasoning,
native tool calls/results, local plan, decision, status and errors. These records
belong to the execution policy; upper Team assignments retain independent contexts.
Operator inspection supplies no tool authority or shared agent conversation.

The gateway sends bounded `policy_event` messages alongside read-only `policy_tool`
requests. Each message carries task scope, execution/request/observation identity,
control generation, policy Session ID, timestamp and monotonic Session sequence.
The physical client accepts telemetry only for direct/hybrid mode and its current
inference. The worker checks its active generation before publication. The upper
application checks execution ownership and sequence before journal publication.
Telemetry cannot issue controls or establish a formal verdict.

The console includes execution-policy output in the existing activity feed. Its
filter selects the policy's local subtask plan, including both-arm intentions and
prerequisites. Tool result association includes Session identity. Live text and
reasoning projections publish at most every 100 ms during streaming, plus start
and end. Each projection retains the latest 16,000 characters per field; complete
native assistant messages remain separately recorded. Missing provider reasoning
remains unavailable.

Limits: 2 MiB per policy event, 10,000 transport messages and 64 provider tool
requests per inference. Native model-step, timeout, observation-expiry and physical
budgets continue to apply. Disconnects cancel the policy; retained local audits
can include errors that the disconnected client could not receive. No action replay
occurs during reconnection.

The implementation passes TypeScript, Python compilation and source checks.
RoboDojo direct run `2c974465-f035-4d1d-a913-fba5a4688c02` records complete
gateway-to-worker publication and persisted-history reads, 42 actual controls,
eight Astra policy calls, local plans, grounding/depth/motion tool rounds and
three camera views. Its independent upper Verifier accepts native
`task_success=true`; Planner completes the task. The recorded-loop audit checks
all 2,153 events. The final local policy plan remains its last model-authored
snapshot; native episode termination and the formal verdict establish completion
separately. Hybrid inference and in-flight interruption need their own acceptance.
