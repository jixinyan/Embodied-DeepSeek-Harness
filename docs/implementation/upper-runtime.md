# Upper runtime: development and extension

Start from the repository root with `pnpm install --frozen-lockfile`, then `pnpm demo`.
Open `http://127.0.0.1:4317`. No model key, simulator or GPU is needed for this fixture.
`EDH_PORT`, `EDH_DATA_DIR` and `EDH_TEAM_FILE` configure the local demo service.
Runtime records live under `.runs/console-demo` by default and are not public source.

## Composition without another agent loop

[main.ts](../../apps/server/src/main.ts) starts the
[HTTP service](../../apps/server/src/http-server.ts), which composes a
[DSH host](../../apps/server/src/runtime.ts), immutable
[team](../../harness/agent-runtime/teams/src/loader.ts),
[UpperRun](../../apps/server/src/application.ts), local store and backend.
TeamSessions creates a neutral-host DSH session for each fresh delegation.
Only explicit InvocationBriefs and delivered messages enter that session.
The same role may be instantiated repeatedly without sharing histories. A continuing
assignment receives explicit DSH followup messages in its own context.

For example, a scene analyst receives “inspect cabinet access” and chosen evidence
references. It does not receive the Planner's private notes. Supplying an unknown
evidence ID fails. Even explicitly listing execution.start does not give the analyst
the configured decision owner's motion authority.

## Add a role and tool

1. Write a ROLE.md with YAML frontmatter (`role_id`, `description`, `tools`) and
   instructions. Add its relative path under `members` in team.yaml.
2. Register the logical tool as available in FileTeamLoader. Missing model/tool/provider
   bindings fail preflight; optional providers are not installed automatically.
3. Supply `UpperRun.additionalTools[logicalId]` as a trusted factory receiving the
   assignment. Return a native DSH ToolDefinition using `defineTool` from `@edh/tools`.
   For `scene.describe`, the model-facing name must be `scene__describe`.
4. Preserve native parameter/output schemas and honor the execution AbortSignal.
   DSH defineTool validates inputs; raw ToolDefinition authors must explicitly use
   the native validator. DSH performs registration, output validation, dispatch and
   cooperative timeout. EDH adds
   run-lifetime checks and correlated tool activity. Core authority tools cannot be replaced.
5. Delegate using team.delegate with member, objective, context and authorized evidence
   references. Reply through team.send or request/respond for missing context.
6. Run [the configuration-to-role acceptance test](../../tests/runtime/team-extensions.test.ts)
   as a concrete example, then add behavior-specific provider tests.

The default HTTP demo supplies built-in tools and the fixture provider through
`createDemoDeployment`. The same `startServer` accepts a `ServerDeployment` containing
model adapters, task presets, tools and backend factories; see the
[deployment guide](deployments.md). Listing an arbitrary name in YAML alone cannot
load executable code. These are trusted in-process extensions, not a plugin sandbox.

## Structured role reports

Every role receives `agent.report`, `team.query` and `team.ack_report` as framework capabilities. Domain
permissions remain explicit. For example, see the [reporting team](../../examples/teams/reporting.yaml),
[scene role](../../examples/roles/scene-reporter.md), and its
[result schema](../../examples/roles/schemas/scene-assessment.json).

A role calls `agent__report` with:

```json
{
  "status": "completed",
  "summary": "The supplied frame supports this candidate; physical success is unchecked.",
  "result": {"target": "cup", "confidence": "low", "observation": "Candidate visible in the provided view."},
  "evidenceRefs": ["authorized-frame-id"],
  "requestedContext": [],
  "expectedVersion": 0
}
```

Replace the example evidence ID with an actual authorized reference. The framework
fills agent/assignment/team/task identity from native tool scope and fixes the recipient
to the brief's caller. It stores the existing AgentReport.v1 envelope, then explicitly
hands it to the caller through DSH. No model prose is parsed to guess completion.

`output_schema` is relative to ROLE.md and constrains a completed report's `result`,
not the framework envelope. Its JSON must be an object-rooted schema in DSH's supported
subset: properties, required fields, boolean additionalProperties, arrays/items,
scalar types/enum/const and oneOf. Unsupported keywords (including external references,
minimum and pattern) fail preflight; they are never silently ignored. The schema is
frozen and hashed with the team. Omission or `builtin:AgentReport.v1` uses the default
object result. Other built-in role-result schema aliases are not bound yet.

`insufficient_context` requires a nonempty requestedContext list. It is not final:
the caller can use context.respond with explicit evidence, then the role submits a
later report with the returned version. `completed`, `failed` and `cancelled` are final
for that assignment. New work needs a fresh delegation. The decision owner uses
`tasks.finish` / `tasks.abandon` to end its task, rather than a final role report.
An Evolver's successful recovery report can follow SKILL publication.

An exact replay using the original expectedVersion returns the same accepted receipt
without sending the report twice. Changed final results and stale attempts are rejected.
`team__query({assignmentId})` exposes the latest report and native agent status only
to that assignment or its direct caller. It does not expose private histories/files.
Reports never replace formal physical verification or alter a task's success criteria.

