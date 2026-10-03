# Native workspace deployment

`examples/deployments/native-workspace.mjs` composes configured native deployments
into one Console and workspace. Environment, embodiment, execution mode, checkpoint
and model selectors continue to resolve complete compatible launch profiles.
Each profile retains its own trusted Team file and role directory, so R1Pro and
arm-based environments can use different planning and verification prompts.
Profile selection displays its resolved Team before allocating a Session.

Create an actual workspace JSON, for example `.local/native-workspace.json`:

```json
{
  "version": 1,
  "modelConfiguration": "../examples/models/qwen38-vllm.yaml",
  "dataDirectory": "native-sessions",
  "consolePort": 4324,
  "deployments": {
    "dojo": { "provider": "robodojo", "configuration": "profiles/robodojo.json" },
    "twin": { "provider": "robotwin", "configuration": "profiles/robotwin.json" },
    "casa": { "provider": "robocasa", "configuration": "profiles/robocasa.json" },
    "behavior": { "provider": "behavior", "configuration": "profiles/behavior.json" }
  }
}
```

Every referenced provider file must contain its real native worker, installed
scene/task catalog, checkpoint and policy endpoint as described in the
[native deployment guide](../../examples/deployments/README.md). Paths in the
workspace JSON resolve relative to that JSON. Provider-specific configuration
continues to use its existing path rules. The common model configuration overrides
each provider's model file and may define both local vLLM and cloud API aliases.
Each profile's `plannerModel` selects one of those aliases. Credentials stay in
the configured local environment.

The supported native provider identifiers are `robodojo`, `robotwin`, `robocasa`
and `behavior`. Multiple groups may use the same provider with different Teams,
tasks or checkpoints. Group IDs contain at most 40 characters. Profiles are
namespaced as `<group>.<profile>` and must fit the existing 80-character profile
limit. Their labels include the group, and each selected combination retains the
original policy/checkpoint identity. Component selectors never combine incompatible
profiles. Close the current Session before selecting and allocating another.

The workspace owns one native DSH host, common configured models and the existing
image/tool services. All provider configurations must declare identical optional
SAM, YOLO and camera-intrinsic bindings. Conflicting declarations fail during
configuration loading. Simulator-specific calibrated measurement continues through
the selected native backend. Each provider's ordinary environment factory owns its
worker, scene, action resources and policy mode; imported modules and service
startup allocate no simulator or model inference.

For the Desktop launcher, select `native-workspace.mjs` as the deployment and set
`EDH_NATIVE_WORKSPACE_CONFIG` in its environment file. The launch configuration
still supplies its own workspace directory and may use port `0`. The configured
workspace console port is a valid fixed port for direct execution:

```sh
EDH_NATIVE_WORKSPACE_CONFIG=/absolute/path/native-workspace.json \
pnpm exec tsx --tsconfig tsconfig.runtime.json examples/deployments/native-workspace.mjs
```

The provider factories retain their existing managed-service leases. `/api/services`
namespaces each inspection identity by group; commands and credentials remain
private. Server close awaits all owned service lifecycles and preserves cleanup
errors. Native record and image retention use the existing complete ownership
policy, including the selected Team, immutable Session catalog and independent task
contexts. Restart never resumes physical actions automatically.

Actual startup, selector, task switching and confirmed cleanup require retained
production records. Source checks alone establish no model or simulator outcome.

## Configuration and Console acceptance

The 2026-10-03 production startup reads four original native configuration files,
loads their distinct Teams and exposes four compatible profiles from one server.
Actual browser selection checks each environment's embodiment, policy and exclusive
checkpoint choice. RoboTwin displays its configured SceneAnalyst in both the Team
graph and assignment sidebar. Teams with learning disabled display that state in
the workflow and recovery panels. The browser reports zero errors or warnings.
Normal server shutdown releases the writer lock and closes the loopback listener;
all four original configuration hashes remain unchanged.

Evidence: `.local/work/native-workspace-20261003/`. This accepts configuration,
Team projection, selection and shutdown without allocating a simulator or invoking
a model. Native task execution and switching allocated environments retain their
own source-bound acceptance requirements.
