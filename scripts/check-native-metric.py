import argparse
import asyncio
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.validation import ContractValidator


def native_environment(provider, source_root, validator):
    if provider == "robotwin":
        from physical_harness.environments.robotwin import RoboTwinEnvironment

        return RoboTwinEnvironment(source_root, validator)
    if provider == "behavior":
        from physical_harness.environments.behavior.process import BehaviorProcessEnvironment

        return BehaviorProcessEnvironment(source_root, validator)
    from physical_harness.environments.robodojo import RoboDojoEnvironment

    return RoboDojoEnvironment(validator)


async def check(args):
    directory = args.output_directory.resolve()
    directory.mkdir(parents=True, exist_ok=False)
    metric_directory = directory / "metric-records"
    os.environ["EDH_METRIC_RECORD_DIR"] = str(metric_directory)
    configuration = json.loads(args.scene_configuration.read_text())
    if not isinstance(configuration, dict):
        raise ValueError("Native metric scene configuration must be a JSON object.")
    source_root = args.source_root.resolve(strict=True) if args.source_root else None
    if args.provider in ("robotwin", "behavior") and source_root is None:
        raise ValueError("The selected native provider requires --source-root.")
    validator = ContractValidator.from_path(args.schema_path.resolve(strict=True))
    environment = native_environment(args.provider, source_root, validator)
    device = NativeActionDevice(environment)
    try:
        await device.on_owner(environment.reset, args.task_id, configuration)
        description = await device.on_owner(environment.describe)
        before = await device.on_owner(environment.observe)
        if tuple(before.images) != tuple(description.camera_names):
            raise RuntimeError("The native capture differs from its registered cameras.")
        measurements = {}
        for camera, png in before.images.items():
            with Image.open(BytesIO(png), formats=["PNG"]) as image:
                width, height = image.size
            mask = BytesIO()
            Image.fromarray(np.full((height, width), 255, dtype=np.uint8)).save(mask, format="PNG")
            measurements[camera] = await device.on_owner(
                environment.measure_object, before.observation_id, camera,
                hashlib.sha256(png).hexdigest(), mask.getvalue(),
            )
        after = await device.on_owner(environment.observe)
        if before.state != after.state or before.images != after.images:
            raise RuntimeError("Read-only native region measurement changed robot state or camera bytes.")
        records = sorted(metric_directory.glob("*/*/measurement.json"))
        if len(records) != len(measurements):
            raise RuntimeError("Native measurement recording omitted a calibrated camera.")
        for record in records:
            value = json.loads(record.read_text())
            if value != measurements[value["camera"]]:
                raise RuntimeError("Recorded native geometry differs from the actual measurement result.")
        report = {
            "schema_version": "edh.native_metric_probe.v1", "provider": args.provider,
            "task_id": args.task_id, "scene_configuration": configuration,
            "scene_metadata": description.scene_metadata,
            "probe_source_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "observation_id": before.observation_id, "observed_at": before.observed_at,
            "region": "complete captured image", "robot_state_unchanged": True,
            "camera_bytes_unchanged": True, "policy_clients": 0, "policy_controls": 0,
            "read_only_after_native_reset": True, "measurements": measurements,
            "metric_records": [str(path.parent.relative_to(directory)) for path in records],
        }
        (directory / "result.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
        print(json.dumps({"provider": args.provider, "cameras": list(measurements),
                          "read_only": True, "metric_records": report["metric_records"]}))
    finally:
        await device.close()


def main():
    parser = argparse.ArgumentParser(description="Measure each actual native calibrated camera's complete image region.")
    parser.add_argument("--provider", choices=("robotwin", "behavior", "robodojo"), required=True)
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--source-root", type=Path)
    parser.add_argument("--scene-configuration", type=Path, required=True)
    parser.add_argument("--schema-path", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    asyncio.run(check(parser.parse_args()))


if __name__ == "__main__":
    main()
