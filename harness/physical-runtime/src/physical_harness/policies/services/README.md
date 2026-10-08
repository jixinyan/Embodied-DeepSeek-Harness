# Native policy service launchers

These production modules own argument admission, checkpoint/upstream identity,
model initialization, inference records and service lifecycle. The example
scripts import their `main` function. Both entries use the same implementation;
installed deployment configuration selects the Python environment, endpoint,
checkpoint and GPU.

| Service | Production module | Example entry |
| --- | --- | --- |
| GR00T / RoboCasa | [gr00t_n1d6_robocasa.py](gr00t_n1d6_robocasa.py) | [serve_gr00t_n1d6_robocasa.py](../../../../../../examples/policies/serve_gr00t_n1d6_robocasa.py) |
| GR00T / BEHAVIOR | [gr00t_n1d6_behavior.py](gr00t_n1d6_behavior.py) | [serve_gr00t_n1d6_behavior.py](../../../../../../examples/policies/serve_gr00t_n1d6_behavior.py) |
| LeRobot Pi0.5 / RoboTwin | [lerobot_pi05_robotwin.py](lerobot_pi05_robotwin.py) | [serve_lerobot_pi05_robotwin.py](../../../../../../examples/policies/serve_lerobot_pi05_robotwin.py) |
| OpenPI / RoboDojo JSON bridge | [openpi_robodojo.py](openpi_robodojo.py) | [serve_openpi_robodojo.py](../../../../../../examples/policies/serve_openpi_robodojo.py) |
| Identified native OpenPI producer | [openpi_robodojo_native.py](openpi_robodojo_native.py) | [serve_openpi_robodojo_native.py](../../../../../../examples/policies/serve_openpi_robodojo_native.py) |

For example, `python -m physical_harness.policies.services.lerobot_pi05_robotwin`
accepts the same checkpoint/tokenizer/device/port arguments as its example entry.
Every module supports `--help` before optional model SDK imports. The four EDH
JSON servers bind their port before model initialization and open connection
admission only after readiness. The native producer uses the upstream OpenPI
server. It admits a fixed port in `1..65535`, verifies the complete pinned
checkpoint and writes its verification report before importing the model SDKs.
JAX device selection, trained-policy loading and upstream service startup follow
these filesystem checks.

[inference.py](../inference.py) owns model threads and records;
[server.py](../server.py) owns validated WebSocket transport. These launchers
select the provider-specific adapter. Original normalization/identity manifests
and the authoritative wire schema retain their existing repository locations.
The source checkout supplies those data files.

Use [policy startup validation](../../../../../../docs/implementation/cpu-release-validation.md#policy-service-startup)
for actual argument, occupied-port, original file-error and listener checks.
Loaded checkpoint/inference and task acceptance retain their
[native release requirements](../../../../../../docs/implementation/v1-delivery.md).
