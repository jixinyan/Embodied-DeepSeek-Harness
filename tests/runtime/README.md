# Runtime acceptance

Run `pnpm test:runtime` from the repository root. Twenty tests exercise the actual
DSH host and native model/tool loop, isolation, cancellation, cooperative timeout,
configuration, storage, custom-role/tool extension, recovery and HTTP/SSE history.
The model boundary emits scripted chunks; physical observations are synthetic.

[team-extensions.test.ts](team-extensions.test.ts) loads a custom ROLE.md and verifies
explicit context, private files/evidence, owner-only execution, scoped TODOs, duplicate
assignment admission and rejection of custom tool calls after cancellation.
[upper-run.test.ts](upper-run.test.ts) checks first-pass, retry-success, unknown/error
and pause/resume/cancel paths. [console-server.test.ts](console-server.test.ts) starts
a temporary loopback server to exercise admission/reconnect/interrupted restart.
No live model key, simulator, learned policy or GPU is required.
