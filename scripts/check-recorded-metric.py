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
    args = parser.parse_args()
    record = args.record.resolve(strict=True)
    sources = {str(path): sha256(path.read_bytes()).hexdigest() for path in (
        record / "measurement.json", record / "calibration.npz", record / "mask.png", record / "source.png")}
    result = json.loads((record / "measurement.json").read_text())
    with np.load(record / "calibration.npz", allow_pickle=False) as arrays:
        measured = summarize_metric_region(
            axial_depth_m=arrays["axial_depth_m"], intrinsic_matrix=arrays["intrinsic_matrix"],
            camera_to_world=arrays["camera_to_world"], mask_png=(record / "mask.png").read_bytes(),
            source_image_png=(record / "source.png").read_bytes(),
            expected_source_image_sha256=result["source_image_sha256"],
            calibration_id=result["intrinsics"]["calibration_id"], observation_id=result["observation_id"],
            camera_name=result["camera"], observed_at=result["measured_at"],
            simulation_time_s=result["simulation_time_s"], source=result["source"], world_frame=result["world_frame"],
            minimum_depth_m=result["minimum_depth_m"], maximum_depth_m=result["maximum_depth_m"],
        )
    roundoff = compare_measurement(result, measured)
    if any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("Native measurement source changed during recomputation.")
    report = {"provider": result["provider"], "camera": result["camera"],
              "observationId": result["observation_id"], "validPixels": result["valid_pixels"],
              "medianAxialDepthM": result["median_axial_depth_m"],
              "sourceImageSha256": result["source_image_sha256"], "recomputed": True,
              "sourceFilesUnchanged": True, "sources": sources,
              "derivedGeometryRoundoff": roundoff,
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
