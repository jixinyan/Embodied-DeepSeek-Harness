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

RoboDojo is an external dependency. Its repository is distributed under the
RoboDojo Non-Commercial Research License and its public release is evaluation
oriented; no RoboDojo or GPT-as-Policy source is copied into EDH. Install the
optional dependencies in the physical runtime environment and start the simulator
from the separately licensed checkout:

```sh
.venv/bin/python -m pip install -e 'harness/physical-runtime[robodojo]'
```

The native worker provider name is `robodojo`. Its scene configuration requires
`port` and accepts `host`, `seed`, `source`, `policy_version` and the optional
combination/audit identity fields. The adapter expects the RoboDojo metadata to
declare `action_dim=14`, cameras `cam_high`, `cam_left_wrist` and
`cam_right_wrist`, and a positive `control_dt`. The canonical ActionSpec is
`robodojo.environment_origin` qpos target with continuous grippers in `[0, 1]`.

The adapter has CPU protocol coverage with a fake RPC peer. On 2026-09-30, the
local Isaac Sim 5.1 `build_tower` server (RoboDojo revision `726e9aa`) also
passed a real EDH reset, three-camera RGB observation, metadata/action-spec
description and one admitted qpos step. The step returned one executed action,
one native simulation step and a nonterminal `task_success=false` check. This is
provider-boundary evidence only; it does not claim a completed task, learned
policy success or GPT-6 Astra request. A full policy rollout, interruption and
formal task-success acceptance still require their own recorded runs.

References:

- RoboDojo: <https://github.com/RoboDojo-Benchmark/RoboDojo>
- GPT-as-Policy RPC implementation inspected in the local LitchiAgent checkout:
  `/mnt/data/users/jixin/workspace/code/LitchiAgent/runtime/vendor/GPT-as-Policy`
