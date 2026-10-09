from __future__ import annotations

from typing import Any

import numpy as np
from gr00t.data.embodiment_tags import EmbodimentTag
from gr00t.policy.gr00t_policy import Gr00tPolicy

from physical_harness.policies.action_outputs import read_action_array
from physical_harness.policies.observation_inputs import decode_camera, decode_state, read_policy_observation


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
    pixels = decode_camera(value, expected_sizes=((256, 256), (512, 512)), resize_to=(256, 256))
    return pixels[None, None, ...]


def _decode_state(value: Any, size: int) -> np.ndarray:
    return decode_state(value, size)[None, None, :]


def prepare_policy_input(request: dict[str, Any], *, language_key: str) -> dict[str, Any]:
    _check_action_spec(request["action_spec"])
    observation = read_policy_observation(request, "robocasa.pandaomron")
    cameras = observation["cameras"]
    states = observation["proprioception"]
    if set(cameras) != set(CAMERAS) or set(states) != set(STATES):
        raise ValueError("RoboCasa observation has incompatible camera or state keys.")
    return {
        "video": {mapped: _decode_camera(cameras[source]) for source, mapped in CAMERAS.items()},
        "state": {mapped: _decode_state(states[source], size) for source, (mapped, size) in STATES.items()},
        "language": {language_key: [[request["instruction"]]]},
    }


def _action_group(action: dict[str, Any], key: str) -> np.ndarray:
    value = read_action_array(action[key], dimensions=(1, None, ACTION_SIZES[key]),
                              source=f"GR00T RoboCasa {key}")
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
        inputs = prepare_policy_input(request, language_key=self.policy.language_key)
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
