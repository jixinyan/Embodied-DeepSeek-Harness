# RoboDojo simulation backend

EDH connects to a running RoboDojo simulator through
[`RoboDojoEnvironment`](../../harness/physical-runtime/src/physical_harness/environments/robodojo/__init__.py).
The adapter performs the native reset, metadata check, RGB observation capture,
14-dimensional dual-arm qpos action step, terminal success check and explicit
close. Every command is one action and therefore remains behind the existing
generation-fenced `NativeActionDevice` and `ActionGate`.

The connection uses the inspected RoboDojo RPC v1 framing: a bounded msgpack
packet compressed with zlib, NumPy extension type 42, request identity checking,
and no retry of a mutating request. A lost or malformed response closes the
connection; EDH never replays an uncertain action. `teacher_observation` is read
after each acknowledged `chunk_step`, preserving the simulator's exact
post-action camera boundary.

The RoboDojo SDK, Isaac Sim and native dependencies remain separately installed
and retain their source and asset licenses. EDH owns the simulator entry point,
RGB-D tools, FK validation and numerical motion service. Install optional client
dependencies in the worker environment:

```sh
.venv/bin/python -m pip install -e 'harness/physical-runtime[robodojo]'
```

EDH owns the upper and execution-policy DSH Sessions, model transport, policy
tools, worker client, execution lifecycle and ActionGate. The owned simulator service
starts through `physical_harness.environments.robodojo.launch` and
`physical_harness.environments.robodojo.server`. A configured
`service_configuration` gives Session initialization ownership of service startup
and confirmed shutdown. See [independent deployment](robodojo-standalone.md).

The native worker provider name is `robodojo`. Its scene configuration requires
`port` and accepts `host`, `seed`, `source`, `policy_version` and the optional
combination/audit identity fields. The adapter expects the RoboDojo metadata to
declare `action_dim=14`, cameras `cam_high`, `cam_left_wrist` and
`cam_right_wrist`, and a positive `control_dt`. The canonical ActionSpec is
`robodojo.environment_origin` qpos target with continuous grippers in `[0, 1]`.

On 2026-09-30, the
local Isaac Sim 5.1 `build_tower` server (RoboDojo revision `726e9aa`) also
passed a real EDH reset, three-camera RGB observation, metadata/action-spec
description and one admitted qpos step. The step returned one executed action,
one native simulation step and a nonterminal `task_success=false` check. This is
provider-boundary evidence only; it does not claim a completed task, learned
policy success or GPT-6 Astra request. A full policy rollout, interruption and
formal task-success acceptance retain independent recorded evidence.

## Verified Astra direct task

Run `2c974465-f035-4d1d-a913-fba5a4688c02` completes the native
`general_pickup` instruction "Pick up the mint green scissors by 10 cm."
Planner, execution policy and Verifier use three independent native DSH Sessions.
Astra direct inference uses the head and both wrist cameras, camera RGB-D
grounding, wrist depth and numerical motion preparation. ActionGate admits
42 controls across eight policy calls within the unchanged 200-step native budget.
Native episode termination confirms the stopped device boundary. The fresh
Verifier returns `passed` for `task_success=true`, then Planner completes its plan
and task. All 2,153 recorded events pass the real-run audit, and Session closure
releases the environment and exits its native simulator. The runtime source
record retains revision `5442c98` with `state=modified`; the deployment binds
the cloud Astra model and remote simulator explicitly.

Run `806e8b33-4764-4458-87fc-2f99443e63d6` verifies confirmed ordinary pause and
Planner-owned resume with cumulative control budgets. Run
`ac7133e1-c807-41ea-a0a6-fd76500755d8` verifies in-flight operator cancellation,
confirmed `user_stop`, no formal Verifier, Session resource release, native
simulator exit and continued console availability. Its 93-event audit passes.

The successful pickup contains no recovery or SKILL publication. Hybrid checkpoint
inference and recovery acceptance remain required. The replay/MP4 command and
source-integrity checks are documented in [recorded replay](../../scripts/REPLAY.md).

## Learned-policy service identity

The owned native OpenPI entry point and JSON bridge support
`edh.openpi.request_identity.v1`. Each inference carries the canonical EDH request
UUID and returns that UUID alongside the SHA-256 of its exact instruction, native
float32 state and three camera inputs. Checkpoint identity and imported policy
source hashes remain fixed across the connection. Global inference indices must
increase; other clients may consume intervening indices.

A bridge may connect to an already-used native service. A replacement connection
admits its current counter and uses a new request identity for each explicit
inference. Cancellation still discards the connection and an uncertain inference
is never replayed. All returned controls retain canonical ActionSpec validation
and pass through ActionGate. Original records without this protocol retain their
fresh-service and contiguous-index audit requirements.

The real inference-only check consumes an original recorded simulator RGB/state
request without issuing device controls:

```sh
PYTHONPATH=harness/physical-runtime/src <policy-environment>/bin/python \
  scripts/check-openpi-reconnection.py \
  --request <original-native-policy-request.json> \
  --schema harness/contracts/schema/physical.schema.json \
  --native-policy-uri ws://127.0.0.1:<native-policy-port> \
  --checkpoint-sha256 <verified-checkpoint-sha256> \
  --output-directory .local/work/<new-inference-check-directory>
```

It opens a second client after one actual inference, returns to the first client,
then replaces the connection. Every output is checked against the original
instruction, state, decoded RGB bytes and native action transformation. The input
file must remain unchanged. This check verifies checkpoint inference and client
identity; physical task acceptance uses the production rollout audit.

## Distributed Astra deployment

`examples/deployments/robodojo-live.mjs` accepts a deployment JSON path through
`EDH_ROBODOJO_CONFIG`. Each profile binds a worker command, native scene and task
catalog, compatible execution mode and model/checkpoint identity. The console
admits the complete profile selected by the user.

The console and DSH policy gateway may run on a model-accessible host while the
native simulator and Python worker run on the GPU host. Set a profile's optional
`policyGatewayPort` to the local listening port and `workerPolicyUri` to the
WebSocket address reachable from its worker. Without these settings, the gateway
uses an allocated local port and the worker connects locally. An SSH reverse
forward can connect the remote worker to a loopback-only local gateway; the
worker command can use SSH with `transportFd: 1`. SSH stdout then carries the
worker protocol and stderr carries diagnostics. No model credentials need to be
copied into worker configuration.

Keep simulator output, native task assets, checkpoints and dependency environments
in their designated locations. Device selection is deployment configuration.
Cold scene/material initialization must complete before task acceptance. Retain
initialization failures separately from task outcomes and create a fresh native
episode after an uncertain reset; the inspected native server admits one episode.

References:

- RoboDojo: <https://github.com/RoboDojo-Benchmark/RoboDojo>
- [Source provenance and retained notices](../provenance/litchi-robodojo.md)
