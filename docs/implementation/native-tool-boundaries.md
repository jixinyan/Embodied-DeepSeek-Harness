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
