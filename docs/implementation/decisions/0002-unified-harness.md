# 0002 — One harness directory, separate runtime responsibilities

Status: accepted by the user, 2026-09-07.

The user selected `harness/agent-runtime`, `harness/physical-runtime` and
`harness/contracts`. This replaces the language/package-oriented top-level names
`packages/` and `python/` while retaining EDH ownership from decision 0001.

The agent side contains the existing flat domain modules. Shared contracts are its
sibling, not owned by either runtime. The physical side contains the Python package
and its policy/environment/device interfaces. Public `@edh/*` names and the Python
`physical_harness` import namespace stay unchanged.

A shared directory does not force a shared process. Model orchestration and device
control have different latency, dependencies and failure handling. They form one
framework through explicit task, observation and status contracts. No independent
product or repository boundary is introduced, and no agent loop or physical behavior
is implemented by this move.

Migration includes workspace discovery/lockfile, TypeScript paths, source generation,
Python import checks, fixtures, role references and documentation links. Validate with
`pnpm check` and a frozen-lockfile install before committing the directory checkpoint.

Public repository content is English, including role examples and all SVG text;
internal conversation may remain Chinese. SVG labels must be visually checked after
translation because text lengths change.
