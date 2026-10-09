from collections.abc import Callable, Mapping
from typing import Any

import numpy as np

from physical_harness.policies.action_outputs import read_action_array


def decode_model_action(decoder: Callable, action: np.ndarray, embodiment_tag: Any,
                        state: dict[str, np.ndarray] | None = None, *,
                        action_dimensions: Mapping[str, int], action_horizon: int) -> dict[str, np.ndarray]:
    read_action_array(action, dimensions=(1, None, None), source="GR00T normalized model output")
    if (action.dtype != np.float32 or action.shape[1] < action_horizon or
            action.shape[2] < sum(action_dimensions.values())):
        raise ValueError("GR00T normalized model output requires float32 values and the configured action capacity.")
    with np.errstate(over="raise", invalid="raise", divide="raise"):
        decoded = decoder(action, embodiment_tag, state)
    if not isinstance(decoded, dict) or set(decoded) != set(action_dimensions):
        raise ValueError("GR00T action decoding returned incompatible modality keys.")
    return {
        key: read_action_array(value, dimensions=(1, action_horizon, action_dimensions[key]),
                               source=f"GR00T decoded action {key}", float32=True)
        for key, value in decoded.items()
    }
