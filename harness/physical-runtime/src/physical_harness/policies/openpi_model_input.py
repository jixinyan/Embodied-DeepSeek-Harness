from collections.abc import Callable

import numpy as np

from physical_harness.policies.action_outputs import read_action_array


def prepare_model_input(observation: dict, transform: Callable[[dict], dict]) -> dict:
    with np.errstate(over="raise", invalid="raise", divide="raise"):
        prepared = transform(observation)
    if not isinstance(prepared, dict) or set(prepared) != {
            "state", "image", "image_mask", "tokenized_prompt", "tokenized_prompt_mask"}:
        raise ValueError("ARX X5 OpenPI preprocessing returned incompatible model fields.")
    state = read_action_array(prepared["state"], dimensions=(32,), source="ARX X5 OpenPI model state", float32=True)
    if prepared["state"].dtype.kind != "f" or not np.isfinite(state).all():
        raise ValueError("ARX X5 OpenPI model state requires finite floating-point values.")
    cameras = {"base_0_rgb", "left_wrist_0_rgb", "right_wrist_0_rgb"}
    if (not isinstance(prepared["image"], dict) or not isinstance(prepared["image_mask"], dict) or
            set(prepared["image"]) != cameras or set(prepared["image_mask"]) != cameras):
        raise ValueError("ARX X5 OpenPI preprocessing requires all three model cameras.")
    for name in cameras:
        image, mask = prepared["image"][name], np.asarray(prepared["image_mask"][name])
        if not isinstance(image, np.ndarray) or image.shape != (224, 224, 3) or image.dtype != np.uint8:
            raise ValueError(f"ARX X5 OpenPI preprocessing returned an invalid image: {name}.")
        if mask.shape != () or mask.dtype != np.bool_ or not mask.item():
            raise ValueError(f"ARX X5 OpenPI preprocessing requires an available camera: {name}.")
    tokens, mask = prepared["tokenized_prompt"], prepared["tokenized_prompt_mask"]
    if (not isinstance(tokens, np.ndarray) or tokens.shape != (200,) or tokens.dtype.kind not in "iu" or
            np.any(tokens < 0) or np.any(tokens > np.iinfo(np.int32).max) or
            not isinstance(mask, np.ndarray) or mask.shape != tokens.shape or mask.dtype != np.bool_ or not mask.any()):
        raise ValueError("ARX X5 OpenPI preprocessing returned invalid prompt tokens or availability mask.")
    return prepared
