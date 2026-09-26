# The EDH harness

This directory contains one framework with two runtime responsibilities and a shared
wire-contract source:

```text
harness/
  agent-runtime/       # Agent cooperation, decisions, tools, verification and memory
  physical-runtime/    # Policy stepping, simulator/device I/O and physical fact providers
  contracts/           # Shared message, observation, action and result schemas
```

[Agent runtime](agent-runtime/README.md) ·
[Physical runtime](physical-runtime/README.md) ·
[Contracts](contracts/README.md)

## Why two runtimes inside one harness?

Repository placement and process boundaries answer different questions. A common
parent makes product ownership clear. Separate runtime responsibilities keep model
latency, physical control, device dependencies and failure handling explicit. The
runtimes can be deployed on the same host; their interfaces also permit a worker near
a simulator/GPU/robot later. This does not require two repositories or two products.

For example, to put a cup in a cabinet, the agent runtime selects a subgoal, sends its
IDs/criteria/budget, and runs the independent verifier. The physical runtime advances
the selected policy and supplies observations, job state and limited check facts. The
verifier submits the formal result; the upper Planner chooses retry/replan/resume.
The physical worker never acquires those decision privileges merely because it has
stopped executing actions.

“Physical harness” describes the whole framework, including planning, verification
and experience. Naming only the Python worker “physical-harness” would hide those
responsibilities. `agent-runtime` is broader than an agent-loop core; it also includes
team cooperation, task orchestration and domain tools.

**Status:** selected DSH services, application startup, native worker transport and
policy control are implemented. A real RoboCasa console run records 1,050 GR00T
controls and formal GT failure. RoboTwin and BEHAVIOR native resets return sensor
observations; remaining provider, perception, lifecycle and successful recovery
acceptance is tracked in the [v1 delivery register](../docs/implementation/v1-delivery.md).
