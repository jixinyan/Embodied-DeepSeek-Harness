# robocasa

`RoboCasaEnvironment` binds RoboCasa 1.0.1, robosuite 1.5.2 and MuJoCo 3.3.1 to
PandaOmron's `HYBRID_MOBILE_BASE` controller. It validates the native 12-channel
layout, normalized limits and 20 Hz control frequency after the actual scene reset.
The last channel is `base_mode`. Session configuration selects a seed and split or
explicit layout/style IDs, plus texture and camera randomization settings. Unknown
or conflicting fields fail. A later upper task must use the same native task ID;
`bind_task` preserves the current scene.

Three 256 × 256 RGB cameras and the five proprioception arrays used by the official
PandaOmron GR00T mapping are captured as native observations. The only registered
formal check is RoboCasa's task success predicate under `task_success`. The adapter
does not expose active camera movement. `step` calls one actual robosuite control
step and reports the measured MuJoCo internal step count. A manually specified
neutral control action passed one step with 25 internal steps in the isolated GPU
environment. That check did not execute a learned policy or complete the task.

Simulator calls must stay on the execution worker's owner thread. The adapter alone
does not publish upper agent updates, image references or formal verdicts.
