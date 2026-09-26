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
