# Execution

`ActionGate` validates generation, task identity, ActionSpec, observation freshness,
resource ownership and budgets before bounded device dispatch. `PolicyRollout` composes
an inference port with that gate. Pause invalidates old chunks; stopped confirmation
is separate from closed admission. Actual devices must fence old commands themselves.

`ExecutionWorker` remains an interface. The host bridge, job event mapping, independent
watchdog and resource arbiter are next. See the [adapter guide](../../../../../docs/implementation/model-policy-adapters.md)
for exact semantics, examples and CPU acceptance limits.
