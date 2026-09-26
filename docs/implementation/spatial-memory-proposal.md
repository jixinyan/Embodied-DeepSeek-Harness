# Spatial memory proposal

Status: the user selected an initialized, continuously maintained scene state.
The lifecycle and interfaces below specify the proposed implementation; they are
not implemented capabilities.

## Representation and lifetime

Initialize one persistent `SceneState` for the environment retained by a user
Session. Its object and region graph accumulates knowledge throughout that
environment's lifetime. Later observations update the same state identity and
advance its revision. Objects, regions, observations and their relationships are
explicit records. Each current entry points to supporting observations. Preserve
history so an update does not erase what an earlier plan relied on.

## Initialization and continuous updates

The environment initialization workflow creates `SceneState` with `state_id`,
`session_id`, `scene_id`, `scene_generation`, `revision`, lifecycle status and
available camera/frame metadata. Its contents include objects, regions, relations,
view history and unresolved observations. Unknown space remains unknown.

After the backend supplies its first permitted observations, the configured
perception providers populate the initial visible scene. Readiness means that the
configured initialization operations completed; it does not mean that the entire
environment was observed. Required provider failures surface as initialization
errors. Initialization does not read hidden scene objects or GT depth. Any active
movement needed for another view requires the normal physical tool admission.

Subsequent updates follow these rules:

1. Captures register immutable source observations in the same scene generation.
   Configured perception results update supported object identities, positions,
   visibility and relations. Planner annotations remain identifiable hypotheses.
2. The scene service validates ownership, source references, capture time and the
   expected state revision, then commits the update atomically. Repeated delivery
   of an already accepted result does not create another revision.
3. Delayed model results retain their original capture time. They may add historical
   evidence but cannot replace a newer current position merely because inference
   finished later. Results from another generation cannot update the current state.
4. A successful commit advances `revision` and publishes the changed records to
   the console. Queries return the revision and observation times used, so an Agent
   or operator can inspect exactly which state informed a decision.
5. Formal verification results attach to their original goal, execution and evidence.
   Permitted semantic facts can update the scene; hidden debug state stays excluded.

Each accepted observation or perception result can contribute an update without
requiring Planner to rewrite the whole scene. Semantic assertions that require
Agent interpretation are explicit tool operations. Perception providers return
results; the scoped scene service owns state changes and permissions.

The state persists across tasks in the retained environment. A server restart
restores its saved revision and history, then reconciles the backend instance and
scene generation before treating records as current. An unconfirmed environment
identity leaves restored records historical until new observations establish the
current scene. Reset creates a new generation and initialized current state while
preserving the previous generation for inspection.

The environment supplies a scene identity and reset generation. Consecutive tasks
in the same retained scene can query the graph. A scene reset starts a new generation:
earlier positions and object states remain inspectable historical records and cannot
be returned as current scene facts. Closing a Session archives its graph. Another
Session retrieves reusable SKILL knowledge independently; it does not inherit object
coordinates as facts about its new environment.

## Records

| Record | Required content |
| --- | --- |
| Object | Stable EDH object ID, semantic label, identity state, source observations, last-seen time and current scene generation |
| Region | Stable region ID, name, supported observed connections and source viewpoints |
| Observation | Source run, observation and camera attachment IDs; capture time; segmentation or detection result; depth result and model identity; calibration and coordinate frame when available |
| Position estimate | Value, units, coordinate frame, method, valid pixel coverage, source mask/depth references and time; unavailable values remain explicitly unavailable |
| State or relationship | Subject, predicate, optional related object/region, observation time, evidence references and whether it is an observation, model estimate or Agent hypothesis |
| View record | Region, camera, capture time, actual pose when available and objects observed; a view does not certify that every object in the region was found |

Examples of relationships are `in_region`, `on`, `inside`, `held_by` and
`connected_to`. Their truth is a timestamped claim supported by evidence. Only
formal verification can satisfy an admitted task success criterion.

## Object identity and changing evidence

SAM tracking identities are scoped to their camera and tracking session. They can
support continuity inside that scope. Matching labels or nearby boxes alone do not
establish that two observations concern the same physical object.

Cross-camera and later re-identification produce candidates with explicit evidence.
An Agent with identity-update permission can resolve a candidate after inspecting
the relevant observations; unresolved candidates remain separate. Preserve the source
IDs and identity history when a resolution is recorded. Identity methods are
replaceable providers, with their names and versions attached to their results.

