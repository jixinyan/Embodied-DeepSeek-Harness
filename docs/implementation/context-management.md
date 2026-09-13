# Agent context management

## Native foundation

The pinned DSH compaction service, basic compaction backend, optional tool-result
pruner and replay-aware token meter are absorbed under `memory/src/dsh` and
`models/src/dsh`. Command identity and retry event types are included only to satisfy
the source closure; their command/retry services are not mounted. The source map
records 122 files and their hashes from the existing pinned upstream commit.

At this foundation checkpoint these services are not yet mounted by the EDH host.
TypeScript, source-closure/provenance and structure checks pass. This is not evidence
of automatic context reduction in the running application.

## Integration requirements

Use the native pre-step/overflow hooks, balanced tool-call/result spans, transactional
surface replacement and original audit events. Adapt summary instructions for embodied
roles. Summaries are fallible memory; they cannot grant evidence, change authoritative
goal conditions or replace a formal verdict. Preserve exact task/goal/attempt/boundary
and evidence identities, observed facts versus hypotheses, current plan and pending work.

Expose explicit deployment policy and model context capacity. Keep settings in the
configuration digest. Report compaction, estimated occupancy and failures to the same
assignment audit used by the console. Validate cancellation, rejected/non-shrinking
summaries, isolated roles and continuing native tool calls after replacement.

Context reduction changes the model-visible surface. It does not bound raw evidence,
run events or disk history, resume a session after restart, or validate a VLM's reasoning.
