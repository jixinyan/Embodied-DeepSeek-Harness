# User sessions and the console launcher

![Session lifecycle and experience scope](../architecture/assets/user-session-lifecycle.svg)

A user session is one conversation workspace with one retained environment allocation.
It contains sequential task runs. Each task creates independent DSH role assignments;
role contexts are not silently shared between tasks or agents. The environment and
workspace SKILL library have different lifetimes from those assignments.

Example: task A places a cup in a cabinet; task B closes its door. Task B must observe
the scene left by A. Starting B must not reset the environment. A new user session
allocates a new environment unless an installed provider explicitly binds a persistent
hardware resource. Task success and environment release are separate states.

## Implemented boundary

`ServerDeployment.launchProfiles` registers trusted launch configurations. Each binds
an environment label, embodiment, policy/checkpoint, default upper model, permitted
task presets and optional validated physical profile. Executable factories and provider
validators remain server-side. All profile Teams are loaded and frozen before opening
storage; their digests participate in admission identity. Explicit role model bindings
still override the selected default. Profiles are installed configuration combinations,
not arbitrary browser-provided checkpoint paths or executable code.

`SessionEnvironment.createTaskBackend(taskId, {signal})` returns a fresh task control
scope over the same environment. Its `EmbodiedBackend.close()` releases only that scope;
`SessionEnvironment.close()` stops and releases the environment. Providers must clean
partial allocations if their factory throws, reject concurrent device ownership, isolate
late task events and acknowledge real release. The server cannot infer robot safety
from a resolved JavaScript promise. Failed cleanup remains `unknown`.

The CPU launcher validates persistent synthetic world state, independent task/role IDs,
recovery publication before task-scope cleanup, history and shared SKILL retention. It
is not a simulator integration. Legacy `/api/runs` remains a single-task entry point and
cannot allocate while a user session owns the environment.

## HTTP and lifecycle

- `GET /api/config`: installed launch profile catalog, resolved profile Teams and task/model bindings.
- `POST /api/sessions`: `{profileId, requestId, selection, catalogRevision}` allocates one user session.
  The console sends all six selected component values and the deployment digest.
  Existing profile-only API clients may continue sending `{profileId, requestId}`.
- `GET /api/sessions?before={id}`: bounded session summaries, next cursor and independent
  active-session configuration. Omit `before` for the latest page.
- `GET /api/runs?session={id}&before={runId}`: bounded task summaries for a session;
  omit filters for all tasks or use `session=standalone` for independent tasks.
- `GET /api/sessions/:id`: state, resource disposition, configuration and a compact
  `taskHistory` containing format, task count and latest task ID. Read task IDs through
  the session-scoped `/api/runs` pages.
- `POST /api/sessions/:id/tasks`: `{scenario, requestId, instruction?, contextRunIds?}`
  starts a task using an allowed criteria preset and an optional user instruction.
- `POST /api/sessions/:id/close`: `{}` ends the session and releases the environment.
- Existing run detail, SSE, pause, resume-request, stop and audit endpoints remain.
  Run detail includes the accepted `submission` and its explicit historical context.

- `GET /api/skills`: up to 100 stored bundles with originating run/session links and
  [inspected provenance](skill-provenance.md), including missing-source diagnostics.

The sidebar and task-context selector navigate separate history pages. Selected outcomes
survive page changes within the active session. See [workspace history](workspace-history.md)
for cursor semantics, record limits and acceptance.

A session progresses through `opening → ready → running → draining → ready` for each
task, then `closing → closed`. Drain waits for pending role receipts and Evolver work
before closing task scopes. End-session cancels outstanding work before waiting for
cleanup. Closing during recovery can therefore cancel unfinished learning; it cannot
publish unverified experience. Unknown cleanup errors block another allocation in the
same process. Admission requests are configuration-bound and deduplicated. After a
restart, unfinished sessions become `interrupted / unknown`, with no physical command
replay. Historical sessions are read-only; provider resource reconciliation remains an
integration requirement. A closed session retains its conversation task records and skills.

## Session-open request identity

