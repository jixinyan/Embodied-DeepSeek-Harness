# Execution

| File | Responsibility |
| --- | --- |
| [worker.py](worker.py) | NativeWorkerSession: task and execution operations; process entry point |
| [worker_transport.py](worker_transport.py) | Host JSON requests on stdin, responses/events on fd 3, pipe shutdown and request tasks |
| [policy_records.py](policy_records.py) | Recording-directory checks, original inference requests and native control records |
| [action_gate.py](action_gate.py) | Sole policy-to-device admission boundary |
| [native_device.py](native_device.py) | Simulator owner thread, action counters, generation fencing and stop acknowledgement |
| [policy_observation.py](policy_observation.py) | Named camera/proprioception serialization for actual policy requests |
| [modes.py](modes.py) | Learned, direct and hybrid response normalization |
| [resources.py](resources.py) | Explicit shared-device resource leases |
| [watchdog.py](watchdog.py) | Independent lease/deadline monitoring |
| [video.py](video.py) | Worker-local native frame recording |

The process entry remains `python -m physical_harness.execution.worker`.
Its transport accepts UTF-8 JSON messages of at most 32 MiB, with nonblank
request identities and explicit operations. Duplicate JSON fields and nonfinite
numeric values fail during standard-library decoding. Duplicate active identities terminate
admission. Python's stream reader bounds input before JSON decoding; TaskGroup owns
request failures and cancellation. EOF, malformed input and failed publication
revoke the lease before Session cleanup and pipe closure. Expected operation errors
return their scoped error receipt. The CPU transport and actual host/worker
initialization checks are in the
[validation guide](../../../../../docs/implementation/cpu-release-validation.md#worker-process-transport).

`ActionGate` validates generation, task identity, ActionSpec, observation freshness,
resource ownership and budgets before bounded device dispatch. `PolicyRollout` composes
an inference port with that gate. Pause invalidates old chunks; stopped confirmation
is separate from closed admission. Actual devices must fence old commands themselves.

`NativeActionDevice` now serializes native calls on one owner thread. It checks
execution identity and generation immediately before a control step, exposes a
thread-safe stop predicate to the simulator, and waits for the current step to
finish before confirming a stopped boundary. Actual step completion and counters
are recorded on that thread, so cancelling an asynchronous waiter does not erase
physical effects. A new execution can bind only after the prior execution stops.

Owner-thread waits propagate cancellation at the caller's admitted deadline.
The device retains outstanding Futures, fences an uncertain dispatch and checks
late operation errors during close. Deadline expiry supplies no stop acknowledgement.
Background policy or watchdog failure reaches the upper task through a scoped
native fault, preserving the last recorded physical state and independent formal
verification rules. Native transport closure confirms the owned process group
has exited; unclean termination retains its original error.

Configured `EDH_POLICY_REQUEST_RECORD_DIR` and `EDH_METRIC_CAPTURE_RECORD_DIR`
must be absolute, existing writable directories. Initialization checks actual
exclusive-file creation and deletion before allocating the SDK environment.
An unconfigured recorder requires no directory. The operator owns these paths.

Native providers recheck that stop predicate immediately before physical dispatch,
including after an authoritative episode-status read. When
`EDH_POLICY_REQUEST_RECORD_DIR` is configured, `NativeActionDevice.stop` retains
the original acknowledgement under `<execution_id>/stop-<boundary_id>.json`.
The record includes its acquisition time, executed/uncertain action totals,
reported physics count and the most recent owner-produced observation/physics
metadata. SDK counter provenance remains available through the provider's original
native records. Recording changes neither the acknowledgement wire format nor
the requirement to drain the actual device owner before confirming its boundary.

An actual RoboCasa GPU check used explicit manual inputs through `ActionGate`: a
confirmed pause, resume and budget stop executed two control steps; another job
continued the same scene; a stop during a 16-action chunk halted after one step.
The scene remained stationary after its stop acknowledgement. These checks establish
the native gate/device boundary. The host bridge and job/frame event mapping also
carry actual GR00T policy controls and stopped-boundary checks. The independent
watchdog fences native admission on lease loss or the original wall deadline.
Same-host OS resource locks serialize policy and active-view motion across
workers with an explicitly shared device scope. Paused executions retain ownership;
confirmed ended executions release it. See the
[physical safety guide](../../../../../docs/implementation/physical-safety.md) and the
[adapter guide](../../../../../docs/implementation/model-policy-adapters.md).

`encode_policy_observation` admits named PNG RGB cameras and finite proprioception
arrays under byte, pixel and channel limits. The policy request carries the native
observation ID and acquisition time. Learned-policy camera/state serialization
contains no simulator task predicates. Configured simulation fact tools expose
authorized native facts to Planner; independent formal `check` operations require
their stopped boundary and fresh Verifier assignment. A real RoboCasa
request with three camera images and five PandaOmron state arrays has been generated
under ignored local deployment evidence. The full-horizon console run retains
66 GR00T requests, 1,050 controls, 26,250 physics steps and formal native GT failure.
