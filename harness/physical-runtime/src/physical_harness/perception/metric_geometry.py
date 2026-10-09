# SPDX-License-Identifier: AGPL-3.0-only
import hashlib
import io
import math

import numpy as np
from PIL import Image


def summarize_metric_region(
    *,
    axial_depth_m: np.ndarray,
    mask_png: bytes,
    source_image_png: bytes,
    expected_source_image_sha256: str,
    intrinsic_matrix: np.ndarray,
    camera_to_world: np.ndarray,
    calibration_id: str,
    observation_id: str,
    camera_name: str,
    observed_at: str,
    simulation_time_s: float,
    source: str,
    world_frame: str,
    minimum_depth_m: float | None = None,
    maximum_depth_m: float | None = None,
) -> dict:
    source_digest = hashlib.sha256(source_image_png).hexdigest()
    if source_digest != expected_source_image_sha256:
        raise ValueError("Metric geometry source image differs from the requested observation.")
    if not all(isinstance(value, str) and value for value in (calibration_id, observation_id, camera_name, observed_at, source, world_frame)):
        raise ValueError("Metric geometry requires complete capture and calibration identities.")
    if not math.isfinite(simulation_time_s) or simulation_time_s < 0:
        raise ValueError("Metric geometry requires a finite nonnegative simulator time.")
    with Image.open(io.BytesIO(source_image_png)) as source_image:
        source_image.load()
        if source_image.format != "PNG":
            raise ValueError("Metric geometry source must be a native PNG image.")
        width, height = source_image.size
    if (
        width < 1 or height < 1 or width * height > 4_000_000
        or not isinstance(axial_depth_m, np.ndarray)
        or axial_depth_m.dtype != np.float32
        or axial_depth_m.shape != (height, width)
    ):
        raise ValueError("Metric depth must be a source-sized float32 array in meters.")
    with Image.open(io.BytesIO(mask_png)) as decoded:
        decoded.load()
        if decoded.format != "PNG" or decoded.size != (width, height):
            raise ValueError("Metric mask must be a source-sized PNG.")
        pixels = np.asarray(decoded)
        if decoded.mode == "L":
            mask = pixels
        elif decoded.mode in ("RGB", "RGBA"):
            if (
                not np.array_equal(pixels[:, :, 0], pixels[:, :, 1])
                or not np.array_equal(pixels[:, :, 0], pixels[:, :, 2])
                or (decoded.mode == "RGBA" and not np.all(pixels[:, :, 3] == 255))
            ):
                raise ValueError("Metric mask must contain opaque grayscale pixels.")
            mask = pixels[:, :, 0]
        else:
            raise ValueError("Metric mask must use L, RGB or RGBA PNG channels.")
    if not np.all((mask == 0) | (mask == 255)):
        raise ValueError("Metric mask must contain binary pixels.")
    intrinsic = np.asarray(intrinsic_matrix, dtype=np.float64)
    transform = np.asarray(camera_to_world, dtype=np.float64)
    if (
        intrinsic.shape != (3, 3) or not np.isfinite(intrinsic).all()
        or intrinsic[0, 0] <= 0 or intrinsic[1, 1] <= 0
        or not np.array_equal(intrinsic[2], [0, 0, 1])
        or transform.shape != (4, 4) or not np.isfinite(transform).all()
        or not np.array_equal(transform[3], [0, 0, 0, 1])
        or not np.allclose(transform[:3, :3].T @ transform[:3, :3], np.eye(3), rtol=0, atol=1e-6)
        or not np.isclose(np.linalg.det(transform[:3, :3]), 1, rtol=0, atol=1e-6)
    ):
        raise ValueError("Metric geometry requires finite camera intrinsics and a rigid camera-to-world transform.")
    for bound in (minimum_depth_m, maximum_depth_m):
        if bound is not None and (not math.isfinite(bound) or bound <= 0):
            raise ValueError("Metric depth bounds must be finite positive meter values.")
    if minimum_depth_m is not None and maximum_depth_m is not None and minimum_depth_m >= maximum_depth_m:
        raise ValueError("Metric depth upper bound must exceed its lower bound.")
    selected = mask > 0
    selected_count = int(selected.sum())
    if selected_count == 0:
        raise ValueError("Metric region contains no selected pixels.")
    valid = selected & np.isfinite(axial_depth_m) & (axial_depth_m > 0)
    if minimum_depth_m is not None:
        valid &= axial_depth_m > minimum_depth_m
    if maximum_depth_m is not None:
        valid &= axial_depth_m < maximum_depth_m
    valid_count = int(valid.sum())
    if valid_count == 0:
        raise ValueError("Metric region contains no valid depth pixels within its bounds.")
    rows, columns = np.nonzero(valid)
    axial = axial_depth_m[valid].astype(np.float64)
    pixels = np.stack((columns, rows, np.ones(valid_count)), axis=0)
    with np.errstate(over="raise", invalid="raise", divide="raise"):
        rays = np.linalg.solve(intrinsic, pixels)
        camera_points = (rays * axial).T
        world_points = camera_points @ transform[:3, :3].T + transform[:3, 3]
        ranges = np.linalg.norm(camera_points, axis=1)
        if not np.isfinite(camera_points).all() or not np.isfinite(world_points).all():
            raise ValueError("Metric back-projection produced non-finite points.")
        centroid_camera = camera_points.mean(axis=0).tolist()
        centroid_world = world_points.mean(axis=0).tolist()
        median_camera = np.median(camera_points, axis=0).tolist()
        median_world = np.median(world_points, axis=0).tolist()
    return {
        "source": source,
        "measurement_kind": "simulator_metric_depth",
        "unit": "meter",
        "distance_frame": "camera_axial_depth",
        "centroid_kind": "mean_of_visible_valid_surface_points",
        "coordinate_axes": ["right", "down", "forward"],
        "world_frame": world_frame,
        "source_image_sha256": source_digest,
        "mask_png_sha256": hashlib.sha256(mask_png).hexdigest(),
        "observation_id": observation_id,
        "camera": camera_name,
        "measured_at": observed_at,
        "simulation_time_s": simulation_time_s,
        "width": width,
        "height": height,
        "selected_pixels": selected_count,
        "valid_pixels": valid_count,
        "invalid_pixels": selected_count - valid_count,
        "valid_fraction": valid_count / selected_count,
        "median_axial_depth_m": float(np.median(axial)),
        "p10_axial_depth_m": float(np.percentile(axial, 10)),
        "p90_axial_depth_m": float(np.percentile(axial, 90)),
        "median_camera_range_m": float(np.median(ranges)),
        "centroid_pixel": [float(columns.mean()), float(rows.mean())],
        "centroid_camera_xyz": centroid_camera,
        "centroid_world_xyz": centroid_world,
        "median_camera_xyz": median_camera,
        "median_world_xyz": median_world,
        "minimum_depth_m": minimum_depth_m,
        "maximum_depth_m": maximum_depth_m,
        "intrinsics": {
            "calibration_id": calibration_id,
            "fx": float(intrinsic[0, 0]),
            "fy": float(intrinsic[1, 1]),
            "cx": float(intrinsic[0, 2]),
            "cy": float(intrinsic[1, 2]),
        },
        "intrinsic_matrix": intrinsic.tolist(),
        "camera_to_world": transform.tolist(),
    }
