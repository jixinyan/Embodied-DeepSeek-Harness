import argparse
import hashlib
import json
from pathlib import Path
import sys
from unittest import TestCase

import numpy as np
from PIL import Image

from physical_harness.perception.depth_statistics import summarize_predicted_depth


def check(args):
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    assert output.is_relative_to(root / ".local/work") and output != root / ".local/work"
    assert not output.exists()
    sources = {}
    implementation = {}

    def original(path):
        path = path.resolve(strict=True)
        content = path.read_bytes()
        sources[str(path)] = hashlib.sha256(content).hexdigest()
        return content

    def read_json(path):
        return json.loads(original(path))

    for relative in (
        "harness/physical-runtime/src/physical_harness/perception/depth_statistics.py",
        "harness/physical-runtime/src/physical_harness/perception/yolo26_depth.py",
        "scripts/check-depth-statistics-offline.py",
    ):
        implementation[relative] = hashlib.sha256((root / relative).read_bytes()).hexdigest()
    image_hash = hashlib.sha256(original(args.image)).hexdigest()
    directory = args.directory.resolve(strict=True)
    phases = read_json(directory / "result.json")
    records = []
    for phase in phases:
        assert phase["sourceImageSha256"] == image_hash
        for instance in phase["instances"]:
            records.append({
                "name": f'{phase["phase"]}-{instance["objectId"]}',
                "mask": directory / f'{phase["phase"]}-{instance["objectId"]}-mask.png',
                "depth": directory / f'{phase["phase"]}-{instance["objectId"]}-depth.npy',
                "expected": instance["depth"],
                "intrinsics": None,
            })
    calibrated = args.calibrated_directory.resolve(strict=True)
    intrinsics = read_json(calibrated / "intrinsics.json")
    for index in (0, 1):
        result = read_json(calibrated / f"yolo-{index:02d}" / "result.json")
        assert result["source_image_sha256"] == image_hash
        assert result["calibration_id"] == intrinsics["calibration_id"]
        assert result["measurement_kind"] == "monocular_prediction"
        assert result["metric_accuracy"] == "unverified_for_source_camera"
        statistics = result["statistics"]
        records.append({
            "name": f"calibrated-{index}",
            "mask": calibrated / "sam" / f"mask-{index:02d}.png",
            "depth": calibrated / f"yolo-{index:02d}" / "depth.npy",
            "expected": {
                "maskPngSha256": result["region"]["mask_png_sha256"],
                "depthNpySha256": result["depth_npy_sha256"],
                "width": result["width"], "height": result["height"],
                "roiXyxy": result["region"]["roi_xyxy"],
                "selectedPixels": statistics["selected_pixels"],
                "validPixels": statistics["valid_pixels"],
                "invalidPixels": statistics["invalid_pixels"],
                "validFraction": statistics["valid_fraction"],
                "medianAxialDepthM": statistics["median_axial_depth_m"],
                "p10AxialDepthM": statistics["p10_axial_depth_m"],
                "p90AxialDepthM": statistics["p90_axial_depth_m"],
                "medianCameraRangeM": statistics["median_camera_range_m"],
            },
            "intrinsics": intrinsics,
        })
    assert len(records) == 6
    cases = []
    test = TestCase()
    numeric_settings = np.geterr()
    for record in records:
        expected = record["expected"]
        assert hashlib.sha256(original(record["mask"])).hexdigest() == expected["maskPngSha256"]
        assert hashlib.sha256(original(record["depth"])).hexdigest() == expected["depthNpySha256"]
        depth = np.load(record["depth"], allow_pickle=False)
        with Image.open(record["mask"], formats=["PNG"]) as image:
            selected = np.array(image.convert("L")) > 0
        assert depth.shape == (expected["height"], expected["width"])
        roi = expected["roiXyxy"]
        if roi is not None:
            left, top, right, bottom = roi
            bounded = np.zeros(selected.shape, dtype=np.bool_)
            bounded[top:bottom, left:right] = True
            selected &= bounded
        array_hashes = [hashlib.sha256(value.tobytes()).hexdigest() for value in (depth, selected)]
        actual = summarize_predicted_depth(depth, selected, record["intrinsics"])
        for key, reference in (
            ("selected_pixels", "selectedPixels"), ("valid_pixels", "validPixels"),
            ("invalid_pixels", "invalidPixels"), ("valid_fraction", "validFraction"),
        ):
            assert actual[key] == expected[reference], (record["name"], key)
        for key, reference in (
            ("median_axial_depth_m", "medianAxialDepthM"),
            ("p10_axial_depth_m", "p10AxialDepthM"),
            ("p90_axial_depth_m", "p90AxialDepthM"),
            ("median_camera_range_m", "medianCameraRangeM"),
        ):
            if expected[reference] is None:
                assert actual[key] is None
            else:
                assert np.isclose(actual[key], expected[reference], rtol=1e-7, atol=1e-9), (
                    record["name"], key, actual[key], expected[reference],
                )
        cases.append({"record": record["name"], "name": "original-statistics", "statistics": actual})
        invalid_arrays = [
            ("float64-depth", depth.astype(np.float64), selected),
            ("integer-depth", depth.astype(np.int32), selected),
            ("depth-shape", depth[:, 0], selected),
            ("mask-shape", depth, selected[:, :-1]),
            ("mask-type", depth, selected.astype(np.uint8)),
            ("empty-region", depth, np.zeros_like(selected)),
            ("zero-depth", np.zeros_like(depth), selected),
            ("negative-depth", -depth, selected),
            ("nonfinite-depth", np.full_like(depth, np.nan), selected),
            ("infinite-depth", np.full_like(depth, np.inf), selected),
        ]
        for name, invalid_depth, invalid_mask in invalid_arrays:
            with test.assertRaises(ValueError):
                summarize_predicted_depth(invalid_depth, invalid_mask, record["intrinsics"])
            cases.append({"record": record["name"], "name": name, "result": "invalid-derivative-rejected"})
        for key in ("fx", "fy", "cx", "cy"):
            for label, value in (("infinite", float("inf")), ("nan", float("nan")), ("boolean", True)):
                with test.assertRaises(ValueError):
                    summarize_predicted_depth(depth, selected, {**intrinsics, key: value})
                cases.append({"record": record["name"], "name": f"{label}-{key}", "result": "invalid-derivative-rejected"})
        for key in ("fx", "fy"):
            with test.assertRaises(ValueError):
                summarize_predicted_depth(depth, selected, {**intrinsics, key: 0.0})
            cases.append({"record": record["name"], "name": f"zero-{key}", "result": "invalid-derivative-rejected"})
        for name, calibration in (
            ("camera-range-division-overflow", {**intrinsics, "fx": 5e-324}),
            ("camera-range-square-overflow", {**intrinsics, "cx": 1e308}),
        ):
            with test.assertRaises(FloatingPointError):
                summarize_predicted_depth(depth, selected, calibration)
            cases.append({"record": record["name"], "name": name, "result": "arithmetic-rejected"})
        even_region = selected.copy()
        if int(even_region.sum()) % 2:
            even_region[tuple(np.argwhere(even_region)[0])] = False
        with test.assertRaises(FloatingPointError):
            summarize_predicted_depth(np.full_like(depth, np.finfo(np.float32).max), even_region)
        cases.append({"record": record["name"], "name": "axial-reduction-overflow", "result": "arithmetic-rejected"})
        assert array_hashes == [hashlib.sha256(value.tobytes()).hexdigest() for value in (depth, selected)]
        assert np.geterr() == numeric_settings
    for path, digest in {**sources, **{str(root / key): value for key, value in implementation.items()}}.items():
        assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == digest
    assert not any(name.split(".")[0] in {"torch", "ultralytics", "sam3", "omni", "isaacsim"} for name in sys.modules)
    report = {
        "cases": cases,
        "sources": [{"path": path, "sha256": digest} for path, digest in sources.items()],
        "implementation": [{"path": path, "sha256": digest} for path, digest in implementation.items()],
        "originalFilesUnchanged": True, "arrayInputsUnchanged": True, "numericSettingsRestored": True,
        "gpuJobs": 0, "modelCalls": 0, "environmentAllocations": 0,
        "numpyVersion": np.__version__,
        "scope": "Original learned depth/mask/calibration statistics and declared invalid derivatives through the production helper; no new depth inference or metric-accuracy acceptance.",
    }
    output.mkdir(parents=True, exist_ok=False)
    (output / "acceptance.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"output": str(output), "records": len(records), "cases": len(cases)}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--calibrated-directory", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    check(parser.parse_args())


if __name__ == "__main__":
    main()
