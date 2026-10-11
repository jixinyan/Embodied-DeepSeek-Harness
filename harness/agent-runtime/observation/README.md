# Active observation

[`rotation.ts`](src/rotation.ts) owns active rotation request and measured receipt
admission. `admitRotationRequest` accepts finite yaw within ±90 degrees and pitch
within ±45 degrees on the declared device axes. A device with no rotation axes
cannot admit a rotation. `readRotationMotion` uses Zod to admit all measured
angles, two three-dimensional positions, nonnegative safe-integer control/physics
counts and the native stop reason. The receipt must match the requested angles;
unknown or missing fields fail admission. Admitted requests, receipts and position
arrays are detached and immutable.

The NativeTaskBackend calls these functions before request transmission and
before publishing the observation. It retains task identity and native DSH
cancellation checks. `BackendRotationMotion` remains exported by the execution
module as the same receipt type.

UpperRun owns Planner authority, formal-verdict admission and active tool state.
The physical Worker owns task/device leases and the motion resource; the BEHAVIOR
provider controls R1Pro base yaw and torso pitch and records achieved pose and
actual control/physics counts. A policy and active observation cannot own the
same motion resource concurrently. A rotation receipt does not verify a task.

[`check-recorded-rotation.mjs`](../../../scripts/check-recorded-rotation.mjs)
reads private copies of closed original journals. Two native BEHAVIOR receipts
retain their exact values; 94 invalid receipt derivatives and 22 invalid request
inputs reject. The same original results retain native DSH JSON and ordered image
attachments. No model, simulator or physical motion is invoked by these checks.
Additional provider/pitch/concurrency acceptance remains in the native release
requirements.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
