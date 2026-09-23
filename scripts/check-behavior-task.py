import json
import os
from pathlib import Path

import numpy as np
from PIL import Image
import omnigibson as og
import torch
from omnigibson.macros import gm
from omnigibson.transition_rules import CookingSystemRule, MixingToolRule, ToggleableMachineRule
from omnigibson.utils.bddl_utils import is_system_bddl_inst
from omnigibson.utils.python_utils import recursively_convert_to_torch

from gr00t.eval.sim.BEHAVIOR.og_teleop_utils import (
    generate_basic_environment_config,
    generate_robot_config,
    load_available_tasks,
)


PROPRIOCEPTION_NAMES = (
    "joint_qpos", "joint_qpos_sin", "joint_qpos_cos", "joint_qvel", "joint_qeffort",
    "robot_pos", "robot_ori_cos", "robot_ori_sin", "robot_2d_ori", "robot_2d_ori_cos",
    "robot_2d_ori_sin", "robot_lin_vel", "robot_ang_vel", "arm_left_qpos",
    "arm_left_qpos_sin", "arm_left_qpos_cos", "arm_left_qvel", "eef_left_pos",
    "eef_left_quat", "grasp_left", "gripper_left_qpos", "gripper_left_qvel",
    "arm_right_qpos", "arm_right_qpos_sin", "arm_right_qpos_cos", "arm_right_qvel",
    "eef_right_pos", "eef_right_quat", "grasp_right", "gripper_right_qpos",
    "gripper_right_qvel", "trunk_qpos", "trunk_qvel", "base_qpos", "base_qpos_sin",
    "base_qpos_cos", "base_qvel",
)
CHECKPOINT_STATE_SLICES = {
    "robot_pos": (140, 143), "robot_ori_cos": (143, 146), "robot_ori_sin": (146, 149),
    "robot_2d_ori": (149, 150), "robot_2d_ori_cos": (150, 151),
    "robot_2d_ori_sin": (151, 152), "robot_lin_vel": (152, 155),
    "robot_ang_vel": (155, 158), "arm_left_qpos": (158, 165),
    "arm_left_qpos_sin": (165, 172), "arm_left_qpos_cos": (172, 179),
    "eef_left_pos": (186, 189), "eef_left_quat": (189, 193),
    "gripper_left_qpos": (194, 196), "arm_right_qpos": (198, 205),
    "arm_right_qpos_sin": (205, 212), "arm_right_qpos_cos": (212, 219),
    "eef_right_pos": (226, 229), "eef_right_quat": (229, 233),
    "gripper_right_qpos": (234, 236), "trunk_qpos": (238, 242),
}
CAMERA_SENSORS = {
    "head": "robot_r1:zed_link:Camera:0",
    "left_wrist": "robot_r1:left_realsense_link:Camera:0",
    "right_wrist": "robot_r1:right_realsense_link:Camera:0",
}
ACTION_SLICES = {
    "base": (0, 3), "torso": (3, 7), "left_arm": (7, 14),
    "left_gripper": (14, 15), "right_arm": (15, 22), "right_gripper": (22, 23),
}


