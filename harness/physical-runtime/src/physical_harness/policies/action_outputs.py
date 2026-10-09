import numpy as np


def selected_action_count(max_actions: int, horizon: int, *, source: str) -> int:
    if type(max_actions) is not int or not 1 <= max_actions <= 512:
        raise ValueError(f"{source} requires an integer action limit between 1 and 512.")
    if type(horizon) is not int or horizon <= 0:
        raise ValueError(f"{source} requires a positive integer action horizon.")
    return min(max_actions, horizon)


def read_action_array(value: np.ndarray, *, dimensions: tuple[int | None, ...],
                      source: str, float32: bool = False) -> np.ndarray:
    if (not isinstance(value, np.ndarray) or value.ndim != len(dimensions) or
            any(size <= 0 or expected is not None and size != expected
                for size, expected in zip(value.shape, dimensions, strict=True))):
        raise ValueError(f"{source} returned an invalid action shape; expected {dimensions} with positive dimensions.")
    if value.dtype.kind not in "fiu":
        raise ValueError(f"{source} actions require a real numeric array.")
    if not np.isfinite(value).all():
        raise ValueError(f"{source} returned nonfinite actions.")
    if float32:
        maximum = np.finfo(np.float32).max
        if np.any(value > maximum) or np.any(value < -maximum):
            raise ValueError(f"{source} actions exceed the finite float32 range.")
        return value.astype(np.float32, copy=False)
    return value
