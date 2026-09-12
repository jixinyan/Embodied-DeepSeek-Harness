# Server application

Run `pnpm demo` from the repository root. The local HTTP/SSE server composes DSH,
team configuration, UpperRun, a local domain store and an explicitly synthetic backend.

- [runtime.ts](src/runtime.ts): original DSH services and cooperative timeout policy.
- [application.ts](src/application.ts): role tools, task/verification/recovery coordination.
- [http-server.ts](src/http-server.ts): admission, history, control endpoints and SSE snapshots.
- [fixture-model.ts](src/fixture-model.ts) / [fixture-backend.ts](src/fixture-backend.ts): keyless test dependencies.

See [extension and lifecycle guide](../../docs/implementation/upper-runtime.md).
Use `startServer` with explicit `ServerDeployment` bindings for tasks, native DSH
models, tools and backend factories. `startDemoServer` supplies the CPU configuration.
See the [deployment guide](../../docs/implementation/deployments.md) and runnable example. No real physical provider or live model is configured by default.
