# Extending EDH

1. Read [the household team](teams/household.yaml).
2. Follow `builtin:planner` to [the canonical role](../harness/agent-runtime/agents/roles/planner/ROLE.md).
3. Inspect [a user-defined scene analyst](roles/scene-analyst.md).
4. See [a SAM tool binding](tools/sam-segmentation.yaml) and
   [the deployment boundary](deployments/behavior.yaml).
5. Inspect [a recovery skill](skills/recovery-check/SKILL.md).

**None of these examples starts agents, tools or robots.** Static schema and
reference checks run in `pnpm check:contracts`. Built-in role definitions have
one canonical location; wrappers in `roles/` link there. Provider registrations,
model/checkpoint compatibility and runtime authorization remain unimplemented.
