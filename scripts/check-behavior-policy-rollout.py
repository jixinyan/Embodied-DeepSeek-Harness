import argparse
import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time
import traceback
from uuid import uuid4

from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.execution.policy_observation import encode_policy_observation
from physical_harness.execution.policy_records import record_policy_request
from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.validation import ContractValidator


async def run(args: argparse.Namespace) -> None:
    source_root = args.source_root.resolve(strict=True)
    sys.path.insert(0, str(source_root))
    from physical_harness.environments.behavior.process import BehaviorProcessEnvironment

    args.output_directory.mkdir(parents=True, exist_ok=True)
    frames_directory = args.output_directory / "frames"
    frames_directory.mkdir(exist_ok=True)
    validator = ContractValidator.from_path(args.schema_path)
    environment = BehaviorProcessEnvironment(source_root, validator)
    device = NativeActionDevice(environment)
    policy = WebSocketPolicyClient(args.policy_uri, validator, timeout_s=300)
    control_durations: list[float] = []
    retained_frames: list[dict[str, object]] = []
    first_control = asyncio.Event()

    async def record_segment(segment: dict, receipt: dict) -> None:
        step = device.last_step
        if step is None or receipt["executed_actions"] != 1:
            raise RuntimeError("BEHAVIOR control has no completed native step.")
        control_durations.append(environment._last_control_duration_s)
        for frame in step.native_frames:
            index = len(retained_frames)
            for camera, image in frame.images.items():
                (frames_directory / f"{index:04d}-{camera}.png").write_bytes(image)
            retained_frames.append({
                "observation_id": frame.observation_id,
                "observed_at": frame.observed_at,
                "native_step_index": frame.native_step_index,
                "simulation_time_s": frame.simulation_time_s,
                "cameras": list(frame.images),
            })
        first_control.set()

    async def stop_after_first_control(gate: ActionGate, response: dict, reason: str, *, terminal: bool) -> tuple[dict, float]:
        first_control.clear()
        active = asyncio.create_task(gate.execute(response))
        ready = asyncio.create_task(first_control.wait())
        completed, _ = await asyncio.wait((active, ready), return_when=asyncio.FIRST_COMPLETED)
        if ready not in completed:
            ready.cancel()
            await active
            raise RuntimeError("BEHAVIOR execution ended before its lifecycle stop request.")
        while not environment.control_in_flight:
            if active.done():
                await active
                raise RuntimeError("BEHAVIOR execution ended before an in-flight control stop request.")
            await asyncio.sleep(0.001)
        requested_at = time.monotonic()
        stopped = await gate.pause(reason, terminal=terminal)
        confirmed_at = time.monotonic()
        await active
        return stopped, confirmed_at - requested_at

    try:
        initial = await device.on_owner(lambda: environment.reset("picking_up_trash", {"instance_id": args.instance_id}))
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
            max_control_steps=16 if args.lifecycle else 1,
            max_wall_time_s=600,
            lease_valid=lambda: environment.initialized,
            observation_ttl_s=300,
            device_timeout_s=300,
            max_policy_actions=16 if args.lifecycle else 1,
            on_segment=record_segment,
        )
        request = gate.request(
            description.task_instruction,
            initial.observation_id,
            encode_policy_observation(description, initial, "picking_up_trash"),
            observed_monotonic=initial.observed_monotonic,
        )
        record_policy_request(request, args.output_directory)
        response = await policy.infer(request)
        (args.output_directory / "policy-response.json").write_text(
            json.dumps(response, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8"
        )
        lifecycle = None
        if args.lifecycle:
            paused, pause_latency = await stop_after_first_control(gate, response, "planner_pause", terminal=False)
            if paused["state"] != "paused" or not paused["device_confirmed"] or not 1 <= device.executed_actions < 16:
                raise RuntimeError("BEHAVIOR did not confirm a pause within its policy chunk.")
            stopped_actions = device.executed_actions
            stopped_steps = device.raw_sim_steps
            stopped_time = (await device.on_owner(environment.native_state))["native_time_step_index"]
            await asyncio.sleep(0.1)
            stable_time = (await device.on_owner(environment.native_state))["native_time_step_index"]
            if device.executed_actions != stopped_actions or device.raw_sim_steps != stopped_steps or stopped_time != stable_time:
                raise RuntimeError("BEHAVIOR advanced after its confirmed pause.")
            resumed = await gate.resume()
            current = await device.on_owner(environment.observe)
            resumed_request = gate.request(
                description.task_instruction,
                current.observation_id,
                encode_policy_observation(description, current, "picking_up_trash"),
                observed_monotonic=current.observed_monotonic,
            )
            record_policy_request(resumed_request, args.output_directory)
            resumed_response = await policy.infer(resumed_request)
            (args.output_directory / "resumed-policy-response.json").write_text(
                json.dumps(resumed_response, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8"
            )
            status = await gate.execute(resumed_response)
            if status["state"] != "ended" or status["stop_reason"] != "budget_exhausted" or device.executed_actions != 16:
                raise RuntimeError("BEHAVIOR resume did not preserve its cumulative control budget.")
            lifecycle = {
                "paused": paused,
                "pause_confirmation_latency_s": pause_latency,
                "pause_requested_during_native_control": True,
                "controls_at_pause": stopped_actions,
                "physics_steps_at_pause": stopped_steps,
                "native_time_step_at_pause": stopped_time,
                "native_time_step_after_wait": stable_time,
                "resumed": resumed,
                "resumed_request_id": resumed_request["request_id"],
            }
            first_execution_status = status
            retained_scene = (await device.on_owner(environment.native_state))["scene_id"]
            await device.on_owner(environment.bind_task, "picking_up_trash")
            second_execution_id = f"native-acceptance-{uuid4()}"
            await device.bind_execution(second_execution_id)
            second_gate = ActionGate(
                validator, device,
                execution_id=second_execution_id,
                task_scope={"task_id": f"native-acceptance-{uuid4()}", "goal_id": f"native-acceptance-{uuid4()}",
                            "attempt_id": f"native-acceptance-{uuid4()}"},
                action_spec=dict(description.action_spec), max_control_steps=16, max_wall_time_s=600,
                lease_valid=lambda: environment.initialized, observation_ttl_s=300,
                device_timeout_s=300, max_policy_actions=16, on_segment=record_segment,
            )
            current = await device.on_owner(environment.observe)
            second_request = second_gate.request(
                description.task_instruction, current.observation_id,
                encode_policy_observation(description, current, "picking_up_trash"),
                observed_monotonic=current.observed_monotonic,
            )
            record_policy_request(second_request, args.output_directory)
            second_response = await policy.infer(second_request)
            (args.output_directory / "second-policy-response.json").write_text(
                json.dumps(second_response, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8"
            )
            terminal, terminal_latency = await stop_after_first_control(second_gate, second_response, "user_stop", terminal=True)
            terminal_steps = device.raw_sim_steps
            terminal_controls = device.executed_actions
            terminal_time = (await device.on_owner(environment.native_state))["native_time_step_index"]
            await asyncio.sleep(0.1)
            terminal_native_state = await device.on_owner(environment.native_state)
            terminal_stable_time = terminal_native_state["native_time_step_index"]
            if (terminal["state"] != "ended" or terminal["stop_reason"] != "user_stop" or not terminal["device_confirmed"]
                    or not 1 <= terminal_controls < 16 or device.executed_actions != terminal_controls
                    or device.raw_sim_steps != terminal_steps or terminal_time != terminal_stable_time
                    or terminal_native_state["scene_id"] != retained_scene):
                raise RuntimeError("BEHAVIOR second task did not retain its scene and confirmed terminal boundary.")
            lifecycle.update({
                "first_execution_ended": first_execution_status,
                "second_execution_id": second_execution_id,
                "second_request_id": second_request["request_id"],
                "second_terminal": terminal,
                "terminal_confirmation_latency_s": terminal_latency,
                "terminal_requested_during_native_control": True,
                "second_controls_at_stop": terminal_controls,
                "second_physics_steps_at_stop": terminal_steps,
                "second_native_time_step_at_stop": terminal_time,
                "second_native_time_step_after_wait": terminal_stable_time,
                "retained_native_scene": True,
            })
            status = terminal
        else:
            status = await gate.execute(response)
        step = device.last_step
        if step is None:
            raise RuntimeError("BEHAVIOR policy action produced no native step result.")
        checks = await device.on_owner(lambda: environment.check(("task_success",)))
        report = {
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "provider": description.provider,
            "native_task_id": "picking_up_trash",
            "task_instruction": description.task_instruction,
            "scene_metadata": description.scene_metadata,
            "request_id": request["request_id"],
            "execution_id": execution_id,
            "policy_action": response["actions"][0],
            "gate": status,
            "lifecycle": lifecycle,
            "native_control_wall_time_s": control_durations,
            "native_process": await device.on_owner(environment.native_state),
            "maximum_native_control_wall_time_s": max(control_durations),
            "native_step": {
                "executed_actions": len(control_durations),
                "action_completed": step.action_completed,
                "raw_sim_steps": sum(frame["native_step_index"] for frame in retained_frames),
                "episode_terminated": step.episode_terminated,
                "interruption_reason": step.interruption_reason,
                "final_observation_id": step.observation.observation_id,
                "frames": retained_frames,
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
            "executed_actions": len(control_durations),
            "raw_sim_steps": sum(frame["native_step_index"] for frame in retained_frames),
            "frame_count": len(retained_frames),
            "task_success": checks[0].value,
        }))
    finally:
        if sys.exc_info()[0] is not None:
            traceback.print_exc()
            (args.output_directory / "error.txt").write_text(traceback.format_exc(), encoding="utf-8")
        await policy.close()
        await device.close()
        (args.output_directory / "close-completed.json").write_text(
            json.dumps({"native_close_returned": environment.close_acknowledged,
                        "native_pid": environment.native_pid, "native_exit_code": environment.process_exit_code,
                        "native_close_diagnostics": environment.native_close_diagnostics,
                        "checked_at": datetime.now(timezone.utc).isoformat()}) + "\n",
            encoding="utf-8",
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--schema-path", required=True, type=Path)
    parser.add_argument("--output-directory", required=True, type=Path)
    parser.add_argument("--policy-uri", required=True)
    parser.add_argument("--instance-id", type=int, default=0)
    parser.add_argument("--lifecycle", action="store_true")
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
