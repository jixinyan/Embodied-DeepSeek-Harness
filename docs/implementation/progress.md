# Implementation progress

Spec: v1.6. Architecture: [ownership](decisions/0001-edh-owned-skeleton.md) and
[unified harness layout](decisions/0002-unified-harness.md).

**Current checkpoint: Steps 00–01 complete. Next: pre-MVP foundation F1.**

The latest accepted priority is to harden all MVP-critical mechanisms (agents, tools, communication, execution,
verification, experience, persistence and application lifecycle),
then deliver a runnable simulation-to-console MVP. Read
[foundation acceptance](mvp-foundation.md) before continuing. F1–F7 are new integration
gates and remain unimplemented; the historical step statuses below are unchanged.

## Delivered capabilities

- Original DSH loop, model/tool services, sessions and scoped lifecycle selectively
  absorbed into EDH. No independent replacement loop or full upstream product.
- Trusted host assembly and explicit scoped-session creation. Six keyless behavior
  tests check actual model inputs/results, wake-up, cancellation and teardown.
- Shared schema and generated TypeScript; Python interfaces; role/team/tool/skill
  examples; English specification, SVG figures, module map and implementation plan.
- Matching TS/Python wire validators and pure execution, verification and recovery
  gates; 77 shared wire cases and 69 shared lifecycle cases pass in both languages.
- Per-file source hashes, original MIT notices and documented compatibility patches.

Still unimplemented: Team/Role loading, validated assignment briefs, durable EDH
communication, physical providers/jobs, async Verifier, owner retry coordination,
Evolver/SKILL services, live console, simulator adapters and real robot support.
The host uses an in-memory session store and a scripted model in tests. It does
not yet implement the Team-level AgentFactory contract or physical execution.

## Functional plan status

| Step | Status | Next concrete work |
| --- | --- | --- |
| 00 | done | Original DSH loop, scoped sessions, structured tool, wake-up and cancellation verified |
| 01 | done | Versioned wire schemas, TS/Python validation and state/attempt/evidence gates verified |
| 02 | not_started | Implement Team/Role loader and tool binding validation |
| 03 | not_started | Implement fresh scoped role sessions; inspect actual model inputs |
| 04 | not_started | Implement scoped communication, durable delivery and evidence access |
| 05 | not_started | Implement planning and private workspace tools |
| 06 | not_started | Implement CPU worker jobs, budgets and resource coordination |
| 07 | not_started | Implement CPU perception and active-observation tool slice |
| 08 | not_started | Implement async verifier and mandatory post-budget verification |
| 09 | not_started | Implement owner-only retry/replan and original-goal recovery linkage |
| 10 | not_started | Implement Evolver lifecycle and versioned SKILL storage/retrieval |
| 11 | not_started | Run the full CPU recovery acceptance scenario |
| 12 | not_started | Implement the live console on authoritative events |
| 13 | not_started | Integrate real BEHAVIOR, compatible policy and limited GT |
| 14 | not_started | Complete v1 acceptance, reproduction and evaluation |
| 15 | not_started | Add a second real configuration and assess transfer |
| 16 | not_started | Bind and verify actual hardware |

## Verification evidence

Local verification on 2026-09-07: Node v25.4.0, pnpm 11.19.0, Python 3.14.0.

| Check | Observed result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; all 19 workspace projects resolve |
| `pnpm check` | Passed: formatting, schema, provenance, TypeScript, structure, Python, runtime and shared contract suites |
| `pnpm check:provenance` | 90 source files, source import closure, 20 referenced module bindings and runtime metadata path checked |
| `pnpm check:contracts` | Generated types current; 6 example wire fixtures and structural rejection cases |
| `pnpm typecheck` | Three foundation declaration builds plus strict EDH/non-foundation DSH checks |
| `pnpm check:structure` | 18 private source workspaces; English public text and local links |
| `pnpm check:python` | 14 CPU modules compile/import; repository SVG XML valid |
| `pnpm test:runtime` | 6 integration tests pass; no skipped cases |
| `pnpm test:contracts` | 146 shared wire/lifecycle cases pass in each language, plus non-JSON rejection tests |

The runtime tests are actual Step 00 acceptance, using a scripted model boundary.
They do not prove model intelligence, task success, GT verification or robot support.
No live model API, simulation, GPU policy or hardware test has been run. GitHub CI
uses Node 22 / Python 3.11; its result is reported by the workflow separately.

## Source and integration decisions

The selected graph contains 90 files from 21 upstream modules, mapped to agents,
models, tools, storage and foundation. The source audit added attachment definitions
missing from the earlier manifest closure and excluded unused optional peers.
The original agent-loop algorithms are unchanged. Local patches translate two
comment examples and bind provider attribution to EDH's root product metadata.
The original relative manifest lookup did not survive source relocation; its fix
and runtime asset are tracked alongside source hashes.

Native DSH module names remain internal local aliases. The application, CLI,
configuration Loader, presets and console are not copied. Original runtime module
relationships include cyclic type/service references; source workspaces declare
them explicitly instead of rewriting the upstream loop to force an artificial DAG.
No published package build is claimed.

[The integration guide](dsh-integration.md) provides exact API signatures,
composition, acceptance tests, compiler boundaries and remaining limits.

## Handoff

Continue F1 in [the foundation plan](mvp-foundation.md): register typed message
payloads and add authoritative tool-call/async-operation contracts. Resolve envelope
and payload identity together; preserve operation identity through completion; validate
both selected tool input and output. Update TS/Python cases and compatibility notes.
Then implement the minimal Team/assignment binding and runtime routing needed for F2.
A document update does not pass these gates. The runnable MVP remains the next product
deliverable after foundation acceptance, ahead of broad provider and UI refinement.

Do not create another loop, regenerate from a full DSH clone or install robot/GPU
dependencies for CPU work. Example YAML is not yet a working Team loader. Current
contract gates are pure functions: later services must supply authoritative state,
identities and facts and enforce transitions atomically. They do not run a verifier,
communicate across processes, execute a policy or publish SKILL files.

Version checkpoints: `1109790` records the unified skeleton; `cd5e032` records source
absorption; `56ea601` records Step 00 assembly and acceptance; `c062126` records shared
wire validation. The subsequent Step 01 commit records lifecycle acceptance and this
handoff. Preserve published history and commit each verified work slice.

## Step 01 decisions and evidence

One JSON Schema owns versioned fields and transition tables. Generated TypeScript is
only a static projection; runtime validators retain conditional branches and check
local field relations. Python loads the same source via an explicit path. Both reject
unsupported versions, malformed identity/time/unit values and non-JSON input.

Pure lifecycle gates reject old attempts, executions, verification requests,
assignments and criteria, stale/cross-clock/debug evidence, unauthorized resume,
budget violations and unknown-as-success. A recovery can resolve only against the
original goal and its retry lineage; prerequisite success is insufficient. A supplied
recovery verdict must already pass the formal verdict gate. These checks assume a
trusted service supplies identity and provider facts; runtime integration is future work.

CPU dependencies are pinned in the pnpm lockfile and Python constraints. The setup
and CI create a local Python environment; no simulator, GPU or model key is required.
See [contract APIs and exact limits](contracts.md) and the shared case corpora for
reproduction. Schema v1 remains a pre-release draft, not a deployed compatibility claim.
