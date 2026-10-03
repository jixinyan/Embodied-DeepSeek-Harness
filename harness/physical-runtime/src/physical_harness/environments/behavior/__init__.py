from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from hashlib import sha256
from importlib import import_module
from importlib.metadata import version
from io import BytesIO
import json
import math
import os
from pathlib import Path
from threading import current_thread, main_thread
import time
from typing import Callable, Mapping, Sequence
from uuid import uuid4

from physical_harness.environments import NativeCheck, NativeEnvironmentDescription, NativeFrame, NativeObservation, NativeRotation, NativeStep
from physical_harness.environments.task_catalog import behavior_task_selection
from physical_harness.environments.native_terminal_record import NativeTerminalRecorder
from physical_harness.perception.metric_capture import MetricCapture
from physical_harness.validation import ContractValidator


CAMERA_SENSORS = {
    "head": "robot_r1:zed_link:Camera:0",
    "left_wrist": "robot_r1:left_realsense_link:Camera:0",
    "right_wrist": "robot_r1:right_realsense_link:Camera:0",
}
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
STATE_SLICES = {
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
ACTION_SLICES = {
    "base": (0, 3), "trunk": (3, 7), "arm_left": (7, 14),
    "gripper_left": (14, 15), "arm_right": (15, 22), "gripper_right": (22, 23),
}
STATE_CHANNELS = tuple(f"state.{name}" for name in STATE_SLICES)


class BehaviorEnvironment:
    def __init__(self, source_root: Path, validator: ContractValidator) -> None:
        self._require_owner()
        if version("omnigibson") != "3.9.2":
            raise RuntimeError("Installed OmniGibson differs from BEHAVIOR-1K v3.9.2.")
        self._source_root = source_root.resolve(strict=True)
        if not (self._source_root / "gr00t" / "eval" / "sim" / "BEHAVIOR" / "og_teleop_utils.py").is_file():
            raise RuntimeError("Pinned GR00T BEHAVIOR evaluation configuration is unavailable.")
        self._validator = validator
        self._og = None
        self._env = None
        self._task_id: str | None = None
        self._instance_id: int | None = None
        self._scene_model: str | None = None
        self._instance_filename: str | None = None
        self._action_spec: dict[str, object] | None = None
        self._controlled_physics_steps = 0
        self._episode_terminated = False
        self._last_native_termination: dict[str, object] | None = None
        self._last_control_duration_s = 0.0
        self._close_diagnostics: dict[str, object] | None = None
        self._scene_config_id = 0
        self._evaluation_horizon = None
        self._metric_capture = MetricCapture("behavior", "behavior.omnigibson.world")
        self._terminal_recorder = NativeTerminalRecorder("behavior")
        import_module("omnigibson")

    @staticmethod
    def _require_owner() -> None:
        if current_thread() is not main_thread():
            raise RuntimeError("BEHAVIOR requires the main thread for its native lifecycle and controls.")

    def _require_env(self):
        self._require_owner()
        if self._env is None:
            raise RuntimeError("BEHAVIOR native task has not been reset.")
        return self._env

    def _native_action_spec(self) -> dict[str, object]:
        import numpy as np

        env = self._require_env()
        robot = env.robots[0]
        action_space = env.action_space["robot_r1"]
        if robot.action_dim != 23 or action_space.shape != (23,):
            raise RuntimeError("BEHAVIOR R1Pro action dimension differs from the official mapping.")
        action_indices = robot.controller_action_idx
        for group, (start, end) in ACTION_SLICES.items():
            if group not in action_indices or action_indices[group].tolist() != list(range(start, end)):
                raise RuntimeError(f"BEHAVIOR R1Pro controller order differs for {group}.")
        if any(group not in (*ACTION_SLICES, "camera") for group in action_indices):
            raise RuntimeError("BEHAVIOR R1Pro has an unexpected controller group.")
        joints_by_dof = {
            int(dof): joint for joint in robot.joints.values() for dof in joint.dof_indices
        }
        lower = robot.joint_lower_limits
        upper = robot.joint_upper_limits
        has_limit = robot.joint_has_limits
        channel_names = (
            "base.x", "base.y", "base.yaw",
            *(f"torso.{index}" for index in range(4)),
            *(f"left_arm.{index}" for index in range(7)),
            "left_gripper",
            *(f"right_arm.{index}" for index in range(7)),
            "right_gripper",
        )
        channels: list[dict[str, object]] = []
        for group, (start, end) in ACTION_SLICES.items():
            controlled_joints = robot.controller_joint_idx[group].tolist()
            if group in ("trunk", "arm_left", "arm_right") and len(controlled_joints) != end - start:
                raise RuntimeError(f"BEHAVIOR {group} controller command and joint counts differ.")
            for index in range(start, end):
                minimum = float(action_space.low[index])
                maximum = float(action_space.high[index])
                if group in ("trunk", "arm_left", "arm_right"):
                    dof = controlled_joints[index - start]
                    joint = joints_by_dof[dof]
                    if not bool(has_limit[dof]) or not joint.is_single_dof:
                        raise RuntimeError(f"BEHAVIOR {group} has no bounded native position joint.")
                    minimum = float(lower[dof])
                    maximum = float(upper[dof])
                    quantity = "angular" if joint.is_revolute else "linear"
                    unit = "radian" if joint.is_revolute else "meter"
                else:
                    quantity, unit = "normalized", "dimensionless"
                if not math.isfinite(minimum) or not math.isfinite(maximum) or minimum >= maximum:
                    raise RuntimeError(f"BEHAVIOR action channel {channel_names[index]} has invalid native limits.")
                channels.append({
                    "name": channel_names[index],
                    "quantity": quantity,
                    "unit": unit,
                    "minimum": minimum,
                    "maximum": maximum,
                })
        if not np.array_equal(action_space.low[:3], np.full(3, -1)) or not np.array_equal(action_space.high[:3], np.ones(3)):
            raise RuntimeError("BEHAVIOR R1Pro base input range differs from the official controller.")
        spec = {
            "schema_version": "physical.action_spec.v1",
            "embodiment_id": "behavior.r1pro",
            "version": "behavior-b1979916-r1pro-v1",
            "coordinate_frame": "behavior.r1pro.native_action",
            "control_mode": "behavior.r1pro_native",
            "frequency_hz": 30,
            "channels": channels,
        }
        self._validator.parse("ActionSpec", spec)
        return spec

    def describe(self) -> NativeEnvironmentDescription:
        from physical_harness.environments.behavior.rotation import NativeViewRotation

        self._require_env()
        if self._action_spec is None or self._instance_id is None or self._instance_filename is None:
            raise RuntimeError("BEHAVIOR native action and scene metadata are unavailable.")
        og = self._og
        if abs(float(og.sim.get_physics_dt()) - 1 / 120) > 1e-9 or abs(float(og.sim.get_sim_step_dt()) - 1 / 30) > 1e-9:
            raise RuntimeError("BEHAVIOR physics or control timestep differs from the official evaluation profile.")
        NativeViewRotation(self)
        task_title = self._task_id.replace("_", " ")
        return NativeEnvironmentDescription(
            provider="behavior",
            embodiment_id="behavior.r1pro",
            action_spec=deepcopy(self._action_spec),
            camera_names=tuple(CAMERA_SENSORS),
            state_channels=STATE_CHANNELS,
            supported_check_ids=("task_success",),
            active_view_directions=(),
            rotation_axes=("yaw", "pitch"),
            task_instruction=task_title[0].upper() + task_title[1:] + ".",
            scene_metadata={
                "native_task_id": self._task_id,
                "instance_id": self._instance_id,
                "scene_model": self._scene_model,
                "instance_filename": self._instance_filename,
                "scene_config_id": self._scene_config_id,
                "robot_model": "R1Pro",
                "physics_timestep_s": 1 / 120,
                "control_timestep_s": 1 / 30,
                "evaluation_horizon": self._evaluation_horizon,
            },
        )

    def _observation(self, raw: Mapping[str, object]) -> NativeObservation:
        import numpy as np
        from PIL import Image
        from omnigibson.utils import transform_utils as T

        observed_monotonic = time.monotonic()
        observed_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        native = raw["robot_r1"]
        images: dict[str, bytes] = {}
        for name, sensor_name in CAMERA_SENSORS.items():
            pixels = native[sensor_name]["rgb"].cpu().numpy()[..., :3]
            if pixels.shape != (256, 256, 3) or pixels.dtype != np.uint8:
                raise RuntimeError(f"BEHAVIOR camera {name} returned an invalid RGB frame.")
            output = BytesIO()
            Image.fromarray(pixels).save(output, format="PNG")
            if output.tell() > 1024 * 1024:
                raise RuntimeError(f"BEHAVIOR camera {name} exceeds the policy observation byte limit.")
            images[name] = output.getvalue()
        proprio = native["proprio"].cpu().numpy()
        if proprio.shape != (258,) or not np.isfinite(proprio).all():
            raise RuntimeError("BEHAVIOR R1Pro proprio differs from the official 258-value mapping.")
        state = {
            f"state.{name}": tuple(float(value) for value in proprio[start:end])
            for name, (start, end) in STATE_SLICES.items()
        }
        observation = NativeObservation(str(uuid4()), observed_at, observed_monotonic, images, state)
        frames = {}
        for camera, sensor_name in CAMERA_SENSORS.items():
            sensor = self._require_env().robots[0].sensors[sensor_name]
            depth = native[sensor_name]["depth_linear"].cpu().numpy()
            if depth.shape == (256, 256, 1):
                depth = depth[..., 0]
            usd_pose = T.pose2mat(sensor.get_position_orientation(frame="world")).cpu().numpy()
            near, far = sensor.clipping_range.tolist()
            frames[camera] = {
                "axial_depth_m": np.asarray(depth, dtype=np.float32),
                "intrinsic_matrix": sensor.intrinsic_matrix.cpu().numpy(),
                "camera_to_world": usd_pose @ np.diag([1.0, -1.0, -1.0, 1.0]),
                "near_m": float(near), "far_m": float(far),
            }
        self._metric_capture.replace(observation, float(self._og.sim.current_time), frames)
        return observation

    def measure_object(self, observation_id: str, camera: str, source_image_sha256: str,
                       mask_png: bytes) -> dict[str, object]:
        self._require_env()
        return self._metric_capture.measure(observation_id, camera, source_image_sha256, mask_png)

    def reset(self, task_id: str, configuration: Mapping[str, object]) -> NativeObservation:
        self._require_owner()
        if self._env is not None:
            raise RuntimeError("BEHAVIOR session is already initialized; task admission preserves its scene.")
        if set(configuration) - {"instance_id", "scene_config_id", "evaluation_horizon"}:
            raise ValueError("Unknown BEHAVIOR native scene configuration field.")
        instance_id = configuration.get("instance_id", 0)
        if type(instance_id) is not int or not 0 <= instance_id < 10:
            raise ValueError("BEHAVIOR 2025 test instance ID must be between 0 and 9.")
        gpu_id = os.environ.get("OMNIGIBSON_GPU_ID")
        if gpu_id is None or not gpu_id.isdecimal() or os.environ.get("CUDA_VISIBLE_DEVICES"):
            raise RuntimeError("BEHAVIOR requires an explicit physical OMNIGIBSON_GPU_ID and unremapped CUDA devices.")
        data_root = Path(os.environ["OMNIGIBSON_DATA_PATH"]).resolve(strict=True)
        scene_config_id = configuration.get("scene_config_id", 0)
        task_configuration, admitted_instance_path = behavior_task_selection(
            self._source_root, data_root, task_id, scene_config_id, instance_id,
        )
        source = import_module("gr00t.eval.sim.BEHAVIOR.og_teleop_utils")
        if Path(source.__file__).resolve().parents[4] != self._source_root:
            raise RuntimeError("Imported GR00T BEHAVIOR configuration differs from the admitted source root.")
        import omnigibson as og
        import torch
        from omnigibson.macros import gm
        from omnigibson.transition_rules import CookingSystemRule, MixingToolRule, ToggleableMachineRule
        from omnigibson.utils.bddl_utils import is_system_bddl_inst
        from omnigibson.utils.python_utils import recursively_convert_to_torch

        torch.cuda.set_device(int(gpu_id))
        gm.HEADLESS = True
        for rule in (ToggleableMachineRule, MixingToolRule, CookingSystemRule):
            rule.ENABLED = False
        selected = source.generate_basic_environment_config(task_id, task_configuration)
        selected["robots"] = [source.generate_robot_config(task_id, task_configuration)]
        selected["robots"][0]["obs_modalities"] = ["proprio", "rgb", "depth_linear"]
        selected["robots"][0]["proprio_obs"] = list(PROPRIOCEPTION_NAMES)
        selected["task"]["include_obs"] = False
        if "evaluation_horizon" in configuration:
            if configuration["evaluation_horizon"] != "human_demo_2x":
                raise ValueError("BEHAVIOR evaluation_horizon must be human_demo_2x.")
            from .evaluation import official_task_horizon

            self._evaluation_horizon = official_task_horizon(self._source_root, data_root, task_id)
            selected["task"]["termination_config"]["max_steps"] = self._evaluation_horizon["max_controls"]
        self._og = og
        env = og.Environment(configs=selected)
        self._env = env
        robot = env.robots[0]
        for name, sensor_name in CAMERA_SENSORS.items():
            sensor = robot.sensors[sensor_name]
            if name == "head":
                sensor.horizontal_aperture = 40.0
            sensor.image_height = 256
            sensor.image_width = 256
        og.sim.update_handles()
        for sensor_name in CAMERA_SENSORS.values():
            robot.sensors[sensor_name].initialize_sensors(names="camera_params")
        # SDK camera_params annotator 需要四次 render 更新，随后保留原生实例 reset。
        for _ in range(4):
            og.sim.render()
        for sensor_name in CAMERA_SENSORS.values():
            robot.sensors[sensor_name].intrinsic_matrix
        env.load_observation_space()
        og.sim.stop()
        robot.base_footprint_link.mass = 250.0
        og.sim.play()
        og.sim.update_handles()
        env._current_episode = 0
        env.reset()
        scene_model = env.task.scene_name
        instance_filename = env.task.get_cached_activity_scene_filename(
            scene_model=scene_model,
            activity_name=env.task.activity_name,
            activity_definition_id=env.task.activity_definition_id,
            activity_instance_id=instance_id,
        )
        instance_path = data_root / "2025-challenge-hidden-instances" / task_id / f"{instance_filename}-tro_state.json"
        if instance_path != admitted_instance_path:
            raise RuntimeError("BEHAVIOR SDK instance identity differs from the admitted native task data.")
        with instance_path.open(encoding="utf-8") as stream:
            instance = recursively_convert_to_torch(json.load(stream))
        for name, state in instance.items():
            if name == "robot_poses":
                pose = state["R1Pro"][0]
                robot.set_position_orientation(pose["position"], pose["orientation"])
                env.scene.write_task_metadata(key=name, data=state)
            else:
                env.task.object_scope[name].load_state(state, serialized=False)
        og.sim.update_handles()
        for _ in range(25):
            og.sim.step_physics()
            for name, entity in env.task.object_scope.items():
                if not is_system_bddl_inst(name) and entity is not None:
                    entity.keep_still()
        env.scene.update_initial_file()
        env.scene.reset()
        raw, _ = env.reset()
        self._task_id = task_id
        self._instance_id = instance_id
        self._scene_model = scene_model
        self._instance_filename = instance_filename
        self._scene_config_id = scene_config_id
        self._action_spec = self._native_action_spec()
        self._controlled_physics_steps = 0
        self._episode_terminated = False
        self._last_native_termination = None
        self.describe()
        return self._observation(raw)

    def bind_task(self, task_id: str) -> None:
        self._require_env()
        if task_id != self._task_id:
            raise ValueError("BEHAVIOR session cannot change its native task without an explicit reset.")

    def observe(self) -> NativeObservation:
        raw, _ = self._require_env().get_obs()
        return self._observation(raw)

    def step(
        self,
        action: Sequence[float],
        should_stop: Callable[[], bool],
        on_live_frame: Callable[[NativeFrame], bool] | None = None,
    ) -> NativeStep:
        import torch

        env = self._require_env()
        if should_stop():
            return NativeStep(self.observe(), 0, False, 0, self._episode_terminated)
        if self.episode_terminated():
            raise RuntimeError("BEHAVIOR episode has ended; a new native session is required.")
        control_started = time.monotonic()
        channels = self._action_spec["channels"]
        if len(action) != len(channels) or any(
            type(value) not in (int, float) or not math.isfinite(value)
            or not channel["minimum"] <= value <= channel["maximum"]
            for value, channel in zip(action, channels)
        ):
            raise ValueError("BEHAVIOR R1Pro action violates its 23 native channel limits.")
        if should_stop():
            return NativeStep(self.observe(), 0, False, 0, self._episode_terminated)
        before = int(self._og.sim.current_time_step_index)
        raw, _reward, terminated, truncated, info = env.step(
            {"robot_r1": torch.tensor(action, dtype=torch.float32)}, n_render_iterations=1
        )
        raw_sim_steps = int(self._og.sim.current_time_step_index) - before
        if raw_sim_steps != 4:
            raise RuntimeError("BEHAVIOR native control step did not complete four physics steps.")
        self._controlled_physics_steps += raw_sim_steps
        self._record_native_termination(terminated, truncated, info)
        if self._episode_terminated:
            self.episode_terminated()
        observation = self._observation(raw)
        frame = NativeFrame(
            observation.observation_id, observation.observed_at, observation.images,
            raw_sim_steps, self._controlled_physics_steps / 120,
        )
        live_exhausted = on_live_frame is not None and not on_live_frame(frame)
        self._last_control_duration_s = time.monotonic() - control_started
        return NativeStep(
            observation, 1, True, raw_sim_steps, self._episode_terminated,
            (frame,), "live_frame_capacity_exhausted" if live_exhausted else None,
            {"native_physics_step_before": before,
             "native_physics_step_after": int(self._og.sim.current_time_step_index),
             "physics_count_source": "omnigibson.sim.current_time_step_index",
             "native_termination": deepcopy(self._last_native_termination)},
        )

    def _record_native_termination(self, terminated: bool, truncated: bool, info: Mapping[str, object]) -> None:
        self._require_owner()
        conditions = info["done"]["termination_conditions"]
        source = Path(import_module("omnigibson.envs.env_base").__file__).resolve(strict=True)
        self._last_native_termination = {
            "terminated": bool(terminated), "truncated": bool(truncated),
            "termination_conditions": {
                name: {"done": bool(value["done"]), "success": bool(value["success"])}
                for name, value in conditions.items()
            },
            "success": bool(info["done"]["success"]),
            "environment_step": int(self._require_env()._current_step),
            "source": "omnigibson.envs.env_base.Environment._post_step",
            "source_file": str(source), "source_sha256": sha256(source.read_bytes()).hexdigest(),
        }
        self._episode_terminated = bool(terminated or truncated)

    def check(self, check_ids: Sequence[str]) -> Sequence[NativeCheck]:
        env = self._require_env()
        if not check_ids or any(check_id != "task_success" for check_id in check_ids):
            raise ValueError("Unsupported BEHAVIOR check ID.")
        success, _ = env.task.compiled_task.check_goal(env.task._evaluate_predicate)
        return tuple(NativeCheck(check_id, bool(success)) for check_id in check_ids)

    def episode_terminated(self) -> bool:
        env = self._require_env()
        before = self._terminal_state()
        success = bool(self.check(("task_success",))[0].value)
        terminated = self._episode_terminated or success
        self._terminal_recorder.record(
            before=before, after=self._terminal_state(), current_success=success, terminated=terminated,
            provider_source=Path(__file__), predicate=env.task.compiled_task.check_goal, control=env.step,
            termination_source=Path(import_module("omnigibson.envs.env_base").__file__),
        )
        return terminated

    def _terminal_state(self) -> dict:
        env = self._require_env()
        return {"task_id": self._task_id, "instance_id": self._instance_id,
                "scene_model": self._scene_model, "instance_filename": self._instance_filename,
                "scene_config_id": self._scene_config_id,
                "native_control_counter": int(env._current_step),
                "native_physics_step": int(self._og.sim.current_time_step_index),
                "controlled_physics_steps": self._controlled_physics_steps,
                "physics_count_source": "omnigibson.sim.current_time_step_index",
                "simulation_time_s": float(self._og.sim.current_time),
                "native_episode_terminated": self._episode_terminated,
                "native_termination": deepcopy(self._last_native_termination)}

    def turn_view(self, direction: str) -> NativeObservation:
        raise ValueError(f"BEHAVIOR active view direction is unsupported: {direction}")

    def rotate_view(self, yaw_deg: float, pitch_deg: float, should_stop: Callable[[], bool]) -> NativeRotation:
        from physical_harness.environments.behavior.rotation import NativeViewRotation

        return NativeViewRotation(self).run(yaw_deg, pitch_deg, should_stop)

    def close(self) -> None:
        self._require_owner()
        self._env = None
        self._task_id = None
        self._action_spec = None
        if self._og is not None:
            og, self._og = self._og, None
            if og.sim is not None:
                from omnigibson import lazy

                lazy.omni.kit.viewport.menubar.core.utils.usd_watch.stop()
                og.sim._partial_clear()
            if og.app is None:
                og.cleanup()
            else:
                import omni.ui as ui

                callback_titles = list(ui.Workspace.get_show_window_titles())
                for title in callback_titles:
                    ui.Workspace.set_show_window_fn(title, None)
                remaining_callbacks = list(ui.Workspace.get_show_window_titles())
                if remaining_callbacks:
                    raise RuntimeError("BEHAVIOR native UI window callbacks remain registered during shutdown.")
                self._close_diagnostics = {
                    "released_ui_callback_titles": callback_titles,
                    "remaining_ui_callback_titles": remaining_callbacks,
                }
                og.app.set_setting("/app/fastShutdown", False)
                og.shutdown()
                self._close_diagnostics["native_close_returned"] = True
