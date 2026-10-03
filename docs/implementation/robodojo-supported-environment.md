# RoboDojo native environment admission

The recorded native environment uses RoboDojo
`726e9aabfaa642203722eb126f5eaf0f37f3e1ad`, its IsaacLab fork
`afca7b09d60d8beb9c1cb28b43066499940b969b`, Isaac Sim 5.1.0.0 and Python 3.11.
Its complete dependency check remains unsuccessful. Original Isaac Sim kernel
metadata requires FastAPI 0.115.7, whose Starlette requirement is
`>=0.40.0,<0.46.0`; this IsaacLab distribution requires Starlette 0.49.1.
Initialized Kit selects its bundled FastAPI 0.115.7 and Starlette 0.45.3.
Native TCP execution, observations and task audits retain their measured scope.
This environment does not complete the dependency-clean installation gate.

## Candidate requiring a new native acceptance

The proposed independent candidate uses official IsaacLab **v2.3.0** source at
`3c6e67bb5c7ada942a6d1884ab69338f57596f77` in an independent environment and
independent RoboDojo checkout. Its [release compatibility table](https://github.com/isaac-sim/IsaacLab/blob/3c6e67bb5c7ada942a6d1884ab69338f57596f77/README.md)
supports Isaac Sim 5.1. The original [complete core dependency declaration](https://github.com/isaac-sim/IsaacLab/blob/3c6e67bb5c7ada942a6d1884ab69338f57596f77/source/isaaclab/setup.py)
requires Starlette 0.45.3, Pillow 11.3.0, Gymnasium 1.2.0, FlatDict 4.0.1,
NumPy below 2 and Torch at least 2.7. The IsaacLab Python distribution version
is 0.47.2. Retain original RoboDojo, cuRobo, XPolicyLab, assets, checkpoint,
native task predicates, seed, horizon and physics configuration.
The selected native profile must bind both its independent Python interpreter
and RoboDojo SDK checkout. EDH's launcher prepends the SDK's
`third_party/IsaacLab/source/isaaclab` and `third_party/curobo` to `PYTHONPATH`.
That IsaacLab directory must resolve to the selected official source revision.
Retain actual module-origin hashes together with distribution metadata during
native admission.

The candidate contains `isaaclab`, `isaaclab_assets`, `isaaclab_tasks`,
`isaaclab_mimic` and `isaaclab_rl`. Install all five in editable source mode,
as prescribed by the [official installer](https://github.com/isaac-sim/IsaacLab/blob/3c6e67bb5c7ada942a6d1884ab69338f57596f77/isaaclab.sh),
with normal dependency resolution. The [official RoboDojo installation source](https://github.com/RoboDojo-Benchmark/RoboDojo/blob/726e9aabfaa642203722eb126f5eaf0f37f3e1ad/scripts/install.sh)
specifies Torch 2.7.0 with CUDA 12.8, Isaac Sim 5.1, NumPy 1.26.0,
Pillow 11.3.0 through the SDK and Starlette 0.45.3 through its runtime constraints.
Record the complete resolved package manifest and require `python -m pip check`
to pass before native admission. A normal pip 26.2.1 dry-run against the recorded
installed environment accepts all five original package dependency declarations.
Its eight installation entries are the five IsaacLab packages, FlatDict 4.0.1,
Gymnasium 1.2.0 and Starlette 0.45.3. The original report SHA-256 is
`7991ffaa27cb70117f422b253efa7d6e90053d30e1a428718134905015ef3195`.
This check leaves the shared environment unchanged.

FlatDict 4.0.1 uses `pkg_resources` during its original source build. Use pip's
`--build-constraint` with `setuptools==80.9.0` for isolated build environments.
This preserves the original package build and complete runtime dependency
resolution. Retain the build constraint alongside the runtime constraints and
resolved installation report.

## Independent installed environment

The independent Python 3.11.16 candidate contains 305 installed distributions.
Its complete `python -m pip check` passes with `No broken requirements found.`
Actual CPU imports pass for FastAPI, Starlette, FlatDict, Gymnasium, NumPy and
Pillow. The installed editable IsaacLab module resolves to the exact independent
official source; 12 benchmark API files match their original SHA-256 values.
Every installed distribution's owning metadata file is inside the independent
environment and has a retained SHA-256. The installed package manifest,
editable-source report, original runtime/build constraints and installation
logs are retained together.
The acceptance report SHA-256 is
`3c3f21e4cd75695e83b459a5b5aca5fea9c04b22211f4ecfb5d5aa1fc50b7006`.
EDH integration dependencies identify frozen source
`6bcb8cb9afb7479acdf146e0f456948fa14fe918` and its `robodojo-server,recording`
extras. A newly selected EDH source must install its declared dependencies and
pass the complete check before native allocation.

This acceptance covers installed dependencies, CPU imports and original source
identity. Native initialization, GPU graphics/compute placement, physics/render
equivalence, learned controls and benchmark task acceptance remain pending.
Changing the production SDK source requires an explicit deployment decision.

## Native behavior that must be verified

The vendored fork's own commit changes one file, `app/app_launcher.py`:
camera defaults, offscreen rendering, experience selection and the
`/isaaclab/cameras_enabled` setting. EDH already explicitly enables cameras.
The official launcher accepts an explicit experience; any required camera
launch binding must be represented in EDH configuration and use the original
SDK API. Preserve original vendor files and distribution metadata.

The official release also precedes upstream changes to reset rendering,
articulation wrench handling, scene views and `SimulationContext.forward`
kinematics/fabric updates. The inspected benchmark API definitions exist
in the candidate, including `CustomDirectRLEnv`'s inherited stepping fields,
scene writes/updates, articulation targets and `find_global_fixed_joint_prim`.
Python 3.11.16 source syntax checks cover 848 official IsaacLab and 112 RoboDojo
Python files. All 22 original default PhysX keys and 13 default rendering keys
are declared in the official `PhysxCfg` and `RenderCfg` classes.
These checks do not establish native behavior equivalence.

Acceptance requires actual initialization and GPU graphics/compute placement,
zero-control reset/camera/calibration/GT checks, original physics counter
provenance, one genuine learned action and confirmed stop/close, then the
complete unchanged benchmark task workflow with source-bound receipts,
observations, videos, independent formal verification and released resources.
Task execution in this candidate remains pending. Existing retained demos
continue to identify their original source and environment independently.
