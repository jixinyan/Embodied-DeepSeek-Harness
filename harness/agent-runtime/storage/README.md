# Durable domain records

[local-store.ts](src/local-store.ts) implements a single-writer CAS journal with checksum validation, fsync and incomplete-tail recovery. The application stores events, plans, files, recovery, skills and read-only DSH audits. No resumable model sessions, automatic stale-lock takeover or compaction is implemented.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
