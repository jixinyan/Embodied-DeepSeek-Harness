# Explicit role communication

[sessions.ts](src/sessions.ts) validates briefs and role tool authority, reserves assignment admission, creates independent DSH sessions and delivers explicit inbox messages. Native output/tool/TODO/status events feed upper projections. Sender identity is bound by application tools. Delivery waits for native session quiescence; versioned role reports and custom result schemas are implemented in [reports.ts](src/reports.ts) and the team loader. Reports retain published versions and immutable caller acknowledgements. Startup marks
unsettled deliveries interrupted without replaying actions; distributed transactions
and automatic redelivery remain pending. See the [protocol guide](../../../docs/implementation/report-acknowledgements.md).

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
