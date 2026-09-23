# Agent workbench

The [browser client](public/app.js) connects to the local server started with `pnpm demo`.
It displays actual DSH output, native tool arguments/results, TODO status/history,
agent assignments/briefs, task plans, synthetic sensors, verification and recovery.
Historical runs are read-only; sensor fixtures are explicitly labeled.

The unified workspace keeps user-session/task history and agent assignments in a sidebar, goal plans
and native TODOs on the left, the searchable agent activity stream in the center,
and observations, execution, verification and recovery on the right. There are no
inspector tabs. Narrow screens stack these sections on the same page; long content
scrolls within its panel. Full payloads remain available in a keyboard-accessible
inspector, including goal criteria and their verdict history.

The verification panel shows a bounded explanation preview. **Accepted verdicts**
loads one selected full result, including complete checks and explanation. Refresh,
selection changes and close cancel superseded reads and clear the previous body.
Missing records remain explicit. See [verdict history](../../docs/implementation/verdict-history.md).

Execution budgets come from the matching subgoal request. Session lifecycle, formal
verdicts and recovery publication are separate states. Historical run selection is
protected against out-of-order responses. Scrolling upward with the mouse wheel
turns off Follow; enabling it returns to the latest output. Search has an explicit
empty state. Synthetic cabinet geometry reflects the displayed frame's open state.

Provider output and concise decision notes can be inspected; absent internal reasoning
must not be invented. TODO completion is distinct from formal physical success.
See [runtime guide](../../docs/implementation/upper-runtime.md) and
[capability map](../../docs/implementation/features.md).


Task presets and source labels come from deployment configuration. Newly admitted runs
retain their own public configuration for historical inspection; legacy runs explicitly
report that configuration is unavailable and show their recorded assignments. The Next
Task selector uses the current deployment, while the workspace shows the selected run.
Samples containing admitted image references show a multi-image observation viewer.
Samples without images show their available metadata.
See the [deployment guide](../../docs/implementation/deployments.md).


## User-session launcher

The launcher provides New session, Run task and End session controls. Separate compatible
selectors choose runtime source, environment, embodiment, checkpoint, policy and upper model default; one
session can run multiple tasks without resetting its environment. Sidebar groups show
session state and environment binding, with independently inspectable task runs below.
Click a session heading to filter its tasks; **Inspect session** reads its complete
frozen configuration and resource state. The
Experience library exposes cross-session bundles and source run/session links. Each
bundle includes inspected provenance: original goal, failure/success verdicts,
evidence/image identities and missing-source diagnostics. Record availability and
declared transfer-validation limits are separate fields. See the
[source inspection guide](../../docs/implementation/skill-provenance.md).

The launcher is separate from the selected historical task: the launcher text identifies
the active session targeted by the next task. Task stop does not end that session.
Selections resolve complete installed profiles and are checked again at admission with
the catalog revision. An active session fixes its selections until End session.
User instructions and selected historical outcomes are admitted against installed task
criteria. Environment discovery can populate immutable session task catalogs; the
console loads the active session's tasks, confirms the catalog digest on submission,
and disables submission while the catalog is loading or unavailable. Reload task
catalog retries an explicit read. See [catalog behavior](../../docs/implementation/session-task-catalogs.md).
The [desktop launcher](../desktop/README.md) selects a configured deployment and starts
the local server. A RoboCasa OpenCabinet session has completed a real policy-driven
rollout and formal failed verification through this console; other physical
providers retain their own acceptance status.
Active-task clarification has an inline response panel with persisted drafts,
immutable accepted responses and delivery status; live-model continuation remains
unverified. See the [interaction guide](../../docs/implementation/user-clarification.md).
See the [session guide](../../docs/implementation/user-sessions.md).

## Team and workflow visualization

The logo and blue/white theme appear throughout the workspace. A locally served Mermaid
graph shows configured roles and actual delegation relationships. Role cards expose
assignment status, tool counts, resolved model aliases and configuration inspection.
Observation, planning, execution, verification and experience have distinct state indicators;
execution end does not mark verification as passed. Active-state animations respect
reduced-motion preferences. Native logs, model output and TODO/plan inspection stay visible.

`launch-selection.js` provides shared browser/server validation; `launch-controls.js`
owns the dependent input controls. `coordination.js` renders Team and task projections.
`ocean.css` applies the brand theme over the existing workbench layout. Run `pnpm test:console`
for catalog and real static-resource checks. These checks do not invoke a model or physical backend.

## Next task input

The composer provides an editable instruction, a selection of up to four ended tasks
from the active session, criteria inspection and accepted-input inspection. Draft text
survives state refreshes and historical run selection. An explicit reset button loads
the selected criteria's instruction. Historical context is checked by the server and
delivered only through the entry Planner's invocation brief.

`task-composer.js` owns input projection and draft preservation. `task-request.js` keeps
unconfirmed submission IDs in native browser session storage so retrying the same input
does not allocate another task. The pending identity is released after the accepted run
loads. Sidebar task labels use the actual submitted instruction. See the
[session admission guide](../../docs/implementation/user-sessions.md).

