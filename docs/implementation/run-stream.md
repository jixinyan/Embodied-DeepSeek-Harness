# Run event streaming

The console loads a complete run through `GET /api/runs/:id`, then subscribes to
`GET /api/runs/:id/events?format=delta&after=N`. `N` is the number of contiguous
events already held by that client. The server validates the cursor before sending
stream headers. Negative, malformed, unsafe or future cursors are rejected.

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
accepted batches across reconnects. A new page load obtains a complete run again.
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

## Validation and remaining limits

[Transport checks](../../tests/console/run-update.test.mjs) exercise the production
producer, merger and HTTP stream with declared event documents. A native Node
EventSource reads real localhost HTTP, resumes after a forced connection close,
crosses actual writable backpressure, and receives a projection-only update. The
console check command enables Node's experimental EventSource implementation.
No model, policy, simulator or hardware execution is represented by these checks.

The initial GET still transfers full history. Server projection construction, the
active run, LocalStore and the browser still retain complete histories. Journal
compaction, history pagination, media retention and the 4,000-event run budget require
separate work. Incremental transmission reduces repeated network payloads; it does
not establish bounded lifetime storage or live-model performance.
