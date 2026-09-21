# Image storage and request projection

`LocalImageStore` implements the existing DSH `AttachmentStore` service. It uses the
pinned upstream raster inspection, normalization, publication, compression limiter and
request-image functions. The EDH service supplies an explicit storage directory,
validated deployment limits, detached inputs, bounded operation admission and native
Cordis disposal. It is exported by `@edh/storage`.

## Deployment API

`startServer` mounts a native attachment service for the application lifetime. The
default `LocalImageStore` uses the resolved `dataDirectory`; `imageStorage` can set
its byte, pixel and operation limits. `/api/config` exposes image limits without
exposing filesystem paths. Supply a deployment factory when model adapters need the
service during construction:

```ts
await startServer({
  root,
  dataDirectory,
  deployment: ({ images }) => createDeployment(images),
});
```

`createDeployment` is deployment-owned composition returning a `ServerDeployment`.
The existing deployment object form remains supported. Both task `createBackend`
and session `createEnvironment` receive `{ signal, services, profile? }`, where
`services.images` is the same application-owned native service. Providers save camera
bytes through it and return the resulting references in `SensorSample.images`.
A retained environment can keep this service for its later task scopes. Providers
must finish their image operations before their own close completes; they must not
dispose the application's attachment context.

`mountImages(context, directory)` can install another native `AttachmentStore` using
the supplied Cordis context. It is mutually exclusive with `imageStorage` and must
finish mounting `context.attachments` before returning. It may return an
`ImageStorageMaintenance` controller with `inspect(signal?)` and
`clearRequestCache(revision, signal?)` methods. A provider returning no controller
keeps image reads/writes available and exposes maintenance as unavailable. The
framework validates service presence and supplied maintenance methods.
Deployment construction/startup failures dispose the context;
normal shutdown disposes it after task/session consumers, DSH and HTTP have stopped.
Native disposal waits for admitted writes and rejects new operations.

Independent consumers can also mount the provider on an owned Cordis context:

```ts
import { Context } from '@deepseek-ai/cordis';
import { LocalImageStore } from '@edh/storage';

const imageContext = new Context();
await imageContext.plugin(LocalImageStore, {
  directory: absoluteDeploymentDataDirectory,
  maxImagesPerMessage: 16,
  maxPendingOperations: 32,
});
const images = imageContext.attachments;
const refs = await images.saveImages(encodedCameraFrames);
```

`encodedCameraFrames` is a batch of `SaveImageAttachment` objects containing encoded
`Uint8Array` bytes, declared MIME type and optional display name. References are returned
only after every image passes admission and publication completes. Put these references
in the appropriate `SensorSample.images`; preserve its task scope, sensor identity,
observation time and visibility. The application admits that metadata through
[SensorSamples](../../harness/agent-runtime/perception/README.md).

The existing `OpenAICompatibleAdapter.resolveImage` callback accepts this provider:

```ts
const resolveImage = (ref, signal) =>
  images.readImageRequest(ref, { maxPixels: 1024 * 1024, maxBytes: 2 * 1024 * 1024 }, signal);
```

Bind the callback when constructing the deployment's adapter. Pixel and byte targets
belong to that model route. This callback resolves native image references already
present in the model input; it does not accept arbitrary URLs or filesystem paths.
The adapter retains its independent image-count and request-byte limits. Dispose the
image context after server consumers stop: `await imageContext.fiber.dispose()`.

The [OpenAI-compatible example](../../examples/deployments/openai-compatible.mjs)
binds this resolver through the deployment factory. Its physical source is explicitly
synthetic; running the example does not establish sensor or simulation acceptance.

## Console image reads

`GET /api/runs/:runId/evidence/:evidenceId/images/:attachmentId` and `HEAD` resolve
only the image reference recorded in that run's persisted sensor sample. Identifiers
are opaque URL components. Missing run/evidence/association returns 404; malformed
identifiers return 400; restricted evidence returns 403. The viewer admits only
`agent` visibility. Assignment-specific access remains independently checked before
model delivery. This is a local single-user service, without multi-user authentication.

Local Host/Origin checks and browser Fetch Metadata checks apply before route access.
Successful responses carry the recorded MIME type, byte count, `no-store`, `nosniff`
and `Cross-Origin-Resource-Policy: same-origin`. Missing byte objects return 410;
integrity/read errors return 500 with a stable public message. Reads receive disconnect,
15-second timeout and server-shutdown cancellation. Arbitrary filesystem paths and
unassociated attachment IDs cannot be requested through this route.

