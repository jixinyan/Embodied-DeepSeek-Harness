# Workspace session and task history

The server's history lists use bounded summary pages. The console keeps one page of
session summaries, one page of task summaries and an independent page of task-context
choices. Inspecting historical work never allocates an environment or resumes a role.

## List API

```text
GET /api/runs
GET /api/runs?before={runId}
GET /api/runs?session={sessionId}&before={runId}
GET /api/runs?session=standalone
GET /api/sessions
GET /api/sessions?before={sessionId}
```

Task pages return `runs`, `nextBeforeId`, `activeId` and `activeRun`. Session pages
return `sessions`, `nextBeforeId`, `activeId` and `activeSession`. A null cursor means
the selected history is exhausted. Omit `before` to request the latest page. Each
page contains at most 32 summaries with a 256 KiB encoded-array target; one oversized
summary remains readable on its own page. Active records are returned separately and
add to that budget. The active session includes its frozen configuration for launcher
controls. Ordinary session summaries contain environment, embodiment, checkpoint,
source, state, resource disposition and task count; they omit configuration and run-ID
arrays. `GET /api/sessions/{id}` remains the explicit complete-record inspection route.

Ordering is descending `createdAt`, then descending ID for equal timestamps. A cursor
is exclusive and must resolve an existing record. A task cursor must also belong to
the selected session filter. Unknown sessions/cursors return HTTP 404; duplicate,
unsupported or malformed query fields and foreign-filter cursors return HTTP 400.
Stored identity/key conflicts fail explicitly. Record timestamps and IDs are the stable
ordering identity; editing those historical fields invalidates continuity assumptions.

Pages are live reads, not a frozen multi-request snapshot. Newer insertions appear on
the latest page without changing an earlier cursor. A newly inserted older-dated record
may appear on a subsequent older page. State changes remain visible on refresh.

## Persistent summary index

`WorkspaceHistoryIndex` owns `workspace-history.sqlite` alongside the authoritative
LocalStore journal. It uses Node's built-in `node:sqlite` module, a versioned strict
schema, FULL synchronous commits and a 4 MiB page-cache target. SQLite temporary tables
stay in memory. The application owns one index per open store, registers its committed
change observer and closes it before closing the source store.

Indexes on `(kind, created_ms, id)` and `(kind, session_id, created_ms, id)` support
ordered cursor queries. Each query reads at most 33 candidate summaries through a
SQLite iterator, then applies the 32-record/256 KiB page target. Count, byte limits,
oversized-record behavior and exclusive cursors remain the public API. Ordinary pages,
cursor lookups, session scope validation and active run summaries read no full journal
bodies. The active session's full configuration requires one explicit source read.

Each summary binds the source version/checksum and, for runs, the ownership record's
version/checksum. A summary checksum covers its identity, order, owner and encoded body.
Reads verify those values against current source metadata. The source journal's file
identity, size and modification time are checked before cached reads. Source checksum
validation still occurs whenever full source records are read. These checks assume
exclusive local ownership; they are not authentication against a hostile filesystem.

After each source `put` has been fsynced, a synchronous observer updates the affected
summary in a SQLite transaction. Ownership updates refresh run membership; ownership
written before its run is incorporated when that run is stored. Unrelated source keys
require no summary update. Index transaction failures propagate and stop the current
source store. The already committed source record remains durable. This is two ordered
durable writes, not an atomic transaction across both files.

At startup, the journal replays and validates its own records. The summary index checks
its format and SQLite integrity, compares source revisions, rebuilds missing/stale rows
from individual source records and removes rows with no source. Unchanged rows need no
body reads during reconciliation. Compaction triggers the same reconciliation because
source checksums can change while their versions remain constant. Reopening recovers
source writes whose index update was interrupted; it performs no model or device work.
Unknown formats and corrupt summary reads fail explicitly. The application never
silently deletes an unreadable index.

`statistics()` reports index-owned source lookups and decoded summary reads for local
diagnostics. It excludes LocalStore's startup replay and reads by other services.
Startup/compaction still traverse source metadata; startup also checks SQLite pages.
Individual source records, the key index, active session configuration, current run
collections and disk retention have independent costs. UserSessions startup and
duplicate-opening lookup traverse source records individually. Explicit
`UserSessions.list()` retains its complete-result allocation cost.

## Console behavior

Sessions and tasks remain visible in the same sidebar. **Earlier sessions/tasks**
and **Recent sessions/tasks** replace the current page. Selecting a session filters
the task list; **All tasks** and **Standalone tasks** are explicit selections.
**Inspect session** reads the complete stored record only when requested. Task controls
use the separately returned active record, even while an older page is displayed.

The task composer pages outcomes from the active session independently of the sidebar.
Up to four selected outcomes survive page changes and are retained alongside the
visible page's options. A new active session clears those selections. Existing server
admission still checks session ownership, terminal status and the four-task limit.
Paging controls require valid current selections before changing pages.

Repeated refreshes of an in-flight selection share its request; a changed selection
cancels the previous request and excludes stale responses. Unchanged sidebar results
preserve existing DOM nodes and focus. Closing the page cancels pending reads.

## Acceptance

`pnpm test:workspace-history` runs twelve actual journal/SQLite/HTTP/process checks: tied-date
ordering and full traversal, independently returned active records, session filters
and cursor admission, byte-budget continuity and newer insertions, detached summary
reads, HTTP origin/query errors and memory pressure. The child process stores more
than 100 MiB of project documents in valid role briefs and session configuration,
opens the session lifecycle, builds the index and traverses all run/session pages under
a 64 MiB V8 old-space limit. Repeated pages perform no index-owned source reads; reopening
an unchanged index also performs none. Tests cover live source/ownership updates,
stale/missing index reconciliation, source-less row removal, corruption and unsupported
versions. A second real SQLite connection holds a writer lock to exercise failures after
source append and compaction publication; both recover on reopen. Authored metadata
does not represent physical execution results.

The preceding browser component acceptance used production markup, history readers, API transport,
list controllers and task composer over actual HTTP and stored document records.
It exercises earlier/recent pages, scope selection, independent active metadata and
cross-page task-context selection. The index preserves those HTTP response shapes;
current HTTP and console regression checks pass. No model or environment is connected. Live VLM,
device lifecycle and whole-application endurance acceptance remain required.
