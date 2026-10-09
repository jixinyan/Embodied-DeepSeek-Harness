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

`@edh/tools` exposes the exact DSH `defineTool` function and native tool types.
Ordinary tools can return DSH-supported JSON values, including numbers.
`core-inputs.ts` owns EDH logical IDs, argument fields and input limits;
`model-schema.ts` supplies detached assignment parameters and canonical schema
projection. Application tool bodies enforce role authority and connect their
scoped domain services to the native DSH dispatcher. Physical provider calls
add task/job identity, resource/budget rules, evidence and confirmed device state.
`core-output.ts` selects result evidence references; UpperRun supplies formal-check
context and admits assignment grants/visibility before native output rendering.

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

## Integration boundary

`createDshHost` mounts original LLM, Session, projection, system-prompt, tool,
tool-call timeout, Agent and Agent-loop services. Configured cloud/local adapters
register with that host. TeamSessions creates independent role contexts with
explicit briefs, native TODOs, scoped tools, follow-ups and cooperative cancellation.
Optional native context management retains its explicit deployment policy.

LocalStore persists domain records, native audits and scoped evidence through the
application's lifecycle owners. Native factory checks and original recorded-task
readers verify their declared configuration/storage boundaries. Actual task
acceptance retains model, policy, simulator, confirmed stopping and source evidence
requirements in the [v1 register](../v1-delivery.md).

## Consequence for delivery

F2 is Team/Role and embodiment-aware binding onto DSH sessions and inboxes. F3 is a
physical provider bridge invoked by DSH tools, not a replacement dispatcher. Later
verification/evolver roles are DSH agents. Continue implementing the useful embodied
workflow and UI on this base; use the foundation gates to verify assembly and new domain
behavior, not to rebuild every existing generic mechanism.
