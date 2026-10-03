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
The configured device deadline is five seconds. The policy has eight admitted
controls available in this fault experiment.

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

## Executable audit

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
