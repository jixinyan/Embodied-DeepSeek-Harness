# Development setup

Use Node.js >=22.19.0, pnpm 11.19.0 and Python >=3.11. The Python source package
uses `jsonschema` for boundary validation and Pillow for native PNG observation
encoding. The commands below install its declared CPU dependencies. Checks prefer
`.venv/bin/python`; `EDH_PYTHON` overrides the executable.

```sh
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/python -m pip install -c harness/physical-runtime/constraints.txt -e harness/physical-runtime
pnpm check
```

Verify edited source with `pnpm format:check` and `pnpm format:desktop`.
Generated contract types are formatted by the schema generator.

Individual checks: `pnpm check:contracts`, `pnpm typecheck`,
`pnpm check:structure`, `pnpm check:python`.
After editing the schema: `pnpm generate:contracts`.

TypeScript workspaces export private source. `pnpm build:desktop` packages the
Electron launcher under `dist/desktop`; it starts a configured service from a selected checkout with
its installed dependencies. See [desktop build and configuration](../../apps/desktop/README.md).

For native execution, select one of the existing
[provider deployment factories](../../examples/deployments/README.md), configure its
actual worker and model endpoints, and check startup before creating an environment:

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-deployment.mjs \
  --provider robotwin --config /absolute/path/deployment.json \
  --models /absolute/path/model.yaml --journal /absolute/path/closed-console
```

The check uses the actual deployment loader, default factory, server and HTTP
metadata endpoint. The optional closed journal is copied into `.local/checks`
and remains unchanged. No environment is allocated and no inference runs. The
same factory can be selected in the Desktop JSON configuration, with its endpoint
settings supplied through the owned service's environment file. The native task
workflow requires an allocated session and actual policy/model execution.

Use the [native workspace](../implementation/native-workspace.md) to expose
multiple configured providers in one Console. Its readiness check opens the
production application, checks compatible profiles and closes the writer/listener
without creating a Session or starting managed model/policy services:

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-workspace-readiness.mjs \
  --config /absolute/path/native-workspace.json \
  --output .local/work/<new-readiness-directory>
```

For task submission, start the configured native Console:

```sh
EDH_NATIVE_WORKSPACE_CONFIG=/absolute/path/native-workspace.json \
pnpm exec tsx --tsconfig tsconfig.runtime.json examples/deployments/native-workspace.mjs
```

Select its compatible environment, embodiment, checkpoint, execution mode, model
and Team before creating a Session. Native factories acquire configured service
leases at Session admission. Keep data and checkpoint installation in their
configured directories. Communication and original-record checks that require
no model or simulator are in [CPU release validation](../implementation/cpu-release-validation.md).

Runtime data belongs in ignored `.runs/` and `.local/` locations. Tests use
explicit synthetic fixtures. Do not initialize genuine experience libraries
from the example SKILL.

## DSH runtime baseline

`pnpm check` performs the source checks listed above. `pnpm test:runtime` separately
runs keyless fixture tests against the selected DSH loop and upper application.
These tests start a local HTTP server and do not establish real model, policy or
simulation acceptance. The native release workflow uses actual installed services
and preserved task records in [release validation](../implementation/release-validation.md).

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

## Optional policy transport acceptance

Install `-e 'harness/physical-runtime[policy]'` with the same constraints file to
include the pinned WebSocket dependency. CI installs this extra. Without it, base
contracts/imports still work but socket acceptance is skipped. The runnable
[adapter examples](../implementation/model-policy-adapters.md) need no GPU.
