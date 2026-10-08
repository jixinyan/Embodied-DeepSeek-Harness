# Shared wire and lifecycle contracts

Step 01 implements reusable validation, not a worker or verifier service. The
single authoritative Draft 7 source is
[`physical.schema.json`](../../harness/contracts/schema/physical.schema.json).
TypeScript uses Ajv; Python uses jsonschema. Both run the same synthetic inputs in
[`tests/contracts`](../../tests/contracts/). No simulator or robot result is implied.

## Validate at the boundary

TypeScript exports `ContractValidator`, `ContractValidationError`, generated types
and `LifecycleValidator` from `@edh/contracts`. Pass the parsed authoritative schema
explicitly. `parse(name, input)` returns validated data or throws; `issues(name,
input)` returns diagnostics without coercion, default insertion or field removal.
Unknown contract names throw. Diagnostics include a JSON pointer, keyword and message;
library-specific wording need not match between languages.

```ts
const contracts = new ContractValidator(schema);
const request = contracts.parse('SubgoalRequest', incomingJson);
const gates = new LifecycleValidator(contracts);
const errors = gates.execution(request, previousStatus, incomingStatus, authenticatedAgentId);
if (errors.length > 0) throw new Error(errors.join(', '));
// A future service must atomically persist the accepted transition.
```

Python uses the same source rather than duplicated DTOs:

```python
from physical_harness.validation import ContractValidator
from physical_harness.lifecycle import LifecycleValidator

contracts = ContractValidator.from_path(schema_path)
request = contracts.parse("SubgoalRequest", incoming_json)
gates = LifecycleValidator(contracts)
errors = gates.execution(request, previous_status, incoming_status, authenticated_agent_id)
if errors:
    raise ValueError(errors)
```

Neither validator reads configuration implicitly from the working directory. Source
workspaces are private and unpackaged; distribution must later include the schema as
an explicit asset. Python `WireObject` annotations alone do not validate anything.

## Versions, units and identity

- Envelope versions are exact strings such as `physical.subgoal.v1`. Unknown versions
  fail closed. Unknown object fields are rejected where the schema closes the object.
  Schema v1 is a pre-release draft; this refinement is not a compatibility migration
  for deployed data. Model/tool-specific data and message payloads remain extensible
  JSON objects. Their registered payload schemas belong to later service boundaries.
- IDs are nonempty ASCII identifiers, maximum 128 characters (role IDs have a tighter
  authoring pattern). Task, goal, attempt, recovery, assignment, execution and request
  IDs are distinct. A new attempt is not a new version of an old execution record.
- Integer counters are bounded by JavaScript's safe-integer range. Do not encode exact
  large identifiers as numbers; use strings. Extensible numeric payloads are JSON
  numbers and are not a promise of arbitrary-precision cross-language arithmetic.
- Time strings use UTC `Z`, whole seconds or exactly three decimal places, with real
  calendar validation. Durations are seconds; control steps and policy calls are
  separate counters. `clock_id` names an explicitly aligned clock domain. Comparing
  two timestamps does not establish clock synchronization; providers must normalize
  clocks or report uncertainty. A fresh file `created_at` cannot refresh stale evidence
  `observed_at`.
- Observations identify device, stream, sequence, frame, source kind and coordinate
  frame. Evidence carries scope, observation time, clock and visibility. Full hidden
  state is `debug_only`, never admissible agent verification evidence.
- `ActionSpec` specifies embodiment/version, frame, mode, frequency and named bounded
  channels. Position/delta channels use meters or radians; velocity channels use
  meters/second or radians/second. Normalized channels use dimensionless values.
  Namespaced provider control modes require installed adapter validation; they may
  declare `frequency_hz: null` for variable-duration native commands. These
  declarations do not implement calibration, transforms or a policy adapter.
- Role defaults are schema annotations, not inserted values. Step 02 resolves defaults,
  role paths, aliases, toolsets, providers and responsibilities into a frozen snapshot.

Generated TypeScript is a static projection. Conditional `if` branches are omitted
from that projection because the generator otherwise destroys useful field types;
the authoritative runtime schema retains them. Numeric bounds, timestamps, conditional
requirements and field relationships must be checked at runtime. Never treat a cast
or a successful compile as wire validation.

## State transitions

Tables are encoded once in the schema's `x-edh-lifecycle` extension. Both languages
consume those tables. Methods return semantic error codes; invalid shapes throw
`ContractValidationError` first. The methods are pure and do not mutate inputs.

| Execution state | Allowed next states |
| --- | --- |
| accepted | running, ended |
| running | running, pausing, paused, ended |
| pausing | pausing, paused, ended |
| paused | paused, running, ended |
| ended | none |

`execution(request, previous, next, actorAgentId?)` checks immutable execution/scope,
increasing state versions, stable clocks, monotonic counters and request budgets.
`pausing` means intent without device acknowledgement; `paused` requires confirmation.
Provider status publications may coalesce the internal stopping phase and report
`running` directly followed by a confirmed `paused` status. A confirmed boundary
ID and time remain mandatory. Generation revocation, device stop acknowledgement
and completion of any admitted in-flight control precede that confirmation.
Only the request's decision owner can resume. An exhausted control/wall budget requires
`ended`; it cannot renew itself. Ended/paused statuses carry a boundary ID and time.

