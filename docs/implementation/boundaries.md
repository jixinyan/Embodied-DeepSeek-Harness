# Typed messages and tool boundaries

F1 adds executable boundary validation in TypeScript and Python. This is a core
contract checkpoint, not a router, dispatcher, worker or persistence implementation.
Read [foundation acceptance](mvp-foundation.md) for the remaining F2–F7 integration.

## Scope after the DSH reuse audit

This is a domain/provider boundary library, not an alternative native tool registry,
dispatcher or agent protocol. DSH already validates tool arguments and canonical output,
returns results to its model loop and manages session lifetimes. Ordinary DSH tools
and messages bypass this library. Use it for embodied task/event fields and the
cross-language physical provider port. See [decision 0003](decisions/0003-reuse-dsh-mechanisms.md).
The earlier `BoundaryValidator` export was renamed `PhysicalBoundaryValidator`; update
internal imports. There is no published backwards-compatibility guarantee in bootstrap.

## Entry points and registration

TypeScript: `PhysicalBoundaryValidator` from `@edh/contracts`.
Python: `physical_harness.physical_boundary.PhysicalBoundaryValidator`.
Both constructors receive the parsed authoritative schema plus optional extensions:
`{schemas: {reference: schema}, messages: [MessageTypeDefinition, ...]}`. Registrations
are copied at construction so changing caller-owned configuration cannot alter them.
A run must keep its selected tool/provider definition immutable in its F2 snapshot.

Built-in payload references use `builtin:Name.v1`. Extensions use explicitly registered
names such as `custom:SceneNote.v1`. References must resolve before validation; there
is no network fetch or implicit discovery. Custom schemas use Draft 7, local `#`/`#/...`
references and the shared UTC `date-time` format. Other formats, `$id`, nonlocal refs,
OpenAPI `nullable` and other declared schema drafts are rejected. Use a Draft 7 null
type instead. Schema registration is a trusted configuration API, not a model tool.

For example, register an object schema `custom:SceneNote.v1` with required `task_id`
and `note` strings, then a `scene.note` event with a binding from `/scope/task_id` to
`/task_id`. A custom role can emit that registered payload without changing the core
role enum. The shared test corpus contains executable custom registration examples,
including malformed content, scope mismatch and local reference resolution.
Extension authors must supply cross-language conformance cases, particularly for
regular expressions; accepting a schema does not prove every possible extension input
has identical behavior in both validator libraries. No automatic defaults/coercion are
used. Ordinary schema property names and literal examples are not schema instructions.

## Calls and results

`ToolCall` is now generated from the authoritative schema and re-exported by the tools
module. There is no separate handwritten camelCase wire definition. It carries:

- Schema version, call/tool/tool-version and team/agent/assignment identity.
- Task scope, stable idempotency key, original request time and deadline.
- Tool input, checked against the selected input schema by `call()`.

Tool definitions now require `execution_mode` (`sync`/`async`) and positive `timeout_s`.
Physical motion is async and declares exclusive physical resources. Resource names are
resolved by the future dispatcher/backend; a label alone does not enforce exclusion.
ToolResult adds team, provider and record time. A completed async result retains its
operation ID, while a synchronous result has no operation ID.

| Method (both languages) | Checks and return value |
| --- | --- |
| `definition(definition)` | Validates declaration and resolves input/output references; returns the definition or throws |
| `call(definition, call)` | Tool/version binding, positive bounded request deadline and selected input schema; returns error codes |
| `result(definition, call, result, operationId?)` | Original call/scope/assignment, provider/effect, output schema, timing and sync/async identity; returns error codes |
| `replay(originalCall, redeliveredCall)` | Same idempotency key and unchanged full request, including call ID, arguments and deadline; returns conflict codes |
| `operation(definition, call, previousOrNull, next, reconciled=false)` | Initial state, transition, monotonic version/time, immutable identity/resources, embedded result and explicit reconciliation; returns error codes |
| `message(envelope)` | Registered type/version/kind, payload schema and constraints, pointer bindings; returns error codes |

Shape violations throw `ContractValidationError`; unknown schema registrations throw
configuration errors. Cross-object incompatibilities return stable codes. Callers must
reject nonempty error lists before any effect. These methods do not mutate inputs.
No method authenticates the caller, checks a live deadline, acquires a lease or writes
a record. F2–F4 must supply authenticated identity, current time and authoritative state.