## Incremental run updates

Workspace history has separate bounded session/task pages with session filters and
earlier/recent navigation. Active controls use independently returned active records.
The task composer pages that session's outcomes and retains up to four selected
outcomes across pages. Session inspection fetches the full stored configuration only
on request. See [workspace history](../../docs/implementation/workspace-history.md).

The console reads a projection and the newest bounded history page at a fixed event count,
then subscribes from that absolute cursor. It appends
contiguous batches and renders the current projection when catch-up completes. Native
EventSource resumes accepted batches after a connection loss. Model text updates with
no new domain events reuse local history without receiving it again. Invalid updates
close the subscription and display the protocol error. See the
[stream protocol and limits](../../docs/implementation/run-stream.md).

Live event retention uses a 500-event and 2 MiB encoded-body target, preserving a single
oversized event. Event log provides Earlier events, Later events and Recent events;
each historical view holds one page and shows its sequence range. Filters apply to
that range, with a dedicated TODO-updates filter. Agent activity search and TODO-history
shortcuts cover recent events. Current TODOs, plans, verdicts and recovery status remain
independent of event eviction. Browsing history keeps live state updates connected.

## Observation images

`sensor-images.js` renders the selected latest or agent-seen observation using scoped
run/evidence/image URLs. Referenced camera images are requested and decoded in parallel.
The viewer publishes one complete decoded observation in a browser frame, retains its
visible image elements across updates, and cancels superseded requests. Empty and
restricted samples clear the viewer. Source labels identify test images explicitly.
The visible image status reports local request-to-decode time and display frames per
second based on published frames. Camera age compares the capture host clock with
the browser clock, so it requires synchronized host clocks. The outer frame label
tracks the last fully displayed observation.
The server checks persisted ownership, reference association and evidence visibility
before reading bytes. See the [image guide](../../docs/implementation/image-storage.md).

Component acceptance uses actual image storage and browser DOM checks. A live
RoboCasa run has supplied native camera observations, VLM decisions and policy
controls; its formal task result was failed. Other provider results are recorded
in the implementation progress document.

## Native session audits

The **Assignments** inspector and role cards read one assignment's complete brief,
TODOs, report and final stream through the assignment detail endpoint. Historical TODO
and sensor selectors load the selected archive, retaining one response per view and
cancelling superseded requests. Compact retired rows preserve Team caller edges.
Loading, empty and failure states remain visible. See
[assignment history](../../docs/implementation/assignment-history.md).

Formal assignments also expose a **Formal verification** section with check status,
execution/boundary/request identities, goal/attempt, evidence and individual facts.
Saved checks remain pending until an accepted verdict exists. An accepted unknown
verdict displays as unknown. Refresh details reads the selected record again; selection,
loading, failure and close clear the previous verification display. Source conflicts
and missing published contexts appear as read errors. Document-based browser checks
exercise these states without a model or physical provider.

The **Role reports** inspector reads one assignment's published reports in bounded
pages. It exposes report bodies, delivery status and caller acknowledgements, with
earlier/latest navigation and explicit empty/error states. Opening another inspector
or closing the dialog invalidates pending report results. The current assignment list
still comes from the run projection. See [report inspection](../../docs/implementation/report-acknowledgements.md#bounded-history-reads).

Native DSH audit inspection has assignment selection and earlier/later/latest event
controls. Assignment indexes and event bodies are paged; the inspector retains one
page of each, renders document contents as text and excludes late responses after
another inspection opens. Only published audit events are shown. See the
[audit HTTP API and acceptance](../../docs/implementation/session-audits.md).

## Workspace storage

The expandable Workspace storage section displays journal size, current record count
and superseded-version bytes, plus original-image and model-request-cache file/byte
counts. Refresh reads the latest statistics. Compact journal
submits the inspected write sequence, displays the reclaimed bytes and preserves all
current records and independent history. The server requires an idle workspace and
ends retained terminal task scopes before maintenance. Stale observations and busy
session/task states return explicit errors. Clear model image cache removes regenerable
request variants and retains original images. The button requires a ready inventory,
nonempty cache and an idle workspace. Busy and unsupported providers have explicit
status messages. Cache cleanup uses the inspected revision; refreshing updates that
revision after image activity. See the
[maintenance format, lifecycle and acceptance](../../docs/implementation/storage-maintenance.md).

Configured original-image retention adds **Inspect image references** and **Delete
unreferenced originals**. The preview shows retained/unreferenced file counts and bytes,
checked reference sources and SKILL-source count. Deletion sends only the preview token;
the server rechecks journal/image/source versions and reference ownership. Refresh,
another operation or failure clears the preview. Missing ownership configuration and
empty candidate sets keep deletion disabled. See the
[retention API and source responsibilities](../../docs/implementation/image-retention.md).
