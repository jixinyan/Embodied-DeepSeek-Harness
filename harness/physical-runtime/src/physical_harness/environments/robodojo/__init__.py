from __future__ import annotations

from copy import deepcopy
from collections import OrderedDict
from datetime import datetime, timezone
from io import BytesIO
import math
import json
import socket
import struct
import subprocess
import sys
import time
from typing import Any, Callable, Mapping, Sequence
from uuid import uuid4
import zlib
from pathlib import Path

import msgpack
import numpy as np
import psutil
from PIL import Image

from physical_harness.environments import (
    NativeCheck,
    NativeEnvironmentDescription,
    NativeFrame,
    NativeObservation,
    NativeStep,
)
from physical_harness.validation import ContractValidator
from physical_harness.perception.metric_capture import MetricCapture


CAMERA_NAMES = ("cam_high", "cam_left_wrist", "cam_right_wrist")
STATE_CHANNELS = ("states",)
ACTION_CHANNELS = tuple(
    [f"left_joint_{index}" for index in range(6)]
    + ["left_gripper"]
    + [f"right_joint_{index}" for index in range(6)]
    + ["right_gripper"]
)
ACTION_SPEC = {
    "schema_version": "physical.action_spec.v1",
    "embodiment_id": "robodojo.dual-arx-x5",
    "version": "robodojo-arx-x5-qpos-v1",
    "coordinate_frame": "robodojo.environment_origin",
    "control_mode": "robodojo.qpos_target",
    "frequency_hz": None,
    "channels": [
        {
            "name": name,
            "quantity": "normalized" if name.endswith("gripper") else "angular",
            "unit": "dimensionless" if name.endswith("gripper") else "radian",
            "minimum": 0 if name.endswith("gripper") else -10,
            "maximum": 1 if name.endswith("gripper") else 10,
        }
        for name in ACTION_CHANNELS
    ],
}

_VERSION = 1
_MAX_BYTES = 128 * 1024 * 1024
_ARRAY_EXT = 42


def _json_array(value: Any) -> Any:
    if isinstance(value, (np.ndarray, np.generic)):
        return value.tolist()
    raise TypeError(f"Unsupported policy tool result type: {type(value).__name__}")


def _encode_array(value: Any) -> Any:
    if isinstance(value, np.ndarray):
        if value.dtype.kind not in "buif":
            raise TypeError(f"Unsupported RoboDojo array dtype: {value.dtype}")
        contiguous = np.ascontiguousarray(value)
        payload = msgpack.packb(
            (contiguous.dtype.str, contiguous.shape, contiguous.tobytes()), use_bin_type=True
        )
        return msgpack.ExtType(_ARRAY_EXT, payload)
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"Unsupported RoboDojo RPC value: {type(value).__name__}")


def _decode_array(code: int, payload: bytes) -> Any:
    if code != _ARRAY_EXT:
        raise ValueError("Unknown RoboDojo RPC extension")
    dtype_text, shape, data = msgpack.unpackb(payload, raw=False)
    dtype = np.dtype(dtype_text)
    if dtype.kind not in "buif" or len(shape) > 8 or any(type(item) is not int or item < 0 for item in shape):
        raise ValueError("Invalid RoboDojo RPC array descriptor")
    expected = int(np.prod(shape, dtype=object)) * dtype.itemsize
    if expected != len(data) or expected > _MAX_BYTES:
        raise ValueError("RoboDojo RPC array size mismatch")
    return np.frombuffer(data, dtype=dtype).reshape(shape).copy()


def _read_exact(stream: socket.socket, length: int) -> bytes:
    result = bytearray()
    while len(result) < length:
        block = stream.recv(min(length - len(result), 1024 * 1024))
        if not block:
            raise EOFError("RoboDojo RPC connection closed")
        result.extend(block)
    return bytes(result)


