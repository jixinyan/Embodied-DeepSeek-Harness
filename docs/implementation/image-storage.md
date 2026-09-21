# Image storage and request projection

`LocalImageStore` implements the existing DSH `AttachmentStore` service. It uses the
pinned upstream raster inspection, normalization, publication, compression limiter and
request-image functions. The EDH service supplies an explicit storage directory,
validated deployment limits, detached inputs, bounded operation admission and native
Cordis disposal. It is exported by `@edh/storage`.

## Deployment API

Mount the provider on a deployment-owned Cordis context and retain that context until
all consumers finish:

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

This is a callable deployment component. The default server does not mount it
automatically. Deployment injection into environment factories, an authorized HTTP
image endpoint, console sensor rendering and live VLM acceptance remain open.

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

Run `pnpm test:images`. Ten tests use the repository's actual PNG logo and real local
files. They exercise native service mounting and encoded-prompt admission, concurrent
deduplication, reopening, batch rejection, byte/pixel limits, filename sanitization,
normalization, request projection/cache reads, cancellation, corruption, immutable
reference checks, operation admission and shutdown during publication. No model,
camera, simulator or browser is executed. Sources and local patches are recorded in
the [DSH provenance map](../provenance/dsh-imports.json).
