# Configuring a local deployment

`startServer({ root, dataDirectory, port, deployment })` composes the existing DSH
host, team, UpperRun, local store, HTTP/SSE service and console. `startDemoServer`
is a wrapper that supplies the CPU configuration from
[demo-deployment.ts](../../apps/server/src/demo-deployment.ts). There is no second
agent loop or runtime registration system.

## Run the configuration example

From the repository root:

```sh
pnpm exec tsx --tsconfig tsconfig.runtime.json examples/deployments/local-cpu.mjs
```

Open `http://127.0.0.1:4318`. The console lists one task, **Place the cup**, using
model alias `brain` and the existing scripted fixture adapter. This demonstrates
configuration replacement, not a live VLM or robot. Its history lives in
`.runs/custom-deployment`; the usual `pnpm demo` history is separate. Stop with
Ctrl+C. See the [runnable example](../../examples/deployments/local-cpu.mjs).

## Define the bindings

The executable contract is
[ServerDeployment / TaskPreset](../../apps/server/src/deployment.ts).

| Field | Meaning and example |
| --- | --- |
| `id`, `version`, `description` | Public deployment identity; increment `version` when executable adapter/factory behavior changes |
| `source` | `test_fixture`, `simulation` or `hardware`; each created backend must report the same source |
| `teamFile`, `roleRoot` | Team YAML and allowed role-file root; roles and result schemas are resolved during preflight |
| `models`, `defaultModel` | Named aliases such as `brain: { provider: 'fixture', model: 'fixture' }`; roles select an alias |
| `adapters` | Original DSH `LlmAdapter` bindings, registered by provider name; keep credentials inside trusted adapter setup |
| `tasks` | Task IDs mapped to public labels/instructions, immutable final goals, optional allowed subgoal checks/predefined goals, and backend factories |
| `additionalTools` | Logical tool IDs mapped to native DSH tool factories; roles opt in through their tool lists |
| `providers` | Available tool-provider names for team preflight; declaring a name does not install or implement a provider |

Executable objects remain trusted local code. HTTP exposes selected metadata, team
prompts and resolved bindings; do not put credentials in those public fields.
Adapters and backend/tool factories are not serialized. A YAML tool name alone
cannot load executable code. Follow the [native tool guide](upper-runtime.md).

The default upper application requires the team's entrypoint to be its decision
owner. This is checked before opening the store or allocating a backend. Unknown
model aliases/providers, duplicate adapter bindings, invalid tasks/budgets and
unresolved team dependencies fail startup preflight. Backend connection and model
inference are not health-checked by preflight.

## Task admission and provider ownership

1. The browser obtains task presets, roles, models and source from `/api/config`.
2. `POST /api/runs` accepts `{ "scenario": "placement-task", "requestId": "unique-request-123" }`.
   The historical field name `scenario` now identifies any configured task preset.
   Free-form instructions, model-selected task criteria and request-supplied executable
   providers are not accepted by this endpoint.
3. The server durably reserves the request ID and calls `createBackend({ signal })`
   once for a new admission. Return a fresh backend for each run. The factory owns
   cleanup if it rejects before returning; the server owns returned instances.
4. UpperRun uses the task's registered checks, goal, budget, tools and native DSH model
   aliases. Metadata is copied/frozen at startup; later caller mutation does not
   change an admitted task. Callable provider internals must remain stable themselves.
5. Reusing the same request ID/configuration returns the original run ID. Changed
   configuration or an interrupted reservation returns 409; inspect history before
   creating another request. Backend allocation failures do not silently retry.
6. Shutdown aborts the factory's signal, waits for in-flight admission, and closes a
   late returned backend without starting a run. Factories must honor cancellation;
   an uncooperative promise cannot be forcibly terminated in process.

The deployment digest covers serialized metadata and the resolved team's source
digest. It does not hash executable closures, model weights or credentials: bump
the deployment version when their behavior changes. Legacy request records without
a digest cannot be replayed under a new deployment.

## Historical debugging

Each newly admitted run stores its public configuration. After changing a deployment,
old runs still show their own roles, source and description. Legacy histories without
a snapshot are explicitly labeled; the console can show their recorded assignments
but cannot reconstruct their original prompts. Restarted histories remain read-only;
no agent session or physical command is automatically resumed.

The synthetic cabinet illustration is shown only for fixture evidence. Other sources
currently show observation metadata: live camera transport/rendering is still pending.
A `simulation` or `hardware` declaration is not evidence that a provider is healthy.

## Next integration steps

1. Supply a live model through DSH's existing adapter interface and validate model
   tool calls against this same application. No live model is configured by default.
2. Implement the [EmbodiedBackend port](../../harness/agent-runtime/execution/README.md),
   with asynchronous reads, cancellation, cached status and confirmed boundaries.
3. Bind one simulator/policy/perception configuration and register its success checks.
4. Run real provider acceptance before claiming a physical MVP. Action admission,
   resource arbitration, Python transport and real sensor display remain unimplemented.

[Deployment acceptance tests](../../tests/runtime/server-deployment.test.ts) exercise
custom tasks/models, immutable metadata/history, preflight rejection, source mismatch
and shutdown during allocation. They use CPU fixtures only.
