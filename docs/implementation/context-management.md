# Agent context management

EDH mounts the pinned DSH token meter, compaction service and basic compaction
backend through an explicit deployment policy. An optional native tool-result
pruner can reduce long tool text. The DSH loop still owns pre-step admission,
balanced tool-call/result spans, maintenance, cancellation and transactional
model-visible surface replacement. No second transcript manager is introduced.

## Enable and configure

```ts
const deployment = {
  // Existing models, adapters, tasks, team and provider bindings...
  contextManagement: {
    compaction: { thresholdRatio: 0.7, retainRatio: 0.15, maxTokens: 4096 },
    // pruneToolResults: { ... } // Optional native pruning configuration.
  },
};
```

This is an excerpt of `ServerDeployment`, not a standalone deployment. Declare each
model's actual `contextWindow` in its adapter metadata. Automatic mode rejects
missing capacity before opening or reconciling run history. Model metadata lookup
is not an inference or health check. The normalized policy is frozen into the public
configuration and deployment digest. Unknown policy fields and invalid native
threshold/retention combinations fail preflight.

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

## Preserve authority and role isolation

The only behavioral patch to the absorbed summarizer is its embodied instruction
and checkpoint preamble. It asks for exact goal/contract/attempt/boundary identities,
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
failure details, assignment identity and native event sequence. `agent.context-capacity`
records model capacity. `agent.context-usage` records estimated total/surface tokens and
surface-node count after delivery settles. The console's activity feed and event inspector
include compaction and usage events; these estimates are not billed token usage.

## Acceptance and practical limits

CPU tests exercise manual and automatic pressure reduction, continued native tool calls,
role isolation, original audit retention, dynamic authoritative context restoration,
rejected empty/oversized/truncated summaries, cancellation and subsequent maintenance.
Server acceptance exercises policy identity, missing-capacity preflight and a completed
fixture task with context measurement. These tests do not assess real summary quality.

- Automatic summarization failures preserve the original surface and follow DSH's
  warning/continue policy. Thresholds are proactive heuristics, not a hard token ceiling.
- Native overflow recovery requires an adapter's canonical context-window-exceeded
  error. The current OpenAI-compatible HTTP adapter does not yet classify those errors;
  pressure management is supported, HTTP overflow recovery remains a follow-on item.
- Image token estimates are approximate without provider-specific pricing metadata.
  The optional pruner targets tool text; it is not a visual frame-selection policy.
  Existing per-request image count/byte bounds can still be reached before pressure
  triggers. Long video/image history needs explicit selection and live VLM evaluation.
- Summaries may omit or misstate facts. They cannot substitute for fresh perception,
  formal verification, immutable contracts, or stored evidence.
- Raw evidence, run events and disk history are not compacted. The 4,000-event limit,
  scalable retention and resumable sessions remain separate work. Restart never
  silently replays historical physical commands.

See [provenance](../provenance/README.md), [runtime integration](upper-runtime.md)
and [deployment bindings](deployments.md) for source and extension entry points.
