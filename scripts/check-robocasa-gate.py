import argparse
import asyncio
import json
import os
from pathlib import Path
from uuid import uuid4

from physical_harness.environments.robocasa import RoboCasaEnvironment
from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.validation import ContractValidator


async def check(output: Path) -> dict:
    root = Path(__file__).resolve().parents[1]
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    environment = RoboCasaEnvironment(validator)
    device = NativeActionDevice(environment)
    action = [0.0] * 12
    action[6] = -1.0
    action[11] = -1.0

    async def begin(attempt: str, budget: int) -> ActionGate:
        execution_id = str(uuid4())
        await device.bind_execution(execution_id)
        return ActionGate(
            validator, device,
            execution_id=execution_id,
            task_scope={"task_id": "OpenCabinet", "goal_id": "manual_control", "attempt_id": attempt},
            action_spec=description.action_spec,
            max_control_steps=budget,
            max_wall_time_s=120,
            lease_valid=lambda: True,
            max_segment_actions=1,
            observation_ttl_s=30,
            device_timeout_s=30,
        )

    def chunk(gate: ActionGate, observation, count: int) -> dict:
        ticket = gate.request(
            "Explicit manual neutral control input for native gate acceptance.",
            observation.observation_id,
            {"manual_control": True},
            observed_monotonic=observation.observed_monotonic,
        )
        result = {
            key: ticket[key]
            for key in (
                "request_id", "execution_id", "task_scope", "generation",
                "observation_id", "valid_until", "action_spec",
            )
        }
        result.update(schema_version="physical.action_chunk.v1", actions=[action] * count)
        return result

    try:
        first_observation = await device.on_owner(lambda: environment.reset("OpenCabinet", {"seed": 0, "split": "pretrain"}))
        description = await device.on_owner(environment.describe)
        first_gate = await begin("manual_1", 2)
        first = await first_gate.execute(chunk(first_gate, first_observation, 1))
        paused = await first_gate.pause("verifier_pause")
        if paused["state"] != "paused" or not paused["device_confirmed"]:
            raise RuntimeError("Native device did not confirm a stopped boundary.")
        check_value = (await device.on_owner(lambda: environment.check(["task_success"])))[0].value
        await first_gate.resume()
        next_observation = await device.on_owner(environment.observe)
        budget_stop = await first_gate.execute(chunk(first_gate, next_observation, 1))
        if budget_stop["state"] != "ended" or budget_stop["stop_reason"] != "budget_exhausted":
            raise RuntimeError("Native budget did not stop after two manual control steps.")

        scene_before = await device.on_owner(lambda: float(environment._require_env().sim.data.time))
        second_gate = await begin("manual_2", 1)
        second_observation = await device.on_owner(environment.observe)
        second_stop = await second_gate.execute(chunk(second_gate, second_observation, 1))
        scene_after = await device.on_owner(lambda: float(environment._require_env().sim.data.time))
        if second_stop["state"] != "ended" or scene_after <= scene_before:
            raise RuntimeError("Second execution did not advance the same scene.")

        third_gate = await begin("manual_3", 16)
        third_observation = await device.on_owner(environment.observe)
        active = asyncio.create_task(third_gate.execute(chunk(third_gate, third_observation, 16)))
        while device.executed_actions == 0 and not active.done():
            await asyncio.sleep(0.001)
        in_flight_stop = await third_gate.pause("verifier_pause")
        await active
        stopped_time = await device.on_owner(lambda: float(environment._require_env().sim.data.time))
        await asyncio.sleep(0.1)
        stable_time = await device.on_owner(lambda: float(environment._require_env().sim.data.time))
        if in_flight_stop["state"] != "paused" or device.executed_actions >= 16 or stable_time != stopped_time:
            raise RuntimeError("In-flight stop did not fence native control actions.")
        report = {
            "input_origin": "explicit_manual_control",
            "environment": "OpenCabinet",
            "robot": "PandaOmron",
            "action_spec": description.action_spec,
            "camera_names": description.camera_names,
            "first": first,
            "paused": paused,
            "native_task_success_at_pause": check_value,
            "budget_stop": budget_stop,
            "second_stop": second_stop,
            "scene_time_before_second_execution": scene_before,
            "scene_time_after_second_execution": scene_after,
            "in_flight_stop": in_flight_stop,
            "native_control_steps_after_in_flight_stop": device.executed_actions,
            "native_raw_sim_steps_after_in_flight_stop": device.raw_sim_steps,
            "scene_time_at_stop": stopped_time,
            "scene_time_after_wait": stable_time,
            "policy_executed": False,
        }
        output.mkdir(parents=True, exist_ok=True)
        (output / "result.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        return report
    finally:
        await device.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Check actual RoboCasa control boundaries with explicit manual actions.")
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    if os.environ.get("MUJOCO_GL") != "egl":
        raise RuntimeError("RoboCasa gate acceptance requires MUJOCO_GL=egl.")
    print(json.dumps(asyncio.run(check(args.output_directory)), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
