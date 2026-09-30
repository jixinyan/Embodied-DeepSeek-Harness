from __future__ import annotations

import base64
from io import BytesIO
import math
from typing import Any

from gr00t.data.embodiment_tags import EmbodimentTag
from gr00t.policy.gr00t_policy import Gr00tPolicy
import numpy as np
from PIL import Image


CAMERAS = {
    "head": "observation.images.rgb.head_256_256",
    "left_wrist": "observation.images.rgb.left_wrist_256_256",
    "right_wrist": "observation.images.rgb.right_wrist_256_256",
}
STATES = {
    "robot_pos": 3,
    "robot_ori_cos": 3,
    "robot_ori_sin": 3,
    "robot_2d_ori": 1,
    "robot_2d_ori_cos": 1,
    "robot_2d_ori_sin": 1,
    "robot_lin_vel": 3,
    "robot_ang_vel": 3,
    "arm_left_qpos": 7,
    "arm_left_qpos_sin": 7,
    "arm_left_qpos_cos": 7,
    "eef_left_pos": 3,
    "eef_left_quat": 4,
    "gripper_left_qpos": 2,
    "arm_right_qpos": 7,
    "arm_right_qpos_sin": 7,
    "arm_right_qpos_cos": 7,
    "eef_right_pos": 3,
    "eef_right_quat": 4,
    "gripper_right_qpos": 2,
    "trunk_qpos": 4,
}
ACTION_GROUPS = {
    "base": 3,
    "torso": 4,
    "left_arm": 7,
    "left_gripper": 1,
    "right_arm": 7,
    "right_gripper": 1,
}
CHANNELS = [
    "base.x", "base.y", "base.yaw",
    *(f"torso.{index}" for index in range(4)),
    *(f"left_arm.{index}" for index in range(7)),
    "left_gripper",
    *(f"right_arm.{index}" for index in range(7)),
    "right_gripper",
]
CHANNEL_LIMITS = (
    (-1.0, 1.0), (-1.0, 1.0), (-1.0, 1.0),
    (-1.1344999074935913, 1.8325998783111572),
    (-2.7924997806549072, 2.5306997299194336),
    (-1.8325998783111572, 1.5707999467849731),
    (-3.054299831390381, 3.054299831390381),
    (-4.4506001472473145, 1.309000015258789),
    (-0.1745000034570694, 3.1415998935699463),
    (-2.3561956882476807, 2.3561956882476807),
    (-2.0943996906280518, 0.3490999639034271),
    (-2.3561956882476807, 2.3561956882476807),
    (-1.0471980571746826, 1.0471980571746826),
    (-1.5707999467849731, 1.5707999467849731),
    (-1.0, 1.0),
    (-4.4506001472473145, 1.309000015258789),
    (-3.1415998935699463, 0.1745000034570694),
    (-2.3561956882476807, 2.3561956882476807),
    (-2.0943996906280518, 0.3490999639034271),
    (-2.3561956882476807, 2.3561956882476807),
    (-1.0471980571746826, 1.0471980571746826),
    (-1.5707999467849731, 1.5707999467849731),
    (-1.0, 1.0),
)
RELATIVE_STATE_KEYS = {
    "torso": "trunk_qpos",
    "left_arm": "arm_left_qpos",
    "right_arm": "arm_right_qpos",
}
MAX_CAMERA_BYTES = 1024 * 1024


def _check_action_spec(spec: dict[str, Any]) -> None:
    expected = {
        "schema_version": "physical.action_spec.v1",
        "embodiment_id": "behavior.r1pro",
        "version": "behavior-b1979916-r1pro-v1",
        "coordinate_frame": "behavior.r1pro.native_action",
        "control_mode": "behavior.r1pro_native",
        "frequency_hz": 30,
    }
    for key, value in expected.items():
        if spec.get(key) != value:
            raise ValueError(f"Unsupported BEHAVIOR R1Pro ActionSpec {key}.")
    channels = spec.get("channels")
    if not isinstance(channels, list) or len(channels) != len(CHANNELS):
        raise ValueError("BEHAVIOR R1Pro ActionSpec requires 23 native channels.")
    for index, (channel, name, bounds) in enumerate(zip(channels, CHANNELS, CHANNEL_LIMITS, strict=True)):
        normalized = index in (0, 1, 2, 14, 22)
        expected = {
            "name": name,
            "quantity": "normalized" if normalized else "angular",
            "unit": "dimensionless" if normalized else "radian",
            "minimum": bounds[0],
            "maximum": bounds[1],
        }
        if channel != expected:
            raise ValueError(f"Unsupported BEHAVIOR R1Pro channel {name}.")


