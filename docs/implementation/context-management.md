# Agent context management

EDH mounts the pinned DSH token meter, compaction service and basic compaction
backend through an explicit deployment policy. An optional native tool-result
pruner can reduce long tool text. The DSH loop still owns pre-step admission,
balanced tool-call/result spans, maintenance, cancellation and transactional
model-visible surface replacement. No second transcript manager is introduced.

[memory/src/context.ts](../../harness/agent-runtime/memory/src/context.ts) installs
the services; the selected [token-meter source](../../harness/agent-runtime/memory/src/dsh/token-meter/index.ts)
lives with compaction in `memory`. Model adapters provide route metadata and
image pricing through their existing model service. Shared native registration
and event scope primitives live in
[foundation](../../harness/agent-runtime/foundation/src/dsh/scope/index.ts).
Directory ownership preserves original DSH imports and exact source hashes.

## Enable and configure

```ts
const deployment = {
  // Existing models, adapters, tasks, team and provider bindings...
  contextManagement: {
    compaction: { thresholdRatio: 0.7, retainRatio: 0.15, headroomTokens: 4096, maxTokens: 8192 },
    visualHistory: { maxImages: 12 }, // Optional; keep below the adapter request limit.
    // pruneToolResults: { ... } // Optional native pruning configuration.
  },
};
```

This is an excerpt of `ServerDeployment`, not a standalone deployment. Declare each
model's actual `contextWindow` and output default in its adapter metadata.
Automatic mode validates the resolved output reservation, pressure headroom and
retention budget before opening or reconciling run history. Model metadata lookup
is not an inference or health check. The normalized policy is frozen into the public
configuration and deployment digest. Unknown policy fields and invalid budgets
fail preflight. A later explicit request cap is checked at the native request
boundary before inference.

EDH deployments with context management default to `headroomTokens: 4096` and
summary `maxTokens: 8192`; either can be configured. The native compaction service
retains its `65536` headroom default when mounted directly outside EDH deployment
normalization. Pressure uses the lower of the configured window fraction and the
context budget after reserving the effective request output cap and headroom.
Retention ratios use the context budget after the output reservation. A 32768-token
window with a 2048-token output cap and EDH defaults begins pressure at 26214
tokens and retains about 4915 recent tokens at the default ratio.

Omitting `contextManagement` leaves the previous host behavior unchanged. Setting
`compaction.auto: false` mounts measurement, scoped facts and manual maintenance
without automatic compaction; this also supports adapters with unknown capacity.
Native maintenance is available through `host.compaction.compactNow(agent, signal)`
while the agent is idle. This is a trusted host API, not a new role tool or HTTP route.

The [HTTP model example](../../examples/deployments/openai-compatible.mjs) enables
pressure compaction when `EDH_MODEL_CONTEXT_WINDOW` is supplied. Use the deployed
model's actual capacity, not a guessed maximum. Native policy types and optional
per-provider/model overrides are exported from the absorbed compaction modules.
Summarization uses the conversation model unless an explicit summarization target
is configured. These auxiliary model requests incur their own latency and cost.

## Bound visual history

`visualHistory.maxImages` is an explicit image-block budget (integer 1–1024).
It counts repeated references as repeated blocks, matching transport admission.
With no visual policy, image retention is unchanged. For image retention without
automatic text summaries, use `compaction: { auto: false }` with `visualHistory`.

The EDH visual service uses DSH's original pre-step hook, logged surface replacement
and token-meter shadow-price protocol. It reserves space for the incoming batch and
for tool images that have not yet reached a model. Remaining space retains complete
image-bearing messages, newest first; once a group does not fit, older groups are
omitted as well. A message is the atomic group: adapters should put synchronized
camera views in one tool result or handoff. A fresh batch that exceeds the budget
fails before inference; it is never silently reduced to a partial observation.

For example, with `maxImages: 6`, each capture containing a head view and two wrist
views leaves room for two complete captures. The third capture shadows the oldest
three image blocks with explicit omission markers. Text, tool-call/result identity,
image IDs and original audit events remain intact. An authorized `evidence.read`
returns the admitted image reference again as fresh tool input; the deployment resolver
must still retain its bytes. Pruning grants no new evidence access.
A text-only followup retains the latest available image-bearing group.

The policy runs before native pressure compaction and rechecks the actual admitted
input after other pre-step contributors. Native summaries may still condense older
visual history; the policy is not semantic keyframe selection or a permanent pin.
Image count does not bound image bytes or tokens. Configure it at or below the
selected adapter's image-count limit (the HTTP adapter defaults to 16), and retain
that adapter's independent byte/deadline checks. Per-role/per-provider visual budgets,
reference-image pinning and learned frame selection remain future extensions.

