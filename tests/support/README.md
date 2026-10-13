# Unit-test support

Existing scripted model, backend and deployment helpers belong to this directory.
Runtime unit tests import them directly; production server and deployment entries
use their configured native factories.

| Helper | Responsibility |
| --- | --- |
| [demo-deployment.ts](demo-deployment.ts) | Existing unit-test task and retained-environment bindings |
| [demo-server.ts](demo-server.ts) | Bind those helpers to the production HTTP server for unit tests |
| [fixture-model.ts](fixture-model.ts) | Existing scripted unit-test model responses |
| [fixture-backend.ts](fixture-backend.ts) | Existing unit-test backend state |
| [multi-goal-fixture.ts](multi-goal-fixture.ts) | Existing unit-test goal responses |

[Production CPU diagnostics](../../docs/implementation/cpu-release-validation.md)
exercise configured factories, native DSH services, genuine transport failures and
original records. Their evidence identifies the accepted source and execution
scope. Physical task acceptance requires the selected native model, policy,
environment and formal Verifier.
