# Formal verification boundary admission

Every accepted stopped execution boundary must receive its own formal verification
assignment. Boundary identity is the tuple `(runId, executionId, boundaryEventId)`.
Providers may use the same boundary label in different executions. Within one
execution, a new stop after resuming motion requires a fresh boundary label.

`VerificationBoundaries` in the upper verification module checks and persists this
identity before UpperRun publishes the stopped status or starts a formal assignment.
The existing shared execution lifecycle validator still owns transition, version,
budget, clock, counter and resume-authority checks. Provider status admission still
binds each attempt to one execution and requires matching observation scope.

## Continuous pause and new stops

A later status for the same continuous pause may advance its state version, observation
references and elapsed wall time. It retains the original task/goal/attempt/recovery
scope, execution ID, boundary ID/time, clock, control-step count, confirmed state and
stop reason. This update needs no additional formal assignment.

Reusing a recorded boundary requires an immediately preceding paused status for that
same boundary and matching stopped facts. A running-to-stopped transition using an
earlier boundary fails. A paused-to-ended transition requires a fresh boundary as well.
Changed stopped facts under an existing identity, stale versions, foreign scopes and
missing previously admitted records fail before the new status enters the run projection.

An initial `ended` status, including `budget_exhausted`, is admitted for formal
verification after the existing budget checks. An unconfirmed device state remains
unconfirmed. Boundary admission establishes scheduling identity; formal evidence and
shared verdict gates determine whether a conclusive outcome is justified.

## Publication and lifetime

Records use `verification-boundary:` followed by the JSON array
`[runId, executionId, boundaryEventId]`. Each value has format
`edh.verification-boundary.v1`, the run identity and the original complete
`ExecutionStatus`. Its journal version must remain 1. Publication reads the record
back and checks exact equality before authorizing new formal work. Repeated continuous
pause updates read the original record without rewriting it.

The sequence is lifecycle validation, evidence retention, boundary admission, run/event
publication and native DSH formal-assignment creation. These are separate writes and
operations. A failure propagates through UpperRun's existing failure/stop path; a
stored admission alone does not prove assignment creation or a completed verdict.
Assignment contexts, `verification.requested` events and accepted verdicts retain
their own explicit identities. Opening a store never resumes verification or motion.

The boundary service retains no separate in-memory collection of historical IDs.
LocalStore retains its key/version/position index, and each admission adds a durable
record. Journal-index growth, disk retention, cumulative verdict/assignment summaries
and active model context remain separate lifetime requirements.

## Acceptance

`pnpm test:verification-boundaries` runs seven checks against production validation
and actual LocalStore files. Authored execution-status documents cover:

- Independent run/execution identities using the same boundary label.
- Continuous pause updates, detached reads and unchanged original publication.
- Resume followed by a fresh stop, prior-boundary reuse and paused-to-ended identity.
- Conflicting facts, scopes, versions and invalid running-state admission.
- Write exclusion, missing source records and rewritten record versions.
- Actual journal compaction and reopening without starting model work.
- Budget-end admission retaining an unconfirmed device state and conflicting source identity.

Related checks exercise persisted verification contexts and actual native DSH role
retirement. These documents are protocol inputs for admission tests; no provider,
physical transition or model-generated verification result is produced. Live provider
ordering, stop acknowledgement and complete model-driven execution remain required.
