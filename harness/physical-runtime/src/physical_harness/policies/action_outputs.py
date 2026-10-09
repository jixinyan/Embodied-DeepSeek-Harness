import numpy as np


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
