# Current capability map

Snapshot: 2026-09-08. Working upper-runtime code through `1212ca9`.

![Implemented capabilities and remaining work](../architecture/assets/implementation-status.svg)

| Working capability | Inspect the implementation / evidence |
| --- | --- |
| Original DSH loop, tool validation, sessions, timeout and cancellation | [Host](../../apps/server/src/runtime.ts), [native tests](../../tests/runtime/native-tools.test.ts) |
| User-defined teams and independent role assignments | [Loader](../../harness/agent-runtime/teams/src/loader.ts), [sessions](../../harness/agent-runtime/communication/src/sessions.ts) |
| Custom native tools, explicit context, private files and permission checks | [Application](../../apps/server/src/application.ts), [extension acceptance](../../tests/runtime/team-extensions.test.ts) |
| Native TODO and versioned physical task plan | [DSH TODO](../../harness/agent-runtime/planning/src/dsh/todo/index.ts), [plans](../../harness/agent-runtime/planning/src/workspace.ts) |
| Async monitor, formal verification, Planner recovery and Evolver progress | [Application](../../apps/server/src/application.ts), [workflow acceptance](../../tests/runtime/upper-run.test.ts) |
| Failure-aware SKILL publication, explicit retrieval and provenance | [Skill library](../../harness/agent-runtime/memory/src/library.ts), [recovery decision](decisions/0004-recovery-observation-and-action-admission.md) |
| Durable domain records and historical audit | [Store](../../harness/agent-runtime/storage/src/local-store.ts), [HTTP service](../../apps/server/src/http-server.ts) |
| Live output, tools/results, TODO history, sensors, verdict and recovery inspection | [Console](../../apps/console/README.md), [API/restart tests](../../tests/runtime/console-server.test.ts) |

Run `pnpm demo` and select the labeled failure/recovery fixture. The observable
sequence is native DSH calls -> synthetic execution -> formal failed verdict ->
Planner replan/retry -> Evolver recording -> formal original-goal success -> SKILL.
First-pass success creates no recovery skill; unknown is never accepted as success.

## Still outside the working boundary

- Live model deployment/evaluation and multi-goal task orchestration.
- Python transport, action admission, shared device resources and physical stop acknowledgement.
- Actual BEHAVIOR/RoboCasa/RoboTwin, VLA/VLN, SAM/depth and hardware adapters.
- Resumable model sessions, distributed/exactly-once delivery, scalable retention and multi-user hosting.
- Final console layout: key state must be visible together; visual polish is deferred.

The demo model and sensors are scripted/synthetic. Its upper workflow is runnable;
it is not the requested final simulation MVP yet. See [progress](progress.md) for
checks and [upper-runtime guide](upper-runtime.md) for extension entry points.
