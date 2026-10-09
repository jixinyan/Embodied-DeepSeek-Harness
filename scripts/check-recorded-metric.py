import argparse
from hashlib import sha256
import json
from pathlib import Path

import numpy as np

from physical_harness.perception.metric_geometry import summarize_metric_region


def compare_measurement(recorded: dict, measured: dict) -> dict:
    accumulated_fields = {"median_camera_range_m", "centroid_camera_xyz", "centroid_world_xyz",
                          "median_camera_xyz", "median_world_xyz"}
    differences = {}
    roundoff = {}
    count = measured["valid_pixels"]
    epsilon = np.finfo(np.float64).eps
    accumulation_bound = count * epsilon / (1 - count * epsilon)
    for key, value in measured.items():
        if key not in recorded:
            raise ValueError(f"Retained native metric field is missing: {key}")
        if key not in accumulated_fields:
            if value != recorded[key]:
                differences[key] = {"recorded": recorded[key], "recomputed": value}
            continue
        original = np.asarray(recorded[key], dtype=np.float64)
        current = np.asarray(value, dtype=np.float64)
        if original.shape != current.shape or not np.isfinite(original).all() or not np.isfinite(current).all():
            raise ValueError(f"Invalid retained numeric metric shape or value: {key}")
        scale = max(1.0, float(np.max(np.abs(original))), float(np.max(np.abs(current))))
        bound = 8 * accumulation_bound * scale
        drift = float(np.max(np.abs(original - current)))
        if drift > bound:
            differences[key] = {"absoluteDifferenceM": drift, "float64AccumulationBoundM": bound}
        roundoff[key] = {"absoluteDifferenceM": drift, "float64AccumulationBoundM": bound}
    if differences:
        raise ValueError(f"Retained native metric differences: {json.dumps(differences, allow_nan=False)}")
    return roundoff


def main():
    parser = argparse.ArgumentParser(description="Recompute a retained actual native masked RGB-D measurement.")
    parser.add_argument("--record", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check-numeric-admission", action="store_true",
                        help="Reject explicitly invalid camera-range and world-centroid calibration derivatives.")
    args = parser.parse_args()
    record = args.record.resolve(strict=True)
    sources = {str(path): sha256(path.read_bytes()).hexdigest() for path in (
        record / "measurement.json", record / "calibration.npz", record / "mask.png", record / "source.png",
        Path(__file__).resolve(), Path(__file__).resolve().parents[1] /
        "harness/physical-runtime/src/physical_harness/perception/metric_geometry.py")}
    result = json.loads((record / "measurement.json").read_text())
    with np.load(record / "calibration.npz", allow_pickle=False) as arrays:
        inputs = dict(
            axial_depth_m=arrays["axial_depth_m"], intrinsic_matrix=arrays["intrinsic_matrix"],
            camera_to_world=arrays["camera_to_world"], mask_png=(record / "mask.png").read_bytes(),
            source_image_png=(record / "source.png").read_bytes(),
            expected_source_image_sha256=result["source_image_sha256"],
            calibration_id=result["intrinsics"]["calibration_id"], observation_id=result["observation_id"],
            camera_name=result["camera"], observed_at=result["measured_at"],
            simulation_time_s=result["simulation_time_s"], source=result["source"], world_frame=result["world_frame"],
            minimum_depth_m=result["minimum_depth_m"], maximum_depth_m=result["maximum_depth_m"],
        )
        measured = summarize_metric_region(**inputs)
    roundoff = compare_measurement(result, measured)
    numeric_admission = []
    if args.check_numeric_admission:
        for name in ("camera-range-overflow", "world-centroid-overflow"):
            derivative = dict(inputs)
            if name == "camera-range-overflow":
                changed = np.asarray(inputs["intrinsic_matrix"], dtype=np.float64).copy()
                changed[0, 0] = changed[1, 1] = 1e-170
                derivative["intrinsic_matrix"] = changed
            else:
                changed = np.asarray(inputs["camera_to_world"], dtype=np.float64).copy()
                changed[:3, 3] = np.finfo(np.float64).max / 2
                derivative["camera_to_world"] = changed
            if not np.isfinite(changed).all():
                raise ValueError("Numeric admission derivatives must contain finite calibration values.")
            derivative["calibration_id"] = sha256(changed.tobytes()).hexdigest()
            try:
                summarize_metric_region(**derivative)
            except FloatingPointError as error:
                if "overflow" not in str(error):
                    raise
                numeric_admission.append({"name": name, "result": "rejected",
                                          "changedCalibrationSha256": derivative["calibration_id"],
                                          "originalError": str(error)})
            else:
                raise ValueError("Invalid calibration arithmetic did not fail at production geometry.")
    if any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("Native measurement source changed during recomputation.")
    report = {"provider": result["provider"], "camera": result["camera"],
              "observationId": result["observation_id"], "validPixels": result["valid_pixels"],
              "medianAxialDepthM": result["median_axial_depth_m"],
              "sourceImageSha256": result["source_image_sha256"], "recomputed": True,
              "sourceFilesUnchanged": True, "sources": sources,
              "derivedGeometryRoundoff": roundoff,
              "numericAdmissionChecked": args.check_numeric_admission,
              "numericAdmission": numeric_admission,
              "scope": "Production geometry on original RGB-D arrays and PNG records; no new model or simulation execution."}
    if args.output:
        output = args.output.resolve()
        if not output.is_relative_to(Path(__file__).resolve().parents[1] / ".local" / "work"):
            raise ValueError("Metric diagnostic output must remain under .local/work.")
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("x", encoding="utf-8") as stream:
            stream.write(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    main()
