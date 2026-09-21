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
finish mounting `context.attachments` before returning. The framework validates the
service presence. Deployment construction/startup failures dispose the context;
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
deployment details. Binary retention, reference accounting and garbage collection remain
required work; the provider currently retains immutable objects and request variants.

## Acceptance

Run `pnpm test:images`. Seventeen tests use the repository's actual PNG logo, real local
files and HTTP sockets. They exercise native service mounting and encoded-prompt admission, concurrent
deduplication, reopening, batch rejection, byte/pixel limits, filename sanitization,
normalization, request projection/cache reads, cancellation, corruption, immutable
reference checks, operation admission, startup cleanup, deployment service injection,
scoped HTTP reads, local-origin restrictions and shutdown during publication.
Browser component acceptance uses this same PNG and production renderer/HTTP reader:
loaded dimensions, multiple slots, stable DOM refresh, empty/restricted states and
missing-evidence errors are inspected through DOM state. No model, camera or simulator
is executed. Full application acceptance with a live VLM/provider remains pending.
Sources and local patches are recorded in
the [DSH provenance map](../provenance/dsh-imports.json).
