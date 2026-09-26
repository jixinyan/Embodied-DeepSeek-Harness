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

The seven previously recorded `pnpm test:verification-boundaries` checks exercised
production validation and actual LocalStore files under the earlier stopped-boundary
rules. Their paused-admission and unconfirmed budget-end expectations no longer match
the current gate. That historical acceptance covered:

- Independent run/execution identities using the same boundary label.
- Continuous pause updates, detached reads and unchanged original publication.
- Resume followed by a fresh stop, prior-boundary reuse and paused-to-ended identity.
- Conflicting facts, scopes, versions and invalid running-state admission.
- Write exclusion, missing source records and rewritten record versions.
- Actual journal compaction and reopening without starting model work.
- Budget-end admission with an unconfirmed device state and conflicting source identity.

Current acceptance must use the present admission rules: eligible confirmed ends
publish one immutable record and fresh Verifier request; ordinary pause and running
updates publish no formal record; stale or reused identities fail; external stop and
backend error do not create successful verdicts. Related historical checks exercised
persisted verification contexts and native DSH role retirement. The old authored
documents and seven checks do not establish the changed gate or actual provider
ordering. Real model, policy and simulator execution with confirmed stop
acknowledgement remains required.
