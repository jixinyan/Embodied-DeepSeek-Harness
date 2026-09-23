# DSH release adaptation

## Release identity

Reviewed release: [DSH v0.1.7-rc.1](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.7-rc.1),
published on 2026-09-23 and marked as a prerelease by upstream.
The immutable source revision is `46a7f68b0922371ce7144b668b90e377d8e799f4`.

EDH's selected-source baseline is `d347e703908d0406b7a7ef80e3a0e594d86b2215`.
[The import manifest](../provenance/dsh-imports.json) records the original source
and local hashes for 128 files. Release adaptations preserve those original
identities and record the exact upstream changes applied to EDH-owned modules.
The release tag identifies the reviewed source; it does not imply that EDH embeds
the complete upstream distribution or accepts every upstream plugin unchanged.

## Runtime changes

### Asynchronous role initialization

`agent/created` becomes the serial, awaited initialization boundary. Role setup,
tool registration and asynchronous initial context contributors must complete before
queued work can enter the model loop. Initialization failure rejects creation and
retains the original failure through cleanup. Disposal during initialization waits
for the initialization boundary and prevents queued model work from restarting.

The upstream implementation is recorded in `9b7a8ccc9fabc2e87386acf7f8b0741baf978022`
and `0fb509f54497623f16f3dc402d8340d820c1c0d5`. EDH keeps independent assignment
contexts and explicit caller-supplied briefs. Planner decision authority, Verifier
pause authority and Evolver recovery admission remain application responsibilities.

### Output-aware compaction

Pressure admission accounts for the selected model's context window, the effective
request output cap and configured compaction headroom. The request's explicit output
cap takes precedence over the adapter's declared default. The resulting threshold is
the smaller of the configured window fraction and the capacity available after both
reservations. Retention must fit below that threshold; impossible configurations fail
before a model request.

This matters for long embodied sessions that accumulate observations, tool results
and recovery evidence. Model capacity and headroom belong to deployment configuration.
A local 32,768-token VLM requires settings consistent with that capacity. Summaries
retain EDH's embodied instructions and cannot change success criteria, execution
authority or evidence permissions.

### Cancellation records

The native loop copies the supported cancellation fields when constructing a durable
`turn/end` event. A provider or Node.js networking implementation can add properties
to an abort reason during cancellation; those properties must not become session
data. The release implementation is in `35f3abf1fa`.

Agent cancellation and confirmed device stop remain separate operations. Physical
execution continues to require ActionGate generation checks and an acknowledged
native stop boundary before formal verification or a resumed action sequence.

### Secret-bearing configuration

The native settings redactor traverses schema unions, intersections and transforms.
Every field marked as a secret is removed from the presented value, repeated secret
paths are merged, and ordinary fields remain available. This supports configurable
cloud API providers without changing environment-variable credential ownership.

## Integration boundaries

### Model and image providers

EDH's cloud API and local vLLM routes continue to use its OpenAI-compatible adapter
and the absorbed Chat Completions serializer. The upstream official DeepSeek provider
now uses Messages API; provider-specific transport changes require an explicit
provider binding. A release adaptation must preserve EDH's current image resolver,
strict stream completion checks and configured model identifiers.

Sensor observations and delegated image evidence use explicit attachment references.
The local image store, scoped evidence readers and retention owners manage their
bytes and lifetime. Planner receives admitted image content through the model adapter.
Existing image cache validation and immutable evidence identities remain required.

### Session history

EDH stores domain records and native audit events through its own journals and history
indices. These records have their own versions and ownership rules. Upstream Session
log V4 changes the native message vocabulary and persistence format; importing a V4
JSONL file requires a dedicated, validated migration boundary. EDH does not currently
expose such an import operation.

Current historical reads and archived event bodies retain their existing identities.
Application restart never replays physical actions automatically. A future migration
of native message representation must include tool-result reconstruction, visual
history, audit readers, stored evidence references and model serialization together.

### Explicit followups and tool evidence

Team delivery calls native `agent.followup` with an explicit sender, assignment and
payload, then observes session quiescence and the resulting audit. Its delivery path
has no consecutive-completion wake limit. The runtime must continue to deliver later
Verifier and Evolver reports throughout a long task.

Fresh synchronized camera groups remain complete. The visual-history policy retains
admitted groups and records omitted historical image references for authorized reread.
Upstream token-budgeted tool retention must preserve this observation requirement and
EDH evidence permissions when mounted; deployment configuration currently selects the
existing native text pruner and explicit visual-history policy.

## Acceptance

The four selected mechanisms are implemented. Schema-based secret removal, serial
initialization, initialization failure/disposal and cancellation record checks pass.
Cancellation uses an actual local HTTP request and inspects the durable native event.
Output/headroom tests cover the 32K deployment, model overrides and invalid budgets.
Native DSH admission with the OpenAI-compatible adapter rejects oversized initial and
dynamic request caps before any HTTP request; disabling automatic compaction permits
transport. The test endpoint supplies no generated model responses.

TypeScript integration, formatting, source provenance and local documentation checks
pass. A full concurrent runtime run reported timeouts; the affected console, upper-run
and user-session suites passed individual reruns. This is not a full-suite pass.
Live VLM image/tool rounds also pass on the complete release adaptation at EDH
commit `1a571e2`, with native context management enabled. Independent Planner and
Verifier sessions each consume the real camera attachment and finish successfully.
These short rounds do not trigger automatic summarization. Exact configuration and
local evidence paths are in [GPU integration](gpu-integration.md#live-vlm-image-and-tool-checks).
Simulation and learned-policy acceptance remain tracked in the
[live integration plan](live-integration.md).
