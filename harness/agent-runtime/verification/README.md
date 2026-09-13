# Verification coordination

UpperRun reuses one independent monitor assignment per continuous execution segment,
retires it on pause/end, and creates a fresh formal-verifier assignment. It enforces limited evidence grants and mandatory boundary verification, and applies shared lifecycle gates. The current backend returns labeled fixture facts. Real GT/device evidence providers remain pending.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
