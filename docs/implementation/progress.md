# Implementation progress

Spec: v1.3. Architecture: [decision 0001](decisions/0001-edh-owned-skeleton.md).

## Skeleton Bootstrap

Status: **done** — the architecture skeleton and its local checks are complete. The initial Git commit records the delivered snapshot; functional Steps 00–16 remain unimplemented.

Created: 15 private TypeScript domain packages, server/console interface entries,
Python provider Protocols, a single-source wire schema and generated TypeScript,
default role definitions, Team/tool/deployment/SKILL examples, synthetic fixtures,
SVG diagrams, source dependency audit and handoff documentation.

Not created: an agent runtime, Team loader, callable tool providers, job service,
asynchronous monitor, recovery engine, skill persistence/retrieval, functioning
console, simulator adapters or real robot support. No DSH runtime code is copied.

## Functional plan status

| Step | Status | Next concrete work |
| --- | --- | --- |
| 00 | not_started | Absorb and assemble the necessary DSH implementation; prove one loop/tool/follow-up path |
| 01 | not_started | Refine schema, implement TS/Python boundary validation and state contracts; scaffold schema is input |
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

| Command / inspection | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; all 18 workspace projects resolve against the lockfile |
| `pnpm check:contracts` | Passed; generated types current; 6 wire fixtures, role/team/tool references and malformed input rejection cases |
| `pnpm format:check` | Passed; public interfaces and development checks have consistent formatting |
| `pnpm typecheck` | Passed; includes checks that generated success criteria keep required fields |
| `pnpm check:structure` | Passed; 17 private source workspaces and local documentation links |
| `pnpm check:python` | Passed; 12 Python interface modules compile/import; SVG XML parses |
| SVG visual inspection | Overview and async recovery sequence rendered and checked; no clipped titles |

These are skeleton checks, not implementation acceptance tests. GitHub CI is
configured for Node 22 / Python 3.11; its actual status is reported by the workflow,
not inferred from local results.
No simulation, hardware or model-runtime test has been run.

## Handoff

The next functional action is Step 00. Read the pinned provenance and inspect source
imports as well as manifests. Reuse this checkout; do not regenerate it from a full
DSH clone. Existing schema/examples are design inputs, not passed functional steps.