`sensor-images.js` renders the selected latest or agent-seen sample in the observation
panel. It supports up to 16 images, loading/dimension/error status and text-safe labels.
Identical evidence refreshes preserve existing image DOM. Empty or restricted samples
clear and hide the image container. Frames with references use the image viewer;
source labels continue to identify test evidence explicitly.

## Stored objects and validation

Images are normalized beneath `<directory>/attachments/v1`. Object identities are
SHA-256 digests of normalized bytes. Publication uses exclusive staging files,
file/directory synchronization, immutable hard-link publication and digest-checked
deduplication. Returned references describe stored MIME type, dimensions and bytes;
downscaled images also retain source dimensions. Display names retain the final
filename and exclude directory paths and control characters.

The full submitted raster is decoded before publication. Source limits cover encoded
bytes, pixel count, per-side dimensions, image count and aggregate batch bytes. A batch
with invalid metadata or undecodable pixels starts no writes. A storage failure can
leave already published objects without returning a partially successful reference list.
Reads validate identity, digest, byte length, format and dimensions. Missing or corrupt
objects fail; the provider never substitutes another image.

Normalization applies orientation, removes metadata and produces a single-frame
8-bit sRGB image. The original DSH encoder preserves transparency. The quality ladder
chooses the first candidate within the byte target, otherwise its smallest candidate;
the byte target is a compression objective. Transport admission still enforces hard
request limits. Animated inputs are normalized to one frame, so temporal observations
must use explicit ordered frames rather than an animated image as a video substitute.

Request variants use a deterministic identity covering the source attachment, pixel
budget, byte target and encoder settings. Cached variants are fully decoded and checked
for dimensions, color representation, alpha compatibility and absence of animation or
retained metadata. Only a missing cache file triggers creation. Other cache errors fail.
The cache remains a private local optimization; it does not provide signed provenance
against edits by an actor who can write the storage directory.

## Resource and access ownership

The defaults accept at most 16 images per batch, 20 MiB per submitted image, 64 MiB
per batch, 64 million decoded pixels and an 8,192-pixel side. Normalized images target
4,194,304 pixels and 4 MiB. At most two native transformations run concurrently; at most
32 store operations are admitted, including queued work. Limits are validated and
frozen before service registration. These limits do not bound whole-process RSS.

Callers receive detached references and byte arrays. Disposing the owning context
rejects new operations and waits for admitted work. Reads accept cancellation signals;
native encoding work already running finishes before its result is accepted or rejected.

This service is a trusted storage API. It has no assignment or user authorization and
must not be exposed as an unrestricted attachment-ID endpoint. UpperRun grants and
visibility remain mandatory before model delivery. HTTP readers must establish run,
evidence and viewer authorization before obtaining bytes. File host paths are private
deployment details. Local original-object collection and structured journal reference
inspection are available to trusted lifecycle owners as described below. Application-wide
retention policy and collection admission remain required. Request variants support
explicit console cache maintenance.

## Image inventory and request-cache maintenance

`inspectStorage(signal?)` returns `state: ready`, an opaque `revision`, and file/byte
counts for original `objects` and derived `requestCache`. During writes or maintenance,
or when a writer changes the store during inspection, it returns `state: busy`.
Directory enumeration is streamed; inventory does not decode or verify image content.
Ordinary image reads retain their digest and raster validation.

`clearRequestCache(revision, signal?)` requires the current inspected revision and no
active writer, inspection or other maintenance operation. It validates the complete
inventory before removing recognized request variants and their native staging files.
Unknown names, unexpected file types and symbolic links fail validation. It leaves
original objects and original-publication staging files unchanged. Original-image
reads remain available; publication and model-request reads are excluded during cleanup.
The next model-request read regenerates its required variant from the retained object.

The result contains `before`, `after`, `removedFiles` and `reclaimedBytes`. Successful
cleanup synchronizes affected cache directories. Cancellation or I/O failure during
deletion can leave a partially cleared cache and propagates the error; refresh the
inventory before another attempt. Native disposal waits for admitted maintenance.
Revision tokens belong to one service instance and change on image mutations or
cleanup. The application must exclusively own this directory; revision checks do not
coordinate external processes modifying files.

