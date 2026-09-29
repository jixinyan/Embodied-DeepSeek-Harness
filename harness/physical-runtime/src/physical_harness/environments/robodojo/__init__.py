"""External RoboDojo RPC environment adapter.

The adapter owns only the EDH environment boundary.  RoboDojo remains an
external process because its source is distributed under the RoboDojo
Non-Commercial Research License.  The wire framing mirrors the inspected
RoboDojo/GPT-as-Policy protocol (version 1, msgpack + zlib, NumPy extension
type 42) without importing or vendoring that code.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from io import BytesIO
import math
import socket
import struct
import time
from typing import Any, Callable, Mapping, Sequence
from uuid import uuid4
import zlib

from physical_harness.environments import (
    NativeCheck,
    NativeEnvironmentDescription,
    NativeFrame,
    NativeObservation,
    NativeStep,
)
from physical_harness.validation import ContractValidator


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


def _msgpack() -> Any:
    try:
        import msgpack
    except ImportError as error:  # pragma: no cover - exercised on an uninstalled host
        raise RuntimeError(
            "RoboDojo support requires the optional physical-runtime[robodojo] dependencies."
        ) from error
    return msgpack


def _numpy() -> Any:
    try:
        import numpy as np
    except ImportError as error:  # pragma: no cover - exercised on an uninstalled host
        raise RuntimeError(
            "RoboDojo support requires numpy in the physical runtime environment."
        ) from error
    return np


def _encode_array(value: Any) -> Any:
    np = _numpy()
    msgpack = _msgpack()
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
    msgpack = _msgpack()
    np = _numpy()
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
        msgpack = _msgpack()
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
        self._metadata: dict[str, Any] | None = None
        self._episode_id: str | None = None
        self._step_id = 0
        self._task_id: str | None = None
        self._simulation_time_s = 0.0
        self._success = False
        self._terminated = False
        self._truncated = False
        self._configuration: dict[str, Any] | None = None

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
        np = _numpy()
        from PIL import Image

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
        np = _numpy()
        images: dict[str, bytes] = {}
        for camera in CAMERA_NAMES:
            if camera not in raw:
                raise RuntimeError(f"RoboDojo observation is missing {camera}.")
            images[camera] = self._image(raw[camera], camera)
        states = np.asarray(raw.get("states"))
        if states.shape != (14,) or states.dtype.kind not in "buif" or not np.isfinite(states).all():
            raise RuntimeError("RoboDojo observation states must be a finite 14-value vector.")
        return NativeObservation(
            str(uuid4()), self._timestamp(), time.monotonic(), images,
            {"states": tuple(float(value) for value in states)},
        )

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
        return NativeEnvironmentDescription(
            provider="robodojo",
            embodiment_id="robodojo.dual-arx-x5",
            action_spec=deepcopy(ACTION_SPEC),
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

    def reset(self, task_id: str, configuration: Mapping[str, object]) -> NativeObservation:
        if self._rpc is not None:
            raise RuntimeError("RoboDojo session is already initialized; reset cannot roll back an episode.")
        allowed = {
            "host", "port", "timeout_s", "seed", "source", "policy_version",
            "control_mode",
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
        if not isinstance(host, str) or not host or type(port) is not int:
            raise ValueError("RoboDojo configuration requires a host and integer port.")
        if type(seed) is not int or seed < 0 or source not in ("student", "gpt_eef", "gpt_joint"):
            raise ValueError("RoboDojo seed or control source is invalid.")
        if not isinstance(policy_version, str) or not policy_version.strip():
            raise ValueError("RoboDojo policy_version must be nonempty.")
        if control_mode not in ("0-shot", "textual-1-shot", "visual-1-shot"):
            raise ValueError("RoboDojo control_mode is invalid.")
        self._rpc = _RoboDojoRpc(host, port, float(timeout_s))
        self._configuration = dict(configuration)
        try:
            metadata = self._rpc.request("metadata")
            if not isinstance(metadata, dict) or metadata.get("task") != task_id:
                raise ValueError("RoboDojo task differs from the admitted native task.")
            self._metadata = metadata
            reset = self._rpc.request(
                "reset", seed=seed, source=source, policy_version=policy_version
            )
            if not isinstance(reset, dict) or not isinstance(reset.get("episode_id"), str):
                raise RuntimeError("RoboDojo reset returned no episode identity.")
            self._episode_id = reset["episode_id"]
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
        if len(action) != 14 or any(type(value) not in (int, float) or not math.isfinite(value) for value in action):
            raise ValueError("RoboDojo action must contain 14 finite values.")
        if any(action[index] < 0 or action[index] > 1 for index in (6, 13)):
            raise ValueError("RoboDojo gripper targets must be in [0, 1].")
        np = _numpy()
        result = self._require_rpc().request(
            "chunk_step", episode_id=self._episode_id, step_id=self._step_id,
            # The source is selected at reset (or by the explicit
            # switch_control_source operation).  RoboDojo's server adds that
            # session-owned value to each receipt; sending it again here
            # creates a duplicate keyword in the reference server.
            actions=np.asarray([action], dtype=np.float32),
        )
        steps = result.get("steps") if isinstance(result, dict) else None
        if not isinstance(steps, list) or len(steps) != 1 or not isinstance(steps[0], dict):
            raise RuntimeError("RoboDojo returned an invalid one-action receipt.")
        receipt = steps[0]
        if receipt.get("step_id") != self._step_id + 1:
            raise RuntimeError("RoboDojo step identity is not contiguous.")
        self._step_id = int(receipt["step_id"])
        self._success = bool(receipt.get("success", False))
        self._terminated = bool(receipt.get("terminated", False))
        self._truncated = bool(receipt.get("truncated", False))
        metadata = self._require_metadata()
        self._simulation_time_s = self._step_id * float(metadata["control_dt"])
        observation = self._observation()
        frame = NativeFrame(observation.observation_id, observation.observed_at, observation.images, 1, self._simulation_time_s)
        if on_live_frame is not None and not on_live_frame(frame):
            return NativeStep(
                observation, 1, True, 1, self._terminated or self._truncated,
                (frame,), "recording_capacity_exhausted",
            )
        return NativeStep(observation, 1, True, 1, self._terminated or self._truncated, (frame,))

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
        self._metadata = None
        self._episode_id = None
        self._task_id = None
