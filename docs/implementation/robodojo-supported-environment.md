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

The candidate contains `isaaclab`, `isaaclab_assets`, `isaaclab_tasks`,
`isaaclab_mimic` and `isaaclab_rl`. Install their original declared dependencies
with normal dependency resolution. The [official RoboDojo installation source](https://github.com/RoboDojo-Benchmark/RoboDojo/blob/726e9aabfaa642203722eb126f5eaf0f37f3e1ad/scripts/install.sh)
specifies Torch 2.7.0 with CUDA 12.8, Isaac Sim 5.1, NumPy 1.26.0,
Pillow 11.3.0 through the SDK and Starlette 0.45.3 through its runtime constraints.
Record the complete resolved package manifest and require `python -m pip check`
to pass before native admission. Dependency resolution for this candidate has
not yet been accepted.

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
Source syntax checks cover 848 official IsaacLab and 112 RoboDojo Python files.
These checks do not establish native behavior equivalence.

Acceptance requires actual initialization and GPU graphics/compute placement,
zero-control reset/camera/calibration/GT checks, original physics counter
provenance, one genuine learned action and confirmed stop/close, then the
complete unchanged benchmark task workflow with source-bound receipts,
observations, videos, independent formal verification and released resources.
Task execution in this candidate remains pending. Existing retained demos
continue to identify their original source and environment independently.
