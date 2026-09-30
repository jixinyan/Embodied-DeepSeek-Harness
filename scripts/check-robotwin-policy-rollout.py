import argparse
import asyncio
from datetime import datetime, timezone
import json
import math
from pathlib import Path
from uuid import uuid4

from physical_harness.environments.robotwin import RoboTwinEnvironment
from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.execution.policy_observation import encode_policy_observation
from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.validation import ContractValidator


async def run(args: argparse.Namespace) -> None:
    args.output_directory.mkdir(parents=True, exist_ok=False)
    frames_directory = args.output_directory / "frames"
    frames_directory.mkdir(exist_ok=True)
    validator = ContractValidator.from_path(args.schema_path)
    environment = RoboTwinEnvironment(args.source_root, validator)
    device = NativeActionDevice(environment)
    policy = WebSocketPolicyClient(args.policy_uri, validator, timeout_s=args.policy_timeout_s)
    controls = []
    lifecycle = []
    requests = []
    report = None
    try:
        initial = await device.on_owner(lambda: environment.reset("adjust_bottle", {
            "seed": args.seed,
            "frame_sample_interval_steps": args.frame_sample_interval_steps,
        }))
        description = await device.on_owner(environment.describe)
        native_limit = await device.on_owner(lambda: environment._require_env().step_lim)
        execution_id = f"native-acceptance-{uuid4()}"
        await device.bind_execution(execution_id)

        async def record_control(segment: dict, receipt: dict) -> None:
            step = device.last_step
            if step is None:
                raise RuntimeError("RoboTwin policy action produced no native step result.")
            index = len(controls)
            for frame_index, frame in enumerate(step.native_frames):
                for camera, image in frame.images.items():
                    (frames_directory / f"{index:04d}-{frame_index:04d}-{camera}.png").write_bytes(image)
            control = {
                "control_index": index,
                "request_id": segment["request_id"],
                "segment": segment,
                "receipt": receipt,
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
            }
            controls.append(control)
            with (args.output_directory / "controls.jsonl").open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(control, separators=(",", ":"), allow_nan=False) + "\n")
            if step.interruption_reason is not None:
                raise RuntimeError(f"RoboTwin native recording was interrupted: {step.interruption_reason}")
            if step.episode_terminated:
                lifecycle.append(await gate.pause("episode_terminated", terminal=True))
            elif args.stop_after_actions and device.executed_actions >= args.stop_after_actions:
                lifecycle.append(await gate.pause("user_stop", terminal=True))
            elif args.pause_after_actions and device.executed_actions == args.pause_after_actions:
                lifecycle.append(await gate.pause("planner_pause"))

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
            max_control_steps=args.max_control_steps,
            max_wall_time_s=args.max_wall_time_s,
            lease_valid=lambda: environment._env is not None,
            observation_ttl_s=args.observation_ttl_s,
            device_timeout_s=args.device_timeout_s,
            max_policy_actions=args.max_policy_actions,
            on_segment=record_control,
        )
        observation = initial
        while gate.snapshot()["state"] == "running":
            request = gate.request(
                description.task_instruction,
                observation.observation_id,
                encode_policy_observation(description, observation, "adjust_bottle"),
                observed_monotonic=observation.observed_monotonic,
            )
            with (args.output_directory / f"{request['request_id']}.json").open("x", encoding="utf-8") as stream:
                json.dump(request, stream, separators=(",", ":"), allow_nan=False)
                stream.write("\n")
            response = await policy.infer(request)
            (args.output_directory / f"policy-response-{request['request_id']}.json").write_text(
                json.dumps(response, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8"
            )
            requests.append(request["request_id"])
            status = await gate.execute(response)
            print(json.dumps({"request_id": request["request_id"], "gate": status,
                              "raw_sim_steps": device.raw_sim_steps}), flush=True)
            if status["state"] == "paused":
                if not status["device_confirmed"] or status["dispatch_in_flight"]:
                    raise RuntimeError("RoboTwin pause did not reach a drained device boundary.")
                paused_counts = (device.executed_actions, device.raw_sim_steps)
                await asyncio.sleep(args.pause_hold_s)
                if paused_counts != (device.executed_actions, device.raw_sim_steps):
                    raise RuntimeError("RoboTwin advanced while its pause boundary was held.")
                lifecycle.append({"held_counts": list(paused_counts), "hold_s": args.pause_hold_s})
                lifecycle.append(await gate.resume())
            if gate.snapshot()["state"] == "running":
                observation = await device.on_owner(environment.observe)
        status = gate.snapshot()
        if not status["device_confirmed"] or status["dispatch_in_flight"]:
            raise RuntimeError("RoboTwin execution did not reach a drained terminal boundary.")
        terminal_counts = (device.executed_actions, device.raw_sim_steps)
        await asyncio.sleep(args.pause_hold_s)
        if terminal_counts != (device.executed_actions, device.raw_sim_steps):
            raise RuntimeError("RoboTwin advanced while its terminal boundary was held.")
        checks = await device.on_owner(lambda: environment.check(("task_success",)))
        report = {
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "provider": description.provider,
            "native_task_id": "adjust_bottle",
            "task_instruction": description.task_instruction,
            "scene_metadata": description.scene_metadata,
            "request_ids": requests,
            "execution_id": execution_id,
            "native_control_step_limit": native_limit,
            "admitted_control_step_budget": args.max_control_steps,
            "policy_max_actions": args.max_policy_actions,
            "gate": status,
            "executed_actions": device.executed_actions,
            "raw_sim_steps": device.raw_sim_steps,
            "uncertain_actions": device.uncertain_actions,
            "frame_count": sum(len(control["native_step"]["frames"]) for control in controls),
            "lifecycle": lifecycle,
            "terminal_hold_s": args.pause_hold_s,
            "checks": [
                {"check_id": check.check_id, "value": check.value, "reason": check.reason}
                for check in checks
            ],
        }
    finally:
        await policy.close()
        await device.close()
    if report is None or environment._env is not None:
        raise RuntimeError("RoboTwin report or confirmed environment release is unavailable.")
    report["environment_closed"] = True
    (args.output_directory / "result.json").write_text(
        json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(report), flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--schema-path", required=True, type=Path)
    parser.add_argument("--output-directory", required=True, type=Path)
    parser.add_argument("--policy-uri", required=True)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--max-control-steps", type=int, default=400)
    parser.add_argument("--max-policy-actions", type=int, default=50)
    parser.add_argument("--max-wall-time-s", type=float, default=3600)
    parser.add_argument("--policy-timeout-s", type=float, default=240)
    parser.add_argument("--observation-ttl-s", type=float, default=600)
    parser.add_argument("--device-timeout-s", type=float, default=300)
    parser.add_argument("--frame-sample-interval-steps", type=int, default=30)
    parser.add_argument("--pause-after-actions", type=int, default=0)
    parser.add_argument("--stop-after-actions", type=int, default=0)
    parser.add_argument("--pause-hold-s", type=float, default=2)
    args = parser.parse_args()
    if args.seed < 0 or not 1 <= args.max_control_steps <= 400:
        raise ValueError("RoboTwin seed and the native 400-control-step budget are invalid.")
    if not 1 <= args.max_policy_actions <= 50 or args.frame_sample_interval_steps <= 0:
        raise ValueError("RoboTwin policy horizon or frame sampling interval is invalid.")
    if not 0 <= args.pause_after_actions < args.max_control_steps:
        raise ValueError("Ordinary pause must precede the admitted terminal control budget.")
    if not 0 <= args.stop_after_actions <= args.max_control_steps:
        raise ValueError("Operator stop must fit within the admitted control budget.")
    bounds = (args.max_wall_time_s, args.policy_timeout_s, args.observation_ttl_s,
              args.device_timeout_s, args.pause_hold_s)
    if any(not math.isfinite(value) or value <= 0 for value in bounds):
        raise ValueError("RoboTwin time bounds must be finite and positive.")
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
