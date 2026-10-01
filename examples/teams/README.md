# Teams

`harness/agent-runtime/teams/src/loader.ts` loads a Team YAML file, resolves each
ROLE definition, validates model/tool bindings and freezes the resulting role
configuration. Relative role paths resolve from the Team file. Responsibility
bindings select the decision owner, formal Verifier and optional recovery Evolver.
Deployment assembly supplies the available model and tool providers.

`household.yaml` includes a user-defined Scene Analyst. `reporting.yaml` includes
an evidence-bound Scene Reporter with a declared JSON output schema. Native
RoboTwin, RoboCasa, BEHAVIOR and RoboDojo configurations select their own embodiment,
task instructions and provider bindings. Current live Teams disable recovery learning.

To add a role, create a ROLE Markdown file with `role_id`, `description`, `tools`
and an optional `output_schema`, then reference that file from `members` in the
Team YAML. Schema paths resolve from the ROLE file. Roles receive native framework
report/query tools in addition to their declared tools.

Planner delegates with an explicit InvocationBrief containing the objective,
task context, authorized evidence references and expected result. The new role
receives its own DSH Session. It reads authorized evidence, reports through
`agent.report`, and uses the returned version for subsequent report updates.
Planner inspects and acknowledges the report before making the next task decision.

The [recorded demos](../../docs/implementation/recorded-demos.md) and
[v1 acceptance register](../../docs/implementation/v1-delivery.md) distinguish
configuration support from actual native-model workflow acceptance.
