# Durable domain records

[local-store.ts](src/local-store.ts) implements a single-writer CAS journal with checksum validation, fsync and incomplete-tail recovery. The application stores events, plans, files, recovery, skills and read-only DSH audits.
[session-audits.ts](src/session-audits.ts) appends native audit events separately,
publishes a durable count index and reads historical full-array snapshots. Entire
audit histories no longer need to fit one 8 MiB journal record. No resumable model sessions, automatic stale-lock takeover or compaction is implemented.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
