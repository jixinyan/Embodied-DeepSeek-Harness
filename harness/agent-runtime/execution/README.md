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

The decision owner may call `execution.query` with optional `completeTurn: true`
for its current admitted task/goal/attempt/recovery execution. The actual status
and formal-verification receipt commit before native DSH turn completion. This
read permits the next bounded running review or pending formal-verdict follow-up
to arrive without changing execution state, motion or task criteria. Omitted or
false preserves an informational query. Missing or stale scope fails before the
turn can complete.

Acceptance uses asynchronous CPU adapters through native DSH tools, including a
successful retry/SKILL loop, a deliberately uncooperative late capture after stop,
and a GT response arriving after a simulated boundary change. This proves the
upper seam; it does not validate a network transport, simulator or policy service.

SensorSample may include admitted immutable DSH image references in `images`. The
Planner's perception tool result and the Verifier-to-Planner feedback use native
image content. Return no raw bytes or arbitrary URLs in this metadata port. See the
[image routing guide](../../../docs/implementation/model-policy-adapters.md).

## Planner terminal review

Native deployments expose `execution.end` when their backend implements `end`.
The authenticated decision owner supplies the exact `executionId` and an
observation-supported review reason. `BackendEndOptions` carries that execution,
owner, assignment and immutable task/goal/attempt/recovery scope to the worker.
The worker validates the complete binding under its existing control lock.

A running or ordinarily paused job ends through the existing ActionGate with
`planner_stop`. Its policy work drains, the device confirms stopping and the
owner thread captures a stopped observation. The host admits that fresh boundary
and creates an independent formal Verifier. An already ended job returns its
published immutable status; concurrent native termination or failure keeps its
original reason and boundary. Repeated review cannot create another boundary or
Verifier for the same ended execution. Policy drain and device-stop failures
remain explicit. Ordinary pause retains its separate resume behavior.

Terminal review ends the attempt without asserting success. Goal selection,
retry and task completion still require the applicable admitted formal result.

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

`subscribeFaults` reports a background worker failure even without an outstanding
RPC. Native fault publications carry their original execution ID, complete active
task scope, exception type and message. The client validates them against its
admitted request and published execution before failing the active run. Disconnect
rejects outstanding calls and closes transport admission. Fault handling produces
no execution status, stop acknowledgement or formal verification boundary.

The Python worker also records `native_background_fault_diagnostic` on stderr.
It contains the actual ActionGate snapshot and the native device's locked counter
snapshot at the fault: reserved, executed and uncertain actions, generation,
fencing state and pending owner operations. These diagnostics remain separate from
the last published execution status and identify unconfirmed work during cleanup.
They do not declare a device boundary or release physical resources.

Native workers own a separate POSIX process group. Shutdown requires the original
clean close acknowledgement, successful leader exit and absence of that owned
group. Each graceful, SIGTERM and SIGKILL release wait has a 15-second deadline;
group cleanup continues when the leader exits before its children. Forced release
retains the original failure and any exit deadline errors. A failed or unconfirmed
release keeps device/resource state unknown.

The [native Console fault acceptance](../../../docs/implementation/native-console-fault.md)
checks a real Qwen/GR00T/BEHAVIOR task after suspension of its owned SDK process.
The background timeout fails the task, retires its role and preserves zero formal
verdicts and unconfirmed device state. Original learned proposals, historical
published counters, active-observation controls and OS process cleanup have
separate records. Session close returns an error with resources unknown, while
the worker's owned process group exits. Process absence establishes OS cleanup;
device confirmation still requires its original acknowledgement.

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

## GPT direct and hybrid policy gateway

Native decision-owner observations use generation-bound `captureReview` and the
existing DSH follow-up delivery. The [running review guide](../../../docs/implementation/planner-running-review.md)
defines cadence, image publication, stopping and independent verification.

[`DshGptPolicy`](src/gpt-policy.ts) is the EDH-owned Litchi-style gateway. It
uses `createDshSession`, native DSH tool schemas, model cancellation and image
attachments. `direct` mode offers grounded joint/EEF proposal tools. `hybrid`
mode offers lower-policy proposal, review and approved-prefix tools. These tools
return proposals; they never receive a device handle or dispatch a command. The
Python policy client converts the resulting envelope into the canonical
ActionChunk and ActionGate remains the sole commit boundary.

The gateway accepts a deployment-provided read-only observation callback, an
optional lower-policy proposer and provider-specific EEF transform. This keeps
RoboDojo, RoboCasa and hardware mappings outside the DSH loop while allowing the
same GPT-6 Astra Responses adapter to serve all three control modes. Unit tests
exercise both direct and reviewed hybrid paths with a CPU model fixture.
