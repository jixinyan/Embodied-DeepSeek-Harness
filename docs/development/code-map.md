# Source entry points

Use the component directory for implementation and its adjacent README for the
public responsibility. The [module architecture](../architecture/modules.md)
defines dependency and authority boundaries. The files below identify the
production path from Session selection to native commands and formal verification.

## Application and agent runtime

| Change | Entry point |
| --- | --- |
| Compose configured native providers | [apps/server/src/native-workspace.mjs](../../apps/server/src/native-workspace.mjs) |
| Bind one provider, Team and launch profile | [apps/server/src/native-deployment.mjs](../../apps/server/src/native-deployment.mjs) |
| Launch the unified Console or a selected backend | [examples/deployments](../../examples/deployments/README.md) |
| Start the HTTP/SSE application | [apps/server/src/http-server.ts](../../apps/server/src/http-server.ts) |
| Own native CLI startup, signals and resource release | [apps/server/src/console-process.ts](../../apps/server/src/console-process.ts) |
| Own shared model/policy service startup, readiness and leases | [apps/server/src/managed-services.ts](../../apps/server/src/managed-services.ts) |
| Manage retained user Sessions and task admission | [apps/server/src/user-sessions.ts](../../apps/server/src/user-sessions.ts) |
| Connect domain tools, Planner decisions and independent roles | [apps/server/src/application.ts](../../apps/server/src/application.ts) |
| Manage native DSH role contexts | [agents/src/runtime.ts](../../harness/agent-runtime/agents/src/runtime.ts) |
| Route native registration and lifecycle scopes | [foundation/src/dsh/scope/index.ts](../../harness/agent-runtime/foundation/src/dsh/scope/index.ts) |
| Change the absorbed DSH agent loop | [agents/src/dsh/loop/index.ts](../../harness/agent-runtime/agents/src/dsh/loop/index.ts); preserve [source provenance](../provenance/README.md) |
| Load composable Teams | [teams/src/loader.ts](../../harness/agent-runtime/teams/src/loader.ts) |
| Configure cloud/local upper models | [models/src/configuration.ts](../../harness/agent-runtime/models/src/configuration.ts) |
| Maintain plans and TODO tools | [planning](../../harness/agent-runtime/planning/README.md) and [tools](../../harness/agent-runtime/tools/README.md) |
| Generate assignment-specific model-visible tool parameters | [tools/src/model-schema.ts](../../harness/agent-runtime/tools/src/model-schema.ts) |
| Deliver explicit context and reports | [communication](../../harness/agent-runtime/communication/README.md) |
| Enforce goals, retries and task completion | [tasks](../../harness/agent-runtime/tasks/README.md) |
| Admit formal verification after device confirmation | [verification/src/boundaries.ts](../../harness/agent-runtime/verification/src/boundaries.ts) and [contexts.ts](../../harness/agent-runtime/verification/src/contexts.ts) |
| Retrieve source-linked SKILL sections | [memory/src/library.ts](../../harness/agent-runtime/memory/src/library.ts) and [skill-sections.ts](../../harness/agent-runtime/memory/src/skill-sections.ts) |
| Install native context measurement and compaction | [memory/src/context.ts](../../harness/agent-runtime/memory/src/context.ts) and [memory/src/dsh/token-meter/index.ts](../../harness/agent-runtime/memory/src/dsh/token-meter/index.ts) |

Prompts, tools and schemas resolve through the selected Team. The
[current Agent loop](../implementation/current-agent-loop.md) records their actual
sources and context assembly. Evolver remains paused and SceneState remains
deferred under the active work scope.

## Physical runtime

All Python provider code belongs under
`harness/physical-runtime/src/physical_harness/`.

| Change | Entry point |
| --- | --- |
| Validate and freeze native configuration before allocation; derive its public type | [apps/server/src/native-worker-configuration.ts](../../apps/server/src/native-worker-configuration.ts) |
| Connect the application to a native worker | [apps/server/src/native-worker.ts](../../apps/server/src/native-worker.ts) |
| Change host-side worker pipes, request completion and process release | [apps/server/src/native-worker-transport.ts](../../apps/server/src/native-worker-transport.ts) |
| Manage worker Sessions and execution operations | [execution/worker.py](../../harness/physical-runtime/src/physical_harness/execution/worker.py) |
| Change worker process communication | [execution/worker_transport.py](../../harness/physical-runtime/src/physical_harness/execution/worker_transport.py) |
| Save original policy requests and actual controls | [execution/policy_records.py](../../harness/physical-runtime/src/physical_harness/execution/policy_records.py) |
| Own policy WebSocket requests and shared connection/client shutdown | [policies/client.py](../../harness/physical-runtime/src/physical_harness/policies/client.py) |
| Bind a policy listener and control connection admission | [policies/server.py](../../harness/physical-runtime/src/physical_harness/policies/server.py) |
| Admit actions and enforce execution budgets | [execution/action_gate.py](../../harness/physical-runtime/src/physical_harness/execution/action_gate.py) |
| Compose an inference client with ActionGate and preserve rollout failures | [execution/policy_rollout.py](../../harness/physical-runtime/src/physical_harness/execution/policy_rollout.py) |
| Confirm simulator execution and stopping | [execution/native_device.py](../../harness/physical-runtime/src/physical_harness/execution/native_device.py) |
| Add a WebSocket policy protocol or checkpoint | [policies](../../harness/physical-runtime/src/physical_harness/policies/README.md) |
| Own inference threads, cancellation and operation records | [policies/inference.py](../../harness/physical-runtime/src/physical_harness/policies/inference.py) |
| Start a configured native policy, record model identity and admit service connections | [policies/services](../../harness/physical-runtime/src/physical_harness/policies/services/README.md) |
| Validate selected GR00T/LeRobot file identity | [policies/provenance.py](../../harness/physical-runtime/src/physical_harness/policies/provenance.py) |
| Verify complete native OpenPI inventory and saved ARX X5 normalization before model imports | [policies/openpi_checkpoint.py](../../harness/physical-runtime/src/physical_harness/policies/openpi_checkpoint.py) |
| Add an environment | [environments](../../harness/physical-runtime/src/physical_harness/environments/README.md); each provider has one named subdirectory |
| Adapt physical hardware | [backends](../../harness/physical-runtime/src/physical_harness/backends/README.md) and [embodiments](../../harness/physical-runtime/src/physical_harness/embodiments/README.md) |
| Compute source-bound RGB-D measurements | [perception/metric_geometry.py](../../harness/physical-runtime/src/physical_harness/perception/metric_geometry.py) |
| Extend cross-language wire schemas | [physical.schema.json](../../harness/contracts/schema/physical.schema.json); regenerate TypeScript declarations with `pnpm generate:contracts` |