class _RoboDojoRpc:
    """One no-retry, identity-checked RoboDojo connection."""

    def __init__(self, host: str, port: int, timeout_s: float) -> None:
        if not host or type(port) is not int or not 1 <= port <= 65535:
            raise ValueError("RoboDojo RPC host and port are invalid.")
        if not math.isfinite(timeout_s) or timeout_s <= 0 or timeout_s > 900:
            raise ValueError("RoboDojo RPC timeout must be positive and at most 900 seconds.")
        self._socket: socket.socket | None = socket.create_connection((host, port), timeout=timeout_s)
        self._socket.settimeout(timeout_s)
        self._socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

    def request(self, operation: str, **arguments: Any) -> Any:
        stream = self._socket
        if stream is None:
            raise RuntimeError("RoboDojo RPC client is closed; reset requires a fresh client.")
        import uuid

        request_id = uuid.uuid4().hex
        try:
            raw = msgpack.packb(
                {"version": _VERSION, "request_id": request_id, "op": operation, "args": arguments},
                default=_encode_array,
                use_bin_type=True,
            )
            payload = zlib.compress(raw, level=1)
            if len(raw) > _MAX_BYTES or len(payload) > _MAX_BYTES:
                raise ValueError("RoboDojo RPC request exceeds the 128 MiB limit.")
            stream.sendall(struct.pack("!I", len(payload)) + payload)
            length = struct.unpack("!I", _read_exact(stream, 4))[0]
            if not 0 < length <= _MAX_BYTES:
                raise ValueError("Invalid RoboDojo RPC response length.")
            decoder = zlib.decompressobj()
            response_raw = decoder.decompress(_read_exact(stream, length), _MAX_BYTES + 1)
            if len(response_raw) > _MAX_BYTES or not decoder.eof or decoder.unused_data:
                raise ValueError("Invalid compressed RoboDojo RPC response.")
            response = msgpack.unpackb(response_raw, raw=False, ext_hook=_decode_array)
            if (
                not isinstance(response, dict)
                or response.get("version") != _VERSION
                or response.get("request_id") != request_id
            ):
                raise ValueError("RoboDojo RPC response identity mismatch.")
            if not response.get("ok"):
                raise RuntimeError(str(response.get("error", "RoboDojo RPC request failed")))
            return response["result"]
        except BaseException:
            self.close()
            raise

    def close(self) -> None:
        stream, self._socket = self._socket, None
        if stream is not None:
            stream.close()


