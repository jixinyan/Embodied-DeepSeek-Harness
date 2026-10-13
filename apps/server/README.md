# Server application

The local HTTP/SSE server composes configured native DSH models, Teams, UpperRun,
the domain store and retained environment factories. Use the
[native workspace](../../docs/implementation/native-workspace.md) to select compatible
simulators, embodiments, checkpoints and model services through one Console.

- [runtime.ts](src/runtime.ts): original DSH services and cooperative timeout policy.
- [native-deployment-configuration.mjs](src/native-deployment-configuration.mjs):
  provider configuration, task/catalog/checkpoint admission, Team/model/service
  bindings, camera banks and native context-management defaults. It performs no
  service or environment allocation. Shared `nativeConsolePortSchema` admits
  deployment/workspace JSON ports and RoboCasa's numeric-string environment override.
- [native-policy-environment.mjs](src/native-policy-environment.mjs): learned
  worker allocation and RoboDojo direct/hybrid GPT gateway lifecycle, including
  independent DSH host, demonstrations, ordered audit writes and confirmed cleanup.
- [native-deployment.mjs](src/native-deployment.mjs): model/perception assembly,
  launch-profile factories, managed-service leases and runnable Console startup.
  Each profile's camera bank participates in configuration identity. Original
  configuration/root exports remain available from this entry point.
- [native-workspace.mjs](src/native-workspace.mjs): multiple configured providers
  in one Console, profile namespacing, shared model/perception admission and complete
  service release. Example deployment files supply runnable entry points.
- [application.ts](src/application.ts): role tools, task/verification/recovery coordination.
- [deployment.ts](src/deployment.ts): detached deployment/profile admission,
  immutable default and profile camera banks, and public launch metadata.
  The Session task route supplies its selected profile's bank to UpperRun;
  UpperRun snapshots those values for YOLO requests. Calibration banks remain private.
- [native-worker.ts](src/native-worker.ts): retained native environment assembly,
  task-scoped backend ports, camera attachment storage and control-step frame events.
  The Session keeps one native scene across tasks;
  each task receives a separate run ID before its backend and UpperRun are created.
  Measurement request snapshots and RGB-D receipt admission belong to
  [perception/metric-measurement.ts](../../harness/agent-runtime/perception/src/metric-measurement.ts).
  The backend retains request transport, cancellation and current task/closure checks.
- [native-worker-configuration.ts](src/native-worker-configuration.ts): authoritative
  worker schema, derived configuration type and detached/frozen admission snapshot.
  Scene parameters contain finite JSON data; preparation and startup use the
  admitted command, environment, scene and task catalog.
- [native-worker-transport.ts](src/native-worker-transport.ts): host request/response
  pipes, original worker errors, read cancellation, communication deadlines and
  confirmed owned-process release. Complete response validation precedes request
  retirement; malformed publications fail every pending request. Error messages
  retain Python's original text, including an empty string.
  Asynchronous `NativeWorkerTransport.create` installs transport ownership before
  awaiting the optional startup observer. Observer failure completes confirmed
  process release before rejecting; initialization starts only after observer completion.
  Request admission accepts bounded operation names and finite JSON arguments.
  Accepted response values use the same finite JSON domain.
- [evidence-images.ts](src/evidence-images.ts): image integrity checks for agent
  evidence and event-bound operator replay frames. Replay URLs use the immutable
  run event sequence and preserve debug-only frame visibility.
- [http-server.ts](src/http-server.ts): admission, history, control endpoints and SSE subscriptions.
- [console-process.ts](src/console-process.ts): native CLI initialization, signal
  handling and shared server/proxy shutdown. Initialization-time requests remain
  owned until startup completes; repeated signals share one resource release.
- [managed-services.ts](src/managed-services.ts): configured model/policy process
  startup, readiness, shared leases and owned shutdown. Cancelling one startup
  admission preserves the process for another admission. Last-lease release and
  global closure wait for the leader and the complete owned process group.
  Graceful shutdown and forced release remain bounded, with original errors
  retained. PID ownership is cleared only after confirmed release. Actual CPU Console checks cover
  these [startup boundaries](../../docs/implementation/cpu-release-validation.md#managed-service-startup-ownership);
  loaded model service behavior keeps its native acceptance requirements.
- [user-sessions.ts](src/user-sessions.ts): retained environment lifetime, task admission
  and durable session-open request identity; [publication and checks](../../docs/implementation/user-sessions.md#session-open-request-identity).
- [session-task-history.ts](src/session-task-history.ts): compact session history,
  immutable task membership and legacy migration; [ownership and checks](../../docs/implementation/user-sessions.md#task-membership-history).
- [workspace-history.ts](src/workspace-history.ts): bounded session/task summaries,
  scoped cursors and independent active records; [API and acceptance](../../docs/implementation/workspace-history.md).
- [domain-retention.ts](src/domain-retention.ts): configured record owners, reference
  leases and versioned retirement previews; [admission boundaries](../../docs/implementation/domain-retention.md).
- [native-audit-payloads.ts](src/native-audit-payloads.ts): shared native audit
  envelope/payload admission, supported tool names and detached event snapshots.
  Retry records preserve finite fractional waits and mode-specific budgets.
- [native-workspace-retention.ts](src/native-workspace-retention.ts): native
  retention composition, SKILL export leases and original-image source inventory;
  both retention paths use the shared native audit admission.
- [native-record-references.ts](src/native-record-references.ts): versioned native
  source relationships, originating Run references and sequence-bound inventory.
  Run records retain their complete task sources; source records reference their Runs.
  Shared generated identities use an existing indexed field-bearing record to retain
  their complete group. Every reference keeps its complete source path.
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

See [extension and lifecycle guide](../../docs/implementation/upper-runtime.md).
Use `startServer` with explicit `ServerDeployment` bindings for tasks, native DSH
models, tools and backend factories. See the
[deployment guide](../../docs/implementation/deployments.md) and runnable example.
The native worker requires an explicit simulator, task catalog, policy service,
scene configuration and isolated runtime command. Source-bound CPU communication
and process checks are documented in
[CPU release validation](../../docs/implementation/cpu-release-validation.md).
Actual model inference, simulator actions and task completion use the
[native campaign](../../docs/implementation/native-release-campaign.md).
