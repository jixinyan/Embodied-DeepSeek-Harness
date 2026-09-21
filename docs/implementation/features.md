# Current capability map

Snapshot: 2026-09-21. Upper runtime, model transport and standalone policy/action admission are tested; live physical integration is pending.

![Implemented capabilities and remaining work](../architecture/assets/implementation-status.svg)

| Working capability                                                                                        | Inspect the implementation / evidence                                                                                                                |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original DSH loop, tool validation, sessions, timeout and cancellation                                    | [Host](../../apps/server/src/runtime.ts), [native tests](../../tests/runtime/native-tools.test.ts)                                                   |
| Opt-in native context compaction, token estimates and scoped authoritative state                          | [Context guide](context-management.md), [native acceptance](../../tests/runtime/context-management.test.ts)                                          |
| User-defined teams, independent roles and completion with retained audits/reports                         | [Loader](../../harness/agent-runtime/teams/src/loader.ts), [sessions](../../harness/agent-runtime/communication/src/sessions.ts)                     |
| Whole-message visual history budgets with scoped audit and console maintenance events | [Visual policy](context-management.md), [visual tests](../../tests/runtime/visual-history.test.ts) |
| Custom native tools, explicit context, private files and permission checks                                | [Application](../../apps/server/src/application.ts), [extension acceptance](../../tests/runtime/team-extensions.test.ts)                             |
| Typed reports, published history, caller acknowledgement and interrupted delivery                         | [Reports](../../harness/agent-runtime/communication/src/reports.ts), [protocol guide](upper-runtime.md)                                              |
| Native TODO and versioned physical task plan                                                              | [DSH TODO](../../harness/agent-runtime/planning/src/dsh/todo/index.ts), [plans](../../harness/agent-runtime/planning/src/workspace.ts)               |
| Registered subgoals, verified dependencies and owner-only goal selection                                  | [Goals](../../harness/agent-runtime/tasks/src/goals.ts), [multi-goal guide](multi-goal-runtime.md)                                                   |
| Verified pause and boundary-bound Planner resume with provider acknowledgement                            | [Execution contract](../../harness/agent-runtime/execution/README.md), [authority acceptance](../../tests/runtime/upper-run.test.ts)                 |
| Segment-scoped async monitor retirement, fresh formal verification, Planner recovery and Evolver progress | [Application](../../apps/server/src/application.ts), [workflow acceptance](../../tests/runtime/upper-run.test.ts)                                    |
| Failure-aware SKILL publication, explicit retrieval and provenance                                        | [Skill library](../../harness/agent-runtime/memory/src/library.ts), [recovery decision](decisions/0004-recovery-observation-and-action-admission.md) |
| Durable domain records and historical audit                                                               | [Store](../../harness/agent-runtime/storage/src/local-store.ts), [HTTP service](../../apps/server/src/http-server.ts)                                |
| Deployment-defined tasks, model aliases, tools, backend factories and historical configuration            | [Deployment guide](deployments.md), [acceptance](../../tests/runtime/server-deployment.test.ts)                                                      |
| Planner-owned capture/image/plan/action loop and image-bearing verifier feedback                          | [Image path](model-policy-adapters.md), [native acceptance](../../tests/runtime/sensor-images.test.ts)                                               |
| Config-only physical stack profiles with simulator/embodiment/policy compatibility and prompt context     | [Profile guide](physical-profiles.md), [profile tests](../../tests/runtime/physical-profiles.test.ts)                                                |
| OpenAI-compatible text/image streaming through the native DSH loop                                        | [Model adapter and guide](model-policy-adapters.md), [HTTP acceptance](../../tests/runtime/openai-compatible.test.ts)                                |
| WebSocket policy client/server and generation-fenced action gate                                          | [Adapter guide](model-policy-adapters.md), [CPU/socket acceptance](../../harness/physical-runtime/tests/test_policy.py)                              |
| Live output, tools/results, TODO history, sensors, verdict and recovery inspection                        | [Console](../../apps/console/README.md), [API/restart tests](../../tests/runtime/console-server.test.ts)                                             |

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
- Further console usability and actual sensor-provider integration; the unified workspace and scoped image renderer are implemented.

The demo model and sensors are scripted/synthetic. Its upper workflow is runnable;
it is not the requested final simulation MVP yet. See [progress](progress.md) for
checks and [upper-runtime guide](upper-runtime.md) for extension entry points.

Asynchronous perception/GT reads now run through the upper provider port with native
DSH cancellation and stopped-boundary revalidation. CPU acceptance covers delayed
success, cancellation and stale GT responses; actual transport remains pending.
See [provider call semantics](../../harness/agent-runtime/execution/README.md).


