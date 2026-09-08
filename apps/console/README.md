# Agent workbench

The [browser client](public/app.js) connects to the local server started with `pnpm demo`.
It displays actual DSH output, native tool arguments/results, TODO status/history,
agent assignments/briefs, task plans, synthetic sensors, verification and recovery.
Historical runs are read-only; sensor fixtures are explicitly labeled.

UI design is deferred. The agreed destination is one workspace showing key agent,
plan, execution, sensor, verifier and experience state together without switching
pages or tabs. Current inspector tabs are provisional. Detail expansion may reveal
full payloads, but critical state should remain visible at the same time.

Provider output and concise decision notes can be inspected; absent internal reasoning
must not be invented. TODO completion is distinct from formal physical success.
See [runtime guide](../../docs/implementation/upper-runtime.md) and
[capability map](../../docs/implementation/features.md).