`requiresVerification(status)` (`requires_verification` in Python) selects an
`ended` status with `policy_stop`, `planner_stop`, `episode_terminated` or `budget_exhausted`.
The runtime admits a fresh independent Verifier after the device confirms that
boundary. An ordinary pause remains with Planner. Cancellation and backend
failure preserve failed or unknown outcomes. Task completion requires the
accepted formal verdict for the unchanged goal criteria.

| Verification state | Allowed next states |
| --- | --- |
| pending | running, unknown |
| running | passed, failed, unknown |
| passed / failed / unknown | none |

`verification(previous, next)` preserves request, execution, boundary, assignment,
scope and criterion identity. A later formal check gets a new verification request.

`verdict(result, context)` validates a final outcome. Context fields are `request`,
`execution`, `verifierId`, `verifierAssignmentId`, `verificationRequestId`, `evidence`
and `checkFacts` in both languages. Callers supply authoritative stored request/status,
assigned verifier identity, evidence registry entries and limited provider facts.
Never populate this context by trusting the submitted report itself.

Conclusive outcomes require a confirmed boundary, matching current attempt/execution/
request/criteria/verifier assignment, and scoped agent-visible evidence observed at
or after the boundary on the same clock. Evidence cannot postdate the verdict. Every
criterion must appear and agree with its corresponding provider fact and references.
For `all`, any false check fails; otherwise an unknown check preserves uncertainty.
For `any`, any true check passes; otherwise an unknown check preserves uncertainty.
The verifier agent owns formal submission; this deterministic gate rejects inconsistent
claims against its supplied facts. It does not infer scene facts or create verdicts.
An `unknown` outcome is admissible without conclusive evidence, but never success.

For example, attempt 1 placing a cup can pass against its own stopped execution.
That identical report cannot finish attempt 2, even if it names the same cup and
cabinet. A frame captured before attempt 2 stopped is also insufficient, regardless
of when its image file was written.

| Recovery state | Allowed next states |
| --- | --- |
| recording | recording, resolved_success, abandoned |
| resolved_success / abandoned | none |

`recovery(previous, next, verdict?)` preserves the original goal, criteria, decision
owner and append-only retry lineage. Success requires a matching passed verdict for
the original goal within that recovery's retry attempts. **The supplied verdict must
already pass `verdict()`** and come from the authoritative record. The lineage gate
alone cannot certify evidence or authenticate a model report. Opening a cabinet as a
prerequisite cannot resolve a recovery whose original goal was storing the cup.

## Production enforcement and acceptance

Wire validation and domain authority have explicit runtime owners. TeamSessions
binds assignment identity, effective tools and explicit context. UpperRun connects
TaskGoals/TaskPlans, evidence grants, formal boundaries and accepted verdicts.
Native worker and ActionGate services validate current request/action scope,
budgets, generations and device confirmation. Persisted record owners enforce
immutable versions, reverse ownership and reference visibility during reads and
maintenance. See the [module map](../architecture/modules.md) and
[current Agent loop](current-agent-loop.md).

CPU diagnostics exercise actual original model/tool/plan records, request codecs,
worker subprocesses, policy sockets, operation deadlines and owned shutdown.
They retain original sources and perform no model or physical task execution.
Commands and evidence are in [CPU validation](cpu-release-validation.md).
Native task/stop/verification workflows retain independent provider evidence in
the [v1 register](v1-delivery.md); complete current-code matrix acceptance remains open.

Shared schema/lifecycle helper checks cover valid and invalid values independently
of service authority. Their acceptance does not authenticate a caller or supply
device evidence. Live Teams disable learning; Evolver execution and new recovery-SKILL
publication remain paused. Existing authorized SKILL search/loading is available.
The [implementation plan](plan.md) records the active sequence and remaining gates.

## F1 additions

The subsequent [boundary guide](boundaries.md) documents typed message registration,
shared ToolCall/ToolOperation, selected input/output validation and draft field migrations.
Use those checks in addition to basic shape validation when integrating service boundaries.

## Policy transport and action admission (v1.11)

The schema additionally defines PolicyRequest, ActionChunk, ActionSegment,
ActionReceipt and StopAcknowledgement. Shape checks are shared between TS/Python;
request identity, action dimension/bounds, generation/freshness and budget checks
are exercised by the Python policy client and action gate. Consult the
[adapter contract guide](model-policy-adapters.md) before connecting a worker.

`PolicyRequest`, `ActionChunk` and `ActionSegment` accept optional
`checkpoint_sha256`, a lowercase 64-character hexadecimal digest. When a request
selects that identity, policy response validation and ActionGate require the same
service-owned value before dispatch. Native profiles carry that selection through
Worker initialization; hybrid proposal clients check it on the lower-policy
response. See [checkpoint bindings](checkpoint-bindings.md).
