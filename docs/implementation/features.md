# Current capability map

Snapshot: 2026-09-13. Upper runtime, model transport and standalone policy/action admission are tested; live physical integration is pending.

![Implemented capabilities and remaining work](../architecture/assets/implementation-status.svg)

| Working capability | Inspect the implementation / evidence |
| --- | --- |
| Original DSH loop, tool validation, sessions, timeout and cancellation | [Host](../../apps/server/src/runtime.ts), [native tests](../../tests/runtime/native-tools.test.ts) |
| User-defined teams and independent role assignments | [Loader](../../harness/agent-runtime/teams/src/loader.ts), [sessions](../../harness/agent-runtime/communication/src/sessions.ts) |
| Custom native tools, explicit context, private files and permission checks | [Application](../../apps/server/src/application.ts), [extension acceptance](../../tests/runtime/team-extensions.test.ts) |
| Typed reports, published history, caller acknowledgement and interrupted delivery | [Reports](../../harness/agent-runtime/communication/src/reports.ts), [protocol guide](upper-runtime.md) |
| Native TODO and versioned physical task plan | [DSH TODO](../../harness/agent-runtime/planning/src/dsh/todo/index.ts), [plans](../../harness/agent-runtime/planning/src/workspace.ts) |
| Registered subgoals, verified dependencies and owner-only goal selection | [Goals](../../harness/agent-runtime/tasks/src/goals.ts), [multi-goal guide](multi-goal-runtime.md) |
| Async monitor, formal verification, Planner recovery and Evolver progress | [Application](../../apps/server/src/application.ts), [workflow acceptance](../../tests/runtime/upper-run.test.ts) |
| Failure-aware SKILL publication, explicit retrieval and provenance | [Skill library](../../harness/agent-runtime/memory/src/library.ts), [recovery decision](decisions/0004-recovery-observation-and-action-admission.md) |
| Durable domain records and historical audit | [Store](../../harness/agent-runtime/storage/src/local-store.ts), [HTTP service](../../apps/server/src/http-server.ts) |
| Deployment-defined tasks, model aliases, tools, backend factories and historical configuration | [Deployment guide](deployments.md), [acceptance](../../tests/runtime/server-deployment.test.ts) |
| OpenAI-compatible text/image streaming through the native DSH loop | [Model adapter and guide](model-policy-adapters.md), [HTTP acceptance](../../tests/runtime/openai-compatible.test.ts) |
| WebSocket policy client/server and generation-fenced action gate | [Adapter guide](model-policy-adapters.md), [CPU/socket acceptance](../../harness/physical-runtime/tests/test_policy.py) |
| Live output, tools/results, TODO history, sensors, verdict and recovery inspection | [Console](../../apps/console/README.md), [API/restart tests](../../tests/runtime/console-server.test.ts) |

Run `pnpm demo` and select the labeled failure/recovery fixture. The observable
sequence is native DSH calls -> synthetic execution -> formal failed verdict ->
Planner replan/retry -> Evolver recording -> formal original-goal success -> SKILL.
First-pass success creates no recovery skill; unknown is never accepted as success.
The multi-goal scenario adds a separately verified access prerequisite, retries placement,
then closes the cabinet for final task success. See the [illustrated flow](multi-goal-runtime.md).

## Still outside the working boundary

- Live model deployment/evaluation; concurrent physical goals and nested independent recovery chains.
- Host-to-Python worker transport, shared device resources/watchdog and real physical stop acknowledgement. Standalone policy transport and action admission are CPU-tested.
- Actual BEHAVIOR/RoboCasa/RoboTwin, VLA/VLN, SAM/depth and hardware adapters.
- Resumable model sessions, distributed/exactly-once delivery, scalable retention and multi-user hosting.
- Further console usability and live sensor integration; the unified fixture workspace is implemented.

The demo model and sensors are scripted/synthetic. Its upper workflow is runnable;
it is not the requested final simulation MVP yet. See [progress](progress.md) for
checks and [upper-runtime guide](upper-runtime.md) for extension entry points.

Asynchronous perception/GT reads now run through the upper provider port with native
DSH cancellation and stopped-boundary revalidation. CPU acceptance covers delayed
success, cancellation and stale GT responses; actual transport remains pending.
See [provider call semantics](../../harness/agent-runtime/execution/README.md).
