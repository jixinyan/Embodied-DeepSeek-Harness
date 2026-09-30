# Independent RoboDojo deployment

EDH owns the native service entry point and numerical tool service in
[`environments/robodojo`](../../harness/physical-runtime/src/physical_harness/environments/robodojo/README.md).
The process imports the installed RoboDojo simulator SDK and its native dependencies.
Its model calls use EDH's existing cloud/local adapters and DSH policy Sessions.

## Required deployment paths

Keep isolated environments in `.local/envs`, pinned simulator SDKs in `.local/deps`,
assets in a configured `data/robodojo/Assets` directory and model weights in
`checkpoints/robodojo`. The SDK's `Assets` link points to the configured data
directory. Dependencies and assets are local installations and are not published
with EDH source.

[`scripts/provision-robodojo.py`](../../scripts/provision-robodojo.py) can provision
independent copies from an existing authorized installation. Its `source` stage
creates complete Git checkouts without object alternates, sets their official
origins and checks exact source revisions. Its `assets` stage copies the assets,
compares their contents and binds the SDK to the configured data directory. Its
`environment` stage creates a separate Conda environment from explicit native
package versions, copies installed binary dependencies, and installs native SDK
packages from the EDH-owned dependency directory. Runtime caches and editable
package redirects are excluded from the dependency copy. Bootstrap input directories
are required only while installing dependencies.

| Dependency | Revision |
| --- | --- |
| RoboDojo SDK | `726e9aabfaa642203722eb126f5eaf0f37f3e1ad` |
| IsaacLab SDK | `afca7b09d60d8beb9c1cb28b43066499940b969b` |
| cuRobo SDK | `d17b54ce32cba095c0b000c4c58777075d11de0e` |
| XPolicyLab | `bb9a0b5f5136a74503b679af830bfd0a3a837d5c` |

## Launch configuration

The following paths illustrate an installation layout; supply actual absolute
paths on the deployment host. `output` must name a fresh directory.

```json
{
  "python": "/workspace/edh/.local/envs/robodojo-sim/bin/python",
  "workspace": "/workspace/edh",
  "sdk": "/workspace/edh/.local/deps/robodojo",
  "data": "/workspace/data/robodojo",
  "output": "/workspace/edh/.local/work/episodes/tower-001",
  "task": "build_tower",
  "port": 19213,
  "gpu": "0",
  "evalSeed": 0,
  "nvrtcLibrary": "/workspace/edh/.local/deps/nvrtc/lib/libnvrtc.so.12",
  "graphicsLibraryDirectory": "/workspace/edh/.local/deps/graphics"
}
```

```bash
python examples/deployments/start_robodojo.py --configuration deployment.json
```

GPU visibility is deployment configuration. The service checks the selected GPU's
compute capability against the installed NVRTC compiler's supported architectures.
Graphics libraries and NVIDIA driver manifests must belong to the deployment host.
The launcher preserves explicitly configured driver variables and provides private
cache and temporary directories inside `.local`.

Set the existing `robodojo-live.mjs` worker profile's
`sceneConfiguration.service_configuration` to the service configuration file,
with the same native task and loopback port. Session initialization starts the
owned service and waits for its actual listening socket. Each initialization
creates a unique episode output beneath the configured output directory.
Session resource release closes the connection and waits for confirmed process exit.
Select `direct`, `hybrid` or `policy` through the existing admitted
profile. Hybrid/learned profiles additionally require a real compatible policy
endpoint and checkpoint identity. Model credentials remain environment variables.
The worker disconnects its owned service when the user Session releases resources.

## Acceptance

Compilation and source checks pass for the service and launcher. Independent
SDK/environment/asset provisioning and real service acceptance are in progress.
Required checks are native reset, measured FK, all three RGB-D sensors, numerical
preparation, actual ActionGate controls, Planner-owned pause/resume, operator
cancel and process/resource release. Previous acceptance evidence using a separate
native service does not certify this new deployment.
