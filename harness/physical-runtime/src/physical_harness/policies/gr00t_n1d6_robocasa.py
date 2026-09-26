from __future__ import annotations

import base64
from io import BytesIO
import math
from typing import Any

import numpy as np
from PIL import Image
from gr00t.data.embodiment_tags import EmbodimentTag
from gr00t.policy.gr00t_policy import Gr00tPolicy


CAMERAS = {
    "robot0_agentview_left": "res256_image_side_0",
    "robot0_agentview_right": "res256_image_side_1",
    "robot0_eye_in_hand": "res256_image_wrist_0",
}
STATES = {
    "robot0_base_to_eef_pos": ("end_effector_position_relative", 3),
    "robot0_base_to_eef_quat": ("end_effector_rotation_relative", 4),
    "robot0_gripper_qpos": ("gripper_qpos", 2),
    "robot0_base_pos": ("base_position", 3),
    "robot0_base_quat": ("base_rotation", 4),
}
CHANNELS = [
    "right_0", "right_1", "right_2", "right_3", "right_4", "right_5",
    "right_gripper", "base_0", "base_1", "base_2", "torso", "base_mode",
]
ACTION_SIZES = {
    "end_effector_position": 3,
    "end_effector_rotation": 3,
    "gripper_close": 1,
    "base_motion": 4,
    "control_mode": 1,
}
MAX_CAMERA_BYTES = 1024 * 1024


def _check_action_spec(spec: dict[str, Any]) -> None:
    if spec.get("schema_version") != "physical.action_spec.v1":
        raise ValueError("Unsupported RoboCasa ActionSpec version.")
    expected = {
        "embodiment_id": "robocasa.pandaomron",
        "version": "robocasa-1.0.1-pandaomron-hybrid-v1",
        "coordinate_frame": "robosuite.pandaomron.native",
        "control_mode": "robosuite.hybrid_mobile_base",
        "frequency_hz": 20,
    }
    for key, value in expected.items():
        if spec.get(key) != value:
            raise ValueError(f"Unsupported RoboCasa ActionSpec {key}.")
    channels = spec.get("channels")
    if not isinstance(channels, list) or len(channels) != len(CHANNELS):
        raise ValueError("RoboCasa ActionSpec requires twelve native channels.")
    for channel, name in zip(channels, CHANNELS, strict=True):
        if channel != {
            "name": name, "quantity": "normalized", "unit": "dimensionless",
            "minimum": -1, "maximum": 1,
        }:
            raise ValueError(f"Unsupported RoboCasa ActionSpec channel {name}.")


def _decode_camera(value: dict[str, Any]) -> np.ndarray:
    if value.get("mime_type") != "image/png" or value.get("width") != 256 or value.get("height") != 256:
        raise ValueError("GR00T RoboCasa requires a 256x256 PNG camera frame.")
    encoded = value.get("data_base64")
    if not isinstance(encoded, str) or len(encoded) > 4 * ((MAX_CAMERA_BYTES + 2) // 3):
        raise ValueError("Camera frame encoding exceeds its limit.")
    data = base64.b64decode(encoded, validate=True)
    if len(data) > MAX_CAMERA_BYTES:
        raise ValueError("Camera frame exceeds its byte limit.")
    with Image.open(BytesIO(data), formats=["PNG"]) as image:
        if image.mode != "RGB" or image.size != (256, 256):
            raise ValueError("GR00T RoboCasa requires RGB camera pixels.")
        pixels = np.array(image, dtype=np.uint8, copy=True)
    return pixels[None, None, ...]


def _decode_state(value: Any, size: int) -> np.ndarray:
    if not isinstance(value, list) or len(value) != size:
        raise ValueError("RoboCasa proprioception has an invalid dimension.")
    if any(type(item) not in (int, float) or not math.isfinite(item) for item in value):
        raise ValueError("RoboCasa proprioception must contain finite numbers.")
    return np.asarray(value, dtype=np.float32)[None, None, :]


def _action_group(action: dict[str, Any], key: str) -> np.ndarray:
    value = action[key]
    if not isinstance(value, np.ndarray) or value.ndim != 3 or value.shape[0] != 1 or value.shape[2] != ACTION_SIZES[key]:
        raise ValueError(f"GR00T returned an invalid {key} action group.")
    if not np.isfinite(value).all():
        raise ValueError(f"GR00T returned a nonfinite {key} action group.")
    return value[0]


class Gr00tN1d6RoboCasa:
    def __init__(self, checkpoint: str, *, device: str = "cuda:0") -> None:
        self.policy = Gr00tPolicy(
            embodiment_tag=EmbodimentTag.ROBOCASA_PANDA_OMRON,
            model_path=checkpoint,
            device=device,
            strict=True,
        )
        modalities = self.policy.get_modality_config()
        for kind, keys in (
            ("video", list(CAMERAS.values())),
            ("state", [name for name, _ in STATES.values()]),
            ("action", list(ACTION_SIZES)),
        ):
            if modalities[kind].modality_keys != keys:
                raise ValueError(f"Checkpoint has incompatible RoboCasa {kind} modalities.")
        if len(modalities["action"].delta_indices) != 16:
            raise ValueError("Checkpoint has an incompatible RoboCasa action horizon.")

    def infer(self, request: dict[str, Any]) -> list[list[float]]:
        actions, _ = self.infer_with_record(request)
        return actions

    def infer_with_record(self, request: dict[str, Any]) -> tuple[list[list[float]], list[list[float]]]:
        _check_action_spec(request["action_spec"])
        observation = request["observation"]
        if observation.get("schema_version") != "edh.policy_observation.v1":
            raise ValueError("Unsupported policy observation version.")
        if observation.get("source_observation_id") != request["observation_id"]:
            raise ValueError("Policy observation identity does not match the request.")
        if observation.get("embodiment_id") != "robocasa.pandaomron":
            raise ValueError("Policy observation has an incompatible embodiment.")
        cameras = observation["cameras"]
        states = observation["proprioception"]
        if set(cameras) != set(CAMERAS) or set(states) != set(STATES):
            raise ValueError("RoboCasa observation has incompatible camera or state keys.")
        inputs = {
            "video": {mapped: _decode_camera(cameras[source]) for source, mapped in CAMERAS.items()},
            "state": {mapped: _decode_state(states[source], size) for source, (mapped, size) in STATES.items()},
            "language": {self.policy.language_key: [[request["instruction"]]]},
        }
        action, _ = self.policy.get_action(inputs)
        groups = {key: _action_group(action, key) for key in ACTION_SIZES}
        horizon = groups["end_effector_position"].shape[0]
        if any(value.shape[0] != horizon for value in groups.values()):
            raise ValueError("GR00T returned inconsistent action horizons.")
        native = np.concatenate(
            (
                groups["end_effector_position"],
                groups["end_effector_rotation"],
                np.where(groups["gripper_close"] < 0.5, -1.0, 1.0),
                groups["base_motion"],
                np.where(groups["control_mode"] < 0.5, -1.0, 1.0),
            ),
            axis=1,
        )
        if native.shape != (horizon, 12) or not np.isfinite(native).all():
            raise ValueError("GR00T returned invalid native RoboCasa actions.")
        if np.any(native < -1) or np.any(native > 1):
            raise ValueError("GR00T returned actions outside the native RoboCasa controller range.")
        model_actions = native.astype(np.float64).tolist()
        return model_actions[:request["max_actions"]], model_actions
