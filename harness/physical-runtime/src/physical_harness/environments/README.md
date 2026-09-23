# environments

`NativeEnvironment` defines the synchronous methods called by one simulation owner
thread. `reset` initializes a session scene; `bind_task` validates each later upper
task without resetting that scene. `describe` declares native action, observation,
check and active-view capabilities. `step` reports whether one admitted command
began and completed, plus actual internal simulation steps. Its `should_stop`
callback lets a provider interrupt a longer native command. Unknown check or view
requests fail in the provider.

`NativeObservation` carries bounded camera bytes and selected state channels. It
contains no simulation ground truth. Formal `check` is called only for a confirmed
stopped boundary by the execution worker. The shared wire schema remains in
`harness/contracts/schema/physical.schema.json`. Importing this interface does not
load simulator SDKs.
