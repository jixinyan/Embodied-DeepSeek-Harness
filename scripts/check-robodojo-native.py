import argparse
import asyncio
import json
from pathlib import Path
from uuid import uuid4

from physical_harness.environments.robodojo import RoboDojoEnvironment
from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.execution.policy_observation import encode_policy_observation
from physical_harness.validation import ContractValidator


async def run(args):
    config = json.loads(args.service_configuration.read_text())
    validator = ContractValidator.from_path(args.schema_path)
    environment = RoboDojoEnvironment(validator)
    device = NativeActionDevice(environment)
    args.output_directory.mkdir(parents=True, exist_ok=False)
    result = {"scope": "native manual-control boundaries; no model or task-success acceptance"}
    try:
        initial = await device.on_owner(lambda: environment.reset(config["task"], {
            "host": "127.0.0.1", "port": config["port"], "timeout_s": 300,
            "seed": args.layout_id, "source": "gpt_joint", "policy_version": "edh-manual-boundary-check",
            "service_configuration": str(args.service_configuration.resolve())}))
        description = await device.on_owner(environment.describe)
        service_pid = environment._service.pid
        for camera, image in initial.images.items():
            (args.output_directory / f"initial-{camera}.png").write_bytes(image)
        context = await device.on_owner(lambda: environment.policy_context(initial.observation_id))
        targets = {arm: {"qpos": values["qpos"], "gripper_closed": False}
                   for arm, values in context["current_joints"].items()}
        targets["left"]["qpos"] = list(targets["left"]["qpos"])
        targets["left"]["qpos"][0] += 0.01
        prepared = await device.on_owner(lambda: environment.policy_tool(
            initial.observation_id, "prepare_joints", {"targets": targets, "coordinate_mode": "absolute"}))
        proposed = await device.on_owner(lambda: environment.policy_tool(
            initial.observation_id, "eef_joint_target", {"targets": targets}))
        if prepared["physical_steps"] != 0 or proposed["physical_steps"] != 0:
            raise RuntimeError("Numerical preparation advanced physical controls.")
        execution_id = str(uuid4())
        await device.bind_execution(execution_id)
        gate = ActionGate(validator, device, execution_id=execution_id,
                          task_scope={"task_id": str(uuid4()), "goal_id": str(uuid4()), "attempt_id": str(uuid4())},
                          action_spec=dict(description.action_spec), max_control_steps=10,
                          max_wall_time_s=600, lease_valid=lambda: environment._rpc is not None,
                          observation_ttl_s=300, device_timeout_s=60)

        async def dispatch(observation, action):
            ticket = gate.request("Measured joint motion boundary check", observation.observation_id,
                                  encode_policy_observation(description, observation, config["task"]),
                                  observed_monotonic=observation.observed_monotonic)
            chunk = {key: value for key, value in ticket.items()
                     if key not in ("instruction", "observation", "max_actions")}
            chunk.update(schema_version="physical.action_chunk.v1", actions=[action])
            await gate.execute(chunk)

        await dispatch(initial, proposed["action"])
        paused = await gate.pause("planner_pause")
        if not paused["device_confirmed"] or paused["state"] != "paused" or device.executed_actions != 1:
            raise RuntimeError("Native ordinary pause was not confirmed after one admitted control.")
        await asyncio.sleep(2)
        if device.executed_actions != 1:
            raise RuntimeError("Controls advanced during confirmed native pause.")
        await gate.resume()
        current = await device.on_owner(environment.observe)
        current_context = await device.on_owner(lambda: environment.policy_context(current.observation_id))
        action = [value for arm in ("left", "right")
                  for value in [*current_context["current_joints"][arm]["qpos"], 1.0]]
        await dispatch(current, action)
        stopped = await gate.pause("user_stop", terminal=True)
        if not stopped["device_confirmed"] or stopped["state"] != "ended" or device.executed_actions != 2:
            raise RuntimeError("Native cancellation was not confirmed after two admitted controls.")
        checks = await device.on_owner(lambda: environment.check(("task_success",)))
        result.update(service_pid=service_pid, provider=description.provider,
                      instruction=description.task_instruction, scene=description.scene_metadata,
                      initial_cameras=list(initial.images), prepared=prepared,
                      paused=paused, stopped=stopped, controls=device.executed_actions,
                      measured_state=current_context["current_joints"],
                      native_check={"task_success": checks[0].value})
    finally:
        await device.close()
    result["service_exit_confirmed"] = environment._service is None
    (args.output_directory / "result.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    print(json.dumps(result, allow_nan=False))


def main():
    parser = argparse.ArgumentParser(description="Check actual EDH-owned RoboDojo control and resource boundaries.")
    parser.add_argument("--service-configuration", type=Path, required=True)
    parser.add_argument("--schema-path", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    parser.add_argument("--layout-id", type=int, default=0)
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
