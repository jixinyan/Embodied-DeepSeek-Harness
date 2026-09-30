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
Use port `0` in both configurations for independently allocated Session ports.
The service atomically publishes its actual port, process and task identity after
binding. The worker checks its owned listening socket before connecting once.
Select `direct`, `hybrid` or `policy` through the existing admitted
profile. Hybrid/learned profiles additionally require a real compatible policy
endpoint and checkpoint identity. Model credentials remain environment variables.
The worker disconnects its owned service when the user Session releases resources.

## Acceptance

Independent SDK checkouts, isolated native packages and the content-verified
asset copy are provisioned. Native manual-control check
`efc74efc-5c30-4b1b-9173-5c0c47d51039` passes reset, all three RGB-D sensors,
measured FK and numerical preparation with zero physical steps. Two actual
ActionGate controls pass confirmed pause, held counters, resume, terminal
`user_stop` and confirmed owned-process exit. Its unchanged native success
criterion returns false. This check exercises manual control boundaries;
task-success acceptance remains required.

Owned-service Astra run `c62651a0-f681-4303-9476-3c0301754833` passes two
actual controls across an operator pause and a Planner-owned resume. Cancellation
confirms `user_stop`, closes Session `f7625b8c-72b6-46c2-9f68-3e188d4617a9`,
releases resources and exits native process `149702`. Its audit validates all
204 events, one upper Session, two independently scoped execution-policy Sessions,
two sensor/control boundaries and zero formal verdicts. The service initializes
with port `0` and verifies its atomically published process/task/port identity.
The recorded 6,417 module origins contain no LitchiAgent or GPT-as-Policy path.
This check validates control lifecycle and cancellation; it does not measure
task success, recovery or experience publication.

The selected native SDK dependency metadata requires Starlette `0.49.1` while
Isaac Sim `5.1.0.0` requires FastAPI `0.115.7`, which requires Starlette below
`0.46.0`. The environment provisioning command finishes with `pip check` and
reports this upstream dependency conflict. Native manual-control evidence does
not certify a clean dependency installation.
