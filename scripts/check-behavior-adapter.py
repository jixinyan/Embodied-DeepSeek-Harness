import argparse
from datetime import datetime, timezone
from io import BytesIO
import json
from pathlib import Path

from PIL import Image

from physical_harness.environments.behavior import BehaviorEnvironment
from physical_harness.validation import ContractValidator


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--schema-path", required=True, type=Path)
    parser.add_argument("--output-directory", required=True, type=Path)
    parser.add_argument("--instance-id", type=int, default=0)
    args = parser.parse_args()
    args.output_directory.mkdir(parents=True, exist_ok=True)
    validator = ContractValidator.from_path(args.schema_path)
    environment = BehaviorEnvironment(args.source_root, validator)
    try:
        observation = environment.reset("picking_up_trash", {"instance_id": args.instance_id})
        description = environment.describe()
        checks = environment.check(("task_success",))
        cameras = {}
        for name, png in observation.images.items():
            with Image.open(BytesIO(png)) as image:
                image.load()
                cameras[name] = {
                    "format": image.format,
                    "mode": image.mode,
                    "width": image.width,
                    "height": image.height,
                    "png_bytes": len(png),
                }
            (args.output_directory / f"{name}.png").write_bytes(png)
        result = {
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "provider": description.provider,
            "native_task_id": "picking_up_trash",
            "task_instruction": description.task_instruction,
            "scene_metadata": description.scene_metadata,
            "action_spec": description.action_spec,
            "cameras": cameras,
            "state": {name: list(values) for name, values in observation.state.items()},
            "observation_id": observation.observation_id,
            "observed_at": observation.observed_at,
            "checks": [
                {"check_id": check.check_id, "value": check.value, "reason": check.reason}
                for check in checks
            ],
        }
        (args.output_directory / "result.json").write_text(
            json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8"
        )
        print(json.dumps({
            "result": str(args.output_directory / "result.json"),
            "camera_names": list(observation.images),
            "state_channels": list(observation.state),
            "action_channels": len(description.action_spec["channels"]),
            "task_success": checks[0].value,
        }))
    finally:
        environment.close()


if __name__ == "__main__":
    main()
