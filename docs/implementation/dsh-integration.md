# DSH integration: Step 00

The original DSH model/tool loop now runs inside EDH's source tree. This is a
keyless integration baseline, not a functioning physical agent product.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm check
# Or run the native runtime acceptance suite alone:
pnpm test:runtime
```

The tests use a scripted model and structured synthetic cup-location tools. They
open no ports, make no model API calls and use no GPU or simulator. The test model
only emits DSH stream chunks; DSH itself chooses the loop transitions, invokes the
tool registry, constructs subsequent requests and drains cancellation.

## Source assembly and ownership

[The pinned import map](../provenance/dsh-imports.json) records 93 source files from
23 modules at `d347e703908d0406b7a7ef80e3a0e594d86b2215`.

| EDH location | Absorbed responsibilities |
| --- | --- |
| `harness/agent-runtime/agents/src/dsh/` | Agent registry, original loop, scoped context, system prompts |
| `harness/agent-runtime/models/src/dsh/` | Model interface, streaming/message vocabulary, attribution |
| `harness/agent-runtime/tools/src/dsh/` | Native tool registration/execution and imported code/approval definitions |
| `harness/agent-runtime/storage/src/dsh/` | Sessions, projections, persistence and attachment definitions |
| `harness/agent-runtime/foundation/src/dsh/` | Cordis, Cosmokit, Schemastery, settings/protocol and small runtime utilities |

Native `@deepseek-ai/*` module IDs remain internal source aliases so namespace
merging and imports preserve upstream behavior. They resolve to these local EDH
files, not installed DSH packages. The upstream application, CLI, Loader, coding
profiles, presets and UI are absent. Source names preserve attribution, not a
separate upstream product layout.

The earlier manifest closure was an audit input, not executable proof. Source
inspection found LLM attachment imports missing from that closure and excluded
unused optional Loader/include/diagnostic peers. Imported definitions do not mean
providers are mounted: there is no attachment filesystem, approval service,
code-execution backend or disk session persistence in this host.

## Concrete host and session seams

[Host assembly](../../apps/server/src/runtime.ts) exports:

```ts
createDshHost(bindings: readonly ModelBinding[]): Promise<Context>
// ModelBinding = { providers: string[]; adapter: LlmAdapter }
```

It mounts LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt,
ToolRuntime, AgentRegistry and AgentLoop with no automatically created agents.
It registers the supplied model adapters and rolls back startup on error. The
caller owns the returned trusted context and must await `ctx.fiber.dispose()`.
No role prompt or global user tool is installed by default.

[Session construction](../../harness/agent-runtime/agents/src/runtime.ts) exports:

```ts
createDshSession(host: Context, definition: DshSessionDefinition): Promise<DshAgentHandle>
// definition = { sessionId, provider, model, instructions, tools, signal? }
```

This uses `host.agents.create({ sessionId, agentOptions, signal?, setup })`.
`setup(agentCtx)` registers the explicit prompt section and tools in the new
agent's scope before publication. Duplicate tool registration rolls the entire
creation back. The helper rejects an agent-owned context; sessions are created
from the neutral host rather than inheriting a caller's scoped composition.

The result owns `handle.agent` and asynchronous `handle.dispose()`. Actual APIs:

| Need | Native DSH seam | Verified meaning / limit |
| --- | --- | --- |
| Later input | `agent.followup(createUserMessage({ content, source }))` | Wakes an idle agent; plugin-sourced host input tested |
| Wait for quiescence | `await agent.whenIdle()` | Waits for the current activity to drain; not a per-message receipt |
| Cancel | `agent.cancel({ kind: 'user' })` | Aborts active model/tool work and clears queued work by default |
| Dispose | `await handle.dispose()` / `await host.fiber.dispose()` | Stops/drains activity and unregisters sessions and scoped contributions |
| Trace events | `ctx.on('agent/status', ...)`, scoped `agent.ctx.on(...)` | Actual running/idle transitions; scoped listeners do not see sibling events |
| Inspect transcript | `agent.session.snapshotEvents()` | Includes original tool/result and turn/end records; in-memory here |
| Typed tool | `defineTool({ parameters, output: { schema, render }, execute })` | Canonical structured value plus model-visible projection |
| Dispatch boundary | `ctx.tools.execute({ agent, callId, name, arguments, signal })` | Out-of-scope tool is rejected, even through direct runtime dispatch |

These are trusted assembly primitives. The future Team loader and AgentFactory
must add validated InvocationBriefs, responsibility permissions, evidence/file
access and physical effect/resource rules. A neutral host with no global prompt
or tools proves sibling separation in this composition; it does not prove arbitrary
third-party host plugins are isolated or safe. This is not the full Step 03 gate.

DSH cancellation is cooperative, not a robot stop acknowledgement. DSH model API
request retries are also distinct from EDH physical task retries. Steps 06–09 must
enforce action budgets, confirmed device state and owner-only physical decisions.

## Compatibility changes

No model-loop algorithm was rewritten. Two narrow source changes are recorded:

1. Translate two Unicode identifier examples in Python SDK renderer comments to
   English-compatible examples. No executable change.
2. Resolve model attribution's version from EDH's root manifest after relocation,
   and identify EDH's product/repository in the public User-Agent. The original
   `../package.json` lookup failed at runtime in the new layout. This is product
   metadata, not model prompt or loop logic.

The source checker verifies every copied file hash, selected import and alias, plus
runtime metadata assets. Keep upstream hashes immutable; explain and hash local
patches separately. TypeScript targets ES2024 for the upstream Promise APIs.
`verbatimModuleSyntax` follows DSH's setting because upstream imports include type
symbols without `import type`; strict, exact optional and indexed-access checks
remain enabled for EDH and non-foundation DSH code.

Cordis/Cosmokit/Schemastery keep their upstream compiler boundaries. The typecheck
command regenerates declarations in ignored `.cache/dsh-types/`, then checks EDH
against those declarations. `tsconfig.runtime.json` resolves runtime aliases to
source; it must be supplied to `tsx`. These are private source workspaces, not a
published package build. Some original DSH modules have cyclic type/service
references; their owner workspaces declare these edges rather than hiding them.
The standard-schema declaration dependency is available
at the root for generated declarations. Only esbuild's required installation script
is enabled; simulator/model dependencies are not added.

## Acceptance evidence

[Six tests](../../tests/runtime/host.test.ts) passed locally on Node 25.4.0:

1. Structured tool call, canonical model-visible result, later plugin-sourced input,
   two running/idle cycles, and scoped removal on disposal.
2. Distinct sessions; no sibling prompt/history/tool in actual model inputs; explicit
   later handoff appears; direct unauthorized tool dispatch fails without execution.
3. Cancellation reaches an active model request, clears queued input, commits an
   aborted turn and permits a later fresh wake.
4. Aborted creation publishes nothing; host teardown unregisters multiple sessions.
5. Failed scoped setup rolls back; the same session identity can then be reused.
6. Host shutdown cancels an active cooperative tool and drains it before removal.

These exercise the assembled EDH host, not a replacement loop or mock agent factory.
The complete upstream test suite has not been imported or claimed as passing.
The normal CI runs the same suite on Node 22; consult the workflow for its actual
status rather than inferring that result from the local Node version.

## Current upper integration

TeamSessions now composes this seam with immutable Team/Role bindings and explicit
briefs; UpperRun implements task tools, verification and recovery. The original DSH
TODO plugin is mounted per authorized session. The original cooperative timeout
policy is mounted in the host. Native authoring and scalar output remain unchanged.

A local EDH domain journal is mounted; native DSH sessions remain in-memory with
read-only audit exports. This is not resumable session persistence. See
[upper-runtime guide](upper-runtime.md) and [progress](progress.md) for 26 runtime
acceptance cases and remaining physical/deployment boundaries.
