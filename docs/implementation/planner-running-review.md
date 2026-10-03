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
Planner updates notes and TODOs before that call. A successful `execution.end`
receipt concludes its current native DSH turn; the assignment remains live to
receive the formal-verdict follow-up. Successful `execution.start` likewise
concludes its turn, and `execution.resume` concludes when its receipt reports
running. Original tool receipts commit before native turn completion. Existing
inbox order and independent Verifier Sessions remain authoritative.

`execution.query` accepts optional `completeTurn`. Omitted or false retains its
informational behavior. The decision owner can supply true for the current admitted
task/goal/attempt/recovery execution. The host returns the actual scoped status and
formal-verification receipt, then completes that native turn. This query changes
no motion, execution state or success criterion. Missing or stale execution scope
fails before turn completion. This boundary also permits a queued formal result
to enter its next native turn while independent verification remains host-owned.

For each running review, Planner reads status to assess the attached observation.
When continued motion is appropriate, it updates decision notes and TODOs once if
needed, then calls `execution.query` with `completeTurn: true` to await the next
bounded capture. When observations justify formal review, it calls `execution.end`
with the current identity and observed reason. End and explicit query receipts
commit before native turn completion; the existing coalesced delivery and inbox
order supply subsequent observations or the independent formal verdict.
The fresh independent Verifier reads the admitted native checks. A passed
prerequisite permits the next goal; final task completion still requires the
original task criterion.

Inspect complete actual task histories and original worker policy records with:

```bash
PYTHONPATH=harness/physical-runtime/src python scripts/check-recorded-terminal-review.py \
  --run data/acceptance/run.json --events data/acceptance/events.json \
  --policy-records data/acceptance/policy-requests \
  --schema-path harness/contracts/schema/physical.schema.json \
  --output data/acceptance/terminal-review-audit.json \
  --require-running-review --require-planner-stop
```

The reader checks original native model arguments, decision ownership, task scope,
immutable ended receipts, the recorded owner-thread StopAcknowledgement, actual
action receipt counts and the single independent formal assignment. Add
`--require-repeat` when the history contains repeated native model end calls.
Add `--require-turn-completion` to require every successful start/end decision,
every resume returning running, and each `execution.query` with `completeTurn: true`,
to commit its original native result before
a completed turn boundary. It rejects any additional model step in that turn.
The reported task outcome comes from the original history.

Actual run `d0178a6f` on immutable source `8aa11fc` delivers its first review at
32 controls. Planner ends the native job at 108 controls and 1,080 physics steps,
with seven learned requests and one confirmed `planner_stop` boundary. One fresh
Verifier finds the original tower criterion false; the task ends as failed and
releases its resources. The complete 347-event audit checks 220 sensor records,
three original camera videos and zero tool errors. This run contains one model
end call. Its final task TODO remains in progress in the retained failed outcome.

The separate actual native worker race `aab51787` uses eight learned controls and
80 physics steps. Its real budget stop waits behind an owner-thread observation
while the owned SDK process is suspended. An authenticated Planner review during
that pending confirmation preserves `budget_exhausted`. After process continuation,
the original acknowledgement confirms the same generation and counters. Repeated
worker review retains the same status and observation, with one ended publication
and unchanged native state and image bytes. The worker and native process close.
This physical boundary check supplies no task-success result.

Multi-goal task completion requires its own retained native goal and verification
records.
