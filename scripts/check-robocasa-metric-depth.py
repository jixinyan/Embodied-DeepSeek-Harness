import argparse
import asyncio
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image

from physical_harness.environments.robocasa import CAMERA_NAMES, RoboCasaEnvironment
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.validation import ContractValidator


async def check(output: Path, task_id: str, seed: int) -> dict:
    root = Path(__file__).resolve().parents[1]
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    environment = RoboCasaEnvironment(validator)
    device = NativeActionDevice(environment)
    try:
        await device.on_owner(environment.reset, task_id, {"seed": seed, "split": "pretrain"})
        before = await device.on_owner(environment.observe)
        description = await device.on_owner(environment.describe)
        capture = await device.on_owner(environment.capture_metric_depth)
        after = await device.on_owner(environment.observe)
        if before.state != after.state:
            raise RuntimeError("Read-only metric capture changed the native robot state.")
        if tuple(capture["cameras"]) != CAMERA_NAMES:
            raise RuntimeError("Metric capture omitted a registered native camera.")
        output.mkdir(parents=True, exist_ok=False)
        records = {}
        for camera, sample in capture["cameras"].items():
            rgb_path = output / f"{camera}.png"
            depth_path = output / f"{camera}-axial-depth-m.npy"
            with Image.open(BytesIO(sample["rgb_png"])) as image:
                pixels = np.asarray(image)
            with Image.open(BytesIO(before.images[camera])) as image:
                reference = np.asarray(image)
            with Image.open(BytesIO(after.images[camera])) as image:
                following = np.asarray(image)
            if not np.array_equal(pixels, reference) or not np.array_equal(pixels, following):
                raise RuntimeError("Paired metric RGB differs from the native camera observation orientation.")
            rgb_path.write_bytes(sample["rgb_png"])
            np.save(depth_path, sample["axial_depth_m"], allow_pickle=False)
            intrinsic = sample["intrinsic_matrix"]
            calibration_id = "robocasa-camera:" + hashlib.sha256(json.dumps({
                "camera_name": camera, "width": 256, "height": 256,
                "intrinsic_matrix": intrinsic.tolist(), "depth_kind": "axial",
                "image_origin": "top_left",
            }, sort_keys=True, allow_nan=False).encode("utf-8")).hexdigest()
            record = {
                "camera_name": camera,
                "calibration_id": calibration_id,
                "observation_id": capture["observation_id"],
                "observed_at": sample["observed_at"],
                "simulation_time_s": capture["simulation_time_s"],
                "width": 256,
                "height": 256,
                "image_origin": "top_left",
                "depth_kind": "axial",
                "depth_unit": "metre",
                "camera_coordinate_axes": ["right", "down", "forward"],
                "rgb_path": str(rgb_path.resolve()),
                "depth_path": str(depth_path.resolve()),
                "rgb_sha256": hashlib.sha256(rgb_path.read_bytes()).hexdigest(),
                "depth_sha256": hashlib.sha256(depth_path.read_bytes()).hexdigest(),
                "intrinsic_matrix": intrinsic.tolist(),
                "fx": float(intrinsic[0, 0]),
                "fy": float(intrinsic[1, 1]),
                "cx": float(intrinsic[0, 2]),
                "cy": float(intrinsic[1, 2]),
                "camera_to_world": sample["camera_to_world"].tolist(),
                "near_m": sample["near_m"],
                "far_m": sample["far_m"],
                "minimum_axial_depth_m": float(sample["axial_depth_m"].min()),
                "maximum_axial_depth_m": float(sample["axial_depth_m"].max()),
                "rgb_matches_native_observation": True,
            }
            (output / f"{camera}-calibration.json").write_text(
                json.dumps(record, indent=2, allow_nan=False) + "\n", encoding="utf-8"
            )
            records[camera] = record
        report = {
            "schema_version": "edh.robocasa.metric_capture.v1",
            "provider": "robocasa",
            "task_id": task_id,
            "scene_metadata": description.scene_metadata,
            "source_revision": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip(),
            "source_changes": subprocess.check_output(["git", "status", "--short"], cwd=root, text=True).strip(),
            "render_source": "robosuite.MjSim.render(depth=True)",
            "depth_conversion": "robosuite.utils.camera_utils.get_real_depth_map",
            "calibration_source": "robosuite.utils.camera_utils",
            "read_only": True,
            "robot_state_unchanged": True,
            "simulation_time_s": capture["simulation_time_s"],
            "native_task_success": (await device.on_owner(environment.check, ["task_success"]))[0].value,
            "cameras": records,
        }
        (output / "result.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        return report
    finally:
        await device.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Export paired native RoboCasa RGB and axial metric depth with calibration.")
    parser.add_argument("--output-directory", type=Path, required=True)
    parser.add_argument("--task-id", default="OpenCabinet")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    if os.environ.get("MUJOCO_GL") != "egl":
        raise RuntimeError("Native metric depth acceptance requires MUJOCO_GL=egl.")
    print(json.dumps(asyncio.run(check(args.output_directory, args.task_id, args.seed)), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