A cup outside the current image remains last seen at its prior location. An occluded
cup has uncertain current visibility. Neither condition establishes absence. New
evidence can supersede a position or state while retaining its prior value and source.
Conflicting observations remain visible for the Planner to resolve through another
observation. Memory never creates a retry or a physical movement automatically.

## Geometry and depth

Object masks come from the selected segmentation/detection provider. Object distance
uses the matching RGB frame's YOLO26-predicted depth and valid pixels in the selected
mask or image region. It must not read simulator GT depth or hidden object positions.

Keep optical-axis depth and camera-to-surface distance as separate quantities.
Camera intrinsics allow back-projection of valid pixels. A robot-frame or world-frame
position additionally requires a known transform at the capture time. Preserve its
source and frame identity. When that transform is unavailable, retain camera-frame
evidence and mark the requested transformed position unavailable.

Record the checkpoint's calibration provenance and depth-estimation limitations.
Pixel coverage describes usable input; it is not a fabricated probability of correct
distance. Sparse, invalid or conflicting predictions produce an explicit insufficient
evidence result. Current-scene GT is not used to calibrate runtime distance estimates.

## Agent tools and context

Proposed tools:

- `scene.query`: read the initialized state's objects, regions, last-seen states,
  relationships or prior views relevant to a task. Return bounded summaries with
  state identity, revision, freshness and evidence references.
- `scene.record`: register a permitted observation and semantic annotations. Geometry
  is derived from referenced perception results; an Agent cannot invent its numeric
  source values. Agent interpretations remain labeled hypotheses.
- `scene.link`: add an evidence-backed relation or record that a previous relation is
  no longer supported. Preserve both source observations.
- `scene.resolve_identity`: record an explicit identity decision and its evidence.
- `scene.evidence`: retrieve selected underlying observations and image attachments.

Tool permissions are configurable by role. Planner can query and maintain task-relevant
scene knowledge. A perception specialist can record only the observations granted to
its assignment. Verifier can inspect relevant scene history, and still checks the
current stopped execution through its formal verification tools.

The graph is never preloaded into all role prompts. Queries add their selected results
only to the calling assignment. Delegation still requires an explicit brief. Shared
storage does not create shared conversation context.

Cross-task reads require membership in the same user Session and scene generation,
and an explicit scene-tool request. The evidence reader validates the original run's
ownership and visibility before granting selected images. Debug-only records stay
outside Agent evidence. Archive inspection does not make old evidence current.

## Example: a cup and a cabinet

This is an illustrative usage sequence, not an acceptance result.

1. Environment initialization creates the Session's `SceneState`. Initial images
   and configured perception identify a cup and a cabinet. YOLO26 depth estimates
   their distances from those image regions. The first populated revision records
   the observed cup on the counter, its evidence and the cabinet's visible state.
2. A task asks to put the cup in the cabinet. Planner queries those two objects and
   receives concise entries with the original times and source references. It requests
   a new view where the current state needs confirmation.
3. Planner starts an admitted policy subgoal. Subsequent observations update the
   same `state_id`; for example, evidence that the cabinet opened creates a new
   revision of its state. After execution ends, Verifier checks the current goal.
   Supported verification facts update the state, and Planner updates its plan.
4. If the cup is subsequently hidden, its entry retains the last observation and
   marks its current visibility uncertain. Planner chooses whether another view is
   necessary. The memory entry alone cannot establish that the cup is inside.
5. A later task in the same Session can query the cup's last verified location and
   reobserve it. A later Session retrieves applicable SKILL guidance without inheriting
   this cabinet's coordinates.

## Implementation and actual acceptance

Use the existing journal, scoped evidence readers, native DSH tools and Session
lifecycle. Add spatial records to the retention ownership inventory. Deployment
configuration selects providers and query limits; no simulator-specific classes enter
the shared interface.

Acceptance requires actual multi-view observations and predicted depth, stable identity
within a tracking scope, explicit ambiguity across scopes, updated state after real
movement, reset invalidation, same-Session multi-task retrieval, independent role
contexts and preserved evidence after restart. Also verify one initialized state
identity across tasks, atomic revisions, duplicate-result idempotency, delayed-result
ordering and backend reconciliation after restart. Record unsupported transforms and
incorrect associations as failures. No synthetic robot success or fabricated scene
observations establish acceptance.
