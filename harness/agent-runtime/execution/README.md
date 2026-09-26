# Upper execution boundary

[backend-port.ts](src/backend-port.ts) defines the EmbodiedBackend port. The
[native worker client](../../../apps/server/src/native-worker.ts) connects it to
the Python worker and its simulator owner thread. RoboCasa acceptance includes
actual GR00T controls, camera events, cancellation, confirmed pause/stop and
formal GT failure. Shared device resource arbitration and an independent device
watchdog remain required by the [v1 register](../../../docs/implementation/v1-delivery.md).

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).

## Asynchronous provider calls

`capture` and `check` may return either a value or a Promise. Active observation and
start receive optional `BackendCallOptions` containing the native DSH `AbortSignal`.
Resume requires `BackendResumeOptions`, described below. Implementations should forward
these signals into network requests and cooperative provider work.

An admitted Planner or operator pause is owned and tracked by the run. The provider
may publish `pausing` while awaiting the device acknowledgement and publishes a
confirmed `paused` boundary with `planner_pause`. A fast acknowledgement can move
the last published `running` status directly to confirmed `paused`. The worker
captures a new observation after confirmation for this boundary.
This boundary permits a Planner resume decision and does not trigger formal checks.
A pause failure fails the run and requests stop. Providers must bound acknowledgement
latency and publish confirmed state; a settled Promise alone is not a device-stop
confirmation. Stop/close also remain independent of an aborted model call. Cancellation
does not establish that hardware stopped. An independent device watchdog remains pending.

`query()` reads the client's immediate status projection. The native transport
updates that projection before notifying `subscribe` listeners; this method does
not start a network request. Stream reconciliation belongs in that client.

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

## Bound resume decisions

The native `execution.resume` tool admits one in-flight resume decision at a time.
It requires the current attempt, an admitted `paused` state, device confirmation
and remaining budget. The Planner decides whether to continue the stopped job.

The provider receives `executionId`, `boundaryId`, `stateVersion` and the native
cancellation signal in `BackendResumeOptions`, alongside the authenticated owner's
ID. It must check that boundary before motion, reject stale requests and publish
the resulting status before resolving. Mapping this binding to the Python action
gate's control generation is the native worker bridge's responsibility; a state
version is not itself a robot controller generation.

The upper host records `execution.resume-requested` and accepts a `paused -> running`
transition only while the matching decision is outstanding. Copying the owner ID
from an earlier SubgoalRequest does not constitute a new decision. A second resume
call cannot dispatch another command. If the command was sent but its acknowledgement
is missing or invalid, the run fails and cleanup requests device stop. It does not
replay the command. Actual device stop still depends on the provider acknowledgement.

If the job resumes and pauses at B before the resume Promise resolves, B stays paused;
a late response cannot change the host state back to running.

## Provider status admission

One admitted attempt binds to one execution ID. Each BackendUpdate observation must
have the same task/goal/attempt/recovery scope as its execution. The first status is
budget-checked even when no previous state exists. Later updates pass the shared
lifecycle validator, using actual outstanding resume authority rather than inferring
it from the subgoal's stored owner ID.

Transport clients must reconcile ordering and duplicate versions before notifying
this strict update port. Protocol violations fail the run and request stop; the
last accepted status is historical evidence, not proof of current hardware state
following a connection or protocol failure. Device/resource recovery is still a
worker integration responsibility.

Formal boundary IDs are scoped to a run and execution. Every completed execution
requires a fresh boundary ID. The upper host records admission before publishing
the ended status and scheduling the formal role. Historical paused-boundary records
remain readable. See
[boundary publication](../../../docs/implementation/verification-boundaries.md).

Six additional upper tests cover pending formal checks, unsolicited resume, missing
acknowledgement, concurrent commands, a newer pause during acknowledgement,
execution/image identity and first-state budget rejection. All use CPU providers.


Profile configuration is resolved before provider allocation. The shared schema and
[profile guide](../../../docs/implementation/physical-profiles.md) define the exact
embodiment action/observation and checkpoint mapping boundary. Config-only switching
requires installed adapters with synchronous validation; it does not imply a running
simulator or checkpoint compatibility.