The runnable worker entry remains `python -m physical_harness.execution.worker`.
Provider SDKs load when their configured environment initializes. Policy model
implementations load in their separately configured service processes.

## Console and checks

| Change | Entry point |
| --- | --- |
| Assemble the unified Console | [apps/console/public/app.js](../../apps/console/public/app.js) |
| Select compatible Session components | [launch-selection.js](../../apps/console/public/launch-selection.js) and [launch-controls.js](../../apps/console/public/launch-controls.js) |
| Inspect role communication and Agent trace | [coordination.js](../../apps/console/public/coordination.js) and [session-audit.js](../../apps/console/public/session-audit.js) |
| Read actual run updates | [run-update.js](../../apps/console/public/run-update.js) |
| Configure and start the desktop launcher | [apps/desktop](../../apps/desktop/README.md) |
| Verify CPU services, transport and original records | [CPU release validation](../implementation/cpu-release-validation.md) |
| Execute the configured CPU diagnostic campaign | [run-cpu-release-campaign.mjs](../../scripts/run-cpu-release-campaign.mjs) |
| Verify signal-driven CPU campaign closure and actual diagnostic process-group release | [check-cpu-campaign-shutdown.mjs](../../scripts/check-cpu-campaign-shutdown.mjs) |
| Own actual native campaign cancellation through live-driver and matching Session release | [run-native-release-campaign.mjs](../../scripts/run-native-release-campaign.mjs) and [run-live-acceptance.mjs](../../scripts/run-live-acceptance.mjs) |
| Verify native campaign admission, repeated signals and released processes without Worker allocation | [check-native-campaign-shutdown.mjs](../../scripts/check-native-campaign-shutdown.mjs) |
| Verify image-group retention and budget rejection through the native loop | [check-recorded-visual-context.mjs](../../scripts/check-recorded-visual-context.mjs) |
| Validate configured native scenes and policy endpoints before allocation | [check-native-scene-configuration.mjs](../../scripts/check-native-scene-configuration.mjs) |
| Verify native CLI startup and signal-driven process release for every provider | [check-native-startup-offline.mjs](../../scripts/check-native-startup-offline.mjs) |
| Verify real Worker initialization, detached configuration and startup observer failures | [check-worker-host-offline.mjs](../../scripts/check-worker-host-offline.mjs) |
| Verify native owner-thread drain, cancellation and concurrent closure without an SDK allocation | [check-native-device-owner-offline.py](../../scripts/check-native-device-owner-offline.py) |
| Verify shared Session/device/recording finalization and original file errors | [check-native-session-owner-offline.py](../../scripts/check-native-session-owner-offline.py) |
| Verify retained ActionGate stops and original operation/stop errors | [check-action-gate-owner-offline.py](../../scripts/check-action-gate-owner-offline.py) |
| Verify real rollout connection/owner failures and scoped background faults | [check-rollout-failure-offline.py](../../scripts/check-rollout-failure-offline.py) |
| Verify actual policy connection drain and concurrent/cancelled close callers | [check-policy-client-owner-offline.py](../../scripts/check-policy-client-owner-offline.py) |
| Verify policy CLI admission, bound-listener readiness and startup release | [check-policy-startup-offline.py](../../scripts/check-policy-startup-offline.py) |
| Check selected digests against actual original checkpoints for all four providers | [check-checkpoint-binding-offline.py](../../scripts/check-checkpoint-binding-offline.py) |
| Check original saved ARX X5 normalization and explicitly invalid derivative inputs | [check-openpi-normalization-offline.py](../../scripts/check-openpi-normalization-offline.py) |
| Verify configured service startup cancellation and shared admissions | [check-service-startup-owner-offline.mjs](../../scripts/check-service-startup-owner-offline.mjs) |
| Verify standalone SAM/YOLO argument admission before SDK imports | [check-perception-startup-offline.py](../../scripts/check-perception-startup-offline.py) |
| Exercise native RoboCasa worker or SAM-backed measurement | [check-robocasa-worker.ts](../../scripts/check-robocasa-worker.ts) and [check-robocasa-object-measurement.ts](../../scripts/check-robocasa-object-measurement.ts) |
| Submit and audit actual native tasks | [native release campaign](../implementation/native-release-campaign.md) |

Runtime output belongs under ignored `.local/` or `.runs/`. Provider data and
checkpoint paths belong to deployment configuration. Source, evidence and installed
dependency ownership remain explicit across hosts.
