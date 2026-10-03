# Execution

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
observation ID and acquisition time. It excludes simulator ground truth; that remains
available only through the stopped-boundary formal `check` path. A real RoboCasa
request with three camera images and five PandaOmron state arrays has been generated
under ignored local deployment evidence. The full-horizon console run retains
66 GR00T requests, 1,050 controls, 26,250 physics steps and formal native GT failure.
