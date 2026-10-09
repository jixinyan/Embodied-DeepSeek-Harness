from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from safetensors.torch import load_file
import torch
from lerobot.configs import PreTrainedConfig
from lerobot.policies import make_pre_post_processors
from lerobot.policies.pi05 import PI05Policy

from physical_harness.policies.action_outputs import read_action_array
from physical_harness.policies.observation_inputs import decode_camera, decode_state, read_policy_observation


CAMERAS = {
    "head_camera": "observation.images.cam_high",
    "left_camera": "observation.images.cam_left_wrist",
    "right_camera": "observation.images.cam_right_wrist",
}
CHANNELS = tuple(
    [f"fl_joint{index}" for index in range(1, 8)]
    + [f"fr_joint{index}" for index in range(1, 8)]
)
TOKENIZER_HASHES = {
    "added_tokens.json": "7d0bad90030d638a4bf89a82e91206e25f1fbe0012f14bca21666a64b643bc49",
    "config.json": "e00c72cdff16296bf1229c3267b99f5247d8c740cae84336866338d64fa7918f",
    "special_tokens_map.json": "5ef37093ae4236587b6e8266acb815b46e2db8ce656c66552bfa574d32880405",
    "tokenizer.json": "ef6773c135b77b834de1d13c75a4c98ab7a3684ffd602d1831e1f1bf5467c563",
    "tokenizer.model": "8986bb4f423f07f8c7f70d0dbe3526fb2316056c17bae71b1ea975e77a168fc6",
    "tokenizer_config.json": "3259402b1d1802e02417d7bff75a889ec61d359d15be6050a957b307c48edbbe",
}


def _check_action_spec(spec: dict[str, Any]) -> None:
    expected = {
        "schema_version": "physical.action_spec.v1",
        "embodiment_id": "robotwin.aloha-agilex",
        "version": "robotwin-bf44be51-qpos-v1",
        "coordinate_frame": "robotwin.aloha-agilex.joint",
        "control_mode": "robotwin.qpos_target",
        "frequency_hz": None,
    }
    for key, value in expected.items():
        if spec.get(key) != value:
            raise ValueError(f"Unsupported RoboTwin ActionSpec {key}.")
    channels = spec.get("channels")
    if not isinstance(channels, list) or len(channels) != len(CHANNELS):
        raise ValueError("RoboTwin ActionSpec requires fourteen native channels.")
    for channel, name in zip(channels, CHANNELS, strict=True):
        gripper = name.endswith("joint7")
        if channel != {
            "name": name,
            "quantity": "normalized" if gripper else "angular",
            "unit": "dimensionless" if gripper else "radian",
            "minimum": 0 if gripper else -10,
            "maximum": 1 if gripper else 10,
        }:
            raise ValueError(f"Unsupported RoboTwin ActionSpec channel {name}.")


def _decode_camera(value: dict[str, Any]) -> torch.Tensor:
    pixels = decode_camera(value, expected_sizes=((640, 480),))
    return torch.from_numpy(pixels).permute(2, 0, 1).contiguous().to(torch.float32) / 255


def _decode_state(value: Any) -> torch.Tensor:
    return torch.from_numpy(decode_state(value, len(CHANNELS)))


def native_action_record(selected: torch.Tensor) -> tuple[list[list[float]], list[list[float]]]:
    if selected.ndim != 2 or selected.shape[1] != len(CHANNELS) or selected.shape[0] == 0:
        raise ValueError("LeRobot π0.5 returned an invalid RoboTwin action selection.")
    if selected.dtype == torch.bool or selected.is_complex():
        raise ValueError("LeRobot π0.5 actions require real numeric tensors.")
    if not torch.isfinite(selected).all():
        raise ValueError("LeRobot π0.5 returned nonfinite RoboTwin actions.")
    selected = selected.detach().cpu().to(torch.float64)
    read_action_array(selected.numpy(), dimensions=(None, len(CHANNELS)), source="LeRobot π0.5 RoboTwin")
    model_actions = selected.tolist()
    native = selected.clone()
    native[:, (6, 13)] = native[:, (6, 13)].clamp(0, 1)
    lower = torch.tensor([0 if name.endswith("joint7") else -10 for name in CHANNELS], dtype=torch.float64)
    upper = torch.tensor([1 if name.endswith("joint7") else 10 for name in CHANNELS], dtype=torch.float64)
    violations = (native < lower) | (native > upper)
    if torch.any(violations):
        invalid = [
            {
                "channel": CHANNELS[index],
                "value": native[action_index, index].item(),
                "minimum": lower[index].item(),
                "maximum": upper[index].item(),
                "action_index": action_index,
            }
            for action_index, index in torch.nonzero(violations, as_tuple=False).tolist()
        ]
        raise ValueError(f"LeRobot π0.5 returned actions outside the native RoboTwin joint range: {invalid}")
    return native.tolist(), model_actions


