import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
from uuid import uuid4

import sapien

from physical_harness.environments.robotwin import RoboTwinEnvironment
from physical_harness.execution.policy_observation import encode_policy_observation
from physical_harness.validation import ContractValidator


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--schema-path", required=True, type=Path)
    parser.add_argument("--output-directory", required=True, type=Path)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    args.output_directory.mkdir(parents=True, exist_ok=True)
    validator = ContractValidator.from_path(args.schema_path)
    environment = RoboTwinEnvironment(args.source_root, validator)
    try:
        observation = environment.reset("adjust_bottle", {"seed": args.seed})
        description = environment.describe()
        checks = environment.check(("task_success",))
        device = sapien.Device(os.environ["ROBOTWIN_RENDER_DEVICE"])
        for name, png in observation.images.items():
            (args.output_directory / f"{name}.png").write_bytes(png)
        result = {
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "task_id": "adjust_bottle",
            "seed": args.seed,
            "device_name": device.name,
            "device_pci_string": device.pci_string,
            "device_cuda_id": device.cuda_id,
            "physics_timestep_s": float(environment._require_env().scene.get_timestep()),
            "action_spec": description.action_spec,
            "camera_names": list(description.camera_names),
            "camera_png_bytes": {name: len(png) for name, png in observation.images.items()},
            "joint_action_vector": list(observation.state["joint_action.vector"]),
            "check": [{"check_id": check.check_id, "value": check.value, "reason": check.reason} for check in checks],
            "observation_id": observation.observation_id,
            "observed_at": observation.observed_at,
        }
        now = datetime.now(timezone.utc)
        request = {
            "schema_version": "physical.policy_request.v1",
            "request_id": str(uuid4()),
            "execution_id": f"native-acceptance-{uuid4()}",
            "task_scope": {
                "task_id": f"native-acceptance-{uuid4()}",
                "goal_id": f"native-acceptance-{uuid4()}",
                "attempt_id": f"native-acceptance-{uuid4()}",
            },
            "generation": 0,
            "observation_id": observation.observation_id,
            "valid_until": (now + timedelta(minutes=15)).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "action_spec": description.action_spec,
            "instruction": description.task_instruction,
            "observation": encode_policy_observation(description, observation, "adjust_bottle"),
            "max_actions": 1,
        }
        validator.parse("PolicyRequest", request)
        (args.output_directory / "result.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        (args.output_directory / "policy-request.json").write_text(
            json.dumps(request, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8"
        )
        print(json.dumps(result, indent=2))
    finally:
        environment.close()


if __name__ == "__main__":
    main()
