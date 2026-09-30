# Perception tools

The Planner calls capture/active observation directly and receives images as native
DSH image content. `admitSensorSample` validates bounded metadata and immutable image
references supplied by an EmbodiedBackend. `sensorImages` assembles only explicitly
granted samples. Neither function creates an independent perception agent.

`SensorSamples` persists admitted metadata in the existing LocalStore journal, scoped
by run identity. `retain` validates the entire sample and attachment conflicts before
writing missing immutable attachment records, then publishes the sample. Exact replay
adds no records. A failed publication can leave immutable attachment reservations;
the sample remains unavailable until it is published successfully. JSON metadata uses
the journal representation, including omitted optional undefined fields and numeric zero.

`read` fetches only the requested sample and its attachment metadata, verifies source,
identity and immutable records, and returns detached values. It is an internal storage
API. UpperRun checks assignment grants before reading and rejects debug-only evidence
before model delivery. Stored records never grant access or restore an agent session.
New runs have independent namespaces, even when a provider reuses evidence identifiers.

UpperRun retains current sensor projections and assignment reference sets. Historical
sample bodies and attachment metadata are read on demand. LocalStore's key index,
grant sets, audit/projection records and journal disk usage have separate growth costs.
Historical runs created before this catalog have only their originally stored evidence;
the catalog does not reconstruct missing records or resume historical assignments.

Run `pnpm test:evidence` for real-journal acceptance using authored metadata documents.
The tests cover immutability, replay, visibility, namespace isolation, partial publication,
invalid records and reopen behavior. A process with a 64 MiB V8 old-space limit stores
and rereads 1,600 documents totaling more than 64 MiB. This tests metadata storage,
not image bytes, whole-process RSS, sensor accuracy or model behavior.

`perception.segment_objects` is an optional native DSH tool. Its input names a granted
`evidenceId`, an image `attachmentId` in that sample, and a `textPrompt`. UpperRun
reads the authorized image, calls `Sam31HttpClient` on loopback HTTP, validates image
identity and dimensions, and retains overlay and mask samples as new evidence. The
calling assignment receives their references. The returned object IDs identify one
SAM inference session; `resultId` links its masks and overlay. Stored visualization
metadata keeps the source image hash, prompt, model revision, checkpoint hash, JPEG
input hash, and session adapter. Dense masks remain image attachments and do not enter
the model context as numeric arrays. Other assignments need an explicit evidence grant.

The standalone service is
[`sam31.py`](../../physical-runtime/src/physical_harness/perception/sam31.py).
It uses the official SAM 3.1 multiplex builder and the local checkpoint selected by
`--checkpoint`. The source revision and checkpoint SHA-256 are required at startup.
The pinned source revision used for the recorded acceptance is
`2345a4ad109ac29c569da749c91d84f10dc08c40`; the local checkpoint digest is
`0567debeec80ba4ac6369540c6c248025283cb3ff2b92827509e57e2b3541cb6`.
The service records `sam31-multiplex-init-state-v1`, a revision-gated session
initialization adapter. It preserves the official prompt and close-session methods.
The source and weights retain their original Meta terms; this standalone service has
its own MIT source notice.

An isolated Python environment with the pinned SAM source, PyTorch, FastAPI and
Uvicorn runs the service. Set `TMPDIR` to a dedicated ignored work directory and
choose the device with `CUDA_VISIBLE_DEVICES`. The service binds to `127.0.0.1` and
accepts an explicit port. For the actual image check, run
[`check_sam31.py`](../../../examples/perception/check_sam31.py) against that service
with a native camera PNG, a prompt and an ignored output directory. A RoboCasa
256 × 256 camera image with prompt `cabinet` produced two nonempty masks with areas
6,953 and 17,627 pixels. The source image hash matched the camera attachment.
This verifies the standalone model service and image output. An actual DSH assignment
tool round with model-visible retained overlay remains to be checked.

The deployment can use
[LocalImageStore](../../../docs/implementation/image-storage.md) for encoded image
bytes, normalization and model request projection. See the
[Planner loop and image path](../../../docs/implementation/model-policy-adapters.md).

`Yolo26HttpClient` implements `DepthEngine` against the independent loopback
`yolo26_depth.py` service. Inputs include the source RGB bytes and dimensions,
an optional binary SAM mask and ROI, and optional identified camera intrinsics.
The service returns source-sized float32 NPY depth, an overlay, selected/valid
pixel counts, validity fraction, axial-depth median and p10/p90 values. Identified
intrinsics additionally permit camera-range median using the pinhole projection.
The client verifies source/mask digests, region identity, dimensions, statistics,
calibration identity and the retained depth-array digest. Both clients apply
cancellation and the configured bounded timeout throughout response reading.

