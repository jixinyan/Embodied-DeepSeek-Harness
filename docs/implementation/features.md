# Current capability map

Snapshot: 2026-09-08, runtime code at `abe810b`. This page describes the current
checkout's verified capabilities, not the completed target architecture.

![Current implementation and remaining work](../architecture/assets/implementation-status.svg)

## Reused DSH mechanisms that run now

| Capability | Concrete evidence | Source |
| --- | --- | --- |
| Runtime assembly | Seven original DSH services assembled; explicit model binding and teardown | [Host assembly](../../apps/server/src/runtime.ts) |
| Scoped sessions | Explicit prompt/tools, independent histories, follow-up wake-up, cancellation and cleanup | [Session seam](../../harness/agent-runtime/agents/src/runtime.ts), [runtime tests](../../tests/runtime/host.test.ts) |
| Model/tool loop | Scripted tool request is dispatched by DSH; the next model request receives the result | [Original DSH loop](../../harness/agent-runtime/agents/src/dsh/loop/index.ts) |
| Native tool authoring | `@edh/tools.defineTool` is exactly the imported DSH function | [Public tool API](../../harness/agent-runtime/tools/src/index.ts) |
| Tool validation and output | Invalid arguments never reach the body; invalid values never reach rendering; scalar `7` returns through the loop | [Native reuse tests](../../tests/runtime/native-tools.test.ts) |
| Runtime observation | Running/idle and tool/result/turn events are inspectable in memory | [Integration guide](dsh-integration.md) |

Nine runtime tests pass. The model adapter is scripted; the tools are synthetic.
These are tested integrations of DSH capabilities, not newly invented EDH mechanisms.
No live model provider is mounted or evaluated. Upstream tool timeout metadata requires
a separate enforcement plugin that is not mounted. Disk persistence is not mounted.

## EDH helpers implemented but not wired into physical execution

| Helper | What it checks | Remaining integration |
| --- | --- | --- |
| Shared wire validation | Versions, scope IDs, UTC time, evidence metadata, action units and schema shape in TS/Python | Actual service boundaries and authoritative provider data |
| Execution/verdict/recovery gates | Attempt identity, budget rules, designated verifier, fresh evidence, owner resume and original-goal recovery | Task coordinator, async verifier and robot backend |
| Physical provider checks | Typed domain messages, tool/version binding, provider input/output, stable replay and operation identity | DSH physical-tool body, Python transport, permissions and durable job store |

The [contract guide](contracts.md) and [physical boundary guide](boundaries.md) document
these callable functions and limitations. The 230 shared test cases use synthetic data.
The helpers do not run a robot, authenticate a caller or publish a skill. Ordinary DSH
messages and tools do not need EDH physical envelopes.

## Defined or planned, not functional yet

| Area | Present artifact | What still needs to run |
| --- | --- | --- |
| Team and role authoring | [Team YAML](../../examples/teams/household.yaml), [role definitions](../../harness/agent-runtime/agents/roles/) | Loader, immutable bindings and assignment permissions composed onto DSH |
| Agent-to-agent task handoff | Brief/envelope schemas and router interface | Recipient/lifetime checks and explicit handoff via DSH inbox/followup |
| Physical jobs and policies | [Python interfaces](../../harness/physical-runtime/src/physical_harness/) | Separate worker, query/cancel/stop acknowledgement, budgets, resources and compatible policy |
| Perception and active observation | Capture/segmentation/action contracts and tool example | Actual images, SAM/provider inference, active-view control and evidence access |
| Verifier and retry | Role definitions and pure gates | Independent DSH verifier, bounded async monitoring, mandatory budget-end checks and owner decisions |
| Evolver and SKILL | Role, metadata and SKILL format example | Retry-triggered recording, original-goal success gate, atomic storage and explicit retrieval |
| Plans, private files and domain persistence | Module interfaces | Scoped file tools, versioned plans, durable task/recovery records and replay reconciliation |
| Console | [Projection contract](../../apps/console/src/index.ts), earlier visual prototype as reference | Running UI connected to task, agent, sensor, device, tool, verdict and memory state |
| Simulation and hardware | Adapter directories and [deployment example](../../examples/deployments/behavior.yaml) | Actual BEHAVIOR/policy binding; later RoboCasa/RoboTwin and device testing |
| Product startup | Callable host assembly | Configured application entry, readiness, worker startup and end-to-end reproduction |

Directory presence, a YAML provider name or a function signature is not implementation.
The current project cannot yet execute a user task through a live console and simulation.

## What changed in this alignment

- Exposed native DSH tool authoring/types directly and verified that path.
- Replaced generic ToolRegistry/ToolExecutor placeholders with explicitly physical
  provider metadata/transport interfaces; no second dispatcher was implemented.
- Renamed the standalone F1 validator to PhysicalBoundaryValidator and limited its
  role to EDH domain/provider boundaries.
- Updated the [reuse decision](decisions/0003-reuse-dsh-mechanisms.md), specification
  and [foundation plan](mvp-foundation.md). The original DSH source is unchanged.

Next: load Team/Role and physical permissions onto the existing DSH mechanisms, then
connect a physical provider through native tools. Validation of that composition and
embodied behavior replaces plans to build generic runtime mechanisms in parallel.
