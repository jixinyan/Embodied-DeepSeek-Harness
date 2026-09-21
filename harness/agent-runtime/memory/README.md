# Context and recovery experience

[library.ts](src/library.ts) stores and exports versioned SKILL.md artifacts, searches explicit task semantics, and checks provenance. Failure signals, possible causes and avoid guidance accompany planning and verification guidance. Successful original-goal recovery gates publication in UpperRun. Fixture experience is excluded from ordinary searches by default.

## On-demand context

Planner and Verifier decide when prior experience could help their current question.
`skills.search` returns up to 20 metadata records: task semantics, required capabilities,
source, validation scope, limitations and provenance references. It returns no SKILL
body. After reviewing applicability, the agent calls `skills.load` for selected IDs;
each result contains that immutable skill's metadata and Markdown. Agents can refine
their query or continue from current observations when candidates are unhelpful.

No library listing or SKILL body is inserted automatically into a fresh assignment.
Publishing a skill adds it to persistent workspace storage, making it available to
later sessions through explicit retrieval. Retrieval results belong to the calling
assignment's native DSH context. Delegation requires explicit guidance or references;
skill provenance references do not grant access to another task's evidence. Console
experience inspection is separate from model-context delivery.

The built-in role prompts request reuse of guidance already available in context.
Native DSH context management may compact or prune old tool results; the agent can
reload a needed skill. There is no separate hidden context, automatic repeated injection,
or runtime deduplication of deliberate load calls. Native tool-call records expose
queries, selected IDs and returned content for debugging.

The current retriever matches keywords against `task_semantics`; it returns at most
20 matching records in store order. Embedding search, semantic ranking and selective
section loading are unimplemented. Agent-directed search and selective loading already
operate through the existing tools. Guidance informs planning and verification while
current task criteria, evidence permissions and execution authority remain authoritative.

See [upper-runtime integration](../../../docs/implementation/upper-runtime.md),
[current capability](../../../docs/implementation/features.md) and
[module responsibilities](../../../docs/architecture/modules.md).

[context.ts](src/context.ts) mounts original DSH token metering, compaction and optional
tool-text pruning. [visual-history.ts](src/visual-history.ts) adds whole-message image
retention through native pre-step and logged surface replacement. It preserves fresh
observations, original audits and existing evidence permissions; it does not delete
evidence assets. See the [context guide](../../../docs/implementation/context-management.md).
