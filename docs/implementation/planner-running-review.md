# Planner review during native execution

Native deployment profiles enable bounded observations for the decision-owner
Planner. Their default configuration is:

```json
{
  "plannerReview": {
    "enabled": true,
    "controlStepInterval": 32,
    "wallTimeIntervalMs": 15000
  }
}
```

Both intervals must be satisfied. A RoboDojo profile may override the deployment
value through its own `plannerReview` property. Other native providers accept the
same property in their deployment JSON. Disabling review uses the complete object
with `enabled: false`; existing status, native video and final verification remain
available. Other trusted server deployments enable review explicitly and must
provide `EmbodiedBackend.captureReview`.

`controlStepInterval` is an integer from 1 through 1,000,000.
`wallTimeIntervalMs` is an integer from 1,000 through 3,600,000. These settings are
validated, frozen and included in the public launch metadata and deployment
digest. They do not alter task budgets, native policy instructions or criteria.

The worker publishes the real ActionGate `control_generation` in execution
status. The host coalesces the latest status for each execution and generation,
with one pending or active review. It waits for the existing native Planner turn
to settle through a separately tracked delivery. Execution status publication
continues while that wait is pending. Pause, terminal execution, cancellation and
task shutdown discard pending review state and clear its timer.

`publishRunningImages: false` remains supported. Per-control status carries
metadata while native videos stay with the worker. Only a cadence review invokes
`capture_review`, which checks the execution, generation and complete task scope
before and after an actual owner-thread observation. A changed boundary returns
an unavailable review. The client checks the same identities after saving image
attachments; the host checks them again before granting and delivering evidence.
Sensor bytes are transferred only for accepted cadence captures and other
explicit observation or stopped-boundary operations.

The existing native TeamSessions delivery sends `running-review` with its actual
status, admitted sample, image attachments and configured cadence. Only Planner
receives this message. Retention inspection follows the persisted execution,
decision assignment, request ownership and sensor references. Running review
does not create a Verifier or expose provider debug records.

Planner inspects the attached images and queries fresh status before requesting
`execution.end`. That terminal request uses the existing native stop, policy
drain, owner-thread confirmation and eligible stopped-boundary verification.
The fresh independent Verifier reads the admitted native checks. A passed
prerequisite permits the next goal; final task completion still requires the
original task criterion.

Source checks validate the declared interface and schemas. Actual cadence,
terminal review, race handling and multi-goal acceptance require retained native
worker, model, action and verification records.