## User session and launcher addition

Implemented with CPU acceptance: a retained environment across task runs; frozen
launch-profile selections; independent task/role scopes; task drain before environment
reuse; explicit session end; failed-release/restart state; grouped console history and
workspace experience inspection. [Session guide and SVG](user-sessions.md).

The launcher includes compatible source/environment/embodiment/checkpoint/policy/model
selectors, shared admission validation and catalog revision checks. The branded console
adds Mermaid Team relationships and event-driven workflow states. See the
[console implementation](../../apps/console/README.md) and [selection tests](../../tests/console/launch-selection.test.mjs).

Task admission accepts editable instructions and explicitly selected same-session history,
with immutable registered criteria, persisted input snapshots and complete request identity.
See [admission](../../apps/server/src/task-admission.ts) and
[journal/input checks](../../tests/runtime/task-admission.test.ts).

Still pending: actual simulator/hardware allocation, discovery of new task criteria,
active-task clarification and CLI-free server bootstrap.
[Legacy design migration audit](legacy-migration.md) lists retained and missing designs.

## On-demand experience context

Planner and Verifier have explicit search/select/load instructions and descriptive
native tools. Search returns metadata; selected SKILL bodies enter only the calling
assignment's context. Cross-session persistence does not preload future role contexts.
Current retrieval uses task-semantic keywords with a 20-result bound; embedding search,
semantic ranking and section loading remain unimplemented. See the
[memory guide](../../harness/agent-runtime/memory/README.md).

## Incremental console transport

Implemented: cursor-based SSE event batches, projection-only text updates, native
reconnection, strict client continuity checks and write backpressure. UpperRun emits
lightweight change notifications. Initial history loads in bounded pages through a
fixed event count; incremental projections read only the requested event window.
Cumulative store/browser memory still requires retention work. [Protocol and checks](run-stream.md).

## Indexed journal bodies

LocalStore keeps latest key/version/byte-position/checksum metadata and reads record
bodies on demand. Startup replay and lazy scans avoid materializing all stored bodies.
Read integrity failures stop that store instance; writes verify the indexed file size.
The existing journal format and publication boundaries remain authoritative. Storage
checks include write/reopen/scan of a journal exceeding 64 MiB under a 64 MiB V8
old-space limit. The key index, active run and caller/browser results still need
lifetime limits. [Storage behavior](../../harness/agent-runtime/storage/README.md).

## Application image service and observation viewer

The server owns a native attachment context and injects its service into deployment,
environment and task factories. The local provider stores and validates actual bytes;
the console reader resolves persisted run/evidence/image identities and rejects
restricted or unassociated images. Latest and agent-seen frames render through the same
multi-image component with load/dimension/error status. Twenty-three actual file/HTTP tests
and browser component DOM checks cover this path. Live VLM/provider acceptance and
media retention remain required. [Image service guide](image-storage.md).

## Journal compaction and console maintenance

LocalStore can atomically compact superseded record versions while retaining all
current records, their CAS versions, global sequence and independent history. The
console exposes storage statistics and idle-only maintenance with a fresh sequence
check. Real-file/process tests cover reopening, corruption, interrupted publication
and retained history/image references. Distinct-key and original-image retention remain open.
[Maintenance guide](storage-maintenance.md).

Image storage reports original/cache usage and supports explicit cleanup of derived
model-request images through the same idle admission boundary. Cleanup requires a
current provider revision, excludes image writers and retains original evidence bytes.
Custom providers can expose the optional maintenance controller. Actual file tests
cover cache regeneration, busy/stale conflicts, invalid entries and shutdown.

## Paged native audit inspection

The audit HTTP route and console select one assignment and a bounded page of native
events. A fixed published event count supports navigation while later events arrive.
Assignment indexes are also paged. Real-file, HTTP and constrained-heap process tests
cover retained values, task scope, legacy arrays and publication boundaries. Domain
retention and native active-session lifetime remain open. [Audit guide](session-audits.md).

## SKILL source inspection

Workspace experience inspection resolves recovery ownership, original-goal failure and
success, source run/session and sensor/image metadata. Missing references are explicit;
conflicting records fail. New source limitations follow the declared provider origin.
The latest 100 bundles include provenance without scanning unrelated runs. Agent
retrieval remains explicit and does not inherit source evidence permissions. Original
image integrity checks and domain retention have separate responsibilities.
[Source API, semantics and acceptance](skill-provenance.md).
