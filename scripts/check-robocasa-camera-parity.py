import argparse
from io import BytesIO
import json
from pathlib import Path

import numpy as np
from PIL import Image
from robocasa.wrappers.gym_wrapper import RoboCasaGymEnv
from robosuite import macros

from physical_harness.environments.robocasa import CAMERA_NAMES, RoboCasaEnvironment
from physical_harness.validation import ContractValidator


def check(output: Path, schema_path: Path) -> dict:
    validator = ContractValidator.from_path(schema_path)
    adapter = RoboCasaEnvironment(validator)
    wrapper = RoboCasaGymEnv(
        env_name="OpenCabinet",
        robots="PandaOmron",
        split="pretrain",
        seed=0,
        camera_names=list(CAMERA_NAMES),
        camera_widths=256,
        camera_heights=256,
        enable_render=True,
    )
    try:
        raw = wrapper.env._get_observations(force_update=True)
        edh = adapter._observation(raw)
        official = wrapper.get_basic_observation(raw.copy())
        comparisons = {}
        for camera in CAMERA_NAMES:
            with Image.open(BytesIO(edh.images[camera])) as image:
                decoded = np.asarray(image.convert("RGB"))
            reference = official[f"{camera}_image"]
            comparisons[camera] = {
                "array_equal": bool(np.array_equal(decoded, reference)),
                "edh_shape": list(decoded.shape),
                "official_shape": list(reference.shape),
                "edh_dtype": str(decoded.dtype),
                "official_dtype": str(reference.dtype),
            }
            if not comparisons[camera]["array_equal"]:
                raise RuntimeError(f"EDH PNG differs from the official RoboCasa wrapper input for {camera}.")
        report = {
            "environment": "OpenCabinet",
            "robot": "PandaOmron",
            "split": "pretrain",
            "seed": 0,
            "image_convention": macros.IMAGE_CONVENTION,
            "source": "RoboCasaGymEnv.get_basic_observation",
            "comparisons": comparisons,
            "policy_executed": False,
        }
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        return report
    finally:
        wrapper.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare actual RoboCasa camera arrays with the official wrapper.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--schema-path", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(check(args.output, args.schema_path), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
