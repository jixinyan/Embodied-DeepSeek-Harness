# DSH release adaptation

## Release identity

Latest discovery review: [DSH v0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2),
published on 2026-09-29 at 09:42:36 UTC and marked as a prerelease.
Its immutable source revision is `639ed015397290b3745d163aafe02ffee4aa3f84`.
The official release list contains no stable release at this check.
Completed selected-source compatibility includes the v0.2.0-rc.1 live tool-result
recovery and intrinsic-constructor adaptations described below. The rc.2 comparison
introduces no further changes to EDH's selected sources. The earlier v0.1.7-rc.2
review used `477b4f420553e8a52c2fbccc464d7561b239c443`; its rc.1 review used
`46a7f68b0922371ce7144b668b90e377d8e799f4`.

EDH's selected-source baseline is `d347e703908d0406b7a7ef80e3a0e594d86b2215`.
[The import manifest](../provenance/dsh-imports.json) records the original source
and local hashes for 128 files. Release adaptations preserve those original
identities and record the exact upstream changes applied to EDH-owned modules.
The release tag identifies the reviewed source; it does not imply that EDH embeds
the complete upstream distribution or accepts every upstream plugin unchanged.

## v0.2.0-rc.2 discovery review

The complete Git comparison from `4878cdabd87d4041bdaff61d04c966883b9fd07a`
to `639ed015397290b3745d163aafe02ffee4aa3f84` contains 187 commits and
1,022 changed paths. Its intersection with all 128 source paths in the EDH
import manifest is empty. The selected loop, tool runtime, model transport,
context management, Session storage and attachment primitives have no additional
source changes in this release. The applicable rc.1 adaptations are implemented
and have actual native-history, live Qwen and JavaScriptCore acceptance below.

### Optional asynchronous questions

The final source changes in `packages/interaction/tool-ask-user/src/` and
`packages/interaction/user-questions/src/` introduce opt-in timed questions.
Commit `3a296b16b400ad2125476464f21d3d15678788f0` introduces the mechanism;
`24226a71642f44a023b27bed9250792e3707b79b` delivers late replies through
`agent.steer`. The default tool remains blocking. Timed mode returns a pending
result after its foreground wait; the question stays answerable. A Session
projection tracks open, continued and settled questions, and reply admission
prevents duplicate queued answers. The result explicitly states that timeout
does not grant permission. Required answers can retain an indefinite wait.

This is relevant to future operator interaction, but requires an explicit EDH
integration across tool registration, question persistence, console presentation
and assignment ownership. EDH's current `user.ask` description requires the
decision owner and confirmed stopped execution, concludes the native turn and
waits for an explicit response. Importing timed continuation must preserve that
required-answer boundary, independent role contexts and Planner authority.
Elapsed time cannot authorize execution or alter ActionGate or formal verification.
No timed-question integration is implemented or accepted by this review.

### Model compatibility and launch environment

Commit `6ed596f71b7e90f5685dd4c04f5f612271aa1973` upgrades the upstream
pi-ai adapter to 0.87.1. The final `catalog.ts` diff updates protocol capability
classification, including Mistral; `replay.ts` retains the requested model
identity and records `responseModel` separately. EDH's configured cloud and vLLM
routes use its OpenAI-compatible adapter, with no pi-ai dependency in its lockfile.
Their model identifiers and message serialization require no change from this
release's pi-ai update.

The reviewed `apps/desktop/src/login-shell-environment.ts` source loads the user's
login-shell environment for the upstream graphical desktop launcher. EDH's
deployment-owned launcher does not import that desktop entry point. Its isolated
model and simulator environments retain their existing configuration ownership.

The rc.2 source assessment requires no additional source import or Session-format
migration. Optional timed questions and upstream graphical launch integrations have
their own application ownership requirements. Their review creates no new simulator
or model capability claim.

## v0.2.0-rc.1 selected-source adaptation

The immutable comparison from `477b4f420553e8a52c2fbccc464d7561b239c443`
to `4878cdabd87d4041bdaff61d04c966883b9fd07a` contains 261 commits.
The review used the full Git comparison because the GitHub comparison API limits
its file list to 300 entries. Intersecting that complete list with EDH's 128
selected source files identifies five changed sources:

