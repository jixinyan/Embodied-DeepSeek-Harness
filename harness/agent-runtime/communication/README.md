# Explicit role communication

[sessions.ts](src/sessions.ts) validates briefs and role tool authority, reserves assignment admission, creates independent DSH sessions and delivers explicit inbox messages. Native output/tool/TODO/status events feed upper projections. Sender identity is bound by application tools. Delivery waits for native session quiescence; versioned role reports and custom result schemas are implemented in [reports.ts](src/reports.ts) and the team loader. Reports retain published versions and immutable caller acknowledgements. Startup marks
unsettled deliveries interrupted without replaying actions; distributed transactions
and automatic redelivery remain pending. See the [protocol guide](../../../docs/implementation/report-acknowledgements.md).

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).

## Continuing and retiring assignments

A fresh delegation creates an independent context. Explicit followup messages may
continue that assignment; they do not import another agent's conversation. The host
creates the designated Verifier only after an eligible completed execution boundary.
It supplies selected before and final observations as explicit context. Running frame
updates and ordinary pauses create no Verifier assignment.

`TeamSessions.retire` closes message/tool admission and requests native cancellation
immediately, then waits for quiescence, disposes the handle and exports the final audit.
Events committed during scoped disposal are included. Audit export is attempted even
when native disposal fails.
Repeated retirement shares its completion. Identity and historical audit remain
available; retired IDs cannot be reused or receive new work. Audit failure does not
skip disposal, and shutdown collects cleanup errors from already retired sessions.
The native disposer removes Agent and Session registry entries and unwinds their scopes.
Retained assignment identities and persisted history have separate lifetimes. Active
session history and application projections still require retention limits.

Creation-publication failures dispose their native handles and preserve cleanup errors.
Application evidence grants open from the creation brief and release after retirement
cleanup. Late additions require an existing live grant scope. See the
[lifecycle checks](../../../docs/implementation/assignment-lifetime.md).

The synchronous audit hook receives the native Session. UpperRun publishes it through
`SessionAudits.appendNative`, which reads immutable events individually through the
original DSH sequence API. Delivery error detection likewise reads the captured
delivery range. Complete native event-array snapshots are unnecessary for these paths.
See [native audit publication](../../../docs/implementation/session-audits.md#native-publication).


Normal completion uses `TeamSessions.finish`: reject new messages immediately, allow
the current native turn to receive its final tool receipt and produce final output,
then retire at quiescence. The original turn deadline remains active while draining;
shutdown may still cancel it. Repeated finish shares completion, including cleanup
errors. `isLive` describes the native handle; `acceptsMessages` also excludes finishing
assignments. Application tools permit only report receipt/replay and report inspection
while finishing, not new domain work.

Final role reports, accepted formal verdicts and settled recovery-success delivery
with a published SKILL finish their assignments. An Evolver model failure retires its
handle while preserving the separate learning failure. Missing-context reports and
ordinary idle turns remain available for explicitly supplied followup context.

The caller can still query and acknowledge a retired role's durable report. A final
report arriving after its caller finishes is saved with failed delivery and no new
recipient evidence grant; it does not reopen that caller or fail the whole task.
Its actual final native turn may replay the report before quiescence. After disposal,
use durable report inspection, not another native call through a retired handle.
