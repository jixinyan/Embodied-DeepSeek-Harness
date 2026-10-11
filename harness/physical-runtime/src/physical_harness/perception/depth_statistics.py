# SPDX-License-Identifier: AGPL-3.0-only
import math
from collections.abc import Mapping

import numpy as np


def summarize_predicted_depth(
    depth: np.ndarray,
    selected: np.ndarray,
    intrinsics: Mapping[str, object] | None = None,
) -> dict[str, int | float | None]:
    if (
        not isinstance(depth, np.ndarray) or depth.dtype != np.float32 or depth.ndim != 2
        or not isinstance(selected, np.ndarray) or selected.dtype != np.bool_
        or selected.shape != depth.shape or not depth.size or depth.size > 4_000_000
    ):
        raise ValueError("Predicted depth requires a bounded float32 image and matching boolean region.")
    if intrinsics is not None:
        values = [intrinsics[key] for key in ("fx", "fy", "cx", "cy")]
        if (
            any(type(value) not in (int, float) or not math.isfinite(value) for value in values)
            or values[0] <= 0 or values[1] <= 0
        ):
            raise ValueError("Predicted depth requires finite intrinsics and positive focal lengths.")
    selected_count = int(selected.sum())
    if selected_count == 0:
        raise ValueError("Selected region contains no pixels.")
    valid = selected & np.isfinite(depth) & (depth > 0)
    valid_count = int(valid.sum())
    if valid_count == 0:
        raise ValueError("Selected region contains no valid predicted depth pixels.")
    axial = depth[valid]
    camera_range = None
    with np.errstate(over="raise", invalid="raise", divide="raise"):
        if intrinsics is not None:
            rows, columns = np.nonzero(valid)
            ranges = axial * np.sqrt(
                1.0
                + np.square((columns - intrinsics["cx"]) / intrinsics["fx"])
                + np.square((rows - intrinsics["cy"]) / intrinsics["fy"])
            )
            if not np.isfinite(ranges).all() or not np.all(ranges > 0):
                raise ValueError("Predicted camera ranges must be finite positive meter values.")
            camera_range = float(np.median(ranges))
        median = float(np.median(axial))
        p10 = float(np.percentile(axial, 10))
        p90 = float(np.percentile(axial, 90))
    if not all(math.isfinite(value) and value > 0 for value in (median, p10, p90)):
        raise ValueError("Predicted axial statistics must be finite positive meter values.")
    if camera_range is not None and not (math.isfinite(camera_range) and camera_range > 0):
        raise ValueError("Predicted camera range must be a finite positive meter value.")
    return {
        "selected_pixels": selected_count,
        "valid_pixels": valid_count,
        "invalid_pixels": selected_count - valid_count,
        "valid_fraction": valid_count / selected_count,
        "median_axial_depth_m": median,
        "p10_axial_depth_m": p10,
        "p90_axial_depth_m": p90,
        "median_camera_range_m": camera_range,
    }