| Upstream source                              | EDH destination                                            |
| -------------------------------------------- | ---------------------------------------------------------- |
| `packages/core/agent-loop/src/agent.ts`      | `harness/agent-runtime/agents/src/dsh/loop/agent.ts`       |
| `packages/core/agent-loop/src/tool-calls.ts` | `harness/agent-runtime/agents/src/dsh/loop/tool-calls.ts`  |
| `packages/core/session/src/index.ts`         | `harness/agent-runtime/storage/src/dsh/session/index.ts`   |
| `packages/core/session/src/repair.ts`        | `harness/agent-runtime/storage/src/dsh/session/repair.ts`  |
| `packages/util/values/src/index.ts`          | `harness/agent-runtime/foundation/src/dsh/values/index.ts` |

### Live tool-result recovery

Upstream commit `6a6f350b9437cf24e34a34f39ee4dfd107897d0c` adds
`ToolCallRecovery` to the live step boundary and reuses its pending-call tracking
for interrupted-session repair. After started dispatches settle, a failed step
records missing results before `step/end`, preserves completed results and
propagates the original error. A recorded call without a durable result receives
`TOOL_OUTCOME_UNKNOWN`; a requested call without a start record receives
`TOOL_NOT_STARTED`. Result-recording failure retains both errors.

EDH imports `ToolCallRecovery` into its live step owner and shares that tracker
with interrupted durable-prefix repair. Each owned step subscribes only to its
own Session's committed events and removes the listener before closing the step.
Completed results remain immutable. Missing-result publication precedes `step/end`;
failure preserves the original error, including both errors when recovery publication
also fails. Pending identities have no references to other assignment Sessions.

Tool results remain blocks inside EDH's `role: user` message. The original selected
source identities, applied upstream commit and resulting local hashes are retained
in the import manifest. For execution tools, an unknown result requires inspection
of execution identity, device state and ActionGate records before Planner decides
the next action. Recording a missing result must never replay a robot action,
confirm a stop, create a Verifier assignment or authorize retry.

Actual Qwen acceptance invokes three read-only repository tools through the native
loop. The first result commits; exclusive file publication rejects the second with
an actual `EEXIST` after its recorded start. Recovery publishes that unknown outcome
and the third request's `TOOL_NOT_STARTED` result. The subsequent actual model request
contains all three results, with no repeated dispatch. A separate actual Session
receives its independent context. A second check makes recovery publication itself
encounter `EEXIST` and confirms both original errors are retained. Four actual model
requests and four file reads pass; no physical action is dispatched.

`scripts/check-dsh-tool-recovery-live.ts` retains the model requests, native events,
filesystem errors and source hashes in an ignored evidence directory. The accepted
check is `.local/work/dsh-tool-recovery-live-ygLra4/acceptance.json`.

`scripts/check-dsh-recovery-history.ts` checks interruption at every recorded call
in a private copy of an actual journal. It preserves complete prefix events and
completed results, validates call-result provenance, restores the native Session
surface and confirms that repair dispatches no tool. Five retained workflows pass
149 call boundaries, including actual execution, clarification and perception tools.
Original journals remain unchanged. Run these checks against actual evidence:

```sh
EDH_LIVE_VLM_URL=http://127.0.0.1:18080/v1 \
EDH_LIVE_VLM_MODEL=Qwen/Qwen3.8-27B \
pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-dsh-tool-recovery-live.ts

pnpm exec tsx --tsconfig tsconfig.runtime.json scripts/check-dsh-recovery-history.ts \
  --data-directory /absolute/path/closed-console
```

### JSON validation portability

Upstream commit `068c552b1e057aa580ef2875efdaafcdfa2aacfb` compares a
candidate intrinsic constructor's text with the current engine's own constructor
text. EDH applies this comparison to the selected value validator. Actual Node/V8
and macOS JavaScriptCore checks use the complete 128-file import manifest, including
arrays and objects originating in separate engine realms. Detached snapshots retain
the original content; custom object and array prototypes remain rejected.
JavaScriptCore's actual intrinsic text contains line breaks and passes the same
validator without changing accepted JSON semantics.

```sh
node scripts/check-dsh-json-portability.mjs \
  --jsc /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
```

This check compiles the actual selected value module and executes it in both engines.
Its accepted result is `.local/work/dsh-json-portability-YAW7sV/acceptance.json`.

