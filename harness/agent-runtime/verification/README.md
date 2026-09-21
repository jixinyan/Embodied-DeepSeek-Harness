# Verification coordination

UpperRun reuses one independent monitor assignment per continuous execution segment,
retires it on pause/end, and creates a fresh formal-verifier assignment. Accepted formal verdicts close new
work and release the verifier after its final native turn. It enforces limited evidence grants and mandatory boundary verification, and applies shared lifecycle gates. The current backend returns labeled fixture facts. Real GT/device evidence providers remain pending.

## Formal-check context lifetime

`VerificationContexts` stores each assignment's request, execution, stopped boundary,
task scope, current facts and evidence ID under a versioned `verification-context`
record. The active registry retains only assignment IDs and accepted record versions.
Sensor bodies remain in `SensorSamples` and are loaded when an active check needs them.
Opening a context requires an existing source observation in the same task scope.
Formal assignments inherit the admitted execution's complete scope, including its
recovery identity even after that recovery has resolved while the execution is paused.
Provider check updates require agent-visible evidence; facts cannot cite another
sample or contain duplicate check IDs. Shared lifecycle gates still decide whether
the facts justify the submitted outcome.
UpperRun validates and publishes the scoped check context before extending the
Verifier's observation permissions or publishing its consumed-observation event.

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
