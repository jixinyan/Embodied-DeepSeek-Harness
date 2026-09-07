# Server assembly

Application composition, transport and host startup.

The [runtime entry](src/runtime.ts) now assembles the selected DSH services with
explicit model bindings. Its keyless acceptance tests run the original agent loop.
The public `ServerAssembly` remains a target interface; there is no network server,
browser application or `start` command. See [DSH integration](../../docs/implementation/dsh-integration.md).