def _decode_camera(value: dict[str, Any]) -> np.ndarray:
    if value.get("mime_type") != "image/png" or value.get("width") != 256 or value.get("height") != 256:
        raise ValueError("GR00T BEHAVIOR requires a 256x256 PNG camera frame.")
    encoded = value.get("data_base64")
    if not isinstance(encoded, str) or len(encoded) > 4 * ((MAX_CAMERA_BYTES + 2) // 3):
        raise ValueError("BEHAVIOR camera frame encoding exceeds its limit.")
    data = base64.b64decode(encoded, validate=True)
    if len(data) > MAX_CAMERA_BYTES:
        raise ValueError("BEHAVIOR camera frame exceeds its byte limit.")
    with Image.open(BytesIO(data), formats=["PNG"]) as image:
        if image.mode != "RGB" or image.size != (256, 256):
            raise ValueError("GR00T BEHAVIOR requires RGB camera pixels.")
        pixels = np.array(image, dtype=np.uint8, copy=True)
    return pixels[None, None, ...]


def _decode_state(value: Any, size: int) -> np.ndarray:
    if not isinstance(value, list) or len(value) != size:
        raise ValueError("BEHAVIOR proprioception has an invalid dimension.")
    if any(type(item) not in (int, float) or not math.isfinite(item) for item in value):
        raise ValueError("BEHAVIOR proprioception must contain finite numbers.")
    return np.asarray(value, dtype=np.float32)[None, None, :]


def _action_group(action: dict[str, Any], key: str) -> np.ndarray:
    value = action[key]
    if not isinstance(value, np.ndarray) or value.ndim != 3 or value.shape[0] != 1 or value.shape[2] != ACTION_GROUPS[key]:
        raise ValueError(f"GR00T returned an invalid BEHAVIOR {key} action group.")
    if not np.isfinite(value).all():
        raise ValueError(f"GR00T returned a nonfinite BEHAVIOR {key} action group.")
    return value[0]


class Gr00tN1d6Behavior:
    def __init__(self, checkpoint: str, *, device: str = "cuda:0") -> None:
        self.policy = Gr00tPolicy(
            embodiment_tag=EmbodimentTag.BEHAVIOR_R1_PRO,
            model_path=checkpoint,
            device=device,
            strict=True,
        )
        modalities = self.policy.get_modality_config()
        for kind, keys in (
            ("video", list(CAMERAS.values())),
            ("state", list(STATES)),
            ("action", list(ACTION_GROUPS)),
        ):
            if modalities[kind].modality_keys != keys:
                raise ValueError(f"Checkpoint has incompatible BEHAVIOR {kind} modalities.")
        if len(modalities["action"].delta_indices) != 32:
            raise ValueError("Checkpoint has an incompatible BEHAVIOR action horizon.")
        if not self.policy.processor.state_action_processor.use_relative_action:
            raise ValueError("Checkpoint must convert BEHAVIOR relative actions to absolute targets.")
        configs = modalities["action"].action_configs
        if configs is None or len(configs) != len(ACTION_GROUPS):
            raise ValueError("Checkpoint has incompatible BEHAVIOR action representations.")
        for key, config in zip(ACTION_GROUPS, configs, strict=True):
            expected_representation = "RELATIVE" if key in RELATIVE_STATE_KEYS else "ABSOLUTE"
            expected_reference = RELATIVE_STATE_KEYS.get(key)
            if config.rep.name != expected_representation or config.type.name != "NON_EEF" or config.state_key != expected_reference:
                raise ValueError(f"Checkpoint has incompatible BEHAVIOR {key} action semantics.")
        if self.policy.language_key != "annotation.human.coarse_action":
            raise ValueError("Checkpoint has an incompatible BEHAVIOR instruction key.")

    def infer(self, request: dict[str, Any]) -> list[list[float]]:
        _check_action_spec(request["action_spec"])
        observation = request["observation"]
        if observation.get("schema_version") != "edh.policy_observation.v1":
            raise ValueError("Unsupported policy observation version.")
        if observation.get("source_observation_id") != request["observation_id"]:
            raise ValueError("Policy observation identity does not match the request.")
        if observation.get("embodiment_id") != "behavior.r1pro":
            raise ValueError("Policy observation has an incompatible embodiment.")
        cameras = observation["cameras"]
        states = observation["proprioception"]
        if set(cameras) != set(CAMERAS) or set(states) != {f"state.{name}" for name in STATES}:
            raise ValueError("BEHAVIOR observation has incompatible camera or state keys.")
        inputs = {
            "video": {mapped: _decode_camera(cameras[source]) for source, mapped in CAMERAS.items()},
            "state": {name: _decode_state(states[f"state.{name}"], size) for name, size in STATES.items()},
            "language": {self.policy.language_key: [[request["instruction"]]]},
        }
        action, _ = self.policy.get_action(inputs)
        groups = {key: _action_group(action, key) for key in ACTION_GROUPS}
        horizon = groups["base"].shape[0]
        if any(value.shape[0] != horizon for value in groups.values()):
            raise ValueError("GR00T returned inconsistent BEHAVIOR action horizons.")
        count = min(request["max_actions"], horizon)
        native = np.concatenate([groups[key][:count] for key in ACTION_GROUPS], axis=1)
        if native.shape != (count, 23) or not np.isfinite(native).all():
            raise ValueError("GR00T returned invalid native BEHAVIOR actions.")
        channels = request["action_spec"]["channels"]
        lower = np.asarray([channel["minimum"] for channel in channels], dtype=np.float64)
        upper = np.asarray([channel["maximum"] for channel in channels], dtype=np.float64)
        if np.any(native < lower) or np.any(native > upper):
            raise ValueError("GR00T returned actions outside the native BEHAVIOR controller range.")
        return native.astype(np.float64).tolist()