UserSessions owns `session-open-request:{requestId}` records with format
`edh.session-open-request.v1`. Each contains the request ID and its session ID; its
journal version stays at 1. New admission publishes the `opening` session, publishes
this identity, then invokes the environment factory. Each write is durable separately.
If publication fails, admission stops before allocation. Startup reconstructs a
missing identity from the source session and marks unfinished sessions interrupted.
It validates existing request records and rejects duplicate source request IDs,
rewritten identities, conflicting keys and absent source sessions.

`replaySession` reads one request record and its source session directly. It compares
the profile, deployment digest and complete configuration using the JSON representation
persisted by LocalStore. Reusing a request ID with changed configuration fails. Returned
records are detached; reading an old request neither activates its session nor acquires
environment resources. A missing request returns no previous admission. Normal opening
then applies current-session and lifecycle admission rules.

Request metadata contains no copies of model configuration, role definitions or task
history. Startup reconciliation still traverses historical sources individually;
request/source key metadata retains lifetime growth. Session task membership uses the
compact representation described below.
Source-aware retention must preserve or explicitly retire request ownership together
with its session. Journal compaction preserves both records and their versions.

`pnpm test:session-requests` runs seven actual journal/document checks covering detached
reads, configuration identity, compaction/reopen, interrupted publication, write holds,
duplicate IDs, rewritten records and missing/conflicting sources. The workspace
pressure check stores over 100 MiB of project documents, performs 32 old/new request
lookups and traverses history under a 64 MiB V8 old-space limit. These checks do not
allocate a simulator, device or model. Live provider lifecycle acceptance remains open.

## Task membership history

`SessionTaskHistory` owns immutable `session-task-member:` records keyed by the JSON
array `[sessionId, runId]`. Each version-1 record declares format
`edh.session-task-member.v1`, session/task identity and its positive admission position.
The session holds `taskHistory: { format: "edh.session-task-history.v1", count,
lastRunId }`. Empty sessions have count zero and a null latest-task reference. These
fields describe recorded task admissions; outcomes remain in each task's run record.

After creating the task control scope, UserSessions publishes membership, advances the
session history with the expected source version, publishes run ownership and the task
request identity, then starts the native run. Each journal write is independently
durable. A membership outside the session's published count cannot be used for task
context or replay. Partial admission remains an error/interrupted session and never
resumes physical work automatically. Duplicate task IDs, rewritten membership records,
changed source versions and inconsistent latest-task references fail explicitly.

Startup converts legacy `runIds` arrays into membership records in the original order,
then replaces the array with the compact history. Configuration, timestamps, request
identity and resource state are preserved by this conversion; normal interruption
handling subsequently updates unfinished sessions. Existing identical membership
records are reused after an interrupted migration. Source arrays remain present until
all memberships have been saved. Migration performs no model or provider calls.

Task context selection checks the requested membership plus `run-user-session`
ownership and the terminal run. Request replay applies the same membership boundary.
SKILL source inspection includes the relevant membership key/version and reports an
absent referenced membership as incomplete. SQLite summaries continue to expose
`runCount`; the console reads full task history through its existing paged route.
Session detail responses expose `taskHistory` after startup migration.

`pnpm test:session-tasks` exercises real journal/SQLite documents: migration and
compaction/reopen, append order, stale/duplicate requests, partial publication under
actual journal write holds, resuming migration, record/head conflicts, indexed history
and task replay. A single-session check appends 2,000 independent document memberships
while retaining a fixed set of history fields. Task-admission and SKILL-provenance
checks cover selected context and missing/conflicting ownership. No environment,
policy or model executes. Distinct journal keys, task records and disk history still
require source-aware retention; this change bounds the session's task-history fields.

## Task instructions and explicit history

The user selects an installed task criteria preset and edits the next instruction in
the console. `instruction` accepts 1–4000 characters; omitted instructions use the
preset text. The selected goal, success checks, entities, subgoal catalog and budget
remain deployment-bound. Browser input cannot replace these fields. The Planner
receives the instruction as the objective in its native DSH invocation.