The console exposes inventory and explicit cleanup through idle-only server admission.
The [maintenance API](storage-maintenance.md) describes requests, conflicts and
custom-provider capability reporting. No automatic deletion or total-disk quota is imposed.

## Original-object collection and recorded references

`LocalImageStore.collectUnreferencedObjects(revision, retainedAttachmentIds, signal?)`
removes normalized original objects outside an explicitly supplied complete root set.
It requires the current image revision and no pending image operation, including
original-image reads. The method copies and validates all retained IDs before awaiting
filesystem work. Duplicate roots refer to one retained object. An explicit empty root
set permits removal of all published original objects.

The complete recognized inventory and the presence of every retained original are
checked before deletion. Invalid entries, links, missing retained originals or stale
revisions fail. During collection, new original reads, host-path requests, publications,
model-request reads and other maintenance are rejected. Inventory reports busy.
Successful collection synchronizes affected directories and returns `before`, `after`,
`removedFiles`, `reclaimedBytes` and `retainedObjects`. It preserves request-cache files
and original staging files. Cache cleanup remains an independent operation.

Collection is incremental. Cancellation or filesystem failure after deletion starts
may leave a partially collected set and returns an error. The service advances its
revision on admitted collection, including failed attempts. Native disposal waits for
admitted work. The caller must exclusively own the directory and quiesce consumers
that retained a previously returned host path; an already returned path is not a lease.
Inventory checks filename/type/presence. Ordinary reads continue to verify image bytes.

`inspectStoredImageReferences(store)` reads current journal documents one at a time
and finds structured `attachmentId` fields in nested objects and arrays. It returns
the inspected `storeSequence`, `recordsScanned`, and one reference entry per image,
with its referring-record count and at most four example keys. Repeated references
within one record count once. Malformed local attachment IDs fail inspection. Results
are detached. Memory includes one current record and the distinct image-reference set.
The inventory includes historical evidence, native audit and extension records when
they use structured image references; it scans all current namespaces.

This inventory describes structured journal references. Prose, private extension
files, external indexes and live consumers require their own ownership declarations.
The application retention controller combines journal references with declared source
leases, checks every SKILL source, holds journal writes and validates journal/image
revisions. A complete deployment ownership declaration is required; journal inspection
alone does not account for external references.

Configured deployments expose original-image inspection and token-bound collection
through idle server admission and the console. The collector remains a trusted service;
HTTP clients cannot supply the retained-ID set. No collection runs automatically.
Domain-record deletion and live-provider maintenance acceptance remain required. See
[retention configuration, source leases and the console API](image-retention.md).

## Acceptance

Run `pnpm test:images`. Twenty-three tests use the repository's actual PNG logo, real local
files and HTTP sockets. They exercise native service mounting and encoded-prompt admission, concurrent
deduplication, reopening, batch rejection, byte/pixel limits, filename sanitization,
normalization, request projection/cache reads, cancellation, corruption, immutable
reference checks, operation admission, startup cleanup, deployment service injection,
scoped HTTP reads, local-origin restrictions and shutdown during publication.
Maintenance checks cover byte-preserving original reads after cleanup, regeneration,
stale/busy admission, invalid entries, symbolic links, native staging files,
cancellation and disposal during admitted cleanup.
Browser component acceptance uses this same PNG and production renderer/HTTP reader:
loaded dimensions, multiple slots, stable DOM refresh, empty/restricted states and
missing-evidence errors are inspected through DOM state. No model, camera or simulator
is executed. Full application acceptance with a live VLM/provider remains pending.
Sources and local patches are recorded in
the [DSH provenance map](../provenance/dsh-imports.json).

`pnpm test:image-collection` adds nine real-file checks using the repository PNG and
native image transformations. They cover retained-byte identity, collection/reopen,
shared roots, cache independence, missing/invalid roots, stale revisions, reader/writer
exclusion, invalid entries/links, cancellation, disposal, detached root input, explicit
empty roots and preserved staging. Journal inventory checks cover nested references,
bounded example keys, unchanged stored values, compaction/reopen and fail-fast invalid
identities. These tests execute the local collector against owned test directories;
they do not establish application-wide reference coverage or live provider acceptance.
