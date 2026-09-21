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
- `GET /api/sessions`: session history, actual stored configuration and active ID.
- `GET /api/sessions/:id`: state, resource disposition and task IDs.
- `POST /api/sessions/:id/tasks`: `{scenario, requestId}` starts an allowed task.
- `POST /api/sessions/:id/close`: `{}` ends the session and releases the environment.
- Existing run detail, SSE, pause, resume-request, stop and audit endpoints remain.
- `GET /api/skills`: up to 100 stored bundles with originating run/session links.

A session progresses through `opening → ready → running → draining → ready` for each
task, then `closing → closed`. Drain waits for pending role receipts and Evolver work
before closing task scopes. End-session cancels outstanding work before waiting for
cleanup. Closing during recovery can therefore cancel unfinished learning; it cannot
publish unverified experience. Unknown cleanup errors block another allocation in the
same process. Admission requests are configuration-bound and deduplicated. After a
restart, unfinished sessions become `interrupted / unknown`, with no physical command
replay. Historical sessions are read-only; provider resource reconciliation remains an
integration requirement. A closed session retains its conversation task records and skills.

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
2. Support free-form conversational task admission with explicit success contracts and
   scoped prior-task context handoff. Current tasks are deployment-registered presets.
3. Package a desktop/service bootstrap so opening the panel can start its local server.
   The panel controls sessions once the server is running; a browser cannot start its
   own unavailable HTTP server. CLI-free bootstrap is not yet implemented.
4. Add bounded history/media retention, knowledge filtering and measured transfer
   evaluations. Multiple concurrent environment sessions are not supported yet.