class RoboDojoEnvironment:
    """EDH native environment backed by an already running RoboDojo server."""

    def __init__(self, validator: ContractValidator) -> None:
        validator.parse("ActionSpec", ACTION_SPEC)
        self._validator = validator
        self._rpc: _RoboDojoRpc | None = None
        self._service: subprocess.Popen | None = None
        self._metadata: dict[str, Any] | None = None
        self._episode_id: str | None = None
        self._step_id = 0
        self._task_id: str | None = None
        self._simulation_time_s = 0.0
        self._success = False
        self._terminated = False
        self._truncated = False
        self._configuration: dict[str, Any] | None = None
        self._policy_context: dict[str, Any] | None = None
        self._last_observation_id: str | None = None
        self._source: str | None = None
        self._prepared: dict[str, Any] | None = None
        self._current_state: list[float] | None = None
        self._observation_steps: OrderedDict[str, int] = OrderedDict()
        self._metric_capture = MetricCapture("robodojo", "robodojo.isaac.world")

    def _require_rpc(self) -> _RoboDojoRpc:
        if self._rpc is None:
            raise RuntimeError("RoboDojo has not been reset.")
        return self._rpc

    def _require_metadata(self) -> dict[str, Any]:
        if self._metadata is None:
            raise RuntimeError("RoboDojo metadata is unavailable.")
        return self._metadata

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

    @staticmethod
    def _image(value: Any, camera: str) -> bytes:
        pixels = np.asarray(value)
        if pixels.ndim != 3 or pixels.shape[-1] < 3 or pixels.dtype != np.uint8:
            raise RuntimeError(f"RoboDojo camera {camera} returned an invalid RGB frame.")
        output = BytesIO()
        Image.fromarray(pixels[..., :3]).save(output, format="PNG")
        if output.tell() > 1024 * 1024:
            raise RuntimeError(f"RoboDojo camera {camera} exceeds the policy observation limit.")
        return output.getvalue()

    def _observation(self, raw: Mapping[str, Any] | None = None) -> NativeObservation:
        if raw is None:
            raw = self._require_rpc().request(
                "teacher_observation", episode_id=self._episode_id, step_id=self._step_id
            )
        images: dict[str, bytes] = {}
        for camera in CAMERA_NAMES:
            if camera not in raw:
                raise RuntimeError(f"RoboDojo observation is missing {camera}.")
            images[camera] = self._image(raw[camera], camera)
        states = np.asarray(raw.get("states"))
        if states.shape != (14,) or states.dtype.kind not in "buif" or not np.isfinite(states).all():
            raise RuntimeError("RoboDojo observation states must be a finite 14-value vector.")
        self._current_state = states.tolist()
        identity = str(uuid4())
        self._last_observation_id = identity
        self._observation_steps[identity] = self._step_id
        if len(self._observation_steps) > 128:
            self._observation_steps.popitem(last=False)
        self._policy_context = {
            "episode_id": self._episode_id,
            "step_id": self._step_id,
            "instruction": self._require_metadata()["instruction"],
            "frame": "environment_origin",
            "current_eef": {
                arm: {"position": np.asarray(raw["eef_positions"])[index].tolist(),
                      "quaternion_wxyz": np.asarray(raw["eef_quaternions_wxyz"])[index].tolist()}
                for index, arm in enumerate(("left", "right"))
            } if "eef_positions" in raw and "eef_quaternions_wxyz" in raw else None,
            "remaining_steps": raw.get("remaining_steps"),
        }
        observation = NativeObservation(
            identity, self._timestamp(), time.monotonic(), images,
            {"states": tuple(float(value) for value in states)},
        )
        self._metric_capture.replace(observation, raw["simulation_time_s"], raw["metric_frames"])
        return observation

    def measure_object(self, observation_id: str, camera: str, source_image_sha256: str,
                       mask_png: bytes) -> dict[str, object]:
        self._require_rpc()
        if self._observation_steps.get(observation_id) != self._step_id:
            raise ValueError("Metric measurement requires the current native episode step.")
        return self._metric_capture.measure(observation_id, camera, source_image_sha256, mask_png)

    def policy_context(self, observation_id: str) -> dict[str, Any]:
        if self._observation_steps.get(observation_id) != self._step_id or self._policy_context is None:
            raise ValueError("Policy context requires the current observation.")
        context = deepcopy(self._policy_context)
        if self._require_metadata().get("supports_joint_control"):
            context["current_joints"] = self.policy_tool(observation_id, "joint_state", {})["arms"]
        return context

    def policy_tool(self, observation_id: str, operation: str, arguments: Mapping[str, Any]) -> Any:
        if self._observation_steps.get(observation_id) != self._step_id or self._terminated or self._truncated:
            raise ValueError("Policy tool requires a current unfinished observation.")
        allowed = {"grounding", "get_depth", "fk_preview", "joint_state", "prepare_targets",
                   "prepare_joints", "eef_joint_target"}
        if operation not in allowed or set(arguments) & {"episode_id", "step_id"}:
            raise ValueError("Policy tool operation or identity is invalid.")
        inputs = dict(arguments)
        if operation == "fk_preview":
            inputs["actions"] = np.asarray(inputs["actions"], dtype=np.float32)
        result = self._require_rpc().request(
            operation, episode_id=self._episode_id, step_id=self._step_id, **inputs
        )
        if operation in {"prepare_targets", "prepare_joints"}:
            self._prepared = None
            if result.get("ok") is True:
                self._prepared = {"mode": "eef" if operation == "prepare_targets" else "joint",
                                  "targets": deepcopy(inputs["targets"]), "result": deepcopy(result)}
        return json.loads(json.dumps(result, default=_json_array, allow_nan=False))

    def motion_status(self, motion: Mapping[str, Any]) -> dict[str, Any]:
        if (self._prepared is None or motion["mode"] != self._prepared["mode"] or
                motion["targets"] != self._prepared["targets"] or self._policy_context is None):
            raise ValueError("Motion does not match the prepared target.")
        arms = {}
        for index, arm in enumerate(("left", "right")):
            target = self._prepared["result"]["target_eef"][arm]
            measured = self._policy_context["current_eef"][arm]
            distance = float(np.linalg.norm(np.asarray(target["position"]) - measured["position"]))
            q_target = np.asarray(target["quaternion_wxyz"], dtype=np.float64)
            q_current = np.asarray(measured["quaternion_wxyz"], dtype=np.float64)
            cosine = abs(float(np.dot(q_target, q_current) / (np.linalg.norm(q_target) * np.linalg.norm(q_current))))
            angle = float(2 * np.arccos(np.clip(cosine, 0, 1)))
            joint_error = float(np.max(np.abs(np.asarray(self._prepared["result"]["joint_targets"][arm]) -
                self._current_state[index * 7:index * 7 + 6])))
            arms[arm] = {"position_error_m": distance, "rotation_error_rad": angle,
                         "joint_error_rad": joint_error,
                         "reached": joint_error <= 0.01 if motion["mode"] == "joint" else distance <= 0.005 and angle <= 0.03}
        return {"arms": arms, "reached": all(value["reached"] for value in arms.values()),
                "error": sum(value["joint_error_rad"] if motion["mode"] == "joint" else
                             value["position_error_m"] + 0.2 * value["rotation_error_rad"] for value in arms.values()),
                "arrival_scope": "joint_angles" if motion["mode"] == "joint" else "link6_poses"}

    def select_control_source(self, source: str, reason: str) -> None:
        if source not in {"student", "gpt_eef", "gpt_joint"} or not isinstance(reason, str) or not reason.strip():
            raise ValueError("Invalid control source or reason.")
        if self._source != source:
            self._require_rpc().request("switch_control_source", episode_id=self._episode_id,
                                        step_id=self._step_id, source=source, reason=reason)
            self._source = source

    def describe(self) -> NativeEnvironmentDescription:
        metadata = self._require_metadata()
        instruction = metadata.get("instruction")
        if not isinstance(instruction, str) or not instruction.strip() or len(instruction) > 4000:
            raise RuntimeError("RoboDojo metadata has no valid task instruction.")
        cameras = tuple(metadata.get("cameras", CAMERA_NAMES))
        if cameras != CAMERA_NAMES:
            raise RuntimeError(f"RoboDojo camera mapping differs from the EDH adapter: {cameras!r}.")
        if type(metadata.get("action_dim")) is not int or metadata["action_dim"] != 14:
            raise RuntimeError("RoboDojo action dimension differs from the declared 14D mapping.")
        control_dt = metadata.get("control_dt")
        if not isinstance(control_dt, (int, float)) or not math.isfinite(float(control_dt)) or float(control_dt) <= 0:
            raise RuntimeError("RoboDojo control_dt is invalid.")
        action_spec = deepcopy(ACTION_SPEC)
        action_spec["frequency_hz"] = 1.0 / float(control_dt)
        if metadata.get("supports_joint_control"):
            joints = self._require_rpc().request("joint_state", episode_id=self._episode_id, step_id=self._step_id)
            for arm_index, arm in enumerate(("left", "right")):
                for joint_index, bounds in enumerate(joints["arms"][arm]["position_limits_rad"]):
                    channel = action_spec["channels"][arm_index * 7 + joint_index]
                    channel["minimum"], channel["maximum"] = bounds
        self._validator.parse("ActionSpec", action_spec)
        return NativeEnvironmentDescription(
            provider="robodojo",
            embodiment_id="robodojo.dual-arx-x5",
            action_spec=action_spec,
            camera_names=CAMERA_NAMES,
            state_channels=STATE_CHANNELS,
            supported_check_ids=("task_success",),
            active_view_directions=(),
            task_instruction=instruction,
            scene_metadata={
                "native_task_id": self._task_id,
                "simulator": metadata.get("simulator", "RoboDojo"),
                "robot_adapter": metadata.get("robot_adapter", "dual_arx_x5"),
                "control_dt": float(control_dt),
                "max_episode_steps": metadata.get("max_episode_steps"),
                "frame": metadata.get("frame", "environment_origin"),
                "no_rollback": bool(metadata.get("no_rollback", True)),
            },
        )

    def _start_service(self, service_path: Path, service_config: Mapping[str, Any],
                       task_id: str, port: int, timeout_s: float) -> int:
        output = Path(service_config["output"]) / str(uuid4())
        self._service = subprocess.Popen(
            [sys.executable, "-m", "physical_harness.environments.robodojo.launch",
             "--configuration", str(service_path), "--output", str(output)],
            stdout=sys.stderr, stderr=sys.stderr, start_new_session=True,
        )
        process = psutil.Process(self._service.pid)
        deadline = time.monotonic() + timeout_s
        ready_path = output / "ready.json"
        while True:
            exit_code = self._service.poll()
            if exit_code is not None:
                self._service = None
                raise RuntimeError(f"The owned RoboDojo service exited before readiness: {exit_code}.")
            if ready_path.exists():
                ready = json.loads(ready_path.read_text())
                actual_port = ready.get("port")
                if (ready.get("pid") != self._service.pid or ready.get("task") != task_id
                        or ready.get("version") != _VERSION or type(actual_port) is not int
                        or not 1 <= actual_port <= 65535 or (port != 0 and port != actual_port)):
                    raise RuntimeError("Native service readiness identity differs from its owner.")
                if any(connection.status == psutil.CONN_LISTEN and connection.laddr.port == actual_port
                       for connection in process.connections(kind="tcp")):
                    return actual_port
            if time.monotonic() >= deadline:
                raise TimeoutError("The owned RoboDojo service did not become ready within its timeout.")
            time.sleep(0.2)

    def reset(self, task_id: str, configuration: Mapping[str, object]) -> NativeObservation:
        if self._rpc is not None or self._service is not None:
            raise RuntimeError("RoboDojo session is already initialized; reset cannot roll back an episode.")
        allowed = {
            "host", "port", "timeout_s", "seed", "source", "policy_version",
            "control_mode",
            "service_configuration",
            "teacher_model", "teacher_model_provider", "context_version",
            "prompt_sha256", "student_policy_version", "student_policy_sha256",
        }
        if set(configuration) - allowed:
            raise ValueError("Unknown RoboDojo scene configuration field.")
        host = configuration.get("host", "127.0.0.1")
        port = configuration.get("port")
        seed = configuration.get("seed", 0)
        timeout_s = configuration.get("timeout_s", 300.0)
        source = configuration.get("source", "student")
        policy_version = configuration.get("policy_version", "edh")
        control_mode = configuration.get("control_mode", "0-shot")
        if not isinstance(host, str) or not host or type(port) is not int or not 0 <= port <= 65535:
            raise ValueError("RoboDojo configuration requires a host and integer port.")
        if (type(timeout_s) not in (int, float) or not math.isfinite(timeout_s)
                or not 0 < timeout_s <= 900):
            raise ValueError("RoboDojo timeout must be positive and at most 900 seconds.")
        if type(seed) is not int or seed < 0 or source not in ("student", "gpt_eef", "gpt_joint"):
            raise ValueError("RoboDojo seed or control source is invalid.")
        if not isinstance(policy_version, str) or not policy_version.strip():
            raise ValueError("RoboDojo policy_version must be nonempty.")
        if control_mode not in ("0-shot", "textual-1-shot", "visual-1-shot"):
            raise ValueError("RoboDojo control_mode is invalid.")
        service_configuration = configuration.get("service_configuration")
        if service_configuration is not None:
            if host != "127.0.0.1" or not isinstance(service_configuration, str):
                raise ValueError("An owned native service requires a loopback host and configuration path.")
            service_path = Path(service_configuration).resolve(strict=True)
            service_config = json.loads(service_path.read_text())
            if service_config["task"] != task_id or service_config["port"] != port:
                raise ValueError("Native service configuration differs from the admitted task or port.")
        self._configuration = dict(configuration)
        try:
            if service_configuration is not None:
                port = self._start_service(service_path, service_config, task_id, port, float(timeout_s))
            self._rpc = _RoboDojoRpc(host, port, float(timeout_s))
            metadata = self._rpc.request("metadata")
            if not isinstance(metadata, dict) or metadata.get("task") != task_id:
                raise ValueError("RoboDojo task differs from the admitted native task.")
            self._metadata = metadata
            reset = self._rpc.request(
                "reset", seed=seed, source=source, policy_version=policy_version
            )
            if not isinstance(reset, dict) or not isinstance(reset.get("episode_id"), str):
                raise RuntimeError("RoboDojo reset returned no episode identity.")
            reset_metadata = reset.get("metadata")
            if not isinstance(reset_metadata, dict) or reset_metadata.get("task") != task_id:
                raise RuntimeError("RoboDojo reset returned no matching scene metadata.")
            self._metadata = deepcopy(reset_metadata)
            self._episode_id = reset["episode_id"]
            self._source = source
            self._step_id = int(reset.get("step_id", 0))
            self._task_id = task_id
            self._simulation_time_s = self._step_id * float(metadata["control_dt"])
            self._success = False
            self._terminated = False
            self._truncated = False
            begin = {
                key: self._configuration[key]
                for key in (
                    "teacher_model", "teacher_model_provider", "context_version",
                    "prompt_sha256", "student_policy_version", "student_policy_sha256",
                )
                if key in self._configuration
            }
            if begin:
                self._rpc.request(
                    "begin_combination", episode_id=self._episode_id, step_id=self._step_id, **begin
                )
            return self._observation()
        except BaseException:
            self.close()
            raise

    def bind_task(self, task_id: str) -> None:
        if task_id != self._task_id:
            raise ValueError("RoboDojo session cannot change its native task without an explicit reset.")

    def observe(self) -> NativeObservation:
        return self._observation()

    def step(
        self,
        action: Sequence[float],
        should_stop: Callable[[], bool],
        on_live_frame: Callable[[NativeFrame], bool] | None = None,
    ) -> NativeStep:
        if should_stop():
            return NativeStep(self.observe(), 0, False, 0, False)
        if self.episode_terminated():
            raise RuntimeError("RoboDojo episode has ended; a new native session is required.")
        if len(action) != 14 or any(type(value) not in (int, float) or not math.isfinite(value) for value in action):
            raise ValueError("RoboDojo action must contain 14 finite values.")
        if any(action[index] < 0 or action[index] > 1 for index in (6, 13)):
            raise ValueError("RoboDojo gripper targets must be in [0, 1].")
        result = self._require_rpc().request(
            "chunk_step", episode_id=self._episode_id, step_id=self._step_id,
            actions=np.asarray([action], dtype=np.float32),
        )
        steps = result.get("steps") if isinstance(result, dict) else None
        if not isinstance(steps, list) or len(steps) != 1 or not isinstance(steps[0], dict):
            raise RuntimeError("RoboDojo returned an invalid one-action receipt.")
        receipt = steps[0]
        if receipt.get("step_id") != self._step_id + 1:
            raise RuntimeError("RoboDojo step identity is not contiguous.")
        self._step_id = int(receipt["step_id"])
        raw_sim_steps = receipt.get("raw_sim_steps")
        if (type(raw_sim_steps) is not int or raw_sim_steps <= 0
                or type(receipt.get("native_physics_step_after")) is not int
                or type(receipt.get("native_physics_step_before")) is not int
                or receipt.get("native_physics_step_after") - receipt.get("native_physics_step_before") != raw_sim_steps):
            raise RuntimeError("RoboDojo native physics counters are invalid.")
        native_physics = {key: receipt[key] for key in (
            "episode_id", "step_id", "physics_count_source", "native_physics_step_before",
            "native_physics_step_after", "simulation_time_s", "physics_timestep_s",
            "camera_calibration",
        )}
        if native_physics["episode_id"] != self._episode_id:
            raise RuntimeError("RoboDojo native physics belongs to another episode.")
        self._success = bool(receipt.get("success", False))
        self._terminated = bool(receipt.get("terminated", False))
        self._truncated = bool(receipt.get("truncated", False))
        self._simulation_time_s = float(receipt["simulation_time_s"])
        observation = self._observation()
        frame = NativeFrame(observation.observation_id, observation.observed_at, observation.images, raw_sim_steps, self._simulation_time_s)
        if on_live_frame is not None and not on_live_frame(frame):
            return NativeStep(
                observation, 1, True, raw_sim_steps, self._terminated or self._truncated,
                (frame,), "recording_capacity_exhausted",
                native_physics,
            )
        return NativeStep(observation, 1, True, raw_sim_steps, self._terminated or self._truncated,
                          (frame,), native_physics=native_physics)

    def episode_terminated(self) -> bool:
        status = self._require_rpc().request("episode_status", episode_id=self._episode_id, step_id=self._step_id)
        if not isinstance(status, dict) or any(type(status.get(key)) is not bool
                                               for key in ("terminated", "truncated", "success", "finished")):
            raise RuntimeError("RoboDojo native episode status is invalid.")
        self._terminated, self._truncated, self._success = status["terminated"], status["truncated"], status["success"]
        return self._terminated or self._truncated or status["finished"]

    def check(self, check_ids: Sequence[str]) -> Sequence[NativeCheck]:
        if not check_ids or any(check_id != "task_success" for check_id in check_ids):
            raise ValueError("Unsupported RoboDojo check ID.")
        return tuple(NativeCheck(check_id, self._success if self._terminated else False) for check_id in check_ids)

    def turn_view(self, direction: str) -> NativeObservation:
        raise ValueError(f"RoboDojo active view direction is unsupported: {direction}")

    def close(self) -> None:
        rpc, self._rpc = self._rpc, None
        if rpc is not None:
            rpc.close()
        service = self._service
        if service is not None:
            if rpc is None and service.poll() is None:
                service.terminate()
            exit_code = service.wait(timeout=60)
            self._service = None
            if exit_code != 0:
                raise RuntimeError(f"The owned RoboDojo service failed during shutdown: {exit_code}.")
        self._metadata = None
        self._observation_steps.clear()
        self._episode_id = None
        self._task_id = None
