# Server application

Run `pnpm demo` from the repository root. The local HTTP/SSE server composes DSH,
team configuration, UpperRun, a local domain store and an explicitly synthetic backend.

- [runtime.ts](src/runtime.ts): original DSH services and cooperative timeout policy.
- [application.ts](src/application.ts): role tools, task/verification/recovery coordination.
- [native-worker.ts](src/native-worker.ts): retained native simulator process,
  task-scoped backend ports, bounded transport requests, camera attachment storage,
  and confirmed process release. The session keeps one native scene across tasks;
  each task receives a separate run ID before its backend and UpperRun are created.
- [http-server.ts](src/http-server.ts): admission, history, control endpoints and SSE subscriptions.
- [user-sessions.ts](src/user-sessions.ts): retained environment lifetime, task admission
  and durable session-open request identity; [publication and checks](../../docs/implementation/user-sessions.md#session-open-request-identity).
- [session-task-history.ts](src/session-task-history.ts): compact session history,
  immutable task membership and legacy migration; [ownership and checks](../../docs/implementation/user-sessions.md#task-membership-history).
- [workspace-history.ts](src/workspace-history.ts): bounded session/task summaries,
  scoped cursors and independent active records; [API and acceptance](../../docs/implementation/workspace-history.md).
- [domain-retention.ts](src/domain-retention.ts): configured record owners, reference
  leases and versioned retirement previews; [admission boundaries](../../docs/implementation/domain-retention.md).
- [session-record-owners.ts](src/session-record-owners.ts): Session/request/catalog
  reference declarations and task ownership checks for retention assembly.
- [evidence-record-owners.ts](src/evidence-record-owners.ts): sensor and verification
  dependencies, scoped source checks and accepted-verdict agreement.
- [report-record-owners.ts](src/report-record-owners.ts): report authors, recipients,
  history, evidence and delivery/acknowledgement dependencies.
- [task-record-owners.ts](src/task-record-owners.ts): archived delegation context,
  original-goal recovery provenance and published event dependencies.
- [run-record-owners.ts](src/run-record-owners.ts): run projections, immutable
  configuration, restart annotations and selected historical task sources.
- [event-record-owners.ts](src/event-record-owners.ts): event/message source references,
  historical payload validation and versioned deployment extensions.
- [run-event-stream.ts](src/run-event-stream.ts): bounded event batches, current projections and connection backpressure.
- [fixture-model.ts](src/fixture-model.ts) / [fixture-backend.ts](src/fixture-backend.ts): keyless test dependencies.

See [extension and lifecycle guide](../../docs/implementation/upper-runtime.md).
Use `startServer` with explicit `ServerDeployment` bindings for tasks, native DSH
models, tools and backend factories. `startDemoServer` supplies the CPU configuration.
See the [deployment guide](../../docs/implementation/deployments.md) and runnable example.
The native worker requires an explicit simulator, task catalog, policy service,
scene configuration, and isolated runtime command. The default demo remains synthetic.
The RoboCasa process check stores actual reset camera frames and native checks under
`.local/work/native-worker-remote`; the learned policy has not completed an action in
that check.
