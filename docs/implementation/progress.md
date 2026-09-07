# Implementation progress

Spec: v1.4. Architecture: [ownership](decisions/0001-edh-owned-skeleton.md) and
[unified harness layout](decisions/0002-unified-harness.md).

**Current checkpoint: Step 01 in progress. Bootstrap and Step 00 complete.**

## Delivered capabilities

- Original DSH loop, model/tool services, sessions and scoped lifecycle selectively
  absorbed into EDH. No independent replacement loop or full upstream product.
- Trusted host assembly and explicit scoped-session creation. Six keyless behavior
  tests check actual model inputs/results, wake-up, cancellation and teardown.
- Shared schema and generated TypeScript; Python interfaces; role/team/tool/skill
  examples; English specification, SVG figures, module map and implementation plan.
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
| 01 | in_progress | Refine schema, implement TS/Python boundary validation and state contracts; scaffold schema is input |
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
| `pnpm check` | Passed: formatting, schema, provenance, TypeScript, structure, Python and runtime suite |
| `pnpm check:provenance` | 90 source files, source import closure, 20 referenced module bindings and runtime metadata path checked |
| `pnpm check:contracts` | Generated types current; 6 wire fixtures and structural rejection cases |
| `pnpm typecheck` | Three foundation declaration builds plus strict EDH/non-foundation DSH checks |
| `pnpm check:structure` | 18 private source workspaces; English public text and local links |
| `pnpm check:python` | 12 interface modules compile/import; repository SVG XML valid |
| `pnpm test:runtime` | 6 integration tests pass; no skipped cases |

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

Continue Step 01 in the existing checkout. Read the shared schema and current
fixtures, refine missing identities/units/versions and state rules, then implement
matching TypeScript/Python validators against the same positive and negative cases.
The new runtime suite remains a regression gate. Do not regenerate from a full DSH
clone, install robot/GPU dependencies for CPU work, or label existing example YAML
as a working Team loader. New public content stays English; diagrams stay SVG.

Version checkpoints: `1109790` records the unified skeleton; `cd5e032` records source
absorption. The subsequent Step 00 implementation commit records working assembly
and acceptance. Preserve published history and commit each verified work slice.

## Step 01 — wire validation checkpoint

Refined versioned identities, timestamps, success-check IDs/sources, async tool
results, device acknowledgement, evidence metadata, plan/recovery references and
action units. Both TypeScript and Python load the same authoritative JSON Schema.
A shared fixture corpus exercises positive and negative wire boundaries. Lifecycle
transition and current-attempt verdict gates are the remaining work for this step.
