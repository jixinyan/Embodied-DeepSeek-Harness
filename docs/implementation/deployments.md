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
| `physicalProfile`, `physicalProviders` | Immutable stack configuration and installed adapter validators; see [physical profiles](physical-profiles.md) |
| `contextManagement` | Optional native DSH compaction/measurement policy; automatic mode requires adapter-declared model capacity; see [context management](context-management.md) |
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
3. The server durably reserves the request ID and calls `createBackend({ signal, services })`
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

The observation panel displays admitted image references through scoped HTTP reads;
samples without images retain their available metadata. The synthetic cabinet
illustration is shown only for fixture evidence without image references.
A `simulation` or `hardware` declaration is not evidence that a provider is healthy.

## Next integration steps

1. Supply a live model through DSH's existing adapter interface and validate model
   tool calls against this same application. No live model is configured by default.
2. Implement the [EmbodiedBackend port](../../harness/agent-runtime/execution/README.md),
   with asynchronous reads, cancellation, cached status and confirmed boundaries.
3. Bind one simulator/policy/perception configuration and register its success checks.
4. Run real provider acceptance before claiming a physical MVP. Standalone action
   admission is implemented; resource arbitration, Python worker transport and actual
   sensor-provider integration remain required.

[Deployment acceptance tests](../../tests/runtime/server-deployment.test.ts) exercise
custom tasks/models, immutable metadata/history, preflight rejection, source mismatch
and shutdown during allocation. They use CPU fixtures only.


Shutdown failures do not skip later cleanup stages: the run, native sessions, host,
HTTP listener and store are drained or attempted before an aggregate error is returned.
This guarantees cleanup attempts, not that a failing external device stopped.
Repeated close calls share the same result.

## Application-owned image service

`startServer` accepts a deployment object or an asynchronous
`deployment: (services) => ServerDeployment` factory. It mounts a native image provider
before calling the factory, so model adapters can bind `services.images.readImageRequest`.
Task backend and retained-environment factories receive the same `services` object.
Save encoded images through `services.images.saveImages` and return their immutable
references in sensor samples. See the [image API and lifecycle](image-storage.md).

The default provider uses `dataDirectory`; `imageStorage` configures its limits.
Custom providers use `mountImages(context, directory)` and the native AttachmentStore
interface. The two options are mutually exclusive. Service cleanup runs on startup
failure and after consumers stop during shutdown. Public configuration exposes image
limits and maintenance capability, while byte reads use persisted run/evidence scope
and visibility. A custom mount may return an `ImageStorageMaintenance` controller;
the default local provider exposes usage inspection and explicit request-cache cleanup.
Providers without a controller remain usable for images. Maintenance requires an idle
workspace and a current provider revision. See the [maintenance API](storage-maintenance.md).

## Configured model and policy endpoints

The [model/policy adapter guide](model-policy-adapters.md) now provides an
OpenAI-compatible model deployment example and a standalone Python WebSocket policy
roundtrip. The latter is not yet connected to ServerDeployment's EmbodiedBackend;
worker event/status integration is the next implementation slice.
