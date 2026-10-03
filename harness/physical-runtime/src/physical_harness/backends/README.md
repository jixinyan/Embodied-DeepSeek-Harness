# Device backends

`hardware.py` supplies discovery validation, a typed SDK provider interface and
the generation-fenced `HardwareActionDevice` adapter for ActionGate. Initial
execution binding requires a matching actual stopped acknowledgement before
arming. Connection identities are rechecked before commands; reconnect requires
explicit readmission. A declared independent controller watchdog is mandatory.

The existing `DeviceBackend` protocol remains available for provider composition.
No physical SDK provider is registered. Imports stay usable without GPU,
simulator or device SDK dependencies. Wire schema is owned by
`harness/contracts/schema/physical.schema.json`. See the
[physical safety guide](../../../../../docs/implementation/physical-safety.md)
for interface validation and actual acceptance boundaries.