Delivery distinguishes recorded, queued, settled, failed and interrupted. Settled means
native DSH quiescence. The designated caller separately confirms a specific report ID
through `team.ack_report`; its immutable receipt is visible through team.query and
HTTP roleReports. Startup marks unsettled published delivery interrupted while
preserving acknowledgements. No action is replayed. See [report acknowledgement](report-acknowledgements.md)
for the tool call, version history, crash boundaries and acceptance evidence.

## State and debugging semantics

| Record | Meaning |
| --- | --- |
| agent.output / stream | Actual assistant/provider output; concise decision notes may be requested by prompts; missing reasoning is never fabricated |
| agent.report / report-delivery | Versioned role result, fixed caller and native delivery disposition; physical success remains separately verified |
| agent.todos | Original DSH whole-list TODO snapshot, tied to assignment/session/turn/sequence |
| plan.updated | Versioned task plan; done requires the relevant accepted formal verdict |
| dsh.tool-call / result | Native call identity, arguments, model-facing result/error and turn/step |
| message.delivered | Explicit sender/recipient/context handoff; DSH idle means quiescence, not a durable per-message business acknowledgement |
| observation.consumed | Evidence supplied to one agent, distinct from latest sensor state |
| verification.completed | Fresh boundary-scoped accepted result, distinct from policy status and TODO completion |
| recovery.opened / progress | Planner's failed-attempt summary and changes, followed by scoped recorded progress |
| skill.saved | Original recovery goal succeeded and the Evolver published a provenance-bound artifact |

Inspector details expose payloads and correlation IDs. The unified console shows
plans, activity and embodied state together; long panels scroll and narrow screens
stack sections. Native TODO resets with a new DSH turn; an older
snapshot must remain labeled by its originating turn, never silently presented as new.

## Monitor assignment lifetime

For example, 70 admitted observations of a running cup-placement attempt continue one
Verifier assignment through native DSH followups. While a model request is active,
pending frames coalesce to the latest sample; this is not every-frame VLM inference.
The Planner is the monitor's explicit caller. The brief includes the goal, criteria,
execution instruction and budget; images are explicitly delivered to that session.

Pause/end closes that monitor's message and tool admission and requests native cancel.
An accepted pause request is tracked by the run and must outlive the monitor that
it cancels; provider acknowledgement is not cancelled with that model request.
Audit export and handle disposal happen independently of the mandatory formal round.
Late creation at an obsolete boundary is retired without receiving an old frame.
Planner-authorized resume creates a fresh monitoring context. A final role report also
ends its monitor assignment; ordinary per-frame feedback should keep it available.

`monitor.started` identifies the execution segment and assignment. `agent.retired`
records the reason and cleanup outcome; the console projection retains retired status.
Assignment identity and audit remain readable after native handles are released.
This prevents frame count from consuming the live-session limit, but does not implement
context compaction, unlimited runs or retirement of every other role assignment.
Current limits remain 64 live/creating sessions per team and 4,000 run events. Retired
metadata and audits are retained; other completed roles may still hold native handles.

## Multi-goal execution

Read [multi-goal runtime](multi-goal-runtime.md) for deployment bindings, native tools,
per-goal attempt budgets, success gates and the runnable access-repair fixture.
The Planner chooses the sequence; EDH validates dependencies and ownership.

## Recovery and failure knowledge

Formal failure alone does not start learning. The Planner's replan/retry decision
opens one recovery and hands the failed attempt and proposed changes to the Evolver.
Progress is delivered explicitly while execution continues. Original-goal formal
success allows publication, even while later task goals remain unfinished; prerequisite
success and unknown outcomes do not. Learning failures are recorded separately and do
not turn a verified successful task into a failed task.

SKILL sections: When to use, Failure signals, Possible causes, Avoid, Planning guidance,
Verification guidance, Limits, Source. Store observed failures separately from causal
hypotheses. For example, “cup remains outside at the boundary” is an observed fixture
fact; “access was obstructed” is only a hypothesis unless independently supported.
The library excludes fixture experience from ordinary searches by default.

## Persistence and operational limits

A single-writer append-only journal persists domain records with versions, checksums
and fsync. Event records are separate from run projections. Native session audit events
are also appended separately behind a count index, with legacy array reads supported.
Each journal record remains bounded to 8 MiB; aggregate audits may be larger. DSH session exports are
read-only audits; restarting marks unfinished runs interrupted without resubmitting
physical work. A stale writer lock requires confirming the old process is stopped
before manual removal. No automatic lock takeover or journal compaction is implemented.

The demo supports one active run, sequential plan-selected goals and one observing
recovery chain at a time. Completed recovery assignments retain their own provenance. SSE sends
coalesced complete snapshots; reconnect resynchronizes current state rather than
replaying each delta. Tests cover local reconnect/restart, not distributed delivery.
The backend port and CPU fixture do not implement the physical action gate, Python
worker or device-specific stop guarantees. See [progress](progress.md) for next steps.