### Transport, context and storage assessment

The source comparison leaves EDH's selected Chat Completions transport, local
image primitives, compaction sources, tool runtime and agent initialization
implementation unchanged. The selected Session change is the recovery mechanism
described above. EDH's existing image evidence permissions, output headroom,
independent role contexts and physical verification rules continue to apply.

The release's image re-upload change batches exact rejected file generations into
one locked DeepSeek upload-index update and preserves newer generations. This
belongs to the official DeepSeek Files route; EDH's current OpenAI-compatible
route resolves its own image attachments. Its configuration optimization is in
the upstream profile `ConfigEditor`; the persistence inventory change compacts
generated type graphs used by upstream tooling. Neither changes the selected EDH
runtime format or requires a Session data migration for this review.

The selected source and adaptation manifest include the verified recovery and
value-validator changes. EDH's existing Session vocabulary and immutable histories
retain their existing format.

## rc.2 compatibility review

The rc.2 comparison against rc.1 was inspected at both immutable revisions.
The release changes relevant to EDH's selected runtime are these:

- Runtime tool additions and removals now produce native `developer/message`
  events, a `Session.toolHistory()` fold and provider-specific tool projections.
  The relevant upstream commits are `bc8c0dbf403662daa62b7ddbb45c2e4abcf718fa`,
  `1b0c2e5760`, `59318c1204` and `f6848ee921`. EDH's currently configured
  OpenAI-compatible adapter has no `toolUpdate` capability and sends the full
  current tool list on each request. The native scoped registry check in
  `tests/runtime/dsh-release-rc2.test.ts` confirms that a new tool becomes
  visible within the same Session and disappears after unregistering. A live
  two-turn Session using `qwen3.8-27b` through vLLM confirmed the provider
  receives the newly registered tool on its next request: the model called
  `read_current_repository_name`, and DSH executed it once against the real
  `package.json`. Both turns completed. EDH does not advertise the upstream
  incremental update mode on its current provider route.
- Upstream commit `dc07e5a50dadcf03e3fb9e1b7c69bb2ba9550254` prevents
  UTF-16 surrogate pairs from being split by output caps in persistent Bash,
  PowerShell and string-replace tools. Those three tools are outside EDH's
  selected source modules. EDH's active native tool-result pruner already
  measures and slices Unicode code points. A real README-derived tool result
  containing a supplementary character passes actual Session pruning, JSON
  file serialization and Session restoration. This check covers the mounted
  pruning path; it does not claim acceptance for tools EDH does not mount.
- Upstream commit `193f9ce413077564c58fb7c1aeb6141f4a4a163c` bounds the
  official DeepSeek Messages provider's `dsh_session_log` request extension
  and lets the base request proceed if extension serialization fails. EDH's
  current OpenAI-compatible adapter does not install that provider or request
  extension. It retains its own `maxRequestBytes` policy and rc.1
  output-aware compaction. This upstream extension behavior therefore has no
  source path to import into the current EDH model route.

No imported DSH source file changed for this review. The selected baseline,
original hashes, local hashes and MIT notices remain unchanged in the
[source import map](../provenance/dsh-imports.json). The rc.2 compatibility
checks use actual DSH Session and tool services plus a persisted log file.
`scripts/check-dsh-rc2-live-tools.ts` also verifies dynamic registration with
the real local VLM service and writes the native tool call/result audit to
`.local/work/dsh-rc2-live-tools.json`. This acceptance covers the full-tool-list
OpenAI-compatible route; no simulator is involved.

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

The complete GitHub Framework checks pass at EDH commit `4b1fd1d`, including
TypeScript, formatting, source provenance, documentation, Python, runtime, contract,
console and launcher checks. The runtime suite contains 387 passing checks.
Live VLM image/tool rounds also pass on the complete release adaptation at EDH
commit `1a571e2`, with native context management enabled. Independent Planner and
Verifier sessions each consume the real camera attachment and finish successfully.
These short rounds do not trigger automatic summarization. Exact configuration and
local evidence paths are in [GPU integration](gpu-integration.md#live-vlm-image-and-tool-checks).
Simulation and learned-policy acceptance remain tracked in the
[live integration plan](live-integration.md).
