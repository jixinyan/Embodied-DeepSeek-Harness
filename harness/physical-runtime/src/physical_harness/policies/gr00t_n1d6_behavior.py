from __future__ import annotations

from typing import Any

import numpy as np

from physical_harness.policies.action_outputs import read_action_array
from physical_harness.policies.gr00t_checkpoint import verify_gr00t_configuration
from physical_harness.policies.observation_inputs import decode_camera, decode_state, read_policy_observation


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
    pixels = decode_camera(value, expected_sizes=((256, 256),))
    return pixels[None, None, ...]


def _decode_state(value: Any, size: int) -> np.ndarray:
    return decode_state(value, size)[None, None, :]


def prepare_policy_input(request: dict[str, Any], *, language_key: str) -> dict[str, Any]:
    _check_action_spec(request["action_spec"])
    observation = read_policy_observation(request, "behavior.r1pro")
    cameras = observation["cameras"]
    states = observation["proprioception"]
    if set(cameras) != set(CAMERAS) or set(states) != {f"state.{name}" for name in STATES}:
        raise ValueError("BEHAVIOR observation has incompatible camera or state keys.")
    return {
        "video": {mapped: _decode_camera(cameras[source]) for source, mapped in CAMERAS.items()},
        "state": {name: _decode_state(states[f"state.{name}"], size) for name, size in STATES.items()},
        "language": {language_key: [[request["instruction"]]]},
    }


def _action_group(action: dict[str, Any], key: str) -> np.ndarray:
    value = read_action_array(action[key], dimensions=(1, None, ACTION_GROUPS[key]),
                              source=f"GR00T BEHAVIOR {key}")
    return value[0]


def verify_checkpoint_configuration(checkpoint: str) -> dict:
    return verify_gr00t_configuration(
        checkpoint, embodiment_id="behavior_r1_pro", video_keys=list(CAMERAS.values()),
        state_dimensions=STATES, action_dimensions=ACTION_GROUPS, action_horizon=32,
        relative_state_keys=RELATIVE_STATE_KEYS, language_key="annotation.human.coarse_action",
    )


class Gr00tN1d6Behavior:
    def __init__(self, checkpoint: str, *, device: str = "cuda:0") -> None:
        verify_checkpoint_configuration(checkpoint)
        from gr00t.data.embodiment_tags import EmbodimentTag
        from gr00t.policy.gr00t_policy import Gr00tPolicy
        self.policy = Gr00tPolicy(
            embodiment_tag=EmbodimentTag.BEHAVIOR_R1_PRO,
            model_path=checkpoint,
            device=device,
            strict=True,
        )

    def infer(self, request: dict[str, Any]) -> list[list[float]]:
        return self.infer_with_record(request)[0]

    def infer_with_record(self, request: dict[str, Any]) -> tuple[list[list[float]], list[list[float]]]:
        inputs = prepare_policy_input(request, language_key=self.policy.language_key)
        action, _ = self.policy.get_action(inputs)
        groups = {key: _action_group(action, key) for key in ACTION_GROUPS}
        horizon = groups["base"].shape[0]
        if any(value.shape[0] != horizon for value in groups.values()):
            raise ValueError("GR00T returned inconsistent BEHAVIOR action horizons.")
        count = min(request["max_actions"], horizon)
        model_actions = np.concatenate([groups[key] for key in ACTION_GROUPS], axis=1)
        if model_actions.shape != (horizon, 23) or not np.isfinite(model_actions).all():
            raise ValueError("GR00T returned invalid native BEHAVIOR actions.")
        channels = request["action_spec"]["channels"]
        lower = np.asarray([channel["minimum"] for channel in channels], dtype=np.float64)
        upper = np.asarray([channel["maximum"] for channel in channels], dtype=np.float64)
        # OmniGibson 对 normalized command 和 absolute joint target 应用原生 controller 范围。
        native = np.clip(model_actions[:count], lower, upper)
        return native.astype(np.float64).tolist(), model_actions.astype(np.float64).tolist()
