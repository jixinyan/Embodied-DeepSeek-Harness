# Paged native session audits

`SessionAudits` persists native DSH event snapshots at delivery quiescence and role
retirement. Each event is a separate immutable journal record. An assignment index
publishes the visible count after event writes complete. An uncommitted suffix is
excluded from readers. This is a read-only debugging history; it does not resume a
DSH session or physical commands.

The final retirement snapshot is taken after native handle disposal, so scope-cleanup
events are included. Audit publication is attempted even after a disposal error;
failures remain visible to the retirement caller and Team shutdown. See the
[assignment lifecycle](assignment-lifetime.md).

## HTTP and console

`GET /api/runs/:runId/audit` returns an assignment index:

```json
{
  "runId": "run-id",
  "sessions": [{ "assignmentId": "assignment-id", "eventTotal": 300 }],
  "nextAfter": null
}
```

At most 64 assignment summaries are returned. Continue with `afterAssignment` equal
to `nextAfter` when it is non-null. Ordering follows durable assignment-index insertion
and survives journal compaction. Newly published assignments can appear on subsequent
index pages. Event bodies are read only after selecting an assignment. The index
includes assignments with published audits; an active assignment may have no audit yet.

Use `?assignment=assignment-id` for the latest published event page. Optional parameters:

- `after=N`: forward page starting at zero-based event offset N.
- `before=N`: backward page ending immediately before offset N.
- `through=N`: fixed published event count for the browsing operation.

`after` and `before` are mutually exclusive. Without either, the latest page ends at
`through`, or the current published count when `through` is omitted. Each response has
`runId`, `assignmentId`, `afterOffset`, `throughOffset`, `eventTotal` and `events`.
The events occupy the half-open range `[afterOffset, throughOffset)` in the stored
array. These offsets do not reinterpret the native DSH event's own sequence fields.
For forward continuation, supply the returned `throughOffset` as `after` and retain
`eventTotal` as `through`. Backward continuation uses `afterOffset` as `before` with
that same `through`. Later appends remain outside the selected range. Refreshing the
latest page explicitly selects the new published count.

Pages contain at most 128 events with a 256 KiB encoded-event-body target. One event
exceeding that target is returned intact on its own, subject to LocalStore's existing
per-record limit. JSON response framing, pretty printing and browser object overhead
have additional memory costs. These bounds do not cap the entire process's memory.

Missing runs and foreign/missing assignment cursors return 404. Invalid, duplicate,
unknown or conflicting query parameters and out-of-range offsets return 400. Corrupt
indexes or missing published event records propagate a storage error. Local Host,
Origin and browser Fetch Metadata admission applies to the route. The service remains
local and single-user. Assignment selection does not expose another task's audits.

The Native DSH audit inspector keeps one assignment-index page and one event page.
Controls select assignments, browse additional assignments, navigate earlier/later
events and refresh the latest published events. Event bodies render as text. Loading,
empty and error states are explicit; stale responses from a closed/replaced inspector
cannot overwrite its current contents. This HTTP response is paged; clients must follow
the index and event cursors to export complete histories.

## Storage and API ownership

`SessionAudits.index`, `page` and `before` read from the authoritative journal.
Indexes are validated through Zod. Indexed event bodies are loaded only within the
requested range. Legacy inline audit arrays remain readable, and their next append
publishes individual event records. Reading a legacy array still materializes that
single legacy record, subject to the journal record-size limit.

The existing in-process `read(runId)` is an explicit complete-history read for trusted
callers and can allocate memory proportional to that history. The HTTP inspector uses
the paged APIs. This change preserves DSH event production, append-only publication,
native compaction and role disposal.

## Acceptance and remaining work

`pnpm test:audits` runs nine actual-file/HTTP/process tests. They cover both navigation
directions, fixed ranges during append, UTF-8 byte limits, oversized events, assignment
pagination, task isolation, incomplete publications, corruption, legacy arrays,
compaction and reopening. A child process with a 64 MiB V8 old-space limit writes and
reopens more than 96 MiB of documents and reads every event through bounded pages.
Browser component acceptance uses the production markup, controller and query reader
with actual stored documents. No model or environment executes in these checks.

Disk retention, original-media reference accounting, distinct-key index growth and
native active-session event lifetime still require domain-specific lifecycle work.
Audit paging does not delete history or establish live model/provider acceptance.