def main() -> None:
    output_directory = Path(__file__).resolve().parents[1] / ".local" / "work" / "behavior-task"
    output_directory.mkdir(parents=True, exist_ok=True)
    gpu_id = os.environ.get("OMNIGIBSON_GPU_ID")
    if gpu_id is None or not gpu_id.isdecimal():
        raise RuntimeError("OMNIGIBSON_GPU_ID must select a physical GPU for native verification.")
    torch.cuda.set_device(int(gpu_id))
    gm.HEADLESS = True
    for rule in (ToggleableMachineRule, MixingToolRule, CookingSystemRule):
        rule.ENABLED = False
    task_name = "picking_up_trash"
    task_configuration = load_available_tasks()[task_name][0]
    configuration = generate_basic_environment_config(task_name, task_configuration)
    configuration["robots"] = [generate_robot_config(task_name, task_configuration)]
    configuration["robots"][0]["obs_modalities"] = ["proprio", "rgb"]
    configuration["robots"][0]["proprio_obs"] = list(PROPRIOCEPTION_NAMES)
    configuration["task"]["include_obs"] = False
    environment = og.Environment(configs=configuration)
    robot = environment.robots[0]
    for name, sensor_name in CAMERA_SENSORS.items():
        sensor = robot.sensors[sensor_name]
        if name == "head":
            sensor.horizontal_aperture = 40.0
        sensor.image_height = 256
        sensor.image_width = 256
    og.sim.update_handles()
    environment.load_observation_space()
    og.sim.stop()
    robot.base_footprint_link.mass = 250.0
    og.sim.play()
    og.sim.update_handles()
    environment._current_episode = 0
    environment.reset()
    instance_id = 0
    scene_model = environment.task.scene_name
    tro_filename = environment.task.get_cached_activity_scene_filename(
        scene_model=scene_model,
        activity_name=environment.task.activity_name,
        activity_definition_id=environment.task.activity_definition_id,
        activity_instance_id=instance_id,
    )
    instance_path = (
        Path("/home/jixin/workspace/data/behavior/2025-challenge-hidden-instances")
        / task_name / f"{tro_filename}-tro_state.json"
    )
    with instance_path.open(encoding="utf-8") as stream:
        instance = recursively_convert_to_torch(json.load(stream))
    for key, state in instance.items():
        if key == "robot_poses":
            pose = state["R1Pro"][0]
            robot.set_position_orientation(pose["position"], pose["orientation"])
            environment.scene.write_task_metadata(key=key, data=state)
        else:
            environment.task.object_scope[key].load_state(state, serialized=False)
    og.sim.update_handles()
    for _ in range(25):
        og.sim.step_physics()
        for name, entity in environment.task.object_scope.items():
            if not is_system_bddl_inst(name) and entity is not None:
                entity.keep_still()
    environment.scene.update_initial_file()
    environment.scene.reset()
    observation, _ = environment.reset()
    native = observation["robot_r1"]
    camera_report = {}
    for name, sensor_name in CAMERA_SENSORS.items():
        pixels = native[sensor_name]["rgb"].cpu().numpy()[..., :3]
        if pixels.shape != (256, 256, 3) or pixels.dtype != np.uint8:
            raise RuntimeError(f"BEHAVIOR camera {name} returned an invalid RGB frame.")
        Image.fromarray(pixels).save(output_directory / f"{name}.png")
        camera_report[name] = {"shape": list(pixels.shape), "dtype": str(pixels.dtype)}
    proprio = native["proprio"].cpu().numpy()
    if proprio.shape != (258,) or not np.isfinite(proprio).all():
        raise RuntimeError("BEHAVIOR R1Pro proprio is not a finite 258-value vector.")
    state_report = {
        name: [float(value) for value in proprio[start:end]]
        for name, (start, end) in CHECKPOINT_STATE_SLICES.items()
    }
    action_space = environment.action_space["robot_r1"]
    if action_space.shape != (23,):
        raise RuntimeError("BEHAVIOR R1Pro action is not a 23-value vector.")
    action_report = {
        name: {
            "minimum": [float(value) if np.isfinite(value) else None for value in action_space.low[start:end]],
            "maximum": [float(value) if np.isfinite(value) else None for value in action_space.high[start:end]],
        }
        for name, (start, end) in ACTION_SLICES.items()
    }
    report = {
        "task_id": task_name,
        "task_instruction": "Picking up trash.",
        "instance_id": instance_id,
        "scene_model": scene_model,
        "cameras": camera_report,
        "state": state_report,
        "action": action_report,
        "native_robot_action_shape": list(action_space.shape),
    }
    (output_directory / "result.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    environment.close()


if __name__ == "__main__":
    main()
