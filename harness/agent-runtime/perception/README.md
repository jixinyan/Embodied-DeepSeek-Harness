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

Custom perception tools remain ordinary native DSH tools. Real camera bytes and
normalization belong to the deployment attachment store and model resolver; SAM,
depth/localization and simulator providers still require actual integration.
See the [Planner loop and image path](../../../docs/implementation/model-policy-adapters.md).
