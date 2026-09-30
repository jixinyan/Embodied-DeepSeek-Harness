# SPDX-License-Identifier: AGPL-3.0-only
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--capture-manifest", type=Path, required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--sam-endpoint", default="http://127.0.0.1:8005/segment")
    parser.add_argument("--yolo-endpoint", default="http://127.0.0.1:8006/depth")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    manifest_bytes = args.capture_manifest.read_bytes()
    manifest = json.loads(manifest_bytes)
    if (
        manifest["schema_version"] != "edh.robocasa.metric_capture.v1"
        or manifest["provider"] != "robocasa"
        or manifest["read_only"] is not True
        or manifest["robot_state_unchanged"] is not True
        or not manifest["cameras"]
    ):
        raise ValueError("Capture manifest is not a verified read-only native RGB-D capture.")
    args.output.mkdir(parents=True, exist_ok=False)
    script_root = Path(__file__).resolve().parent
    cameras = {}
    for camera_name, record in manifest["cameras"].items():
        image_path = Path(record["rgb_path"])
        depth_path = Path(record["depth_path"])
        if (
            hashlib.sha256(image_path.read_bytes()).hexdigest() != record["rgb_sha256"]
            or hashlib.sha256(depth_path.read_bytes()).hexdigest() != record["depth_sha256"]
            or record["camera_name"] != camera_name
            or record["image_origin"] != "top_left"
            or record["depth_kind"] != "axial"
            or record["depth_unit"] != "metre"
            or record["rgb_matches_native_observation"] is not True
        ):
            raise ValueError("Capture source digest, orientation or depth convention differs from its manifest.")
        camera_output = args.output / camera_name
        camera_output.mkdir()
        intrinsics = {
            "calibration_id": record["calibration_id"],
            **{field: record[field] for field in ("fx", "fy", "cx", "cy")},
        }
        intrinsic_path = camera_output / "intrinsics.json"
        intrinsic_path.write_text(json.dumps(intrinsics, indent=2, allow_nan=False), encoding="utf8")
        sam_output = camera_output / "sam"
        subprocess.run(
            [
                sys.executable, str(script_root / "check_sam31.py"),
                "--image", str(image_path), "--prompt", args.prompt,
                "--endpoint", args.sam_endpoint, "--output", str(sam_output),
            ],
            check=True,
        )
        sam_report = json.loads((sam_output / "result.json").read_text())
        if sam_report["source_image_sha256"] != record["rgb_sha256"]:
            raise ValueError("SAM source digest differs from its native capture.")
        instances = []
        for index, instance in enumerate(sam_report["instances"]):
            yolo_output = camera_output / f"yolo-{index:02d}"
            subprocess.run(
                [
                    sys.executable, str(script_root / "check_yolo26_depth.py"),
                    "--image", str(image_path),
                    "--mask", str(sam_output / f"mask-{index:02d}.png"),
                    "--intrinsics", str(intrinsic_path),
                    "--ground-truth-depth", str(depth_path),
                    "--endpoint", args.yolo_endpoint, "--output", str(yolo_output),
                ],
                check=True,
            )
            yolo_report = json.loads((yolo_output / "result.json").read_text())
            if yolo_report["statistics"]["selected_pixels"] != instance["area_pixels"]:
                raise ValueError("YOLO depth region differs from its SAM instance mask.")
            instances.append({"segmentation": instance, "depth": yolo_report})
        cameras[camera_name] = {
            "capture": record,
            "sam": sam_report,
            "instances": instances,
        }
    if not any(camera["instances"] for camera in cameras.values()):
        raise ValueError("SAM produced no object regions for native metric comparison.")
    report = {
        "capture_manifest": str(args.capture_manifest.resolve()),
        "capture_manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "task_id": manifest["task_id"],
        "prompt": args.prompt,
        "alignment": "none",
        "cameras": cameras,
    }
    (args.output / "result.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf8")
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    main()