A read returning malformed segmentation data yields `invalid_tool_output`. A result
for an old assignment yields `result_identity_mismatch`. An otherwise identical request
with an extended deadline yields `idempotency_conflict`; network retry cannot refresh
its budget. `replay()` is only the comparison gate: durable deduplication and conflict
scope belong to the dispatcher/store. Reuse the original call ID/key/time/deadline on
redelivery; new logical calls have new identities. Compare all fields by value, not
object key serialization order.

## Async operations and uncertain outcomes

ToolOperation has its own versioned state, call/operation/provider/task/assignment
identity, stable resource list and an embedded result at conclusive or unknown states.
The transition graph lives in the shared schema, consumed by both languages:

| State | Allowed next states |
| --- | --- |
| accepted | running, cancelling, completed, failed, cancelled, unknown |
| running | running, cancelling, completed, failed, cancelled, unknown |
| cancelling | cancelling, completed, failed, cancelled, unknown |
| unknown | running, cancelling, completed, failed, cancelled, unknown |
| completed / failed / cancelled | none |

An initial record is `accepted` at version 0. This is operation-record acceptance,
not evidence of device action. `cancelling` is intent, not confirmation. Completion
may race a cancellation request and win; reporting cancelled merely because a caller
stopped waiting is invalid integration behavior. Physical stop confirmation remains
the ExecutionStatus/backend responsibility, not an implication of this table.

An unknown operation can change state only with explicit `reconciled=true`, supplied
by the host after querying authoritative state. Reconciliation preserves the same
operation, call and idempotency identity; it never authorizes another execution.
Remaining unknown is valid. If acceptance acknowledgement was lost before an operation
ID became known, a ToolResult may report `unknown` without that ID. Resolve it using
the original call/idempotency identity. Once an operation ID is known, even an unknown
result must retain it. Failed/unsupported admission can return without inventing an
operation. Async completion requires the expected stored operation ID as context.

Result timestamps can exceed the original wait deadline: a late result is useful for
reconciliation/audit. F2/F3 must keep it from a closed or replacement assignment.
A tool's completion says nothing about goal success; the existing formal-verdict gate
and original-goal recovery gate still apply. Declared physical resources must be nonempty;
actual acquisition, confirmed release and device control remain F3/F4 work.

## Typed message bindings

The source schema's `x-edh-message-types` registers the current executable vocabulary:
agent invocation/report, tool invocation/result/operation update, execution progress,
start/pause request/pause/budget end/end, and completed verification. Additional event
families must be registered as their owning services are implemented. The specification's
full target event list is not automatically a callable API. Unknown types fail closed.

Each definition supplies `type`, `version`, `kind`, `payload_schema`, pointer bindings
and optional payload constraints. Envelopes require `type_version` independently of the
envelope schema version. Bindings compare envelope identity/scope with payload fields;
optional means both sides may omit the field, not that one side can contradict the other.
Core bindings check caller/assignment for invocation, provider sender for tool results,
request correlation and scoped task identities. For example, an `execution.ended`
event cannot contain `state: running`, and a budget-exhausted event must carry both
ended state and the matching stop reason.

These checks establish internal consistency, not authenticity. A fabricated envelope
and equally fabricated payload can agree. The router must bind sender, recipient and
permissions to its authenticated session/service, validate lifetime and references,
stamp sequence/time and persist accepted messages before delivery. It must resolve
expected-output recipients and evidence access using the Team/assignment snapshot.

## Migration and acceptance

The v1 schema remains pre-release; no deployed compatibility is claimed. Existing
examples were migrated together. New required fields are ToolDefinition mode/timeout,
ToolResult team/provider/time, and MessageEnvelope type version. The checked message
fixture now contains a full budget-ended ExecutionStatus rather than a partial object.
Old saved examples should fail validation until migrated; do not silently insert identity.
IDs also reject trailing newlines that regex end anchors previously could accept.

`pnpm test:contracts` includes 84 shared boundary cases plus the existing 77 wire and
69 lifecycle cases: 230 shared cases in each language, with extra non-JSON and copied
registration tests. The nine DSH runtime tests remain regression gates. Tests prove
pure contract behavior and extension registration with synthetic data. They do not
prove network delivery, durable replay, permission enforcement, device stopping,
provider performance, or a functional verifier/evolver/console.
