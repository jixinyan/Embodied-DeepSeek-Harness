# Accepted verdict history

`VerdictHistory` stores complete accepted verification results separately from the
active run projection. Shared `VerificationResult` messages retain their full checks
and explanations. Planner feedback, recovery decisions and explicit inspection use
the complete result.

## Publication and ownership

UpperRun validates verifier identity, active formal-check context, request, execution
boundary, goal criteria and evidence before accepting a verdict. It rejects a second
result for the same verification request. `VerdictHistory.retain` then:

1. Validates the complete result and its run identity.
2. Writes an immutable `verdict-history:` record keyed by the JSON array
   `[runId, verdictId]`, with format `edh.verdict-history.v1` and journal version 1.
3. Reads the record back and checks exact equality before returning a summary.

UpperRun appends that summary and publishes `verification.completed` with the full
result in the independent event history. Planner feedback and recovery receive the
full result. Archive and run publication are separate writes: an archive without a
published run entry is not an accepted result exposed by the verdict endpoint.
An identical repeated archive write is idempotent; changed contents or a rewritten
archive version fail. A failed archive write returns no summary.

The run entry preserves all verification identities, scope, status, criteria version,
evidence references and observation time. It replaces `checks` and `explanation` with
`detailsStored: true`, `checkCount`, `explanationPreview` and `explanationTruncated`.
The preview contains at most 512 UTF-16 code units and never splits a Unicode surrogate
pair. Consumers resolve summaries explicitly and verify exact agreement with their
stored result. Missing archives and conflicting summaries fail. Existing full-result
run entries remain readable through the same shared validator.

The current-goal reader used by Planner decisions resolves the complete result.
Plan dependencies consume only status and identity fields. Assignment inspection
resolves the result before checking it against formal facts and evidence. Selected
historical task context includes the full final-goal explanation, subject to its
existing 16 KiB admission limit. SKILL source inspection records archive keys and
versions, compares full failure/success results, and marks absent sources incomplete.
Inspection grants no evidence permissions and executes no provider calls.

## HTTP and console

`GET /api/runs/:runId/verdicts?verdict=:verdictId` requires exactly one verdict ID.
Additional or repeated query parameters fail with 400. The task must publish exactly
one matching accepted entry; absent tasks/results return 404 and duplicate identities
fail. Archive-only records remain private to storage. The response is `{runId, result}`
with the complete validated result.

The verification panel displays the explanation preview with an ellipsis when
truncated. **Accepted verdicts** opens a selector and loads the latest selected full
result. Selection changes and refresh clear the previous body, abort superseded
requests and reject stale responses. Empty selection, loading and read failure have
explicit statuses. Closing clears the view and cancels pending reads. Output uses
text rendering, including check facts and explanations containing HTML characters.

## Acceptance and remaining limits

`pnpm test:verdict-history` runs six actual journal, HTTP and child-process checks.
They cover full-result fidelity, detached reads, compaction/reopen, write exclusion,
immutability, task scope, missing/conflicting archives, legacy entries, Unicode preview
boundaries and selected-result query admission. The pressure check stores and reads
more than 100 MiB of authored verification documents under a 64 MiB V8 old-space limit,
with the retained verdict summaries below 2 MiB.

Task-admission, SKILL-provenance and assignment-history checks cover complete archived
explanations, source references, missing/rewritten archives and formal fact consistency.
These checks use authored documents and production storage/readers. No model, policy,
simulation or hardware executes.

Browser DOM acceptance uses the production selector, markup, JSON transport and
selected-result reader over a real local HTTP server. Authored unknown-result records
exercise latest selection, switching, complete explanations, literal HTML text,
refresh, missing-record errors, empty selection and close.

This bounds the explanation preview and releases full verdict bodies from the active
projection. The number of summary entries, evidence references, execution/request
metadata, formal boundary identities, journal keys and disk usage still grows with
activity. Recovery records, native model messages and durable event history have
separate lifetimes. Live model/provider acceptance and source-aware domain retention
remain required.