`contextRunIds` explicitly selects up to four completed tasks from the same user
session. Admission checks both session membership and persisted run ownership, then
records a detached summary with the source record version, task instruction, outcome,
timestamp, final-goal verification conclusion and skill IDs. Private messages, model
reasoning, tool payloads, sensor data and evidence permissions remain in their existing
scopes. Total context is limited to 16 KiB; oversized requests fail before backend
allocation. Historical results require fresh observation before physical decisions.

The selected summaries are passed to the entry Planner through
`InvocationBrief.history_summary`. New delegated roles receive the caller's explicit
brief. Workspace SKILL retrieval remains the mechanism for cross-session experience.
The accepted submission is stored with the run and available through **Inspect submitted
input**, including the criteria snapshot and exact historical context admitted for that task.

Request identity includes the effective instruction and ordered context selection.
Reusing a request ID with changed input fails. Repeated requests return only a durable
run belonging to the same session; incomplete admission records require inspection.
The browser keeps one pending request identity in native session storage until the
accepted run is loaded. Retrying unchanged input uses the same ID; changing input,
session or deployment creates a new identity. User submission initiates each request.

State updates and historical task inspection preserve the current draft. Changing
criteria preserves edited text; **Use criteria instruction** explicitly restores the
selected preset text. The next task and the inspected historical task remain separate
UI selections. A new user session starts a fresh draft.

## Experience scope

The library is workspace-wide, across user sessions and provider types. Retrieval is
explicit, and applicability/validation metadata remains authoritative. A lesson learned
in simulation may inform a hardware plan; this does not establish hardware transfer
success. Fixture experience remains labeled and excluded from non-fixture retrieval.
Raw hidden agent context is not an experience transport.

## Compatible component selection

The console exposes Runtime source, Environment, Embodiment, Checkpoint, Policy and
Upper model default as separate controls. Each field is constrained by the preceding
selections. A change clears dependent fields; a sole compatible value is selected
automatically. Fields wait until their parent selections are complete. The compatible
configuration control distinguishes installed profiles with identical component values
but different task sets or adapter options.

For example, if an installed B1K/R1Pro catalog declares `pi051` and `gr00t8`, only those
checkpoints are selectable for that combination. A checkpoint registered only for
RoboCasa is excluded. These names illustrate catalog rules; they do not assert that
those checkpoints or simulator adapters are installed in this repository.

Both browser and server use the same full-combination validator. Known individual
values cannot be combined into an unregistered profile. The server checks the catalog
revision before allocating resources and returns HTTP 409 for a stale revision.
Provider validators still own physical-profile semantics, action/observation mappings,
checkpoint support and release compatibility. Labels do not establish robotics performance.

An active session fixes all component choices for its lifetime. End session releases
that environment before another configuration can be selected. Historical task views
retain their recorded configuration. Resolved role cards show actual role model aliases;
an explicit role model continues to override the upper default selection.

The blue-and-white console uses the project logo, a Mermaid role graph, inspectable
role cards and separate observation/planning/execution/verification/experience states.
Delegation arrows come from caller assignment IDs; active roles animate from assignment
status. Sensor arrival and execution end have their own labels. Only a passed verification
or published experience receives a success mark. Logs, model output, TODOs and full
payload inspection remain available on the same page. Reduced-motion settings disable
animations. Mermaid ESM assets are served locally; scripts remain same-origin under
CSP. Generated diagram styling requires inline CSS, while objects and document base
overrides are disabled.

## Remaining launcher work

1. Connect actual simulation/hardware allocations, owned workers, action admission and
   device resource reconciliation. No real provider is bundled in the CPU demo.
2. Add provider-backed discovery and confirmation of new task criteria. Editable
   instructions and scoped prior-task context use deployment-registered criteria.
   [Active-task clarification](user-clarification.md) now has durable question/answer
   records, native DSH followups and console component acceptance; live-model and
   provider-confirmed pause/resume acceptance remains required.
3. Package a desktop/service bootstrap so opening the panel can start its local server.
   The panel controls sessions once the server is running; a browser cannot start its
   own unavailable HTTP server. CLI-free bootstrap is not yet implemented.
4. Add bounded history/media retention, knowledge filtering and measured transfer
   evaluations. Multiple concurrent environment sessions are not supported yet.
