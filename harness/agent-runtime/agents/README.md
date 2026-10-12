# Independent DSH role sessions

[runtime.ts](src/runtime.ts) creates neutral-host sessions with explicit prompts, tools and optional native TODO support. Team-level assignment validation is composed by communication. No replacement loop is implemented.

[src/dsh/model-retry](src/dsh/model-retry/index.ts) contains the selected native DSH
model-request retry executor and event identities. The host mounts this plugin;
`models` supplies immutable provider retry policies. Native backoff, retry-chain
projections, cancellation and disposal stay with the Agent runtime. Correlated
Team events reach the Console and domain retention. See
[model-request retries](../../../docs/implementation/model-configuration.md#model-request-retries).

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