## Preserve authority and role isolation

The summarization prompt uses EDH's embodied instruction and checkpoint preamble.
It asks for exact goal/contract/attempt/boundary identities,
observations versus hypotheses, pending reports, failure conditions, recovery state
and next steps. It cannot execute tools or grant motion/evidence permissions.

With context management enabled, each TeamSessions assignment registers a native
DSH dynamic context contributor. It refreshes the assignment's original objective,
immutable success contract, limits and expected report recipient. UpperRun adds only
admitted operational state in that assignment's goal/attempt scope. The Planner
also receives its current selected goal, contract, budget and run state. Other roles
do not inherit Planner plans, files, raw ground truth, sensor payloads or conversations.
Evidence retrieval and grants remain explicit; plans remain accessible through tools.

For example, a lossy summary might retain “put the cup away” but omit “close the door.”
The next request still receives the original full success contract. After a new stop,
it receives the current scoped boundary/version rather than treating the historical
boundary in the summary as current. DSH refreshes and persists this context before a
model step, including after compaction shadows the previous snapshot. It is a snapshot,
not an authorization to execute; existing goal, owner and verifier gates remain decisive.

## Audit and console

Original native events remain intact. Only the model-visible surface changes.
`agent.context` forwards native start, summary, end and optional prune events, including
failure details, assignment identity and native event sequence. EDH visual retention
adds `edh/visual-history` with retained/incoming counts, source/replacement sequences
and omitted attachment IDs. The console presents these as visual-context maintenance,
not new tool execution. Original tool results remain the tool-card source. `agent.context-capacity`
records model capacity. `agent.context-usage` records estimated total/surface tokens and
surface-node count after delivery settles. The console's activity feed and event inspector
include compaction and usage events; these estimates are not billed token usage.

## Acceptance and practical limits

Original RoboDojo/RoboTwin journals verify native token measurement, provider-usage
projections and registration-scope isolation without replaying physical tools.
Two original RoboTwin journals separately verify six native visual pre-step cases:
whole-group retention, fresh image admission and explicit over-budget rejection.
All original events and attachment references remain available. The sibling
context remains unchanged, original event restoration reproduces the same surface
and token measurements, and every Agent/Session releases. The model-free host
preserves its actual missing-route error after valid image admission. It provides
no model response, summary or task outcome. Exact commands, source hashes and
limits are in [CPU validation](cpu-release-validation.md#native-visual-context-admission).
Model-driven summarization, its factual quality and successful route-specific
image transport require actual-model acceptance.

- Automatic summarization failures preserve the original surface and follow DSH's
  warning/continue policy. Thresholds are proactive heuristics, not a hard token ceiling.
- Native overflow recovery now receives the canonical error from the HTTP adapter
  when status 400/413 contains a bounded JSON body with the exact
  `error.code: "context_length_exceeded"`. Ordinary bad requests, status-only 413,
  auth/rate-limit errors, prose matches and malformed/oversized bodies do not trigger
  compaction. No compatibility with every vLLM/provider error dialect is implied.
  DSH retries only after durable surface reduction and within `maxOverflowRetries`.
  If there is no useful reduction, summary failure preserves the original overflow;
  repeated overflow stops at the retry bound. The adapter never retries requests.
- Image token estimates are approximate without provider-specific pricing metadata.
  The optional pruner targets tool text; it is not a visual frame-selection policy.
  Without `visualHistory`, per-request image count/byte bounds can be reached before pressure
  triggers. Semantic keyframes, long-video handling and live VLM evaluation remain open.
- Summaries may omit or misstate facts. They cannot substitute for fresh perception,
  formal verification, immutable contracts, or stored evidence.
- Sensor metadata and run events are persisted and read on demand. Live console history
  uses bounded windows; audit inspection uses bounded assignment/event pages with an
  explicit published range. Journal/index retention,
  binary media cleanup and resumable sessions remain separate work. Restart never
  silently replays historical physical commands.

See [provenance](../provenance/README.md), [runtime integration](upper-runtime.md)
and [deployment bindings](deployments.md) for source and extension entry points.


Visual-selection events are stored in EDH's existing append-only session audits and
run events. This is not a resumable upstream persistence backend. Any future DSH
persistence provider must explicitly account for EDH's added event vocabulary; do
not silently skip unknown required events or resume physical commands from history.

Native audit publication uses fixed sequence boundaries and individual event reads.
Delivery error inspection uses the same native sequence API. Both paths preserve the
logical history and avoid materializing a complete audit array. Native event-body
[residency](session-history.md) releases older bodies after verified publication.
Active model-context and application-projection lifetime, plus live summary evaluation,
remain independent requirements.
