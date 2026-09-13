# Explicit role communication

[sessions.ts](src/sessions.ts) validates briefs and role tool authority, reserves assignment admission, creates independent DSH sessions and delivers explicit inbox messages. Native output/tool/TODO/status events feed upper projections. Sender identity is bound by application tools. Delivery waits for native session quiescence; versioned role reports and custom result schemas are implemented in [reports.ts](src/reports.ts) and the team loader. Reports retain published versions and immutable caller acknowledgements. Startup marks
unsettled deliveries interrupted without replaying actions; distributed transactions
and automatic redelivery remain pending. See the [protocol guide](../../../docs/implementation/report-acknowledgements.md).

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).

## Continuing and retiring assignments

A fresh delegation creates an independent context. Explicit followup messages may
continue that assignment; they do not import another agent's conversation. The async
Verifier uses this native DSH path for successive admitted images during one running
segment. Pausing retires the monitor; formal verification and resumed monitoring each
receive fresh assignments with explicit context.

`TeamSessions.retire` closes message/tool admission and requests native cancellation
immediately, then waits for quiescence, exports the audit and disposes the handle.
Repeated retirement shares its completion. Identity and historical audit remain
available; retired IDs cannot be reused or receive new work. Audit failure does not
skip disposal, and shutdown collects cleanup errors from already retired sessions.
This releases active session capacity, not retained history or model-context memory.
