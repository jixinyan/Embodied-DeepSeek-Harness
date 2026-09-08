# Foundation acceptance before the runnable MVP

Status: F1 passed local contract acceptance; F2–F7 remain **not yet passed**.
This document changes delivery order, not the confirmed product architecture. Preserve
Steps 00–01 and the original DSH loop. Establish dependable core runtime behavior across every MVP-critical module, then
deliver one real simulation-to-console MVP before broadening providers. Communication
and tool contracts are examples of this requirement, not its full scope.
Historical step numbers remain traceable in [the full plan](plan.md).

## DSH reuse boundary

[Decision 0003](decisions/0003-reuse-dsh-mechanisms.md) governs every slice below.
Agent loops, native tool schema/dispatch, sessions, inboxes, model calls and cancellation
are DSH mechanisms to reuse and configure. F2 binds Team/Role/permissions to those
mechanisms; F3 builds a physical provider bridge inside a native DSH tool body. The
foundation acceptance matrix verifies the resulting composition and embodied rules;
it is not authorization to implement another general-purpose runtime.

## What the current audit establishes

| Boundary | Exists at commit 3624fd6 | Gap to close |
| --- | --- | --- |
| Agent runtime | Original DSH loop, explicit scoped sessions, six runtime tests | Team-bound assignment creation, authenticated routing and model-visible handoff |
| Message | Versioned envelope, scope, assignment and correlation fields | Typed payload registry, sender binding, destination validation, delivery/replay semantics |
| Delegation | InvocationBrief schema and independent session seam | Resolve recipient/output schema; enforce assignment lifetime and effective permissions; explicit missing-context exchange |
| Tool definition | Input/output schema references, executor, effect and resource declarations | Resolve/compile schemas; check actual provider compatibility and expose only authorized tools |
| Tool invocation | A handwritten TypeScript ToolCall interface | Authoritative cross-language call schema, bound caller/provider/version, deadline and idempotency semantics |
| Tool result | Versioned result shape and status conditions | Validate payload against the selected tool; preserve operation identity through async completion; discard/quarantine wrong-scope or late results |
| State rules | Pure execution/verdict/recovery gates | Wire them to authoritative stored state, atomic transitions and actual service effects |
| Observation/evidence | Scope, time, clock, frame and visibility fields | Resolve and authorize references; distinguish latest captured from last supplied to each agent |
| Persistence and console | Interfaces and target layout | Durable critical events, resumable subscriptions and projections using the same accepted events |

The audit found two structural gaps, subsequently addressed by F1. The earlier message
`payload` accepts an arbitrary object independently of `type`. The earlier ToolResult
schema forbade `operation_id` on `completed`, which does not support tracing an async
operation through completion. A later completion must retain operation identity;
synchronous results need not invent an operation. Draft schema changes require both
language fixtures, regenerated static types and migration notes for existing examples.

## Complete core coverage

Quality applies to the entire execution path. The following responsibilities must
have working implementations and evidence before core readiness is claimed. Existing
DSH source is reused; an absorbed file or Protocol declaration does not pass a gate.

| Core area | Required foundation behavior | Concrete acceptance example |
| --- | --- | --- |
| Agent lifecycle and model binding | Team-bound fresh assignments, explicit prompts/tools, streaming/tool-call/media capability checks, bounded execution, cancellation and cleanup | Cancel a model call and a tool call; create a subsequent assignment without inherited history, orphan tasks or leaked registrations; reject a text-only model where images are required |
| Team configuration and extensibility | Resolve roles, responsibilities, model/tool providers and defaults into an immutable run snapshot; precise preflight errors | Add a role with existing providers through configuration; reject an unresolved tool before launching any device work |
| Communication and context | Bound identities, typed payloads, correct destinations, explicit missing-context exchange, idempotent delivery and assignment lifetime | A late answer to a closed assignment never appears in another agent's input |
| Tools and provider execution | Input/output validation, assignment permissions, sync/async lifecycle, deadlines, cancellation, structured errors and output media | Reject malformed provider output; an async result retains operation identity through completion and reconnect |
| Task, execution and physical resources | Owner-only decisions, immutable attempts/budgets, atomic state updates, conflict handling, confirmed stop and backend reconciliation | A view-changing tool cannot move a base already owned by the policy; a network timeout cannot renew the physical budget |
| Observation, perception and embodiment boundary | Evidence access, source/frame/clock/units, actual resource effects, action compatibility, provider lifecycle and reset | Reject wrong-frame/out-of-range actions; a stale camera frame cannot certify the current boundary; fixture reset clears prior run state |
| Verification and recovery | Independent DSH verifier assignments, bounded async monitoring, mandatory post-budget checks and original-goal recovery tracking | Budget expiry persists a formal check even under observation load; only the planner accepts a retry; prerequisite success cannot finish recovery |
| Experience lifecycle | Retry-triggered independent Evolver, evidence-backed draft, gated atomic SKILL persistence, scoped/versioned load and minimal retrieval | A failed or abandoned recovery cannot publish a successful skill; a later compatible task explicitly retrieves a persisted validated bundle |
| Planning, files and durable storage | Versioned owner-controlled plans, assignment-private files, authorized evidence, durable events and restart reconciliation | Reject a stale plan update and cross-assignment file access; restart retains accepted task facts without claiming the robot is stopped |
| Application lifecycle and console data | Reproducible startup/configuration, readiness/failure states, shutdown, traceable events, resumable projections and independent stop control | Start/stop/restart the CPU host and worker; reconstruct the same task state for a reconnecting console; distinguish latest sensor from agent-seen evidence |

