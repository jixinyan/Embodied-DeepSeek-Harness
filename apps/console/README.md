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
Non-fixture sources show observation metadata until real sensor rendering is connected.
See the [deployment guide](../../docs/implementation/deployments.md).


## User-session launcher

The demo now provides New session, Run task and End session controls. A launch profile
shows its environment, embodiment, policy checkpoint and default upper model; one
session can run multiple tasks without resetting its environment. Sidebar groups show
session state and environment binding, with independently inspectable task runs below.
Click a session heading for its complete frozen configuration/resource state. The
Experience library exposes cross-session bundles and source run/session links.

The launcher is separate from the selected historical task: the launcher text identifies
the active session targeted by the next task. Task stop does not end that session.
Only installed compatible bundles are selectable today; free-form conversational tasks,
independent provider selectors and a CLI-free local-server bootstrap remain pending.
No actual simulator or robot is connected. See the [session guide](../../docs/implementation/user-sessions.md).
