# Perception execution

`sam31.py` serves official SAM 3.1 multiplex segmentation, and `yolo26_depth.py`
serves official YOLO26 depth predictions. Each service validates selected source
revisions and checkpoint digests at startup and runs in its isolated model
environment. They remain optional modules; the base package imports the
`PerceptionProvider` interface without GPU, simulator or model dependencies.
Wire schema is owned by `harness/contracts/schema/physical.schema.json`.

Both standalone service CLIs handle `--help`, required arguments and declared
port/checkpoint paths before optional SDK imports. Normal service startup imports
the required libraries directly and performs its original source/checkpoint
verification. The SAM service remains independently runnable with its MIT notice.
Eight actual CLI process checks cover these preallocation boundaries without
loading SDKs or models. See [perception startup validation](../../../../../docs/implementation/cpu-release-validation.md#perception-service-arguments).
Loaded model startup and segmentation/depth outcomes keep their native gates.

`metric_geometry.summarize_metric_region` computes a mask region from paired
native float32 axial depth and PNG RGB. It checks source-image identity, source
dimensions, binary PNG mask, intrinsic calibration, a rigid camera transform,
capture identity and depth bounds. The caller supplies observation ownership,
stopped-device admission and a genuinely paired native RGB-D capture. The helper
returns valid counts, axial/range statistics, pixel centroid, mean visible-surface
camera/world centroids and coordinate-wise medians in meters. The visible surface
centroid describes selected observations; semantic object identity and complete
object geometry require their own evidence.

Back-projection, camera range and camera/world coordinate reductions use NumPy's
scoped arithmetic checks. Overflow, invalid floating-point operations and division
by zero raise at their calculation site. Successful measurements retain the same
equations, output fields, units and source identities.
`scripts/check-recorded-metric.py --check-numeric-admission` recomputes an original
native record and rejects explicitly invalid finite-calibration derivatives for
camera-range and world-centroid overflow. It retains input and production-source
hashes and starts no model or simulator.

An identified native RoboCasa OpenCabinet capture and actual SAM masks pass
[`check_metric_geometry.py`](../../../../../examples/perception/check_metric_geometry.py).
Independent pinhole equations and homogeneous camera transforms reproduce the
helper's camera/world centroids and range. A different actual camera source hash
is rejected. Actual region medians are 1.282525/0.952102 m axial and
1.412978/1.046194 m range. The retained report on `jd_B300` is
`.local/work/perception-20260930/measured-geometry-rgb.json`.
See the [upper perception guide](../../../../agent-runtime/perception/README.md)
for model service evidence and raw prediction errors against these paired depths.