Core mechanism readiness can first be measured with scripted models and CPU providers.
Actual VLM quality, policy compatibility and robot control require the real simulation
MVP's separate acceptance. Advanced retrieval ranking, provider breadth and visual
polish are later refinements; the minimum experience loop and reliable console data
are core requirements, not deferred placeholders.

## Foundation invariants

1. A new delegation creates a new assignment and fresh model context. Identity,
   effective tool access and destination scope come from the runtime, not model text.
   A same-assignment continuation can retain its own history. Missing context produces
   an explicit request; it does not copy a caller's private history.
2. Message acceptance, delivery to a session, model processing, operation acceptance,
   device acknowledgement and task success are different facts. A receipt never means
   the robot moved or an agent completed its work.
3. Critical messages are persisted before acknowledged acceptance. Reconnection may
   redeliver messages; consumers deduplicate committed effects. Do not promise exactly
   once physical execution across an arbitrary device failure. Duplicate IDs with
   conflicting payloads are errors, not silently accepted requests.
4. An async operation retains its call/operation/execution/assignment identity through
   progress, cancellation and final reporting. A timed-out wait is not confirmed stop.
   Reconcile uncertain motion by querying the same operation; do not start a duplicate.
5. Tool schema, effective role exposure and dispatch authorization agree. Validate
   both input and provider output against the frozen selected tool version. A tool
   called "observe" that moves the base is physical motion and needs real resources.
6. Only the decision owner starts a new attempt, retries, replans or resumes. Verifier
   may pause and submit evidence-bound verdicts. A stop control path must not wait for
   an LLM reply. Resources remain unavailable until stop is confirmed or the backend
   is explicitly reconciled; local cancellation alone cannot release a moving device.
7. A completed tool/job is not a completed goal. Formal verification uses current
   execution/boundary/attempt/criterion identity and authorized fresh evidence. Recovery
   success requires the original goal, not a successful prerequisite.
8. High-rate sensor frames are separate from durable control events. Frame coalescing
   must not drop budget, stop, verdict or recovery events. Record evidence actually
   supplied to a model so the console can distinguish captured state from agent input.

## Implementation slices and exit gates

Each slice ends with executable evidence, useful diagnostics and a coherent commit.
A schema-only slice is not completion of the foundation as a whole.

| Slice | Concrete deliverable | Exit gate | Original steps |
| --- | --- | --- | --- |
| F1: canonical boundary contracts | Registered message-type payloads; shared ToolCall and async-operation contracts; resolved schema/version rules; updated examples and TS/Python fixtures | Reject envelope/payload scope conflicts, wrong versions, invalid async transitions and lost operation identity in both languages; preserve a minimal custom message/tool extension path | Extend 01; contract portion of 02/04/06 |
| F2: Team/Role binding onto DSH | Team/Role loader, model capability preflight, immutable assignment/tool bindings and explicit handoff through DSH sessions/inboxes | Inspect actual model requests; reject incompatible bindings and leaked context/tools; route to the right assignment; cancellation, failed setup and subsequent run cleanup work | Required portions of 02/03/04 |
| F3: DSH physical-tool bridge | Native DSH tools wrapping a separate Python CPU worker; provider schemas, evidence access, action/observation compatibility, resources and reset/close | A DSH call crosses processes and returns to its assignment; invalid input/output or action fails; duplicate acceptance does not duplicate work; motion conflicts and uncertain stop are handled explicitly | Required portions of 02/06/07 |
| F4: durable task state, plans and private files | Persist critical events and operation identities, task-stream cursors, versioned plans, scoped files/assets, deduplication and atomic lifecycle gates | Restart/replay preserves accepted facts without duplicate effects; reject stale plan/state updates and unauthorized evidence/files; reconcile uncertain devices before releasing resources | Required portions of 04/05/06/09 |
| F5: verification, retry and experience | Independent verifier/evolver assignments on DSH, async monitor scheduling, formal verification, owner retry, original-goal recovery and minimal durable SKILL storage/retrieval | Actual CPU retry trace triggers Evolver; original-goal success permits a valid bundle; a later assignment retrieves it; failed/prerequisite/unknown outcomes cannot publish success | Required portions of 08/09/10 |
| F6: application lifecycle and console state | Documented startup command, bound configuration, readiness, shutdown/restart, structured diagnostics and resumable authoritative console projection | Host/worker start and stop reproducibly; reconnect reproduces task state and last-seen evidence; stop is available without waiting for an LLM | Core portions of 11/12 |
| F7: complete foundation acceptance | Reproducible CPU scenario spanning all ten core areas above using DSH and a separate Python fixture worker | Run success, recovery and injected-failure cases; publish exact trace and limits; all F1–F6 gates pass; one later run has no leaked state | Foundation gate before real simulation MVP |

