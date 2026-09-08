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
The same role may be instantiated repeatedly without sharing histories.

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
   DSH performs registration, validation, dispatch and cooperative timeout. EDH adds
   run-lifetime checks and correlated tool activity. Core authority tools cannot be replaced.
5. Delegate using team.delegate with member, objective, context and authorized evidence
   references. Reply through team.send or request/respond for missing context.
6. Run [the configuration-to-role acceptance test](../../tests/runtime/team-extensions.test.ts)
   as a concrete example, then add behavior-specific provider tests.

The HTTP demo assembles only built-in tools and the fixture provider. A custom provider
requires deployment code to register the factory; listing an arbitrary name in YAML
alone cannot load executable code. These are trusted in-process extensions, not a plugin sandbox.

## State and debugging semantics

| Record | Meaning |
| --- | --- |
| agent.output / stream | Actual assistant/provider output; concise decision notes may be requested by prompts; missing reasoning is never fabricated |
| agent.todos | Original DSH whole-list TODO snapshot, tied to assignment/session/turn/sequence |
| plan.updated | Versioned task plan; done requires the relevant accepted formal verdict |
| dsh.tool-call / result | Native call identity, arguments, model-facing result/error and turn/step |
| message.delivered | Explicit sender/recipient/context handoff; DSH idle means quiescence, not a durable per-message business acknowledgement |
| observation.consumed | Evidence supplied to one agent, distinct from latest sensor state |
| verification.completed | Fresh boundary-scoped accepted result, distinct from policy status and TODO completion |
| recovery.opened / progress | Planner's failed-attempt summary and changes, followed by scoped recorded progress |
| skill.saved | Original recovery goal succeeded and the Evolver published a provenance-bound artifact |

Inspector details expose payloads and correlation IDs. The final interface should
show important streams and states simultaneously; current tabs are provisional and
further visual work is deferred. Native TODO resets with a new DSH turn; an older
snapshot must remain labeled by its originating turn, never silently presented as new.

## Recovery and failure knowledge

Formal failure alone does not start learning. The Planner's replan/retry decision
opens one recovery and hands the failed attempt and proposed changes to the Evolver.
Progress is delivered explicitly while execution continues. Original-goal formal
success allows publication; prerequisite success and unknown outcomes do not.

SKILL sections: When to use, Failure signals, Possible causes, Avoid, Planning guidance,
Verification guidance, Limits, Source. Store observed failures separately from causal
hypotheses. For example, “cup remains outside at the boundary” is an observed fixture
fact; “access was obstructed” is only a hypothesis unless independently supported.
The library excludes fixture experience from ordinary searches by default.

## Persistence and operational limits

A single-writer append-only journal persists domain records with versions, checksums
and fsync. Event records are separate from run projections. DSH session exports are
read-only audits; restarting marks unfinished runs interrupted without resubmitting
physical work. A stale writer lock requires confirming the old process is stopped
before manual removal. No automatic lock takeover or journal compaction is implemented.

The demo supports one active run and one original subgoal/recovery chain. SSE sends
coalesced complete snapshots; reconnect resynchronizes current state rather than
replaying each delta. Tests cover local reconnect/restart, not distributed delivery.
The backend port and CPU fixture do not implement the physical action gate, Python
worker or device-specific stop guarantees. See [progress](progress.md) for next steps.
