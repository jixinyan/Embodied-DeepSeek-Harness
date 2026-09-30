# SPDX-License-Identifier: AGPL-3.0-only
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--mask", type=Path, required=True)
    parser.add_argument("--endpoint", default="http://127.0.0.1:8006/depth")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--intrinsics", type=Path)
    parser.add_argument("--ground-truth-depth", type=Path)
    args = parser.parse_args()
    image_bytes = args.image.read_bytes()
    mask_bytes = args.mask.read_bytes()
    with Image.open(args.image) as image:
        image.load()
        width, height = image.size
        mime_type = Image.MIME[image.format]
    with Image.open(args.mask) as mask:
        mask.load()
        if mask.format != "PNG" or mask.size != (width, height):
            raise ValueError("Mask must be a source-sized PNG.")
        mask_array = np.asarray(mask.convert("L"))
    if not np.all((mask_array == 0) | (mask_array == 255)):
        raise ValueError("Mask must contain binary pixels.")
    intrinsics = json.loads(args.intrinsics.read_text()) if args.intrinsics else None
    request = Request(
        args.endpoint,
        data=json.dumps(
            {
                "image_base64": base64.b64encode(image_bytes).decode("ascii"),
                "image_mime_type": mime_type,
                "mask_png_base64": base64.b64encode(mask_bytes).decode("ascii"),
                "intrinsics": intrinsics,
            }
        ).encode("utf8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=600) as response:
        result = json.load(response)
    depth_bytes = base64.b64decode(result["depth_npy_base64"], validate=True)
    overlay_bytes = base64.b64decode(result["overlay_png_base64"], validate=True)
    if hashlib.sha256(depth_bytes).hexdigest() != result["depth_npy_sha256"]:
        raise ValueError("Depth array digest differs from the response.")
    depth = np.load(io.BytesIO(depth_bytes), allow_pickle=False)
    if depth.shape != (height, width) or depth.dtype != np.float32:
        raise ValueError("Depth array dimensions or type differ from the source image.")
    if result["source_image_sha256"] != hashlib.sha256(image_bytes).hexdigest():
        raise ValueError("Source image digest differs from the response.")
    if (
        result["width"] != width or result["height"] != height
        or result["unit"] != "meter" or result["distance_frame"] != "camera_axial_depth"
        or result["calibration_id"] != (intrinsics["calibration_id"] if intrinsics else None)
    ):
        raise ValueError("Depth convention, source dimensions or calibration identity differ from the input.")
    if result["region"]["mask_png_sha256"] != hashlib.sha256(mask_bytes).hexdigest():
        raise ValueError("Mask digest differs from the response.")
    selected = mask_array > 0
    valid = selected & np.isfinite(depth) & (depth > 0)
    axial = depth[valid]
    stats = result["statistics"]
    expected = {
        "selected_pixels": int(selected.sum()),
        "valid_pixels": int(valid.sum()),
        "invalid_pixels": int(selected.sum() - valid.sum()),
        "valid_fraction": float(valid.sum() / selected.sum()),
        "median_axial_depth_m": float(np.median(axial)),
        "p10_axial_depth_m": float(np.percentile(axial, 10)),
        "p90_axial_depth_m": float(np.percentile(axial, 90)),
    }
    if intrinsics is not None:
        rows, columns = np.nonzero(valid)
        ranges = axial * np.sqrt(
            1.0
            + np.square((columns - intrinsics["cx"]) / intrinsics["fx"])
            + np.square((rows - intrinsics["cy"]) / intrinsics["fy"])
        )
        expected["median_camera_range_m"] = float(np.median(ranges))
    for key, value in expected.items():
        if not np.isclose(stats[key], value, rtol=1e-7, atol=1e-9):
            raise ValueError(f"Returned statistic {key} differs from the retained depth array.")
    with Image.open(io.BytesIO(overlay_bytes)) as overlay:
        overlay.load()
        if overlay.size != (width, height):
            raise ValueError("Depth overlay dimensions differ from the source image.")
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "depth.npy").write_bytes(depth_bytes)
    (args.output / "overlay.png").write_bytes(overlay_bytes)
    report = {
        key: value
        for key, value in result.items()
        if key not in {"depth_npy_base64", "overlay_png_base64"}
    }
    report["source_image"] = str(args.image)
    report["mask_image"] = str(args.mask)
    report["overlay_png_sha256"] = hashlib.sha256(overlay_bytes).hexdigest()
    if args.ground_truth_depth:
        ground_truth = np.load(args.ground_truth_depth, allow_pickle=False)
        if ground_truth.shape != depth.shape or ground_truth.dtype != np.float32:
            raise ValueError("Ground-truth dimensions or type differ from the prediction.")
        paired = valid & np.isfinite(ground_truth) & (ground_truth > 0)
        if paired.sum() < 10:
            raise ValueError("Fewer than ten valid paired depth pixels are available.")
        prediction = depth[paired].astype(np.float64)
        target = ground_truth[paired].astype(np.float64)
        ratio = np.maximum(prediction / target, target / prediction)
        report["ground_truth_comparison"] = {
            "alignment": "none",
            "unit": "meter",
            "measurement_kind": "simulator_metric_depth",
            "ground_truth_sha256": hashlib.sha256(args.ground_truth_depth.read_bytes()).hexdigest(),
            "paired_pixels": int(paired.sum()),
            "paired_fraction": float(paired.sum() / selected.sum()),
            "median_ground_truth_axial_depth_m": float(np.median(target)),
            "p10_ground_truth_axial_depth_m": float(np.percentile(target, 10)),
            "p90_ground_truth_axial_depth_m": float(np.percentile(target, 90)),
            "median_predicted_to_ground_truth_ratio": float(np.median(prediction / target)),
            "median_absolute_error_m": float(np.median(np.abs(prediction - target))),
            "abs_rel": float(np.mean(np.abs(prediction - target) / target)),
            "rmse_m": float(np.sqrt(np.mean(np.square(prediction - target)))),
            "delta1": float(np.mean(ratio < 1.25)),
        }
        if intrinsics is not None:
            rows, columns = np.nonzero(paired)
            range_factor = np.sqrt(
                1.0
                + np.square((columns - intrinsics["cx"]) / intrinsics["fx"])
                + np.square((rows - intrinsics["cy"]) / intrinsics["fy"])
            )
            report["ground_truth_comparison"]["median_ground_truth_camera_range_m"] = float(
                np.median(target * range_factor)
            )
    (args.output / "result.json").write_text(json.dumps(report, indent=2), encoding="utf8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
