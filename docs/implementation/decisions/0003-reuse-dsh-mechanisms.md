# 0003: Reuse DSH mechanisms; add embodied semantics

Accepted: 2026-09-08. Supersedes any reading of the foundation plan that calls for a
second generic agent/tool runtime. EDH remains the product owner and uses the selected
pinned DSH source already absorbed into its modules.

## Decision

Use DSH's original model loop, model adapters, agent factory, scopes, sessions, inbox,
follow-up, tool registration/dispatch, argument/output validation, events and cooperative
cancellation. Assemble and test these mechanisms; do not count that work as inventing
new agent capabilities. Select additional upstream plugins when needed, with provenance,
instead of replacing their general-purpose behavior without a demonstrated gap.

`@edh/tools` now exposes the exact DSH `defineTool` function and native tool types.
There is no EDH wrapper around that authoring function. Ordinary tools can return any
DSH-supported JSON value, including a number, without a physical call/result envelope.
`PhysicalToolCatalog` and `PhysicalToolProvider` are future provider metadata/transport
ports, not a second model-facing registry or dispatcher. The prior generic
`ToolRegistry`/`ToolExecutor` placeholders were removed to make this ownership explicit.

The F1 validator is named `PhysicalBoundaryValidator`, with files `physical-boundary.ts`
and `physical_boundary.py`. Keep it for EDH domain messages, physical/provider wire
validation and cross-record invariants. Do not send every DSH message or ordinary tool
through it. Its custom schema table serves the cross-language provider boundary, not
native DSH tool registration. Native DSH input/output validation and Python wire validation
have different consumers; a bridge must adapt the same selected contract rather than
maintaining unrelated model-facing schema definitions.

## Ownership examples

| Need | Reuse | EDH-specific work |
| --- | --- | --- |
| Create a role instance | `host.agents.create`, scope setup and disposal | Load Team/Role, bind explicit brief and physical permissions |
| Deliver later context | `agent.followup(createUserMessage(...))` | Resolve recipient/assignment and authorize the explicit handoff |
| Invoke an ordinary tool | `defineTool`, scoped registration, `ctx.tools.execute` | Implement the useful tool body; no mandatory physical envelope |
| Invoke a physical provider | The same DSH tool dispatch and cancellation signal | Bridge to Python/job identity, resource/budget rules and confirmed device state |
| Receive a tool value | DSH canonical output validation, rendering and tool/result events | Validate cross-process provider data and preserve scoped evidence/job references |
| Observe runtime state | DSH events and session snapshots/projections | Correlate task/attempt/device/verdict/skill state for the console |
| Cancel agent work | DSH cancellation and quiescence | Confirm actual robot stop and reconcile unknown device state |
| Persist a session | Inspect/use DSH persistence seams and appropriate upstream backend | Domain task/recovery/skill records not already represented by session storage |

A JavaScript Promise or AbortSignal is not evidence that a robot stopped. A successful
native tool call is not a verified goal. These are the reasons for embodied additions.

## Actual integration boundary

The current host mounts seven original DSH services and scripted model adapters in
acceptance tests. No live model provider, console, simulator or robot is running. DSH
contains a `timeoutMs` tool declaration, but its enforcement requires the upstream
`dsh-tool-call-timeout-policy` plugin, which is not mounted in the current host. Disk
persistence interfaces are absorbed but no disk backend is mounted. Do not label either
capability as working merely because its interface or metadata exists.

Nine runtime tests now include direct API identity, scalar tool output through the
original loop, and native input/output rejection without `PhysicalBoundaryValidator`.
The existing 230 shared wire/lifecycle/boundary cases remain separate, synthetic contract
evidence. They do not establish physical execution or full Team-level integration.

## Consequence for delivery

F2 is Team/Role and embodiment-aware binding onto DSH sessions and inboxes. F3 is a
physical provider bridge invoked by DSH tools, not a replacement dispatcher. Later
verification/evolver roles are DSH agents. Continue implementing the useful embodied
workflow and UI on this base; use the foundation gates to verify assembly and new domain
behavior, not to rebuild every existing generic mechanism.
