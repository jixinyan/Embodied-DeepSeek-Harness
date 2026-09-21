# Session task catalogs

Each new User Session retains an immutable catalog of task definitions. The console
selects from that catalog and confirms its content digest when submitting a task.
UpperRun and `createTaskBackend` receive the same selected definition. Native DSH
sessions, Planner tools and verification remain the execution mechanisms.

## Deployment and environment sources

`LaunchProfile.taskSource` selects the source:

- `deployment` (default): `tasks` lists registered deployment preset IDs. Opening the
  session snapshots only those definitions with the deployment digest as revision.
- `environment`: `tasks` is an empty array. The allocated `SessionEnvironment` must
  implement `describeTasks({ signal })`, returning `{ revision, tasks }`. Discovery
  runs once during session opening. The session becomes ready after validation,
  durable publication and read-back. A deployment using environment catalogs may
  have an empty top-level `tasks` map.

`tasks` maps provider task IDs to `TaskDefinition`: label, instruction, final goal,
optional registered subgoal checks and predefined goals. Instructions contain up to
4000 characters. All goals use [GoalBinding validation](../../harness/agent-runtime/tasks/README.md#goal-binding-admission).
Task IDs use letters, numbers, dots, underscores and hyphens, start with a letter or
number and contain at most 80 characters. Extra fields, executable bindings, empty
catalogs, missing revisions and invalid goals fail admission. Return public task
definitions; hidden simulator state and credentials belong in provider services.

Providers must discover tasks for the allocated scene and embodiment, maintain stable
task IDs, and return criteria their verifier can evaluate. Catalog validity establishes
structure and identity; provider acceptance must establish actual task compatibility.
Discovery must honor cancellation. In-process providers remain responsible for their
operations completing after cancellation. Discovery failure leaves the session in an
error state with resource status unknown; End session or server shutdown attempts
environment release. Restart never allocates an environment or executes discovery.

## Persistence and submission

`SessionTaskCatalogs` stores one version-one `session-task-catalog:<sessionId>` record.
It includes session/profile/deployment ownership, the source, provider revision and a
SHA-256 digest of the normalized catalog. The session stores only the descriptor;
workspace list summaries carry that descriptor. Reads validate every task, record
version, ownership and content digest. Missing or conflicting catalogs are explicit
errors. Repeated publication must match the existing document exactly.

- `GET /api/sessions/:id/tasks` reads the retained catalog, including after session
  closure/restart. It accepts no query parameters and does not execute provider code.
- `POST /api/sessions/:id/tasks` accepts `scenario`, `requestId`, `catalogRevision`,
  optional `instruction` and optional `contextRunIds`. For sessions with a retained
  catalog, `catalogRevision` is the descriptor's content digest. The selected task
  must be in that session's catalog. The digest participates in request identity.
- `SessionEnvironment.createTaskBackend(taskId, options)` receives `options.task`,
  the complete selected definition, and `options.catalogRevision`, its catalog digest,
  alongside the cancellation signal. Adapters must bind those admitted criteria and
  entities to the task control scope. Planner subgoal instructions arrive separately
  through the existing execution interface.

Catalogs remain fixed for the lifetime of a session. A new task catalog requires a
new session. User instructions and retrieved SKILL guidance cannot rewrite admitted
success conditions. Older sessions without catalog descriptors retain their registered
deployment admission path; their task endpoint has no catalog document to return.
Task submission requires the session's original deployment digest.

## Console behavior and verification

The console loads the active session's catalog, displays its tasks, and uses the same
definitions for default instructions and success-condition inspection. Task submission
is disabled while loading or after a failed read. Reload task catalog retries explicitly.
Requests for previous selections are cancelled and late responses are discarded.
Catalog bodies are requested separately from periodic workspace summaries. Catalog
reads currently return the complete selected session catalog; catalog pagination and
provider-specific scale limits remain future integration work.

`pnpm test:task-catalogs` covers actual authored documents, journals, compaction/reopen,
startup checks, request admission and console selection over real HTTP. Related session
request and console checks cover retained identities and ordinary controls. These tests
execute no model, simulation, policy or environment allocation. Actual `describeTasks`
discovery, device allocation and task execution require provider-backed acceptance.
