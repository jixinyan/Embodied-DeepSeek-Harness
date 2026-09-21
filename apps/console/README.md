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
Click a session heading for its complete frozen configuration/resource state. The
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
criteria. New-criteria discovery, active-task clarification and a CLI-free local-server
bootstrap remain pending.
No actual simulator or robot is connected. See the [session guide](../../docs/implementation/user-sessions.md).

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
run/evidence/image URLs. Each image has a loading state, decoded dimensions or a read
error; repeated projection refreshes preserve the existing image elements. Empty and
restricted samples clear the viewer. Source labels identify test images explicitly.
The server checks persisted ownership, reference association and evidence visibility
before reading bytes. See the [image guide](../../docs/implementation/image-storage.md).

Component acceptance uses an actual repository PNG, real local storage/HTTP and browser
DOM checks. Camera streaming, live VLM behavior and physical execution remain unverified.

## Native session audits

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
