# Native metric measurements

RoboCasa, RoboTwin, BEHAVIOR and RoboDojo expose source-bound masked RGB-D
measurements through `perception.measureObject`. An explicit stationary capture
identifies the original PNG. The mask must be a binary PNG with the same dimensions.
The physical worker requires an unchanged capture and confirmed stopped controls;
native SDK access remains on the device owner thread. Results identify the simulator,
camera, image and mask SHA-256, calibration, simulator time and world coordinate frame.

The measurements describe visible valid surface points in meters. Axial depth uses
the optical camera's right/down/forward axes. A visible surface centroid provides
camera and world coordinates. Native depth and calibration supply geometry; model
labels and segmentation masks select the measured region. Native task success remains
the provider's independent authoritative completion check.

| Provider | Native depth | Native calibration | World frame |
| --- | --- | --- | --- |
| RoboCasa | MuJoCo depth converted by robosuite `get_real_depth_map` | robosuite camera helpers | `robocasa.mujoco.world` |
| RoboTwin | SAPIEN `Position` axial depth, native millimeters converted to meters | `intrinsic_cv`, inverse homogeneous `extrinsic_cv`, native clipping range | `robotwin.sapien.world` |
| BEHAVIOR | OmniGibson `depth_linear` / `distance_to_image_plane` | `VisionSensor.intrinsic_matrix`, world pose and native clipping range | `behavior.omnigibson.world` |
| RoboDojo | Native `distance_to_image_plane` annotator | Isaac Camera intrinsics, USD world pose and clipping range on a meter-based stage | `robodojo.isaac.world` |

RoboTwin, BEHAVIOR and RoboDojo retain one immutable calibrated snapshot for their
latest native observation. BEHAVIOR carries measurement requests through its
bounded native process connection. RoboDojo carries native depth and calibration
through its existing simulator RPC and records numeric arrays in episode observations.
RoboCasa captures read-only metric depth and verifies the original image identity.

Set `EDH_METRIC_RECORD_DIR` to retain actual measurement source PNGs, masks,
`calibration.npz` arrays and `measurement.json`. BEHAVIOR's native process inherits
this variable. No records are produced unless a measurement is requested.
`scripts/check-recorded-metric.py --record DIRECTORY` recomputes the measurement
through production metric geometry and compares every calculated value with the
original record. Identity, calibration and pixel-count fields remain exact;
derived back-projected coordinates/range use a reported float64 accumulation
allowance with their measured differences. `--output .local/work/<new-file>.json`
retains source hashes and the complete numeric comparison. See
[CPU geometry checks](cpu-release-validation.md#native-geometry-and-role-records).

RoboDojo action receipts include the actual Isaac SimulationContext physics counter
before and after each admitted command, its physics timestep and simulator time.
The worker uses this counter difference for `raw_sim_steps` and sampled frame indices.
RoboDojo interpolates targets over native control intervals and applies configured
physics decimation. A control command can therefore execute multiple physics steps.
Historical receipts without native counter provenance retain their reported counts
and require separate source evidence for a physical-step claim.
`scripts/audit-recorded-run.py --robodojo-episode-root DIRECTORY` verifies each
worker receipt against the retained native episode action, observation calibration,
simulator clock and hashed SDK source files. RoboDojo audit reports keep
`reportedNativeSteps` separately and populate `nativePhysicsSteps` when this source
audit succeeds. An omitted episode source leaves physical-step acceptance unavailable.

The implementation passed Python compilation, TypeScript checks and installed SDK
source/API inspection. Live metric and new physics-counter acceptance requires
an actual native run with the retained measurement and episode sources.
