# Shared contracts

The authoritative source is `schema/physical.schema.json`. Generate TypeScript
with `pnpm generate:contracts`; never duplicate schema fields in Python.

`ContractValidator` loads that schema explicitly and checks versions, identities,
JSON values, UTC timestamps, units, conditional result fields and local field
relationships. TypeScript and Python use the same positive/negative wire corpus.
Generated types are a static convenience; runtime validation is required. Conditional
schema branches remain in the runtime source even when omitted from static projection.

Step 01 includes pure execution, verification and recovery gates. See the
[contract guide](../../docs/implementation/contracts.md) for APIs, state tables,
clock rules, evidence requirements and integration limits. Schema acceptance
alone does not authenticate callers, authorize tools or execute a physical task.
See [progress](../../docs/implementation/progress.md) and
[setup](../../docs/development/setup.md).

F1 adds `PhysicalBoundaryValidator` for registered messages, selected tool schemas, stable
redelivery and async operations. See [boundary APIs](../../docs/implementation/boundaries.md)
for extension registration, migration and limits. These functions still require actual
routing, authorization, dispatch and persistence in later foundation slices.
