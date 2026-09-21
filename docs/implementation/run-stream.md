# Run event streaming

The console loads the run projection through `GET /api/runs/:id?events=none`, reads
its history in bounded pages, then subscribes to
`GET /api/runs/:id/events?format=delta&after=N`. `N` is the number of contiguous
events already held by that client. The server validates the cursor before sending
stream headers. Negative, malformed, unsafe or future cursors are rejected.

## Initial history

The projection returns an empty `events` array and the visible `eventCount` at that
instant. The console fixes this count as its initial history boundary and requests
`GET /api/runs/:id/history?after=A&through=N` until every event through `N` is loaded.
Each response contains `runId`, `afterSequence`, `throughSequence`, `eventTotal` and
`events`. `eventTotal` is the requested boundary, and `throughSequence` is the last
event in that page. Pages use the same 128-entry and 256 KiB body targets as SSE.
An empty page is valid only at the selected boundary.

Concurrent events do not change the selected initial boundary. SSE catches up from
that boundary after loading. The console checks page identity, sequence and boundary;
switching runs stops further reads for the previous selection. The connection label
shows history-loading progress. The original GET without `events=none` still returns
complete history for explicit full-history clients.

RunHistory reads only the requested immutable event records. A record written beyond
the published count stays invisible. Restart annotations contribute one additional
visible sequence from their separate namespace. Legacy inline histories remain
readable. Startup reconciliation validates event pages without collecting every event
into another complete history array.

## Update protocol

The SSE event name is `run-update`. Its JSON body has these fields:

| Field | Meaning |
| --- | --- |
| `protocol` | `edh.run-update.v1` |
| `runId` | Identity of the subscribed run |
| `afterSequence` | Last event already held by the client |
| `throughSequence` | Last event supplied by this batch |
| `eventTotal` | Total visible events at the time of projection |
| `events` | Contiguous suffix following `afterSequence` |
| `projection` | Current run view without its events, or null during catch-up |

An event batch contains at most 128 events and targets at most 256 KiB of encoded
event bodies. An individual larger event travels alone so its content remains intact.
These limits exclude the SSE envelope and current projection. They do not impose a
total stream-byte limit or discard stored events.

While catching up, the client appends batches without rendering a new state. The
final batch supplies the current projection and makes the completed view visible.
Projection-only updates carry an empty event list; live model text can change without
creating a domain event. Client merging reuses the existing history array in this case.
It rejects discontinuities, duplicate batches, another run's identity, a shrinking
published total, and projections that do not match their event boundary. A protocol
violation closes the console subscription and displays the error.

## Connection and lifecycle

The SSE `id` is `throughSequence`. Native EventSource reconnects with `Last-Event-ID`,
which takes precedence over the original `after` query. The client retains previously
accepted batches across reconnects. A new page load reads the initial history again in pages.
Restart annotations participate in the visible cursor even though their durable
records have a separate namespace. No physical commands are replayed by this stream.

`RunEventStream` coalesces ordinary notifications for 60 ms. Pending batches continue
without waiting for another domain event. A false `ServerResponse.write` result
suspends further writes until `drain`; the accepted batch is not resent. Notifications
received during that interval mark the stream dirty. Heartbeats observe the same
backpressure. Disconnect and server close clear scheduled work and release the stream.

Callers using the default `format=snapshot` continue to receive complete `snapshot`
events. The console explicitly selects the incremental protocol. The server limits
concurrent event streams to 16.

`ApplicationOptions.onChange` receives only `{ id, state, updatedAt }`. Consumers
request `UpperRun.snapshot()` when they need the full run. This prevents full history
cloning on every model text chunk solely to announce that the run changed.
`UpperRun.projection()` clones current state with an empty event array and the
published count. Incremental server views read only the event page following the
subscriber's cursor. A text-only update reads no historical event bodies. Complete
`snapshot()` and full-history API reads remain explicit operations.

## Active event publication

`UpperRun.state` retains the current projection with `events: []` and `eventCount`.
`RunHistory.append` writes the immutable event, publishes the versioned run projection,
then advances the in-memory count and timestamp. Notifications and recovery observation
follow publication. A failed projection write leaves an unpublished event that history
readers exclude; it cannot be overwritten by a later append. Storage errors propagate.

The active task has no fixed event-count cutoff. Its journal index still grows with
the number of distinct records. Event bodies are read by page, or reconstructed by
an explicit `snapshot()` call. Consumers inspecting `state.events` must use history
pages or `snapshot()` to obtain event bodies. Domain state, TODOs and live output
remain available directly in the projection. Message delivery has its own counter
for the existing 256-delivery admission limit on agent-authored messages.

## Validation and remaining limits

[Transport checks](../../tests/console/run-update.test.mjs) exercise the production
producer, merger and HTTP stream with declared event documents. A native Node
EventSource reads real localhost HTTP, resumes after a forced connection close,
crosses actual writable backpressure, and receives a projection-only update. The
console check command enables Node's experimental EventSource implementation.
No model, policy, simulator or hardware execution is represented by these checks.

`pnpm test:history` runs [journal page checks](../../tests/runtime/run-history-pages.test.ts)
against real LocalStore persistence and the production client merger. They cover a
fixed boundary during append, bounded reads, UTF-8 sizes, single large events,
detached results, unpublished suffixes, restart annotations, legacy data, journal
reopening and invalid boundaries. The HTTP stream test also uses partial event windows
to exercise absolute cursors across reconnection and projection-only updates.

The publication checks exercise durable writes, projection publication failure,
immutable event bodies, detached snapshots and invalid counters. A child process with
a 64 MiB V8 old-space limit publishes 4,097 events totaling more than 64 MiB, reopens
the journal and validates every event through bounded pages. This constrains the
JavaScript old-space heap, not total process memory, and does not execute an agent.

LocalStore retains a byte-position index and reads journal bodies on demand. The browser
still retains complete task histories. Recovery observation stores selected event
references and reads bounded progress batches. Journal compaction, key-index growth,
browser history eviction and media retention require separate work. Current projections contain assignment and task data,
and a single large event remains atomic. Bounded event reads and transfer do not
establish bounded lifetime storage or live-model performance.
