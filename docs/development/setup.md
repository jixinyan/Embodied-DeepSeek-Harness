# Development setup

Use Node.js >=22.19.0, pnpm 11.19.0 and Python >=3.11. The Python source package
has no runtime dependencies in bootstrap. Use `EDH_PYTHON` to select an alternate
Python executable for the import check.

```sh
pnpm install --frozen-lockfile
pnpm check
```

Format edited source with `pnpm format`; verify it with `pnpm format:check`.
Generated contract types are formatted by the schema generator.

Individual checks: `pnpm check:contracts`, `pnpm typecheck`,
`pnpm check:structure`, `pnpm check:python`.
After editing the schema: `pnpm generate:contracts`.

There is no `dev`, `start` or deployment command yet: apps contain assembly and
projection interfaces only. TypeScript packages export source and are private;
a distributable build is a future runtime-integration task. No GPU, API key,
policy checkpoint or simulator is required for skeleton checks.

Runtime data belongs in ignored `.runs/` and `.local/` locations. Tests use
explicit synthetic fixtures. Do not initialize genuine experience libraries
from the example SKILL.
