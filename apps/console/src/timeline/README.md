# Timeline

The console renders persisted run events with sequence, timestamp, type and a
readable summary. Selecting an event opens its original payload. Event filters
apply to the displayed range; earlier/later navigation reads bounded history
pages, and the recent view follows the server's incremental event stream.

Implementation lives in [the console application](../../public/app.js),
[run update handling](../../public/run-update.js) and
[the server stream](../../../server/src/run-event-stream.ts). The
[native session audit inspector](../../public/session-audit.js) reads individual
assignments and bounded native DSH event pages. Its contents are read-only.

These readers consume authoritative records. Device state and task success come
from execution acknowledgements and accepted verification records. Model prose
remains model output.

Synchronized simulation video, policy/action inspection and a portable run replay
are pending actual integration delivery. The
[visual acceptance requirements](../../../../docs/implementation/live-integration.md#end-to-end-visual-delivery)
define the required source identities, timestamps and retained evidence.
