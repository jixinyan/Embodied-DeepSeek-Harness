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

An actual RoboCasa GPU check used explicit manual inputs through `ActionGate`: a
confirmed pause, resume and budget stop executed two control steps; another job
continued the same scene; a stop during a 16-action chunk halted after one step.
The scene remained stationary after its stop acknowledgement. These checks establish
the native gate/device boundary without learned-policy inference. The host bridge,
job event mapping, independent watchdog and resource arbiter remain open. See the
[adapter guide](../../../../../docs/implementation/model-policy-adapters.md).

`encode_policy_observation` admits named PNG RGB cameras and finite proprioception
arrays under byte, pixel and channel limits. The policy request carries the native
observation ID and acquisition time. It excludes simulator ground truth; that remains
available only through the stopped-boundary formal `check` path. A real RoboCasa
request with three camera images and five PandaOmron state arrays has been generated
under ignored local deployment evidence. It has not yet received a learned-policy
response.
