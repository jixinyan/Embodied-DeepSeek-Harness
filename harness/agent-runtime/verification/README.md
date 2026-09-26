# Verification coordination

UpperRun creates a fresh independent Verifier assignment after a confirmed ended
execution reports `policy_stop`, `episode_terminated`, or `budget_exhausted`. Running
updates and ordinary pauses do not start Verifier work. The accepted formal verdict
releases the Verifier after its final native turn. The assignment receives the admitted
instruction, budget, execution counters, stop reason, one selected before observation
when available, the final boundary observation, and authorized check results. Other
admitted before observations remain available by evidence reference.

Before observations must appear in the execution request's explicit context references,
be agent-visible, belong to the same task and predate or match the execution request
time. Any supplied goal, attempt or recovery scope must match the request. A task-level
baseline may provide visual context while retaining its original scope, source and
timestamp. The latest eligible observation with images is attached together with the
final boundary images. Formal checks use the ended execution's complete scope and
stopped boundary; a contextual baseline does not establish a current success fact.

## Formal-check context lifetime

`VerificationBoundaries` records formal admission by run, execution and boundary ID.
It preserves the original ended status. New completed executions require fresh
boundary identities. Scope, stop reason, device confirmation, source version and exact
publication are checked before scheduling. Historical paused-boundary records remain
readable after restart without activating model work. See
[boundary admission and tests](../../../docs/implementation/verification-boundaries.md).

`VerificationContexts` stores each assignment's request, execution, stopped boundary,
task scope, current facts and evidence ID under a versioned `verification-context`
record. The active registry retains only assignment IDs and accepted record versions.
Sensor bodies remain in `SensorSamples` and are loaded when an active check needs them.
Opening a context requires an existing source observation in the same task scope.
Formal assignments inherit the admitted execution's complete scope, including its
recovery identity.
Provider check updates require agent-visible evidence; facts cannot cite another
sample or contain duplicate check IDs. Shared lifecycle gates still decide whether
the facts justify the submitted outcome.
UpperRun validates and publishes the scoped check context before extending the
Verifier's observation permissions or publishing its consumed-observation event.
Formal assignment publication retains a `verificationContextStored` marker in its
current and archived details. Once a verdict is accepted, further checks reject before
calling the provider; checks already awaiting the provider recheck settlement before
publishing their response.

`open` publishes the source record before activating its assignment. `update` advances
the active version only after a successful journal write. Active reads reject changes
made outside that owner. Inputs and returned values are detached. A journal write hold
therefore leaves the previous accepted context intact. Publication errors propagate.

UpperRun releases the active identity on `agent.retired`, including failed native
cleanup, and clears remaining identities after task shutdown has drained. Retired
assignments cannot update checks or regain an active context. Their durable records,
source observations, verdicts and native audits remain available for inspection.
`inspect` is a host-side historical reader; it grants no agent evidence access and
has no automatic model-context delivery. Opening a new `VerificationContexts` instance
does not reactivate stored assignments or resume verification.

The Assignment inspector resolves this record alongside its source observation and
accepted verdict. Waiting for facts, saved facts with a pending verdict, and a settled
verdict have separate statuses. An accepted `unknown` result remains unknown. The
reader validates identities, scope, criteria, fact values and evidence references;
missing published records and conflicts fail. See the
[inspection API](../../../docs/implementation/assignment-history.md#read-api-and-console).

`pnpm test:verification-contexts` exercises actual journals and authored project
documents: detached/reopened reads, repeated assignment retirement, unavailable and
foreign/private evidence, invalid fact references, write holds and changed versions.
`pnpm test:assignment-lifetime` also checks the actual native DSH finish/retirement
boundary and retained document references. No physical result or model behavior is
inferred from these checks. Active model input, run verdict collections and durable
record retention remain separate responsibilities.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).
