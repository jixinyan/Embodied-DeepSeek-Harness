import argparse
import json
from pathlib import Path

import numpy as np

from physical_harness.perception.metric_geometry import summarize_metric_region


def main():
    parser = argparse.ArgumentParser(description="Recompute a retained actual native masked RGB-D measurement.")
    parser.add_argument("--record", type=Path, required=True)
    args = parser.parse_args()
    record = args.record.resolve(strict=True)
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
    if any(measured[key] != value for key, value in result.items() if key in measured):
        raise ValueError("Retained native measurement differs from its original metric arrays or PNG sources.")
    print(json.dumps({"provider": result["provider"], "camera": result["camera"],
                      "observationId": result["observation_id"], "validPixels": result["valid_pixels"],
                      "medianAxialDepthM": result["median_axial_depth_m"],
                      "sourceImageSha256": result["source_image_sha256"], "recomputed": True}))


if __name__ == "__main__":
    main()
