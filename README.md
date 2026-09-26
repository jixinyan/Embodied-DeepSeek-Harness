<p align="center">
  <img src="apps/console/public/logo.png" alt="Embodied DeepSeek Harness logo" width="300" />
</p>

<h1 align="center">Embodied DeepSeek Harness</h1>

<p align="center"><strong>Everything is a plugin.</strong><br />Composable agent teams for embodied intelligence.</p>

<p align="center">
  <a href="https://github.com/jixinyan/Embodied-DeepSeek-Harness/actions/workflows/scaffold.yml"><img src="https://github.com/jixinyan/Embodied-DeepSeek-Harness/actions/workflows/scaffold.yml/badge.svg?branch=main" alt="Framework checks on main" /></a>
  <a href="docs/implementation/progress.md"><img src="docs/assets/badges/development.svg" alt="Stage: active development" /></a>
  <a href="docs/implementation/model-configuration.md"><img src="docs/assets/badges/models.svg" alt="Model adapters: cloud API and vLLM" /></a>
  <a href="docs/implementation/features.md"><img src="docs/assets/badges/physical-runtime.svg" alt="Physical runtime: integration pending" /></a>
</p>

<p align="center">
  <a href="docs/project-spec.md">Project spec</a> ·
  <a href="docs/implementation/plan.md">Implementation plan</a> ·
  <a href="docs/implementation/progress.md">Current status</a> ·
  <a href="docs/implementation/features.md">Capability map</a> ·
  <a href="LICENSE">MIT License</a>
</p>

EDH is an independent physical-agent framework designed around user-defined
teams, explicit context handoff, replaceable tools and policies, asynchronous
verification, and reusable recovery experience. Its agent runtime incorporates
selected DeepSeek Harness implementations, with traceable provenance.

> **Early development: the upper workflow and local console are runnable.**
> DSH-backed roles, native tools/TODOs, formal verification, recovery and SKILL
> publication run with an explicitly synthetic CPU backend and scripted model.
> RoboCasa's native `OpenCabinet` adapter passes GPU camera and ActionGate checks,
> including a console-driven Qwen Planner run with 1,050 GR00T controls and 26,250
> physics steps. Formal verification records native task failure; an inspectable
> camera/event replay preserves that outcome and the later model transport failure.
> RoboTwin's actual task reset and three-camera capture also pass. BEHAVIOR-1K
> returns native R1Pro observations and GT and passes clean shutdown.
> Successful task recovery, remaining policy controls and hardware integration remain pending.

![Current implementation](docs/architecture/assets/implementation-status.svg)

The diagram shows actual capability. See [target architecture](docs/architecture/modules.md)
for the complete intended framework.

## Find your way

| Location | Responsibility |
| --- | --- |
| [apps/server](apps/server/README.md) | Application composition and host entry |
| [apps/console](apps/console/README.md) | Physical control panel |
| [apps/desktop](apps/desktop/README.md) | Desktop deployment selection and owned local-service startup |
| [harness/agent-runtime](harness/agent-runtime/README.md) | Agents, teams, models, tools, tasks, verification and memory |
| [harness/contracts](harness/contracts/README.md) | Shared schemas and generated wire types |
| [harness/physical-runtime](harness/physical-runtime/README.md) | Policy, simulator, embodiment and hardware boundaries |
| [examples](examples/README.md) | User-defined roles, teams, tools and skills |
| [tests/runtime](tests/runtime/README.md) | Keyless DSH runtime acceptance; physical fixtures remain synthetic |
| [docs](docs/README.md) | Architecture, decisions, implementation steps and handoff |

## Run the local demo

```sh
pnpm install --frozen-lockfile
pnpm demo
```

Open `http://127.0.0.1:4317`. Inspect agent output, TODOs, native tool calls/results,
explicit handoffs, verification and recovery. See the [upper-runtime guide](docs/implementation/upper-runtime.md).
The multi-goal scenario demonstrates failed placement, an access prerequisite,
placement recovery and final cabinet closure; see [the illustrated runtime guide](docs/implementation/multi-goal-runtime.md).

The fixture is an integration demo; it does not control a real or simulated robot.

## Open a configured deployment from the desktop

`pnpm build:desktop` creates a native application under `dist/desktop/`. Open it,
choose a local launch configuration, start the service and open the console. The
application uses a prepared EDH checkout and a trusted deployment factory; it does
not bundle model weights or physical providers. See the
[desktop configuration and lifecycle guide](apps/desktop/README.md).

## Run the checks

Use Node.js 22.19+ (the bootstrap was checked on Node 25), pnpm 11.19.0 and
Python 3.11+. From the repository root:

```sh
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/python -m pip install -c harness/physical-runtime/constraints.txt -e 'harness/physical-runtime[policy]'
pnpm check
pnpm test:runtime
```

These commands check generated schema types, example structure/references,
TypeScript, documentation links and Python importability, then execute upper-runtime
integration tests and shared wire/lifecycle validation cases in both languages. `test:runtime` runs the runtime suite
alone. The optional policy extra enables 17 WebSocket/action-gate tests. No live model API or simulator is started. API tests start a temporary local server. No GPU or key is needed.
Python checks prefer `.venv/bin/python`, falling back to `python3`; override
`EDH_PYTHON` if needed. `pnpm test:contracts` runs shared TS/Python wire cases.

## Configure models and policies

Use the [model configuration guide](docs/implementation/model-configuration.md) for
YAML/JSON cloud API and local vLLM bindings. Both support explicit credential handling,
model aliases and application-owned image resolution through the native DSH adapter.

The [adapter guide](docs/implementation/model-policy-adapters.md) includes a local vLLM /
remote OpenAI-compatible model example and a runnable WebSocket policy-to-action-gate
CPU example. The host-to-Python worker bridge has actual RoboCasa reset, image
transport, learned control and confirmed-stop acceptance. Complete live task
acceptance is tracked in the [integration guide](docs/implementation/live-integration.md).

The [GPU integration guide](docs/implementation/gpu-integration.md) records isolated
environments, pinned simulator sources, actual NVIDIA rendering and a RoboCasa task
reset with three native camera observations, native action admission and actual VLM
image/tool checks. Simulator-to-policy task completion
remains pending.

## Design commitments

- Define teams through role files and bindings; roles are not a fixed enum.
- Every new delegation gets a fresh context and an explicit task brief.
- The upper decision owner controls retry, replan and resume.
- The verifier can pause, monitors asynchronously, and must verify at budget expiry.
- Recovery skills serve planning and verification; publication requires formal
  success of the original recovery goal.
- Simulation comes first; hardware contracts remain explicit and real-device
  support requires its own verification.

See [DSH provenance](docs/provenance/README.md) for the pinned source baseline
and the [integration guide](docs/implementation/dsh-integration.md). EDH is not an official DeepSeek product.
