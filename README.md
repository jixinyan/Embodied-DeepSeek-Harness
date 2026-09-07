# Embodied DeepSeek Harness

**Composable agent teams for embodied intelligence.**

EDH is an independent physical-agent framework designed around user-defined
teams, explicit context handoff, replaceable tools and policies, asynchronous
verification, and reusable recovery experience. Its agent runtime will absorb
selected DeepSeek Harness implementations, with traceable provenance.

> **Architecture skeleton — no runnable agent system yet.**
> This repository contains module interfaces, configuration examples, source
> schemas, Python protocols and development documentation. DSH runtime integration,
> simulator support, device control and the console are not implemented.

[中文说明](README.zh.md) · [Project spec](docs/project-spec.md) ·
[Implementation plan](docs/implementation/plan.md) ·
[Current status](docs/implementation/progress.md)

![Framework architecture](docs/architecture/assets/framework-overview.svg)

## Find your way

| Location | Responsibility |
| --- | --- |
| [apps/server](apps/server/README.md) | Application composition and host entry |
| [apps/console](apps/console/README.md) | Physical control panel |
| [packages](docs/architecture/modules.md) | Agents, teams, models, tools, tasks, verification and memory |
| [python/physical_harness](python/physical_harness/README.md) | Policy, simulator, embodiment and hardware boundaries |
| [examples](examples/README.md) | User-defined roles, teams, tools and skills |
| [tests](tests/integration/README.md) | Future behavioral acceptance suites; fixtures are synthetic |
| [docs](docs/README.md) | Architecture, decisions, implementation steps and handoff |

## Check the skeleton

Use Node.js 22.19+ (the bootstrap was checked on Node 25), pnpm 11.19.0 and
Python 3.11+. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
```

These commands check generated schema types, example structure/references,
TypeScript interfaces, documentation links and Python importability. They do
**not** start a model, simulator, server or console. No GPU or model key is needed.
The Python command defaults to `python3`; override `EDH_PYTHON` for the check if needed.

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
and planned absorption. EDH is not an official DeepSeek product.
