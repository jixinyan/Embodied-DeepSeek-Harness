# Physical runtime safety boundaries

`NativeWorkerSession` admits every policy execution through a motion resource
lease and an independent `ExecutionWatchdog`. The watchdog uses a dedicated
Python thread with a 50-ms polling interval. Lease loss or the original wall-time
deadline immediately fences the bound `NativeActionDevice`; it schedules the
existing ActionGate stop operation on the event loop. Simulator SDK calls remain
on the native owner thread. A stop acknowledgement is published only after that
thread has drained the admitted operation.

The watchdog remains active during an ordinary pause. The original budget does
not restart when Planner resumes. A budget stop remains eligible for a fresh
independent Verifier after device confirmation; connection loss remains a failed
physical boundary. Planner retains all retry and resume decisions.

## Shared physical resources

`ResourceArbiter` uses `filelock` OS locks to exclude conflicting commands across
worker processes on the same host. Acquisition is immediate and reports
`ResourceBusy` when another owner holds a requested resource. Multi-resource
acquisition releases any already acquired locks if admission fails. Lock files
contain no retained authority; the OS releases ownership when a process exits.

Worker initialization accepts:

- `shared_resource_scope`: stable identity for workers sharing an actual device
  or retained external controller. Independent simulator instances use their own
  worker clock identity by default.
- `resource_lock_directory`: an absolute directory shared by those workers.
  The default is the EDH repository's ignored `.local/physical-resources` directory.

The current worker resolves policy motion and active-view motion to the same
`motion` resource. This conservatively serializes the device's actuators. Ordinary
image capture and formal evidence reads retain their existing provider handling.
Paused executions retain their motion lease until a confirmed terminal stop.
Resources remain held when stopping is uncertain. Cancelling an owner-thread
waiter drains its operation before an active-view lease can be released.

Cross-host controller sharing requires deployment-level ownership or a controller
arbiter; local filesystem locks establish same-host exclusion only.

## Hardware integration interface

`physical_harness.backends.hardware` supplies `HardwareCapabilities`, the
`HardwareBackend` provider protocol and a `HardwareActionDevice` adapter for
ActionGate. Discovery declares device, embodiment and connection identities,
actuator/camera/state channels, coordinate frames, the complete ActionSpec,
optional pause/resume support and an independent controller watchdog deadline.
Admission validates identities, unique named channels, the action frame and
schema, and a finite controller watchdog timeout of at most ten seconds.

An SDK provider implements discovery, generation-fenced dispatch, stop,
execution arming, optional resume and disconnect. Initial execution binding
requires an actual matching stopped acknowledgement before arming. Every
command rechecks discovered connection identity; reconnect requires explicit
readmission. Missing or unconfirmed stopping remains uncertain. Disconnect
requires a matching confirmed boundary for an admitted execution.

This interface contains no simulator reset or GT requirement. A selected hardware
SDK, controller watchdog and physical device are required for hardware execution
acceptance. Hardware capability declarations alone establish interface validation.

## Executable evidence

Run `.venv/bin/python -m unittest discover -s harness/physical-runtime/tests
-p test_safety_runtime.py -v` from the repository root.

Eleven checks execute the production watchdog, actual OS file locks across two
processes, failed-acquisition cleanup, independent device scopes,
and authored capability declarations against the actual wire schema. The watchdog
fences admission while the asyncio owner is blocked, reacts to actual lease
revocation and remains inactive after disarming. These checks execute no simulator
or hardware task and establish no model, physical stop or task-success result.

Native inference/control disconnection, stale-action rejection, observation motion
and hardware SDK stop acknowledgement require retained actual-provider evidence.
