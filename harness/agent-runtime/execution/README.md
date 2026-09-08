# Upper execution boundary

[backend-port.ts](src/backend-port.ts) defines the currently used EmbodiedBackend port. The server composes a nonblocking CPU fixture for job/query/budget/pause/resume/check acceptance. Python transport, action-chunk gate and shared device resource arbitration remain unimplemented.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
