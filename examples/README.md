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

The household/SAM/deployment examples describe future physical bindings and do not
install providers or start robots. Runtime role/report acceptance uses explicit CPU
fixtures. See [the extension guide](../docs/implementation/upper-runtime.md).

## Executable endpoint examples

- [OpenAI-compatible console binding](deployments/openai-compatible.mjs): requires
  an actual configured model endpoint; physical state remains a CPU fixture.
- [WebSocket policy roundtrip](policies/websocket_roundtrip.py): local inference
  callback, action gate and synthetic device; no model or simulator required.

See [configuration and limits](../docs/implementation/model-policy-adapters.md).