F1 is implemented; see [boundary APIs and acceptance](boundaries.md). F2 is next. Keep a small registered core message set and an explicit
extension mechanism. Do not create a global closed enum of every future agent role,
tool or perception model. Avoid implementing every planned tool before one read tool
and one async job demonstrate the contract across the process boundary.

F2 needs just enough Team loading to bind identities and permissions correctly; it
does not require completing all advanced dynamic team features. F3 chooses and
records one transport for the host/worker pair, with framing, lifecycle and failure
semantics covered by tests. A multi-node broker and all transport adapters are not
foundation prerequisites. F4 needs a local durable store; storage selection must be
recorded with the concrete implementation, not inferred from this planning document.

## Required failure demonstrations

- Deliver the same accepted request twice, then reconnect a subscriber. The durable
  record is replayable and the fixture operation is not started twice. Reusing its
  idempotency identity with changed arguments yields a conflict.
- Interrupt the host/worker connection after operation acceptance. The caller reports
  uncertainty and reconciles by the same operation ID; a second physical attempt is
  not inferred from a network retry. Unknown device state remains visible to the UI.
- Complete an old assignment after a new assignment starts. The result is retained
  for audit but cannot enter the new assignment or advance its current task state.
- Return malformed or wrong-version tool output. The model receives a structured
  failure, not fabricated success or an unvalidated provider object.
- Attempt active observation while a policy owns the same base resource. The second
  request receives a defined conflict/queue outcome; it cannot bypass scheduling by
  describing itself as perception. Stop remains available through the control path.
- Exhaust the fixture execution budget while observations arrive. A durable formal
  verification request survives frame coalescing. Unknown or old-boundary verdicts
  cannot complete the task; opening a cabinet cannot resolve a store-cup recovery.
- Cancel during a model call, a read tool and an async physical fixture separately.
  Inspect actual termination and acknowledgement, resource ownership and late results.

These are CPU fault-injection checks, not simulator/robot performance measurements.
Set explicit test timeouts and synchronization points rather than timing-dependent
sleeps. Report failures with call/message/assignment IDs and inspectable event traces.

## Then deliver the MVP

After F7 foundation acceptance, connect those working core mechanisms into one real vertical slice: user instruction
in the console, configured agent team, real observation and execution tools, one
compatible simulator/body/policy, independent verification and owner retry, and a
successful-recovery SKILL retrieval using actual run evidence. Build the
console against the same authoritative events used by services. Preserve its approved
visual direction while showing real sensor and task data.

Validate the simulator/policy deployment early once machine, environment and checkpoint
bindings are supplied; CPU foundation work can proceed without them. Prefer the viable
legacy simulation/policy combination after checking its actual availability. BEHAVIOR
remains the initial planned integration; directory names do not establish availability.

MVP acceptance covers repeatable task runs, visible failure/timeout states, functioning
stop, correct verification/retry lineage and starting a subsequent run without leaked
assignment/tool state. Record the exact tested configuration and task set. This is a
bounded reliability claim, not a guarantee of zero failures on arbitrary tasks.

Second environments, hardware measurements, policy fine-tuning, large skill libraries,
transfer claims, complete transport support and UI refinement follow the runnable MVP.
Finish the foundation when its gates pass and move into integration; do not use an
unbounded notion of perfection to delay the physical end-to-end demonstration.
