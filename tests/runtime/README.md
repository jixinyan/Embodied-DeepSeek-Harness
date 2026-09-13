# Runtime acceptance

Run `pnpm test:runtime` from the repository root. Fifty-four tests exercise the actual
DSH host and native model/tool loop, isolation, cancellation, cooperative timeout,
configuration, storage, custom-role/tool extension, recovery and HTTP/SSE history.
The model boundary emits scripted chunks; physical observations are synthetic.

[team-extensions.test.ts](team-extensions.test.ts) loads a custom ROLE.md and verifies
explicit context, private files/evidence, owner-only execution, scoped TODOs, duplicate
assignment admission and rejection of custom tool calls after cancellation.
[upper-run.test.ts](upper-run.test.ts) checks first-pass, retry-success, multi-goal recovery, selection/retry gates, independent learning failure and unknown/error
and pause/resume/cancel paths. [console-server.test.ts](console-server.test.ts) starts
a temporary loopback server to exercise admission/reconnect/interrupted restart.
No live model key, simulator, learned policy or GPU is required.

[session-audits.test.ts](session-audits.test.ts) covers incremental native audit storage,
aggregate histories larger than a journal record, legacy reads and interrupted append
reconciliation. The multi-goal suite also exercises normal demo timing.

[openai-compatible.test.ts](openai-compatible.test.ts) runs native DSH calls through a
local HTTP/SSE peer, including image results, stream errors and cancellation. This
exercises the compatible adapter without evaluating a deployed VLM.

[sensor-images.test.ts](sensor-images.test.ts) verifies that the Planner directly
receives native capture images, plans/acts, and receives checked images with verifier
feedback; optional role handoff remains explicit and evidence identities immutable.

Upper execution acceptance also rejects resume before formal verification, unsolicited
provider resume, missing acknowledgements, concurrent resume, execution/image identity
mismatch and an over-budget first status. A newer paused boundary survives a late
resume acknowledgement. These are upper authority tests with CPU providers.
