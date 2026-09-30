<p align="center">
  <img src="apps/console/public/logo.png" alt="Embodied DeepSeek Harness logo" width="280" />
</p>

<h1 align="center">Embodied DeepSeek Harness</h1>

<p align="center"><strong>Everything is a plugin.</strong><br />Composable agent teams for embodied intelligence.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/framework-AGPL--3.0--only-blue" alt="Framework license: AGPL-3.0-only" /></a>
  <a href="docs/implementation/model-configuration.md"><img src="docs/assets/badges/models.svg" alt="Model adapters: cloud API and vLLM" /></a>
  <a href="docs/provenance/README.md"><img src="https://img.shields.io/badge/runtime-DeepSeek%20Harness-2563eb" alt="Agent runtime: DeepSeek Harness" /></a>
</p>

<p align="center">
  <a href="docs/project-spec.md">Project specification</a> ·
  <a href="docs/architecture/modules.md">Module guide</a> ·
  <a href="docs/implementation/robodojo-backend.md">RoboDojo integration</a> ·
  <a href="docs/implementation/progress.md">Development records</a>
</p>

EDH connects user-defined agent teams to interchangeable models, perception tools,
execution policies, simulators and robot interfaces. Selected DeepSeek Harness
implementations provide the agent loop, native tool calls and independent role
sessions, with [source provenance](docs/provenance/README.md).

## Framework architecture

![Embodied DeepSeek Harness architecture](docs/architecture/assets/framework-overview.svg)

[Open the full-size architecture diagram](docs/architecture/assets/framework-overview.svg).
The diagram describes component responsibilities and interaction boundaries.
Implementation evidence and acceptance results live in the
[development records](docs/implementation/progress.md) and
[v1 acceptance register](docs/implementation/v1-delivery.md).

## From instruction to verified experience

1. **Configure a Session.** Select a compatible environment, embodiment, execution
   mode, checkpoint, model and team in the console. A Session can contain multiple
   tasks in the same environment instance.
2. **Observe and decide.** Planner receives images through explicit references,
   uses perception tools, maintains the plan and TODOs, and chooses subgoals from
   observations, task context and evidence returned by other roles.
3. **Execute through ActionGate.** The physical worker obtains actions from a
   learned policy, a DSH-backed Astra policy, or a reviewed hybrid proposal.
   ActionGate checks identity, scope, generation, budgets and action validity before
   each device command. Observations and command acknowledgements return as evidence.
4. **Verify after execution.** An eligible execution end with a confirmed device
   boundary creates an independent Verifier assignment. Planner owns subsequent
   retry, replan and resume decisions.
5. **Retain useful experience.** A retry starts Evolver with the failed attempt's
   context. Evolver tracks recovery and extracts success cues, failure conditions
   and verification knowledge. Publication requires formal success of the original
   recovery goal. Agents retrieve relevant `SKILL.md` experience on demand across
   Sessions.

## Extension points

| Component | Configuration and responsibility |
| --- | --- |
| Agent teams | `team.yaml`, role prompts and tool bindings define independent roles with explicit context handoffs. |
| Upper models | Model configuration binds cloud APIs or local vLLM services, including image-capable models. |
| Tools | Native DSH tools cover planning, TODOs, files and communication; provider bindings add perception, active observation, execution and memory. |
| Execution modes | `policy`, `direct` and `hybrid` select learned-policy control, Astra control or Astra-reviewed policy proposals. |
| Policies | Client/server adapters connect checkpoints and policy services to the physical worker. |
| Environments and embodiments | Backend adapters describe observations, actions, coordinate frames, units and device capabilities for RoboDojo, BEHAVIOR-1K, RoboCasa, RoboTwin and hardware integration. |
| Memory | Session scene state and source-linked evidence represent the current environment; `SKILL.md` experience supports planning and verification across Sessions. |
| Verification | Simulator task checks and hardware evidence providers supply scoped facts to the independent Verifier. |

Compatibility checks govern selectable Session configurations. Each environment,
policy and hardware binding has its own installation and acceptance requirements;
the [integration guide](docs/implementation/live-integration.md) records them.

## Repository map

| Directory | Responsibility |
| --- | --- |
| [apps/server](apps/server/README.md) | Application assembly, Session lifecycle and HTTP/SSE API |
| [apps/console](apps/console/README.md) | Session launcher, Agent trace, plans, TODOs, tools, execution and verification |
| [apps/desktop](apps/desktop/README.md) | Desktop configuration selection and local-service lifecycle |
| [harness/agent-runtime](harness/agent-runtime/README.md) | DSH runtime, agents, teams, models, tools, communication, planning, verification and memory |
| [harness/physical-runtime](harness/physical-runtime/README.md) | Execution worker, ActionGate, policies, environments, embodiments and device interfaces |
| [harness/contracts](harness/contracts/README.md) | Shared schemas, wire messages and generated types |
| [examples](examples/README.md) | Deployment, role, team, tool, policy and skill definitions |
| [docs](docs/README.md) | Specification, architecture, provenance, installation and validation records |

## Configure and run

Use Node.js 22.19+, pnpm 11.19.0 and Python 3.11+. Install the source workspaces:

```sh
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/python -m pip install -c harness/physical-runtime/constraints.txt -e 'harness/physical-runtime[policy]'
```

Provide model credentials through private environment variables and choose an
installed physical deployment. The following guides describe configuration and
startup:

- [Cloud API and local vLLM model configuration](docs/implementation/model-configuration.md)
- [Model, policy and ActionGate adapters](docs/implementation/model-policy-adapters.md)
- [RoboDojo backend](docs/implementation/robodojo-backend.md)
- [Astra direct and hybrid execution](docs/implementation/litchi-execution-modes.md)
- [Isolated GPU environments and simulator installation](docs/implementation/gpu-integration.md)
- [Desktop launcher](apps/desktop/README.md)
- [Headless simulator recording and trace MP4 export](docs/implementation/headless-simulation.md)

For the local workflow demonstration, run `pnpm demo` and open
`http://127.0.0.1:4317`. That demonstration uses a scripted model and a synthetic
physical fixture. Live deployments use their configured model and native backend.
See the [upper-runtime guide](docs/implementation/upper-runtime.md).

## License and source attribution

EDH-authored framework code is licensed under AGPL-3.0-only. The standalone SAM
service and its invocation example retain MIT. Upstream code, model weights and
simulator assets retain their respective licenses; see
[licensing scope and notices](THIRD_PARTY_NOTICES.md).

See [DSH provenance](docs/provenance/README.md) and
[LitchiAgent integration provenance](docs/provenance/litchi-robodojo.md).
EDH is an independent project and is not an official DeepSeek product.
