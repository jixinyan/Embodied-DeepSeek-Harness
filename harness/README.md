# The EDH harness

This directory contains the agent and physical runtimes of EDH, with one shared
wire-schema source.

| Directory | Responsibility |
| --- | --- |
| `agent-runtime/` | Agent cooperation, decisions, tools, verification and memory |
| `physical-runtime/` | Policy execution, simulator/device I/O and physical fact providers |
| `contracts/` | Shared message, observation, action and result schemas |

[Agent runtime](agent-runtime/README.md) ·
[Physical runtime](physical-runtime/README.md) ·
[Contracts](contracts/README.md) ·
[Source entry points](../docs/development/code-map.md)

## Runtime responsibilities

The common parent records framework ownership. Explicit runtime responsibilities
keep model latency, physical control, device dependencies and failure handling
visible. Both runtimes can operate on the same host; configured process connections
also permit a worker near the simulator or robot.

For example, to put a cup in a cabinet, the agent runtime selects a subgoal, sends its
IDs/criteria/budget, and runs the independent verifier. The physical runtime advances
the selected policy and supplies observations, job state and limited check facts. The
verifier submits the formal result; the upper Planner chooses retry/replan/resume.
The Python worker returns physical observations, actions and confirmed boundaries;
the configured decision owner retains task authority. Agent communication always
uses explicit messages and independent contexts.

The [architecture](../docs/architecture/modules.md) describes module ownership.
The [v1 delivery register](../docs/implementation/v1-delivery.md) records actual
acceptance and remaining release requirements.
