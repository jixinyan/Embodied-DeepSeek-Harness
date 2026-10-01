# Native tool budgets and task authority

Native DSH owns tool registration, execution deadlines and cancellation. The
deployment's `EmbodiedBackend.toolTimeoutMs` supplies the deadline for physical
capture, object measurement, active observation, execution start/pause/resume,
formal check and task abandonment. Native worker deployments declare this value
through `NativeWorkerConfiguration.toolTimeoutMs`.

| Boundary | Default | Configuration |
| --- | --- | --- |
| Native DSH physical tool | 120,000 ms | `toolTimeoutMs`; integer above 60,000 and at most 1,800,000 |
| Ordinary native request | 60,000 ms | Existing transport request budget |
| Worker output lock and pipe drain | 30 s | `transportWriteTimeoutS`; finite positive value at most 60 |
| Native initialization | 180,000 ms | `initializeTimeoutMs` |
| Native close | 60,000 ms | `closeTimeoutMs` |
| Local core tools | 10,000 ms | Existing native core-tool deadline |

Segmentation/depth providers continue to declare their own native tool deadlines.
Device, policy, observation and subgoal budgets remain independent. For example,
allowing a formal check 120 seconds leaves the admitted 64-control action budget
unchanged. `tool.started` retains the selected `timeoutMs` with the call identity
and original arguments for operator inspection.

```json
{
  "toolTimeoutMs": 120000,
  "transportWriteTimeoutS": 30
}
```

The TypeScript environment factory validates both settings before creating the
worker. Initialization sends `transport_write_timeout_s`; the Python worker
validates that value before changing initialization state. The output deadline
covers waiting for the exclusive output lock and draining the real process pipe.
Timed-out or cancelled output revokes the host/task lease.

Formal native checks require a connected host, an active task lease, the current
task identity and the exact confirmed stopped ActionGate boundary. The worker
checks these conditions before obtaining observations, after observation and
after reading native predicates. A task that changes or loses its lease cannot
publish facts from that check. The authoritative native criterion and post-execution
Verifier responsibility remain unchanged.

Once an admitted execution request reaches `backend.start`, a provider startup
failure ends the run with its original error, cancels its active role sessions and
attempts device stop. The request remains part of the actual audit history.
Planner retry continues to require an accepted current formal failed verdict.

## Device-supported observation tools

`EmbodiedBackend.activeViewDirections` declares supported active observation
directions. Native initialization validates unique `left`, `center` or `right`
values and freezes the declaration. A missing or empty declaration excludes
`observation.turn_view` from every assignment's explicit brief and native tool
list. An exposed tool's `direction` enum contains only the declared directions.
Native observation receipts include `activeObservationSupported` and
`activeViewDirections` for model and operator inspection. Object measurement is
exposed only when the selected backend provides `measureObject`.

For example, a fixed-camera RoboTwin or BEHAVIOR deployment declaring no active
directions exposes capture while omitting active-view motion. A device declaring
only `center` admits exactly that direction. Role definitions retain their
requested tools; the deployment determines the supported subset for each fresh
independent assignment.

`EmbodiedBackend.rotationAxes` separately declares degree-valued yaw/pitch motion.
`observation.rotate` is present only for a supported declaration and implementation.
Unsupported axes have a model-visible `const: 0` parameter. Supported yaw is bounded
to ±90 degrees and pitch to ±45 degrees by both host and worker validation. The
Planner receives new authorized RGB images and a measured rotation receipt. R1Pro
yaw turns its body; pitch changes trunk posture to tilt its mounted camera.

All receipt angles use degrees; `before_position` and `after_position` are native
world-frame XYZ positions in meters. Positive yaw turns left and positive camera
pitch looks up. The selected provider determines supported axes; R1Pro uses its
native base velocity and absolute `torso_joint3` controllers.

Planner owns rotation admission. Before the first policy job it can scan directly;
after an execution it must wait for a confirmed ended boundary and formal result.
A formally completed current goal accepts no additional observation motion.
The host prevents simultaneous execution/task changes and observation motion;
the worker serializes rotation with native control admission. Its connected task
lease and unchanged execution boundary are checked around the operation. Original
capture geometry is invalidated. Rotation counters are separate from the policy
job's admitted controls and appear explicitly in the motion receipt.

The BEHAVIOR provider reads actual controller capabilities, holds unaffected
joint commands and uses measured body yaw/camera pitch feedback. Primitive motion
has a 240-control / 45-second bound and a cross-process cancellation signal.
Source adaptation follows the prior EAF `sim/rotation.py` and
`sim/behavior/motion.py` / `head.py` feedback design; EDH owns its implementation
and imports no EAF package. Actual SDK and Planner/worker validation is recorded
in [progress](progress.md).

Six actual OmniGibson 3.9.2 / R1Pro trials validate the native primitive in
`picking_up_trash`, instance 0. Requested yaw +15/−15 degrees achieves
+13.521254/−13.508769 degrees; requested camera pitch −10/+10 degrees achieves
−9.553014/+9.555559 degrees. The 1.5-degree tolerance is met. Cancellation before
control consumes zero steps; in-motion cancellation stops after five controls and
retains +1.037308 degrees of actual yaw. All 170 controls preserve non-motion hold
targets and native action limits, consume 680 physics steps and retain the original
false task criterion. Three camera videos each fully decode 170 frames. The SDK
returns close acknowledgement and exits with code 0. Exact loaded source, original
images/actions, native model metadata and resource-release evidence are retained
under `.local/work/behavior-rotation-20260930/`. These native checks do not establish
a policy task result. Production-worker run `8f35aca4` separately verifies actual
Qwen capture and both yaw directions with zero tool errors. Each receipt's three
original RGB image hashes and byte counts match subsequent real model requests.
The original task criterion remains unchanged. The test waits for explicit user
confirmation before policy execution, then closes its Session and resources.
No policy job or formal verdict is produced.

## Recorded process validation

Two actual worker processes retain the production `serve`, `NativeWorkerSession`
and output implementation. Pausing the real FD3 reader for 12.051 seconds and
issuing 4,096 pressure requests preserves the connection and returns all receipts.
A separate 32.009-second pause exceeds the 30-second output deadline; subsequent
task operations report a disconnected host. Both processes exit. Six invalid
initialization budgets and an unleased check are rejected before provider/device
access. These checks exercise process transport and admission; they contain no
simulator, learned inference or physical task execution.

The actual native-model and lifecycle validation boundary is recorded in
[progress](progress.md). Protocol/source checks and actual simulator acceptance
retain their own evidence requirements.
