# Agent workbench

The [browser client](public/app.js) connects to the local server started with `pnpm demo`.
It displays actual DSH output, native tool arguments/results, TODO status/history,
agent assignments/briefs, task plans, synthetic sensors, verification and recovery.
Historical runs are read-only; sensor fixtures are explicitly labeled.

The unified workspace keeps run history and agent sessions in a sidebar, goal plans
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
