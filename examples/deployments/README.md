# Native deployments

Each native module default-exports a `DeploymentFactory` for the desktop launcher
and starts its console when executed directly through `tsx`. Importing the module
does not start a server, allocate an environment, or send model requests.

| Module | Required configuration variable | Default console port |
| --- | --- | --- |
| `robotwin-live.mjs` | `EDH_ROBOTWIN_CONFIG` | 4323 |
| `behavior-live.mjs` | `EDH_BEHAVIOR_CONFIG` | 4334 |
| `robocasa-live.mjs` | `EDH_NATIVE_WORKER_CONFIG` | 4318 |
| `robodojo-live.mjs` | `EDH_ROBODOJO_CONFIG` | 4318 |

Execute a selected module through `pnpm exec tsx --tsconfig tsconfig.runtime.json`
with its path as the final argument. The named variable points to an actual JSON
configuration. `native-live.mjs` contains the shared configuration loader and
factory. The desktop launch configuration selects the same provider module as
`deployment`, supplies its environment file, and controls console port and data
directory. See the [desktop launcher](../../apps/desktop/README.md).

Configuration requires `modelConfiguration`, `dataDirectory`, and an actual native
`worker`. RoboTwin, BEHAVIOR and RoboCasa have one `worker` and `checkpoint` at the
top level. RoboDojo has a `profiles` object whose entries contain `worker`,
`checkpoint`, and an optional `plannerModel`. Every worker selects its provider,
`nativeTaskId`, native scene configuration, policy identity, and catalog. The catalog
must contain exactly that task. Task definitions and native success checks pass
the production validators; provider initialization checks the actual installed
task and embodiment before execution.

Optional top-level `teamFile` and `roleRoot` select a production `FileTeamLoader`
Team. Relative paths resolve against the repository root. Team validation includes
actual model aliases, role files, tools, provider constraints, and the decision
owner. For the camera specialist workflow select
`examples/teams/robotwin-scene-analyst.yaml` with `roleRoot: "examples"`.

An optional `profile` object accepts `id`, `label`, and `environment` on each worker
configuration or RoboDojo profile entry. IDs must satisfy the console's profile
identity rules. With existing default tasks the profile IDs remain
`robotwin-adjust-bottle`, `behavior-picking-up-trash`, and `robocasa-open-cabinet`.
Other native task IDs derive their profile identity and labels from the selected
task; explicit metadata supports descriptive operator labels. RoboDojo preserves
each existing `profiles` key and `label`.

`EDH_MODEL_CONFIG` can select a configured model file for every provider. Existing
RoboCasa configuration variables remain supported: `EDH_MODEL_BASE_URL` plus
`EDH_MODEL` when a model configuration is absent, `EDH_POLICY_CHECKPOINT_LABEL`,
`EDH_DATA_DIRECTORY`, `EDH_SAM31_BASE_URL`, and `EDH_CONSOLE_PORT`. Existing provider
configuration paths, native scene fields, deadlines, recording fields, and policy
options retain their meaning. Native learned-policy profiles require `policyUri`.
RoboDojo `direct` and `hybrid` profiles bind GPT-6 Astra through `policyModel`, with
their gateway and DSH host owned by the allocated Session environment. Closing
that environment releases those resources and flushes its audit records.

The startup check uses the actual loader, default factory, server, and HTTP
metadata endpoint:

```bash
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-native-deployment.mjs \
  --provider robotwin --config /absolute/path/deployment.json \
  --models /absolute/path/model.json --journal /absolute/path/closed-console
```

`--journal` is optional and copies existing closed journal bytes into an isolated
directory under `.local/checks`. The check allocates no native environment and
performs no inference. Native task execution, policy acceptance, and formal success
require an actual live run and retained evidence. The YAML files in this directory
remain deployment authoring examples with their own declared requirements.
