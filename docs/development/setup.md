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

Run `pnpm demo` for the local HTTP/SSE console at `http://127.0.0.1:4317`.
The fixture requires no GPU, API key, policy checkpoint or simulator. TypeScript
workspaces export private source; a distributable build/deployment remains future work.

Runtime data belongs in ignored `.runs/` and `.local/` locations. Tests use
explicit synthetic fixtures. Do not initialize genuine experience libraries
from the example SKILL.

## DSH runtime baseline

`pnpm test:runtime` runs 18 keyless integration tests against the original DSH
loop and upper application. It is included in `pnpm check`. HTTP acceptance starts
a temporary local server; physical observations and model responses remain fixtures.

`pnpm check:provenance` verifies pinned source hashes and imports. `pnpm typecheck`
first builds the three foundation libraries' declarations into ignored `.cache/`,
using their upstream compiler settings, then strictly checks EDH and other runtime
source. Runtime source execution uses `tsx --tsconfig tsconfig.runtime.json` so
native DSH imports resolve locally. Deleting `.cache/` is safe; typecheck rebuilds it.

See [the integration guide](../implementation/dsh-integration.md) for APIs, exact
acceptance, compatibility patches and features still missing.

## Shared contract checks

`pnpm test:contracts` runs identical wire and lifecycle cases in TypeScript and
Python. Python tests require the pinned environment installed above; no optional
robotics packages are imported. See [the contract guide](../implementation/contracts.md)
for callable APIs, state tables and limits.
