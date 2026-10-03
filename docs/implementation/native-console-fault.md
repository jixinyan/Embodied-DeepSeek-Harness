# Native Console background fault

The production native transport admits background faults with their original
execution identity, complete task/goal/attempt/recovery scope, exception type and
message. The active run fails through the existing DSH host, pending RPCs reject,
roles retire and transport admission closes. This path creates no ExecutionStatus,
StopAcknowledgement or formal Verifier boundary. The last accepted status remains
historical evidence. Owned process shutdown and device confirmation have separate
outcomes.

## Actual production experiment

Run `ff830ddc-e422-426c-802b-2879ef04b66b` belongs to Session
`f8464154-7c40-40c5-9c35-8aff07d8dc4e`. Immutable source
`5c3e23d05ec5d137f39eb1ac8db2134a4d7f1f1b` has 763 files, individually compared
with the original Git archive before evidence export. The production Console
creates the native BEHAVIOR Session and submits its advertised `picking_up_trash`
task. Its Qwen3.8-27B Planner starts GR00T-N1.6-BEHAVIOR1k, revision
`300db814db8ab5dd010026d5631f280048d06b91`, with the original native task criterion.
The configured device deadline is five seconds. Each policy response permits
eight action proposals; the original 10,535-control native task budget is retained.

The original policy request `0c38b4d3-96af-427d-8d14-0f3fa1d24abf` binds execution
`e64d162f-13d8-4cf2-a3ef-3dccc77f45b6`, generation zero and the complete attempt
scope. Its actual inference starts at `2026-10-03T12:33:29.899Z` and completes at
`12:34:33.624Z`, returning eight controller-converted proposals from 32 model
actions. Original checkpoint and weight digests accompany the inference record.

At `12:33:31.140998Z`, the experiment sends SIGSTOP to the original SDK PID 57135.
The original native capture supplies that PID; its command, ancestry and owned
process group 57044 are checked before signaling. The immediate process-status
sample says `running`; it does not establish the later stopped state. The original
dispatch timeout and device-stop timeout propagate `TimeoutError` through the
scoped native fault publication. The original `run.failed` event records that
fault at `12:34:43.675Z`. Its sole Planner assignment retires at `12:34:43.712Z`.

The complete history contains 110 events, zero Verifier assignments, zero formal
verdicts and zero recorded StopAcknowledgements. Its last accepted execution
status, recorded before interruption, contains zero confirmed learned controls,
zero published policy calls and `device_confirmed: false`. The actual inference
log separately records one completed inference. The original fault envelope does
not retain gate reservation or uncertain-action counters; those values remain
unavailable for this experiment.

Before policy execution, the Planner performs seven actual active-observation
rotations. Their original tool receipts total 1,177 controls and 4,708 physics
steps. These movements precede the learned execution and retain their own pose,
image and rotation evidence.

## Cleanup and preserved outcome

Production Session close returns HTTP 400. The retained Session has `state: error`
and `resources: unknown`. Device stopping remains unconfirmed. The original
failure and forced process-release errors remain visible in Console stderr.

At `12:38:05.741726Z`, actual OS inspection confirms that worker PID 57044, SDK PID
57135 and owned group 57044 are absent. At `12:42:03.576772Z`, owned Console PID
53808 and policy PID 40770 have exited and their listeners on ports 4366 and 8009
are closed. The original workspace writer lock is absent. These OS facts preserve
the unknown device and Session-resource outcome.

The exported original evidence bundle contains the closed journal, API responses,
complete events, policy request, native capture arrays, inference log, fault log,
configuration and original source-file inventory. Its SHA-256 is
`b855a99affb848269c34596c25889282e16967c195b7dee3aa707b3510614a86`.
The unchanged closed journal SHA-256 is
`fe2b924831d347fc21f35a99bc8c6e15d534f4e3afb994f2d34253d21508f6ba`.
Private evidence lives under `.local/work/native-console-fault-20261003`.

## Confirmed device-error boundary

Actual run `4d780936-3971-4ec9-9baa-6f017c93922c` uses immutable source
`89a138abd27abcab068a64e19496554dc950f3d8`. Its original BEHAVIOR task retains the
10,535-control horizon and native criterion. This configured experiment uses a
five-second device deadline, eight proposals per inference and bounded Planner
reviews. Six actual scoped query calls complete their native turns and permit
subsequent review messages.

`ActionGate.execute` reaches its configured deadline while awaiting
`NativeActionDevice.dispatch` through the serialized owner Future. Its original
trace records `TimeoutError`; no operator suspension is sent. The owner operation
subsequently completes. At `2026-10-03T13:19:50.851267Z`, the original recorded
StopAcknowledgement confirms generation one, 361 native controls, 1,444 physics
steps and one uncertain action. The 360 successful action receipts account for
360 controls. The uncertain operation remains charged and is not replayed.

