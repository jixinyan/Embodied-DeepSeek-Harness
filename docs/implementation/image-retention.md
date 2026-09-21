# Original-image retention in the control console

The server coordinates reference ownership, idle maintenance and original-image
collection. The console previews referenced and unreferenced file counts/bytes before
the user submits deletion. Journal records, SKILL bundles, sensor metadata and request
cache files remain available. No automatic collection runs.

## Deployment ownership

`LocalServerOptions.imageRetention` enables collection with an `ImageRetentionPolicy`
from `apps/server/src/image-retention.ts`. Its `version` identifies the ownership
declaration and `sources` contains every additional image owner in the deployment.
Omitting the policy disables original-image collection while retaining cache maintenance.
The built-in demo declares journal-only ownership; no model or environment runs during
inspection. Custom deployments must declare their complete ownership before enabling it.

The built-in journal source scans structured `attachmentId` fields in every current
record, including independent historical evidence, audits and extension namespaces.
All SKILL bundles are checked through explicit provenance, including bundles outside
the console's latest-100 window. Incomplete or inconsistent SKILL sources stop collection.
Missing retained original files also stop it. Existing images referenced by historical
records remain retained even when they are absent from current sensor projections.

External indexes, private files, prose-only references and consumers holding image
host paths need registered reference sources. Source IDs are unique; `journal` is
reserved. Each source implements:

```ts
interface ImageReferenceSource {
  id: string;
  acquire(signal: AbortSignal): ImageReferenceLease | Promise<ImageReferenceLease>;
}
interface ImageReferenceLease {
  revision: string;
  attachmentIds: readonly string[];
  release(): void | Promise<void>;
}
```

Acquisition must pin a complete source snapshot and coordinate that source's writers
and consumers until release. The revision identifies the reference-set version and
must remain stable across unchanged acquisitions. Return all locally owned attachment
IDs; EDH copies and validates them. A source that fails before returning a lease owns
its partial-acquisition cleanup. Successful leases are released in reverse order on
success, cancellation and failure; release failures are reported. Sources must honor
cancellation. A callback that ignores cancellation can delay shutdown.

Source declaration is an adapter responsibility. The framework cannot discover an
unregistered external reference or stop an independently held filesystem path.
Configured ownership applies to the entire image directory, including data from older
deployment configurations. Migration must retain the reference sources that still own
historical images. Application startup freezes source IDs and acquisition functions.

Custom image mounts can expose `ImageStorageMaintenance.objects` with
`inspectObjectRetention` and `collectUnreferencedObjects`. Configuring retention without
these methods fails startup. The default local provider supplies both methods. The
provider must enforce the revision and exclusive-operation guarantees described in
[image storage](image-storage.md#original-object-collection-and-recorded-references).
The controller validates provider response schemas, reference counts and file/byte
totals. A collection result must agree with its inspected retained and removed sets.

## Admission and lifecycle

1. Server admission requires no open session, active task, allocation/lifecycle operation
   or shutdown. A retained terminal task settles and closes before reference inspection.
2. Every stored user session must report `closed / released`. Interrupted or unknown
   resource ownership blocks original collection until provider reconciliation confirms
   release. Historical resource reconciliation remains a provider-integration requirement.
3. The controller acquires additional reference leases, then holds journal writes while
   validating sessions, every SKILL source and structured image references.
4. The image provider inspects a stable inventory and reports the retained/unreferenced
   counts and bytes. It excludes concurrent image mutation during inspection.
5. The journal write hold and source leases are released. The server returns a detached
   preview with a random token, journal sequence, image revision, reference digest,
   source IDs and inspected SKILL count.
6. Deletion reacquires all references under the same lifecycle rules. Journal sequence,
   source revisions, reference membership and image revision must match the preview.
   It then calls the exclusive image collector while journal writes and reference
   ownership remain held.

`LocalStore.holdWrites()` rejects `put` and compaction while any hold remains active.
Reads and statistics remain available. Releases are idempotent and nested holds remain
independent. This is an in-process writer guard; the store retains its existing
exclusive file ownership. The application awaits maintenance before closing the store.

Only the latest successful preview is retained in server memory. Another inspection,
collection attempt or server restart invalidates the prior token. Collection consumes
the token even when references changed or deletion fails. A fresh inspection is required
for another attempt. File deletion is incremental; cancellation or I/O failure can
leave a partially collected set. Source-release failure after collection is also
reported as an error. Refresh the state before another operation.

## HTTP and console

- `GET /api/storage` includes `originalCollection.available`, source IDs or the reason
  collection is unconfigured. `/api/config.imageStorage.originalCollection` advertises
  the same capability.
- `POST /api/storage/inspect-originals` accepts exactly `{}`. It returns storage/image
  statistics and `originalCollection.preview` with the inspection token and counts.
- `POST /api/storage/collect-originals` accepts exactly `{ token }`. The browser cannot
  submit a retained-ID set or filesystem path. Success returns updated statistics and
  `result.operation: original_image_collection` with removed file/byte counts.
- Malformed input is 400; stale/busy/reference-state conflicts are 409; unconfigured
  collection is 501. Local Host/Origin checks precede maintenance. New scoped image
  reads during collection return 409 and may be retried after maintenance.

Workspace storage shows **Referenced originals** and **Unreferenced originals** after
**Inspect image references**. **Delete unreferenced originals** requires a nonempty
preview and an idle workspace. The UI clears its preview on refresh, another operation
or a failed collection. It displays explicit errors instead of retaining an actionable
stale preview. Existing cache cleanup and journal compaction remain separate controls.

## Acceptance and remaining work

`pnpm test:image-retention` exercises real journals, PNG-derived objects, file-backed
reference leases and HTTP. Coverage includes nested write holds, external ownership,
detached previews, token consumption, stale journal/image/source revisions, unresolved
sessions, incomplete SKILL provenance, source failures, cancellation and idle/origin/input
admission. These HTTP checks invoke production admission and retention functions in
a component server; full application drain with live model/provider work is separate.

Browser component acceptance uses production markup/controller code with actual
document/image storage and reference leases. It verifies a two-retained/one-unreferenced
preview, stale-journal rejection with no deletion, cleared preview/disabled controls,
fresh inspection and successful collection. The two retained image hashes remain
unchanged and the unreferenced file is absent afterward. No model or backend executes.

Domain-record archival/deletion, provider resource reconciliation and automatic quota
policies remain required upper-system work. Retaining every recorded reference can keep
all historical originals. Original collection does not impose a disk quota or establish
physical task performance. Live model/provider maintenance acceptance remains pending.
