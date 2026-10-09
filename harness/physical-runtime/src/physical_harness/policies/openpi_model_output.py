from collections.abc import Callable

import numpy as np

from physical_harness.policies.action_outputs import read_action_array


def decode_model_actions(predicted: dict, transform: Callable[[dict], dict]) -> dict:
    if not isinstance(predicted, dict) or set(predicted) != {"state", "actions"}:
        raise ValueError("ARX X5 OpenPI model output requires state and actions.")
    for name, dimensions in (("state", (32,)), ("actions", (50, 32))):
        value = read_action_array(predicted[name], dimensions=dimensions,
                                  source=f"ARX X5 OpenPI normalized {name}", float32=True)
        if predicted[name].dtype.kind != "f" or not np.isfinite(value).all():
            raise ValueError(f"ARX X5 OpenPI normalized {name} requires finite floating-point values.")
    with np.errstate(over="raise", invalid="raise", divide="raise"):
        decoded = transform(predicted)
    if not isinstance(decoded, dict) or set(decoded) != {"actions"}:
        raise ValueError("ARX X5 OpenPI decoding returned incompatible action fields.")
    actions = read_action_array(decoded["actions"], dimensions=(50, 14),
                                source="ARX X5 OpenPI decoded actions", float32=True)
    return {"actions": actions}