The host accepts the original confirmed `backend_error` status at `13:19:51.103Z`
and fails the run at `13:19:51.379Z`. The complete 536-event history has zero formal
Verifiers, zero verdicts and zero tool errors. No background fault publication or
background-fault diagnostic is emitted on this confirmed-stop path. Production
Session close returns HTTP 200 with released resources. Original worker PID
171025, SDK PID 171232 and their owned group are absent; owned Console and policy
processes, listeners and writer lock are also absent.

The original complete bundle retains native RGB-D arrays, source inventory,
action/request records, journal, exception log, API close and process proofs under
`.local/work/native-console-fault-20261003-02`. Native video recording is disabled
in this experiment. Complete bundle SHA-256:
`1f7626b9dd8f5780efe5294cb8fe4121a7accdb726886671a7868375b29fda03`.
Its journal SHA-256:
`d8ca82c48c01e435169f0e17052fcdd5cd097817187c8c6b861ae59abfab560d`.

## Actual owner-counter diagnostic

Immutable source `7adaa4368db4ce2f594ecb95e86f794c071ad64d` ran genuine Qwen,
RoboDojo build_tower and the original Pi0.5 checkpoint with its 50-action response
and 1050-control budget. Task `6d293c7c-4eec-4678-86af-011abf569380` retained
51 original events. Its current execution was
`7c36aad0-59b1-41a2-b517-49ce30c89a8d`, build_tower attempt-1. After one
confirmed learned control, the authenticated owned SDK PID 396699 received
SIGSTOP at `2026-10-03T14:34:39.080003Z`.

The original `native_background_fault_diagnostic` at
`2026-10-03T14:34:48.902Z` records generation 1, pausing, two reserved actions,
one executed action, backend_error, no device confirmation and no boundary ID.
The atomic device snapshot records one executed action, one uncertain action,
10 physics steps, stopped=true and closed=false. Two owner operations remain
pending, with two retained cancelled operations and two pending cancelled
operations. The last published execution remains its historical generation-0
sample with one control and 10 physics steps.

The original scoped TimeoutError produced run.failed at
`2026-10-03T14:34:48.909Z`, retired the Planner and created zero formal Verifiers,
verdicts or StopAcknowledgements. Session close returned HTTP 400 with unknown
resources. The original SDK had a separate POSIX group and remained stopped with
parent PID 1 after production worker exit. Authenticated operator SIGKILL of
that SDK group confirmed PID absence at `2026-10-03T14:37:48.051403Z`.
Console, policy, bridge, listeners and writer lock subsequently exited. Device
and Session resource outcomes remain unknown.

The complete original bundle is
`.local/work/native-console-fault-20261003-03/diagnostic-complete.tar.gz`,
24,426,619 bytes, SHA256
`3547c12c2c9cd1e1e731ee0d124fd950e344738c4bc567713d6a70cb50612f12`.
Its 769 source files match the original Git archive; journal SHA256 is
`9771a3afadd34aa52c217f4b2ecc0e6fcb19f1ac549a7a8ceb04e36aa90da860`.
The strict reader passes against the original closed journal with
`--require-diagnostic` and verifies the original OpenPI bridge request,
50-action inference, first control receipt and numerical owner snapshot.

## Executable background-fault audit

Extract the original bundle into an owned directory, then run:

```sh
node scripts/check-recorded-native-fault.mjs \
  --directory .local/work/native-console-fault-20261003/original-evidence \
  --output .local/work/native-console-fault-20261003/fault-audit.json
```

The reader requires complete original events and checks scoped fault identity,
actual learned proposals, role retirement, absent formal verification, retained
unknown state, capture PID/hash, process-group release records, listener/writer
closure and unchanged journal bytes. It writes the precise counter availability
and active-observation totals into its report. It performs no model inference,
simulator launch, task replay or modification of the original records.

## Owned native service lifetime

An EDH-owned RoboDojo SDK process joins its parent worker's POSIX process group
and session. The provider validates those identities immediately after spawning
and records `native_owned_service` with the actual owner PID, service PID, creation
time, group and session. NativeWorkerTransport owns a unique group and confirms
group exit after its graceful, TERM and KILL deadlines. Ordinary provider close
terminates only its direct SDK child. An externally supplied RPC service remains
outside the worker's owned process lifetime.

Forced process termination preserves the original task failure, unknown device
boundary and unclean close error. It supplies no StopAcknowledgement or formal
Verifier. Fresh real native fault and normal close acceptance are required for
this owned RoboDojo process-group binding.
