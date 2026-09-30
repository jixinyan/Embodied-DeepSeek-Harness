# SPDX-License-Identifier: AGPL-3.0-only
import argparse
import hashlib
import json
from pathlib import Path
import unittest

import numpy as np
from PIL import Image

from physical_harness.perception.metric_geometry import summarize_metric_region


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--comparison-report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report_bytes = args.comparison_report.read_bytes()
    comparison = json.loads(report_bytes)
    records = []
    for camera_name, camera in comparison["cameras"].items():
        capture = camera["capture"]
        source_image = Path(capture["rgb_path"]).read_bytes()
        depth_path = Path(capture["depth_path"])
        if hashlib.sha256(depth_path.read_bytes()).hexdigest() != capture["depth_sha256"]:
            raise ValueError("Native depth differs from its source capture.")
        depth = np.load(depth_path, allow_pickle=False)
        for instance in camera["instances"]:
            mask_path = Path(instance["depth"]["mask_image"])
            parameters = {
                "axial_depth_m": depth,
                "mask_png": mask_path.read_bytes(),
                "source_image_png": source_image,
                "expected_source_image_sha256": capture["rgb_sha256"],
                "intrinsic_matrix": np.asarray(capture["intrinsic_matrix"]),
                "camera_to_world": np.asarray(capture["camera_to_world"]),
                "calibration_id": capture["calibration_id"],
                "observation_id": capture["observation_id"],
                "camera_name": camera_name,
                "observed_at": capture["observed_at"],
                "simulation_time_s": capture["simulation_time_s"],
                "source": "robocasa-native-rgbd",
                "world_frame": "simulator_world",
                "minimum_depth_m": capture["near_m"],
                "maximum_depth_m": capture["far_m"],
            }
            measured = summarize_metric_region(**parameters)
            with Image.open(mask_path) as mask:
                selected = np.asarray(mask.convert("L")) > 0
            valid = selected & np.isfinite(depth) & (depth > capture["near_m"]) & (depth < capture["far_m"])
            rows, columns = np.nonzero(valid)
            axial = depth[valid].astype(np.float64)
            points = np.stack((
                axial * (columns - capture["cx"]) / capture["fx"],
                axial * (rows - capture["cy"]) / capture["fy"],
                axial,
            ), axis=1)
            transform = np.asarray(capture["camera_to_world"])
            centroid_world = transform @ np.append(points.mean(axis=0), 1.0)
            expectations = {
                "centroid_pixel": [columns.mean(), rows.mean()],
                "centroid_camera_xyz": points.mean(axis=0),
                "centroid_world_xyz": centroid_world[:3],
                "median_axial_depth_m": np.median(axial),
                "median_camera_range_m": np.median(np.linalg.norm(points, axis=1)),
            }
            for field, value in expectations.items():
                if not np.allclose(measured[field], value, rtol=1e-12, atol=1e-12):
                    raise ValueError(f"Metric field {field} differs from independent native-depth computation.")
            if measured["selected_pixels"] != instance["segmentation"]["area_pixels"]:
                raise ValueError("Measured geometry differs from its SAM region.")
            other_camera = next(
                item["capture"] for name, item in comparison["cameras"].items() if name != camera_name
            )
            with unittest.TestCase().assertRaisesRegex(ValueError, "source image differs"):
                summarize_metric_region(**{
                    **parameters,
                    "expected_source_image_sha256": other_camera["rgb_sha256"],
                })
            records.append(measured)
    if not records:
        raise ValueError("No native SAM regions are available for metric geometry acceptance.")
    result = {
        "comparison_report_sha256": hashlib.sha256(report_bytes).hexdigest(),
        "metric_regions": records,
        "independent_back_projection_checks": "passed",
        "different_native_camera_source_rejection": "passed",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf8")
    print(json.dumps(result, allow_nan=False))


if __name__ == "__main__":
    main()
