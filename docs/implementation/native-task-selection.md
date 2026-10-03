# Native task selection

Deployment task catalogs bind one actual `worker.nativeTaskId` to their catalog
definition and criteria. The native worker validates each requested
`task_success` check against its initialized provider. A retained environment
keeps its native task and scene; selecting another native task creates a new
Session environment. New task declarations retain the same Planner authority,
ActionGate and independent post-execution verification.

## RoboTwin

`RoboTwinEnvironment` selects the installed `envs/<native_task_id>.py` class and
`description/task_instruction/<native_task_id>.json` instruction. Its scene
configuration accepts:

- `seed`: a nonnegative integer, default 0.
- `task_config`: the installed configuration filename without `.yml`, default
  `demo_clean`.
- Existing frame sampling, frame limit and denoiser settings.

Selected configurations must declare `aloha-agilex`. Every initialized task
validates the original 14 action channels, native joint/gripper limits,
three 640×480 RGB cameras and physics timestep. Formal `task_success` calls the
selected task's native `check_success()`.

The current `adjust_bottle` metadata preserves its sampled model/orientation.
Other tasks publish their own task/configuration/seed identity and timing
without requiring bottle-specific attributes. Selecting `demo_randomized`
uses its installed domain-randomization configuration with the same validated
body/controller mapping.

## BEHAVIOR

`BehaviorEnvironment` reads the installed GR00T BEHAVIOR `available_tasks.yaml`
and selects its exact activity identity and `scene_config_id` (default 0).
`instance_id` selects a prepared 2025 challenge instance from zero through nine.
The selected native instance file must exist under the configured
`OMNIGIBSON_DATA_PATH`; its identity is checked again against the actual
OmniGibson cached-scene filename after native initialization.

The source activity name supplies the display instruction. Selected activities
retain the R1Pro controller, native 23-channel action limits, three RGB cameras,
258-value proprioception and official simulation timing. Formal `task_success`
queries the current compiled BDDL goal directly.

## Installed-source evidence

On October 3, `scripts/check-native-task-catalog.py` executed the production
selection functions against the actual `jd_B300` source/data directories:

- All 50 RoboTwin original task instructions resolve to their actual named SDK
  class and source-defined `check_success` method.
- Both installed `demo_clean` and `demo_randomized` declare `aloha-agilex`.
- The BEHAVIOR SDK catalog contains 74 activity/scene configuration entries.
- The ten installed `picking_up_trash` instance files resolve to the selected
  source scene and contain actual R1Pro robot poses.

The read-only evidence retains each native instruction/module SHA256,
the BEHAVIOR catalog SHA256 and each prepared instance SHA256 under
`.local/work/v1-task-catalog-20261003/catalog-acceptance.json` on both checked
hosts. It executes zero simulator resets and zero physical controls; task
completion acceptance remains false for this source-discovery check.

The existing model-driven `adjust_bottle` and `picking_up_trash` evidence keeps
its original task outcome. Newly configured tasks, randomized scenes and other
BEHAVIOR activities require actual reset, compatible policy inference,
ActionGate controls, stopped acknowledgement and fresh formal verification
before receiving task acceptance.
