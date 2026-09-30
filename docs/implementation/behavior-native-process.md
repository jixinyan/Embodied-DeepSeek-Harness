# BEHAVIOR native process and lifecycle

The BEHAVIOR provider uses a synchronous simulator process. OmniGibson import,
environment initialization, observations, controls, native checks and shutdown
execute on that process's main thread. The existing async worker retains its
ActionGate, policy client and dedicated NativeActionDevice owner.

## Deployment

The [BEHAVIOR deployment](../../examples/deployments/behavior-live.mjs) loads
`EDH_BEHAVIOR_CONFIG`. Its [Team](../../examples/teams/behavior-live.yaml) uses
built-in Planner and Verifier roles, with `learning_enabled: false`.

The worker and simulator use separate Python environments. Set
`EDH_BEHAVIOR_NATIVE_PYTHON` to the absolute native environment executable.
`EDH_BEHAVIOR_NATIVE_TIMEOUT_S` bounds native operations; its default is 900 seconds
and its supported range is greater than zero through 1800 seconds. The process
preserves the supplied executable path so its virtual environment remains active.

The TypeScript deployment defaults `initializeTimeoutMs` to 600000 and
`closeTimeoutMs` to 900000. Explicit worker configuration may override either
value within the transport's 1–1800000 millisecond range. Device selection,
native data, graphics libraries, source directories and checkpoint paths remain
deployment configuration.

Pinned acceptance bindings are OmniGibson 3.9.2 / BEHAVIOR-1K
`b1979916ec1549b10a4e65e630bc6504a9af1b00`, Isaac Sim 5.1.0, Isaac-GR00T
`9b37aa1ce69c73c6d165233fa88128283bba4508`, and
`nvidia/GR00T-N1.6-BEHAVIOR1k@300db814db8ab5dd010026d5631f280048d06b91`.
The policy uses the official `BEHAVIOR_R1_PRO` mapping, three native 256×256 cameras,
21 state groups and 23 native action channels at 30 Hz, with 120 Hz physics.

## Control and process boundaries

The provider sends bounded messages over an inherited socket connection to its
own child. Each request and response carries a request identity and native PID.
Messages are limited to 32 MiB. A watchdog covers sends and receives, including
partially transferred messages, and terminates the owned child at its deadline.
Failures prevent further native operation admission and retain their cause.

Each native step commits one control. Pause and terminal stop prevent subsequent
controls from starting and wait for an active synchronous native control to finish.
An active control has no internal immediate-interruption guarantee. Subsequent
executions and tasks retain the scene and use fresh admitted identities.

Native shutdown stops viewport USD watching, clears simulator scene resources,
releases registered `omni.ui.Workspace` show-window callbacks, checks that their
registry is empty, and runs full `og.shutdown()` with `/app/fastShutdown=false`.
The [Workspace API](https://docs.omniverse.nvidia.com/kit/docs/omni.ui/latest/omni.ui/omni.ui.Workspace.html)
documents callback registration and removal; the
[NVIDIA extension example](https://github.com/NVIDIA-Omniverse/kit-extension-sample-ui-window/blob/main/exts/omni.example.ui_gradient_window/omni/example/ui_gradient_window/extension.py)
removes its callback during extension shutdown. The
[SimulationApp API](https://docs.isaacsim.omniverse.nvidia.com/5.1.0/py/source/extensions/isaacsim.simulation_app/docs/index.html)
documents native application close.

Close acknowledgement follows the actual native close call. Parent close waits
for child exit 0 using the remaining shared shutdown deadline. Abnormal exit,
missing acknowledgement or expired shutdown remains an error. The TypeScript
transport separately requires worker close acknowledgement and actual worker exit 0
before releasing the User Session.

## Actual acceptance

The real lifecycle checker completed 18 controls / 72 physics steps, pause/resume,
another execution on the retained scene, and terminal stop. Requests made during
native controls were confirmed after 0.198189 seconds for pause and 0.226912 seconds
for terminal stop. Native timestep indexes stayed unchanged after confirmation.
The longest control took 1.105446 seconds. Full SDK shutdown returned and the
native process and checker both exited 0.

The actual console run `c9c3809c-374c-437f-b131-12977a44044a` completed 16 controls /
64 physics steps with a real Qwen Planner, independent Qwen Verifier and one GR00T
inference. The confirmed `budget_exhausted` boundary received a formal failed
verdict with `task_success=false`. The simulated duration was 16/30 seconds.
Both role Sessions retired. The User Session closed with `resources=released`,
and its native worker and simulator exited. Three simulator videos each decoded 16
frames at 256×256 with increasing native timestamps.

This console source audit retains one rejected Planner `planning.update` call.
Original-goal success and a complete run without upper tool errors remain pending.
The later Planner instruction update has no additional BEHAVIOR live acceptance
in this checkpoint. An actual 1-second native initialization deadline produced an
explicit timeout, nonzero checker exit and no surviving child.

The [policy checker](../../scripts/check-behavior-policy-rollout.py) records native
controls and lifecycle evidence. Source compilation and import checks certify only
the checked source behavior; the native and console results above have separate
actual process evidence.
