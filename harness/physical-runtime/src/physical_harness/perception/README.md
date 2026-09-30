# Perception execution

`sam31.py` serves official SAM 3.1 multiplex segmentation, and `yolo26_depth.py`
serves official YOLO26 depth predictions. Each service validates selected source
revisions and checkpoint digests at startup and runs in its isolated model
environment. They remain optional modules; the base package imports the
`PerceptionProvider` interface without GPU, simulator or model dependencies.
Wire schema is owned by `harness/contracts/schema/physical.schema.json`.

`metric_geometry.summarize_metric_region` computes a mask region from paired
native float32 axial depth and PNG RGB. It checks source-image identity, source
dimensions, binary PNG mask, intrinsic calibration, a rigid camera transform,
capture identity and depth bounds. The caller supplies observation ownership,
stopped-device admission and a genuinely paired native RGB-D capture. The helper
returns valid counts, axial/range statistics, pixel centroid, mean visible-surface
camera/world centroids and coordinate-wise medians in meters. The visible surface
centroid describes selected observations; semantic object identity and complete
object geometry require their own evidence.

An identified native RoboCasa OpenCabinet capture and actual SAM masks pass
[`check_metric_geometry.py`](../../../../../examples/perception/check_metric_geometry.py).
Independent pinhole equations and homogeneous camera transforms reproduce the
helper's camera/world centroids and range. A different actual camera source hash
is rejected. Actual region medians are 1.282525/0.952102 m axial and
1.412978/1.046194 m range. The retained report on `jd_B300` is
`.local/work/perception-20260930/measured-geometry-rgb.json`.
See the [upper perception guide](../../../../agent-runtime/perception/README.md)
for model service evidence and raw prediction errors against these paired depths.
