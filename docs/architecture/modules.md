# Architecture and module ownership

EDH is the product and repository owner. Runtime implementations will be absorbed
selectively from DSH into these modules. Bootstrap provides **interfaces only**;
there is no functional DSH adapter or independently invented agent loop.

![Architecture](assets/framework-overview.svg)

The diagram's “EDH Host / DSH runtime” denotes the intended absorbed runtime, not a separate
copied upstream application or a running integration. It is a logical target
architecture, not a statement of bootstrap capabilities.

## Working directories

| Module | Owns | Does not own | Main boundary / next step |
| --- | --- | --- | --- |
| `apps/server` | EDH application assembly, future API and startup | Agent loop implementation | ServerAssembly; Step 00/12 |
| `apps/console` | Sensors, team/agent/robot state, tools, verdicts and timeline | Device truth or planner decisions | ConsoleProjection; Step 12 |
| `packages/agents` | Independent assignments, DSH session lifecycle, built-in role definitions | Implicit parent context or another loop | AgentFactory; Step 03 |
| `packages/teams` | Team/member definitions and immutable role/provider bindings | Hard-coded role enum | TeamLoader; Step 02 |
| `packages/models` | Model capabilities and DSH model binding | Planning or tool orchestration | ModelRegistry; Step 00 |
| `packages/tools` | Logical tools, role exposure, provider selection and invocation boundary | Every concrete perception/robot implementation | ToolRegistry/ToolExecutor; Step 02/07 |
| `packages/communication` | Explicit briefs, scoped messages, delivery and subscriptions | Shared conversation memory | TeamRouter; Step 04 |
| `packages/planning` | Persistent PlanDocument and progress projection | Authoritative success | PlanStore; Step 05 |
| `packages/files` | Private assignment files and controlled search | Shared unrestricted filesystem | AgentFiles; Step 05 |
| `packages/tasks` | Goals, attempts, decision ownership and recovery linkage | Policy action generation | TaskCoordinator; Step 09 |
| `packages/execution` | Host/worker bridge, job status and resource coordination | TS control loop or autonomous retry | ExecutionClient; Step 06 |
| `packages/perception` | Model-facing capture/segmentation/depth/localization tool adapters | Shared global scene state | PerceptionProvider; Step 07 |
| `packages/observation` | Active-view intent, resource effects and achieved pose | Assumption that turn-view only moves a camera | ActiveObservation; Step 07 |
| `packages/verification` | Monitoring and formal-verdict coordination | Retry, replan or ground-truth fabrication | VerificationCoordinator; Step 08 |
| `packages/memory` | Authorized evidence access, skills and recovery experience | Automatic shared prompts or VLA training | SkillStore/EvidenceReader; Step 10 |
| `packages/storage` | Persistence primitives used through scoped service boundaries | Bypass of evidence visibility | EventStore/AssetStore; Step 04 |
| `packages/contracts` | Authoritative wire schema and generated declarations | Runtime semantic authorization | physical.schema.json; Step 01 |
| `python/.../execution` | Actual action progression, budget and device job handling | Upper-level retry decision | ExecutionWorker; Step 06 |
| `python/.../policies` | Subgoal-to-action policy adapter | Agent orchestration | SubgoalPolicy; Step 13 |
| `python/.../environments` | Simulator observation/action/task mapping | Environment-specific host protocol | EnvironmentAdapter; Step 13/15 |
| `python/.../embodiments` | Capabilities, units, frames and action/observation specifications | Simulator lifecycle | EmbodimentAdapter; Step 06/13 |
| `python/.../backends` | Device connection, commands and confirmed state | Agent-mediated emergency response | DeviceBackend; Step 06/16 |
| `python/.../perception` | Optional model/provider execution | Host role permissions | PerceptionProvider; Step 07/13 |
| `python/.../verification` | Limited GT/device fact checks | Final agent verdict | VerificationProvider; Step 08/13 |

## Direction of dependencies

Source interfaces depend on `contracts`; application assembly composes the modules.
Concrete runtime coupling is introduced only when implementing each step, with
explicit interfaces and tests. `contracts` must not import agents, apps or Python.
Communication uses storage for persistence; agents receive authorized evidence
through memory/tools, not direct unrestricted storage handles. Python optional
providers must not be imported by the base package at startup.

For example, a SAM tool is defined in `tools`, exposed through `perception`, and
executed by the Python perception provider. A verifier role lives in `agents`,
formal-verdict lifecycle enforcement in `verification`, and a simulator predicate
check in the Python verification provider. These are different responsibilities,
not three implementations of the same agent.

## Recovery sequence

![Async recovery](assets/async-recovery-sequence.svg)

## Wire contract maturity

The source schema defines the draft structural vocabulary. It does not establish
semantic sufficiency of context, event-type payload validation, goal/attempt
matching, evidence access, model compatibility or recovery eligibility. Those
checks belong to Steps 01–10. The generated TypeScript types do not express every
JSON Schema constraint (for example exclusive `all`/`any`); use runtime validation
at actual boundaries once implemented. Python Protocols use wire-object aliases
and do not duplicate or validate schema fields.
