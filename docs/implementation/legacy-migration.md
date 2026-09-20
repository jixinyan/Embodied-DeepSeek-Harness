# Legacy EAF design migration audit

Audit source: local `Embodied-Agent-Framework`, Git revision
`714e00ca83999da2df7221dcf205968adde5b441` (clean working tree when inspected).
EDH baseline: `326c4ff`, plus the user-session checkpoint described in
[user sessions](user-sessions.md). This is a design/behavior comparison, not a claim
that all legacy source was copied or that its integrations have been reproduced.
Legacy paths below are relative to the old repository; EDH links point to this repository.

## What image references actually did

Legacy `src/eaf/agent/runtime/image_registry.py` maps an opaque `image_ref` to raw
RGB, aligned depth and intrinsics. `src/eaf/agent/tools/perception.py::capture_image`
returns both text (`image_ref=img_...`, camera pose) and an `image_url` block produced
by `IMAGE_REGISTRY.to_data_url(ref)`. `detect_objects(image_ref, prompt)` resolves
that reference locally, runs perception, and may return an annotated image.

Thus, references identify and route images; they do not substitute for pixels in
visual model inference. For example, `img_0042` lets SAM and the audit refer to the
same frame. The VLM still needs the selected frame bytes to inspect the cup.

Legacy `runtime/context_window.py` copies outgoing messages and replaces omitted
historical image blocks with spatial-memory text. The registry and original message
history remain intact. `runtime/frame_filter.py` implements coverage, distinctness
and recency policies, with newest/before-snapshot pins; `runtime/spatial_memory.py`
retains pose, seen/not-found objects and aliases. The aggregate scene graph can be
included in the newest omitted-frame stub.

EDH stores native `ImageAttachmentRef` metadata in evidence and DSH messages. The
HTTP model adapter resolves admitted references only when serializing retained images.
[Visual history](context-management.md) currently uses whole-message recency selection
and native DSH surface replacement; original audit events remain available. Omission
markers retain attachment identity, but do not yet contain legacy spatial-memory
summaries. The deployment still owns actual image bytes and the resolver.

## Migration matrix

| Legacy design and source | EDH status | Current implementation / remaining work |
| --- | --- | --- |
| Planner sees observations, plans and selects tools (`agent/run.py`, `tools/perception.py`) | Reimplemented on DSH | [Upper application](../../apps/server/src/application.ts) exposes capture/active view and explicit evidence to the Planner. Real sensors are pending. |
| Deep Agents/LangGraph runtime | Intentionally replaced | Selected upstream DSH loop, tools, sessions, inbox, cancellation and context maintenance. No second generic agent loop. |
| Navigation/manipulation delegation (`orchestration/subtask_executor.py`, `agent/embodiment.py`) | Generalized | Team/ROLE definitions, independent assignments and explicit briefs/results. Navigation and manipulation are optional roles/tools rather than a mandatory hierarchy. |
| Instruction + execution budget + post-execution evidence (`subtask_executor.py`) | Semantics retained | Typed subgoal request, nonblocking execution and mandatory formal boundary checks. Old Python call payloads are not claimed wire-compatible. |
| Verify and replan (`orchestration/verification.py`, `runtime/rollout_monitor.py`) | Reimplemented and changed | Verifier monitors/pauses and formally checks; Planner alone retries/replans/resumes. Real provider monitoring is pending. |
| Reference-addressed RGB/depth/intrinsics (`runtime/image_registry.py`) | Partially retained | Native attachment refs, scoped evidence grants and bounded HTTP resolution. No complete deployment media registry/server or live sensor binding yet. |
| Image-window pruning (`runtime/context_window.py`) | Partially retained | Native DSH compaction and whole-message visual recency; original audit retained. Semantic coverage, before/after pins and scene summaries remain pending. |
| Spatial memory, coverage/stall detection (`runtime/spatial_memory.py`, `frame_filter.py`, `scene_graph.py`) | Not migrated | Must be environment/session scoped with explicit agent access, rather than copying process-global memory. |
| SAM, depth/localization and active robot observation (`tools/perception.py`) | Contract/tool seams only | Capture/view fixture tools and segmentation wire schema exist. Actual SAM, depth, calibrated localization, head/base control and provider integration are pending. |
| Capability-aware embodiment setup (`agent/embodiment.py`, `contracts.py`) | Partially generalized | Validated physical profiles bind action specs, observation mappings, capabilities, required tools and role prompts. SDK behavior is not proven by these schemas. |
| Environment and policy registries (`sim/registry.py`, `policies/registry.py`, `config.py`) | Extension approach retained | Trusted launch/physical profiles and provider validators; policy WebSocket adapter and action gate CPU-tested. Real environment/policy adapter migration is pending. |
| Legacy learned-policy clients (`policies/pi05.py`, `gr00t.py`, other policy modules) | Not migrated as functioning integrations | Standalone protocol/mapping seams are exercised; no imported checkpoint, live policy server or GPU inference acceptance. |
| Cross-episode failure lessons (`runtime/lessons.py`) | Deliberately redesigned | Recovery Evolver starts after failed verification and Planner recovery; successful original-goal verification permits a provenance-bound SKILL with failure conditions and planning/verification advice. |
| Episode trace (`runtime/episode_trace.py`) | Reimplemented | Durable run events, native DSH audits, tool/TODO/assignment evidence and console inspection. Full physical telemetry/media retention remains pending. |
| Environment server lifecycle (`sim/server.py`) | New user-session ownership added | Retain one environment across independent tasks; release at session end. CPU world continuity is tested; real resource ownership/reconciliation is still a provider requirement. |

## Priority for the next migration

1. Bind durable, session-scoped media storage and image resolution to the worker port.
2. Port spatial observation records and explicit scene-memory tools; keep evidence
   visibility and task boundaries. Never share private agent transcripts implicitly.
3. Add coverage/pinned-frame selection as configurable native DSH context maintenance,
   with regressions for fresh images, comparison pairs and missing sensor metadata.
4. Bind one real environment/policy/perception stack through the existing action gate.
   Port useful legacy adapters selectively after checking their pinned SDK contracts.
5. Evaluate skill transfer on another embodiment/configuration; record applicability
   failures as well as successes. Shared storage alone does not prove transfer.
