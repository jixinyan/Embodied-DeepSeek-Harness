# Assignment retirement and evidence permissions

`TeamSessions` owns native DSH handles. `UpperRun` owns the evidence permissions
associated with each assignment through `AssignmentEvidenceGrants`. Persistent briefs,
reports, evidence and audits have separate storage lifetimes.

## Creation

The Team loader supplies the role and permitted tools. Native DSH creation produces an
independent Agent scope and Session. Before creation returns, the application opens
evidence permissions from the validated InvocationBrief and records assignment identity.
Inputs are copied; modifying a caller's reference array does not extend permissions.

If publication or listener setup fails after native creation, TeamSessions disposes the
handle. Registered assignments use the ordinary retirement path, including final audit
and permission release. A concurrent Team close drains pending creation; late handles
are disposed before their create calls reject. Native cleanup errors remain observable
to both the create caller and Team shutdown. TeamSessions prevents reuse of retained
assignment IDs.

## Completion and retirement

`finish` closes new-message admission immediately and awaits the current turn before
retirement. Receipt replay and final output can finish through the existing native
turn. `retire` closes admission and requests cancellation immediately. Both share
existing retirement completions and retain cleanup failures.

Retirement awaits quiescence, attempts native handle disposal, then publishes the
final event snapshot. Native disposal removes Agent and Session registry entries and
unwinds the scoped services. Events produced by those services during cleanup are
included in the final audit. Audit export is attempted after a disposal error too.
Errors are aggregated after all cleanup stages have been attempted.

The application releases evidence permissions when retirement cleanup completes,
including the failed-cleanup path, before writing the retirement projection. Observing
new evidence or transferring references requires an existing grant scope. A late
extension cannot recreate a released set. Run shutdown closes all remaining grant
scopes after native sessions and pending application operations settle.

Retained assignment briefs, last-seen images and published reports remain inspectable
history. Those records do not authorize a retired role to read evidence. Native
role-context disposal does not delete stored evidence or its image objects. Image
retention independently checks persisted references and configured external ownership.

## Acceptance

`pnpm test:assignment-lifetime` uses the actual DSH host, Team loader, native Agent and
Session services, LocalStore and SessionAudits. No model adapter or backend is executed.
The tests cover:

- Detached explicit grants, role isolation, duplicate admission and late-extension rejection.
- Native retirement, durable audit reopening, retained identity and rejected ID reuse.
- Seventy sequential independent assignments with live registry capacity released each time.
- A native scoped cleanup contribution whose event appears in the final persisted audit.
- Team shutdown racing pending native creation.
- A real journal write hold rejecting creation publication and final audit, with native cleanup.
- A real audit write failure releasing registries and grants while remaining observable at shutdown.

These checks establish idle native lifecycle and local authority behavior. They do
not establish in-flight live VLM/provider shutdown, cooperative external cancellation,
garbage-collector timing or a bound on process memory. Active-session event history,
retained assignment/projection growth and domain-record archival remain required
upper-runtime work. Full recovery/receipt behavior needs live model acceptance.