YOLO26 results carry `measurementKind=monocular_prediction`,
`metricAccuracy=unverified_for_source_camera`, global checkpoint scale calibration
and unavailable model uncertainty. Intrinsic calibration supplies projection
geometry; validating absolute prediction accuracy requires corresponding source
camera ground-truth depth. Region p10/p90 values describe observed depth spread
and do not constitute model confidence bounds. The official
[depth documentation](https://docs.ultralytics.com/tasks/depth) specifies the
aligned `(H,W)` meter output and its checkpoint calibration. Simulator RGB-D and
GT measurements retain their own evidence and measurement kind.

Real service acceptance on September 30 used the retained 256 × 256 RoboCasa
camera PNG with SHA-256
`b46b25d0f6ddf6d9b9e6098c6e8504a834d5830400f2827fefd38ed210ee3202`.
[`check_perception_services.ts`](../../../examples/perception/check_perception_services.ts)
ran the production SAM and YOLO26 HTTP clients through actual GPU services.
Independent cold/warm SAM sessions returned 6,953 and 17,627 selected pixels;
all selected predicted depth values were valid. The axial-depth medians were
0.9059616 m and 0.8306032 m. Complete cold/warm rounds took 59.915 s and 7.554 s.
Their retained depth NPY digest was
`a794fc08e606c95b2277c87e3e70004b78af044eef5db0c0da6c87a90e84b978`.
YOLO26 source revision was `e5b73a40a3781e0dee8b9ab49b83f42e3b85bc45`;
checkpoint SHA-256 was
`a01d5e38f66db8617720d7765ef6228343e75c49b2790fbeb10316c5b8db817c`.
Independent checkpoint inspection reads `Depth.cal_a=1.0` and
`Depth.cal_b=-0.316650390625` from the loaded model head.
Evidence is retained locally in
`.local/work/perception-20260930/ts-acceptance/result.json`.
The native RoboCasa RGB-D capture below supplies matching geometry for this image.

[`check_yolo26_depth.py`](../../../examples/perception/check_yolo26_depth.py)
independently recomputes region statistics from the returned NPY with NumPy.
The actual RoboCasa SAM mask passed every independent statistic and artifact
digest check on September 30; its 6,953 pixels reproduce the values above.
An optional identified intrinsic JSON verifies camera range. An optional paired
GT NPY reports unaligned absolute relative error, meter RMSE and delta1, preserving
the exact comparison source digest. Use corresponding RGB/depth observations and
an ignored output directory for these checks.

[`check_sam_yolo_metric_capture.py`](../../../examples/perception/check_sam_yolo_metric_capture.py)
validates the native capture manifest, RGB/depth digests, pixel orientation and
depth convention before running segmentation and region comparisons. On September
30 it used a real OpenCabinet pretrain seed-0 capture, layout 53/style 37,
observation `164b98ca-a598-49e4-83eb-921fe641f6ef`. Each camera's paired RGB and
depth came from the same native render; the provider checker established unchanged
robot state, simulator time and observation pixels around that render. The left
camera has `fx=fy=221.7025033688163`, `cx=cy=128`. Source depth is positive float32
axial depth in meters. All comparisons use the returned checkpoint predictions
without scale adjustment.

| SAM left-camera region | Pixels | Predicted median axial depth | GT median axial depth | Absolute relative error | RMSE | delta1 |
| --- | --- | --- | --- | --- | --- | --- |
| Object 0 | 6,953 | 0.905962 m | 1.282525 m | 0.299552 | 0.401618 m | 0.001870 |
| Object 1 | 17,627 | 0.830603 m | 0.952102 m | 0.118612 | 0.132137 m | 0.909627 |

Both regions have validity and paired-depth fractions of 1.0. Median absolute
errors are 0.372860 m and 0.102197 m; camera-range medians are predicted
1.001570/0.937561 m and measured 1.412978/1.046194 m. These checks validate
projection/statistic computation and reveal substantial absolute prediction error
on this pose. Validity fraction counts usable numeric pixels and does not certify
distance accuracy. This checkpoint has no demonstrated centimeter-scale distance
accuracy for this source camera. Simulator metric tools should consume identified
native RGB-D/GT geometry. YOLO26 outputs retain their prediction metadata.

The `cabinet` prompt returned no instances on the right and wrist cameras;
their reports preserve the empty results. SAM's instance scores express model
segmentation scores, without measured semantic-mask accuracy. This check covers
one native scene and pose and establishes no wider task or camera accuracy.
The complete source capture is retained on `jd_B300` under
`.local/work/robocasa-qwen-20260930/metric-depth-calibrated/`; the independent
comparison report is under `.local/work/perception-20260930/gt-comparison-final/result.json`.
