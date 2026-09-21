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

## Memory and lifecycle

`workspace-history.ts` scans LocalStore records one at a time, projects each summary
and retains only the selected page candidates. It does not collect full historical
run/session bodies. The byte and count limits apply during candidate selection too.
UserSessions startup reconciliation and duplicate-opening lookup also traverse records
individually. Explicit `UserSessions.list()` still materializes its complete result for
callers requesting it; the HTTP and admission paths use the incremental readers.

This limits simultaneous history-body retention. Each page still performs a linear
journal scan and reads individual source records. A persistent summary index would be
required to bound scan I/O as the number of records grows. Individual source records,
the store key index, active session configuration, current run state and disk retention
remain independent costs. This change does not bound every application allocation.

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

`pnpm test:workspace-history` runs five actual journal/HTTP/process checks: tied-date
ordering and full traversal, independently returned active records, session filters
and cursor admission, byte-budget continuity and newer insertions, detached summary
reads, HTTP origin/query errors and memory pressure. The child process stores more
than 100 MiB of project documents in valid role briefs and session configuration,
opens the session lifecycle and traverses all run/session pages under a 64 MiB V8
old-space limit. Authored metadata does not represent physical execution results.

Browser component acceptance uses production markup, history readers, API transport,
list controllers and task composer over actual HTTP and stored document records.
It exercises earlier/recent pages, scope selection, independent active metadata and
cross-page task-context selection. No model or environment is connected. Live VLM,
device lifecycle and whole-application endurance acceptance remain required.
