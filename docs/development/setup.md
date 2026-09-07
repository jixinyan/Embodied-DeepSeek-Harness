# Development setup

Use Node.js >=22.19.0, pnpm 11.19.0 and Python >=3.11. The Python source package
uses `jsonschema` for boundary validation. The commands below install its pinned CPU
dependencies. Checks prefer `.venv/bin/python`; `EDH_PYTHON` overrides the executable.

```sh
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/python -m pip install -c harness/physical-runtime/constraints.txt -e harness/physical-runtime
pnpm check
```

Format edited source with `pnpm format`; verify it with `pnpm format:check`.
Generated contract types are formatted by the schema generator.

Individual checks: `pnpm check:contracts`, `pnpm typecheck`,
`pnpm check:structure`, `pnpm check:python`.
After editing the schema: `pnpm generate:contracts`.

There is no `dev`, `start` or deployment command yet. The server has a callable
DSH assembly entry; the console remains a projection interface. TypeScript packages export source and are private;
a distributable build is a future runtime-integration task. No GPU, API key,
policy checkpoint or simulator is required for skeleton checks.

Runtime data belongs in ignored `.runs/` and `.local/` locations. Tests use
explicit synthetic fixtures. Do not initialize genuine experience libraries
from the example SKILL.

## DSH runtime baseline

`pnpm test:runtime` runs six keyless integration tests against the original DSH
loop and the EDH host assembly. It is included in `pnpm check`. The host is a callable
source entry, not a network service; no `dev` or `start` command exists yet.

`pnpm check:provenance` verifies pinned source hashes and imports. `pnpm typecheck`
first builds the three foundation libraries' declarations into ignored `.cache/`,
using their upstream compiler settings, then strictly checks EDH and other runtime
source. Runtime source execution uses `tsx --tsconfig tsconfig.runtime.json` so
native DSH imports resolve locally. Deleting `.cache/` is safe; typecheck rebuilds it.

See [the integration guide](../implementation/dsh-integration.md) for APIs, exact
acceptance, compatibility patches and features still missing.
