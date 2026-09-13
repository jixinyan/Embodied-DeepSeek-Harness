# Upper execution boundary

[backend-port.ts](src/backend-port.ts) defines the currently used EmbodiedBackend port. The server composes a nonblocking CPU fixture for job/query/budget/pause/resume/check acceptance. Python transport, action-chunk gate and shared device resource arbitration remain unimplemented.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).

## Asynchronous provider calls

`capture` and `check` may return either a value or a Promise. Active observation,
start, pause and resume also receive optional `BackendCallOptions` containing the
native DSH `AbortSignal`. Implementations should forward it into network requests
and cooperative provider work. Stop/close remain cleanup operations independent of
an aborted model call. Cancellation does not establish that hardware stopped.

`query()` deliberately reads the client's immediate status projection. A future
transport client must update that projection before notifying `subscribe` listeners;
this method must not start a network request. Actual remote polling and stream
reconciliation belong in that client. The server still uses the CPU fixture.

Formal `check` receives `executionId` and `boundaryId` alongside the cancellation
signal. For example, a GT service receiving a cabinet check for boundary A must
reject it if the worker has resumed into boundary B. The upper application also
rechecks the current execution, stopped state, device confirmation, assignment
scope and boundary after the Promise resolves, before granting evidence or retaining
facts. Returned EvidenceRef and CheckResult records pass the shared wire validator.
Formal submission still runs the existing full verdict/evidence lifecycle checks.

A late capture after cancellation cannot become an agent observation. A late
active-observation result cannot update a finished run, and a delayed resume reply
cannot change a cancelled run back to running. These are admission rules for upper
state, not a physical emergency-stop mechanism.

Acceptance uses asynchronous CPU adapters through native DSH tools, including a
successful retry/SKILL loop, a deliberately uncooperative late capture after stop,
and a GT response arriving after a simulated boundary change. This proves the
upper seam; it does not validate a network transport, simulator or policy service.

SensorSample may include admitted immutable DSH image references in `images`. The
Planner's perception tool result and the Verifier-to-Planner feedback use native
image content. Return no raw bytes or arbitrary URLs in this metadata port. See the
[image routing guide](../../../docs/implementation/model-policy-adapters.md).
