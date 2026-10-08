# Extending EDH

1. Read [the household team](teams/household.yaml).
2. Follow `builtin:planner` to [the canonical role](../harness/agent-runtime/agents/roles/planner/ROLE.md).
3. Inspect [a user-defined scene analyst](roles/scene-analyst.md).
4. See [a SAM tool binding](tools/sam-segmentation.yaml) and
   [the deployment boundary](deployments/behavior.yaml).
5. Inspect [a recovery skill](skills/recovery-check/SKILL.md).

[console-demo.yaml](teams/console-demo.yaml) is the running `pnpm demo` team.
[reporting.yaml](teams/reporting.yaml) adds a [scene reporter](roles/scene-reporter.md)
with a [custom result schema](roles/schemas/scene-assessment.json); it demonstrates
configuration and needs a model that performs that role's report protocol. The default
console fixture model does not generate arbitrary custom-role behavior.

The SAM example describes the implemented native tool and its optional loopback
service binding. The household/deployment examples remain illustrative and do not
install providers or start robots. See
[the extension guide](../docs/implementation/upper-runtime.md).

## Executable endpoint examples

- [Cloud API and local vLLM configurations](models/README.md): declarative upper
  model bindings for an installed deployment, with explicit credential references.
- [OpenAI-compatible console binding](deployments/openai-compatible.mjs): requires
  an actual configured model endpoint; physical state remains a CPU fixture.
- [WebSocket policy roundtrip](policies/websocket_roundtrip.py): local inference
  callback, action gate and synthetic device; no model or simulator required.

See [configuration and limits](../docs/implementation/model-policy-adapters.md).

Native policy service examples import their production `main` functions from
[`physical_harness.policies.services`](../harness/physical-runtime/src/physical_harness/policies/services/README.md).
The module guide identifies each checkpoint adapter, runnable module and example
entry. Deployment configuration owns the selected environment, endpoint and GPU.
