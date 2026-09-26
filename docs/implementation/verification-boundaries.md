# Formal verification boundary admission

Formal admission applies to an `ended` execution with `device_confirmed=true` and
`stop_reason` equal to `policy_stop`, `episode_terminated`, or `budget_exhausted`.
Ordinary `paused` updates do not create a Verifier assignment. Boundary identity is
the tuple `(runId, executionId, boundaryEventId)`. Providers may use the same label
in different executions; a new eligible end within an execution requires a fresh
boundary label.

`VerificationBoundaries` in the upper verification module checks and persists this
identity before UpperRun publishes the ended status or starts a formal assignment.
The existing shared execution lifecycle validator still owns transition, version,
budget, clock, counter and resume-authority checks. Provider status admission still
binds each attempt to one execution and requires matching observation scope.

## Eligible ends and ordinary pauses

Planner controls an ordinary confirmed pause and may resume the same execution within
its admitted budget. Paused updates remain in execution history and may carry a
boundary ID, but `VerificationBoundaries.admit` rejects them as formal requests.
Running updates likewise do not enter this admission service.

The candidate end must belong to the current run. If there is a prior status for
the execution, its execution ID and complete task scope must match, and the candidate
state version must increase. A previously published formal boundary cannot be reused.
Reuse of the prior status's boundary ID also fails, including a paused-to-ended
transition. Lifecycle validation independently checks the transition, budget,
clock, counters and Planner resume authority before formal admission.

An eligible initial `ended` status may be admitted without a prior status after the
budget checks. An unconfirmed device state, external user stop, backend error or
other ineligible end cannot publish a formal boundary. UpperRun handles user stop as
unknown and backend error as failure. Boundary admission establishes scheduling
identity; formal evidence and shared verdict gates determine the outcome.

## Publication and lifetime

Records use `verification-boundary:` followed by the JSON array
`[runId, executionId, boundaryEventId]`. Each value has format
`edh.verification-boundary.v1`, the run identity and the original complete
`ExecutionStatus`. Its journal version must remain 1. Publication reads the record
back and checks exact equality before authorizing new formal work. Historical
paused-boundary records remain readable, but do not authorize a new assignment.

The sequence is lifecycle validation, evidence retention, eligible-end boundary
admission, `execution.updated` publication and native DSH formal-assignment creation.
The latter publishes `verification.requested`, followed by checked facts and the
accepted verdict. These are separate writes and operations. A failure propagates
through UpperRun's existing failure/stop path; a
stored admission alone does not prove assignment creation or a completed verdict.
Assignment contexts, `verification.requested` events and accepted verdicts retain
their own explicit identities. Opening a store never resumes verification or motion.

The boundary service retains no separate in-memory collection of historical IDs.
LocalStore retains its key/version/position index, and each admission adds a durable
record. Journal-index growth, disk retention, cumulative verdict/assignment summaries
and active model context remain separate lifetime requirements.

## Acceptance

`pnpm test:verification-boundaries` uses `ExecutionStatus` values recorded in a real
RoboCasa run (`1df69c9c-7db6-4ae1-9a1c-dd726f44c15c`), including its running,
confirmed paused and confirmed budget-ended updates. The test passes those values
through the production contract validator and actual LocalStore journal. It confirms
that running and paused updates create no formal record, while the eligible end
publishes one immutable record. Deliberately altered copies verify rejection of
unconfirmed and external stops, conflicting scope or version, and boundary reuse.
The same check covers independent run/execution identities, write exclusion,
rewritten records, detached reads, journal compaction and reopening. A recorded
paused boundary remains readable as history without creating a new assignment.

These checks validate boundary admission and persistence. The real run additionally
confirmed pause, Planner resume, ended execution and subsequent formal Verifier
ordering with native device acknowledgement. The actual Verifier outcome and native
task result remain in that run's evidence records.