class LeRobotPi05RoboTwin:
    def __init__(self, checkpoint: str, tokenizer: str, *, device: str = "cuda:0",
                 compile_model: bool | None = None) -> None:
        path = Path(checkpoint).resolve(strict=True)
        tokenizer_path = Path(tokenizer).resolve(strict=True)
        for name, expected_hash in TOKENIZER_HASHES.items():
            if sha256((tokenizer_path / name).read_bytes()).hexdigest() != expected_hash:
                raise ValueError(f"PaliGemma tokenizer file {name} differs from the pinned checkpoint.")
        with (path / "policy_preprocessor.json").open(encoding="utf-8") as stream:
            processor_config = json.load(stream)
        tokenizer_steps = [step for step in processor_config["steps"] if step["registry_name"] == "tokenizer_processor"]
        if len(tokenizer_steps) != 1 or tokenizer_steps[0]["config"]["tokenizer_name"] != "google/paligemma-3b-pt-224":
            raise ValueError("Checkpoint has an incompatible PaliGemma tokenizer configuration.")
        config = PreTrainedConfig.from_pretrained(path, local_files_only=True)
        config.device = device
        if compile_model is not None:
            if type(compile_model) is not bool:
                raise ValueError("Pi0.5 compile_model must be a boolean.")
            config.compile_model = compile_model
        expected = {
            "observation.state": ("STATE", (14,)),
            **{name: ("VISUAL", (480, 640, 3)) for name in CAMERAS.values()},
        }
        if config.type != "pi05" or set(config.input_features) != set(expected):
            raise ValueError("Checkpoint has incompatible LeRobot RoboTwin input features.")
        for key, (kind, shape) in expected.items():
            feature = config.input_features[key]
            if feature.type.name != kind or tuple(feature.shape) != shape:
                raise ValueError(f"Checkpoint has incompatible {key} feature shape.")
        if set(config.output_features) != {"action"} or config.output_features["action"].type.name != "ACTION" or tuple(config.output_features["action"].shape) != (14,):
            raise ValueError("Checkpoint has incompatible RoboTwin action dimensions.")
        if config.chunk_size != 50 or config.use_relative_actions:
            raise ValueError("Checkpoint has incompatible RoboTwin action semantics.")
        if {key: value.value for key, value in config.normalization_mapping.items()} != {
            "ACTION": "MEAN_STD", "STATE": "MEAN_STD", "VISUAL": "IDENTITY",
        }:
            raise ValueError("Checkpoint has incompatible RoboTwin normalization.")
        policy = PI05Policy(config)
        original = load_file(str(path / "model.safetensors"))
        fixed = policy._fix_pytorch_state_dict_keys(original, config)
        remapped = {key if key.startswith("model.") else f"model.{key}": value for key, value in fixed.items()}
        policy.load_state_dict(remapped, strict=True)
        policy.to(device)
        target = torch.device(device)
        if any(tensor.device != target for tensor in (*policy.parameters(), *policy.buffers())):
            raise ValueError("LeRobot π0.5 model tensors are on an unexpected device.")
        policy.eval()
        self.policy = policy
        self.preprocessor, self.postprocessor = make_pre_post_processors(
            config,
            pretrained_path=str(path),
            preprocessor_overrides={
                "device_processor": {"device": device},
                "tokenizer_processor": {"tokenizer_name": str(tokenizer_path)},
            },
        )

    def infer(self, request: dict[str, Any]) -> list[list[float]]:
        actions, _ = self.infer_with_record(request)
        return actions

    def infer_with_record(self, request: dict[str, Any]) -> tuple[list[list[float]], list[list[float]]]:
        _check_action_spec(request["action_spec"])
        observation = read_policy_observation(request, "robotwin.aloha-agilex")
        cameras = observation["cameras"]
        states = observation["proprioception"]
        if set(cameras) != set(CAMERAS) or set(states) != {"joint_action.vector"}:
            raise ValueError("RoboTwin observation has incompatible camera or state keys.")
        batch = {
            "observation.state": _decode_state(states["joint_action.vector"]),
            "task": request["instruction"],
            **{mapped: _decode_camera(cameras[source]) for source, mapped in CAMERAS.items()},
        }
        prepared = self.preprocessor(batch)
        with torch.inference_mode():
            normalized = self.policy.predict_action_chunk(prepared)
            actions = self.postprocessor(normalized)
        if not isinstance(actions, torch.Tensor) or actions.ndim != 3 or actions.shape[0] != 1 or actions.shape[2] != 14:
            raise ValueError("LeRobot π0.5 returned an invalid RoboTwin action chunk.")
        if actions.dtype == torch.bool or actions.is_complex():
            raise ValueError("LeRobot π0.5 actions require real numeric tensors.")
        if not torch.isfinite(actions).all():
            raise ValueError("LeRobot π0.5 returned nonfinite RoboTwin actions.")
        count = min(request["max_actions"], actions.shape[1])
        return native_action_record(actions[0, :count])
