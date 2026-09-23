import argparse
import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
from uuid import uuid4

from physical_harness.environments.robotwin import RoboTwinEnvironment
from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.execution.policy_observation import encode_policy_observation
from physical_harness.execution.worker import record_policy_request
from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.validation import ContractValidator


async def run(args: argparse.Namespace) -> None:
    args.output_directory.mkdir(parents=True, exist_ok=True)
    frames_directory = args.output_directory / "frames"
    frames_directory.mkdir(exist_ok=True)
    validator = ContractValidator.from_path(args.schema_path)
    environment = RoboTwinEnvironment(args.source_root, validator)
    device = NativeActionDevice(environment)
    policy = WebSocketPolicyClient(args.policy_uri, validator, timeout_s=240)
    try:
        initial = await device.on_owner(lambda: environment.reset("adjust_bottle", {"seed": args.seed}))
        description = await device.on_owner(environment.describe)
        execution_id = f"native-acceptance-{uuid4()}"
        await device.bind_execution(execution_id)
        gate = ActionGate(
            validator,
            device,
            execution_id=execution_id,
            task_scope={
                "task_id": f"native-acceptance-{uuid4()}",
                "goal_id": f"native-acceptance-{uuid4()}",
                "attempt_id": f"native-acceptance-{uuid4()}",
            },
            action_spec=dict(description.action_spec),
            max_control_steps=1,
            max_wall_time_s=600,
            lease_valid=lambda: environment._env is not None,
            observation_ttl_s=120,
            device_timeout_s=300,
        )
        request = gate.request(
            description.task_instruction,
            initial.observation_id,
            encode_policy_observation(description, initial, "adjust_bottle"),
            observed_monotonic=initial.observed_monotonic,
        )
        record_policy_request(request, args.output_directory)
        response = await policy.infer(request)
        (args.output_directory / "policy-response.json").write_text(
            json.dumps(response, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8"
        )
        status = await gate.execute(response)
        step = device.last_step
        if step is None:
            raise RuntimeError("RoboTwin policy action produced no native step result.")
        for index, frame in enumerate(step.native_frames):
            for camera, image in frame.images.items():
                (frames_directory / f"{index:04d}-{camera}.png").write_bytes(image)
        checks = await device.on_owner(lambda: environment.check(("task_success",)))
        report = {
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "provider": description.provider,
            "native_task_id": "adjust_bottle",
            "task_instruction": description.task_instruction,
            "scene_metadata": description.scene_metadata,
            "request_id": request["request_id"],
            "execution_id": execution_id,
            "policy_action": response["actions"][0],
            "gate": status,
            "native_step": {
                "executed_actions": step.executed_actions,
                "action_completed": step.action_completed,
                "raw_sim_steps": step.raw_sim_steps,
                "episode_terminated": step.episode_terminated,
                "interruption_reason": step.interruption_reason,
                "final_observation_id": step.observation.observation_id,
                "frames": [
                    {
                        "observation_id": frame.observation_id,
                        "observed_at": frame.observed_at,
                        "native_step_index": frame.native_step_index,
                        "simulation_time_s": frame.simulation_time_s,
                        "cameras": list(frame.images),
                    }
                    for frame in step.native_frames
                ],
            },
            "checks": [
                {"check_id": check.check_id, "value": check.value, "reason": check.reason}
                for check in checks
            ],
        }
        (args.output_directory / "result.json").write_text(
            json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8"
        )
        print(json.dumps({
            "result": str(args.output_directory / "result.json"),
            "executed_actions": step.executed_actions,
            "raw_sim_steps": step.raw_sim_steps,
            "frame_count": len(step.native_frames),
            "task_success": checks[0].value,
        }))
    finally:
        await policy.close()
        await device.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--schema-path", required=True, type=Path)
    parser.add_argument("--output-directory", required=True, type=Path)
    parser.add_argument("--policy-uri", required=True)
    parser.add_argument("--seed", type=int, default=0)
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
