import hashlib
import inspect
import json
import pickle
from datetime import datetime, timezone
from pathlib import Path
import time
from threading import get_ident
from uuid import uuid4

import imageio.v2 as imageio
import numpy as np
from PIL import Image
from isaacsim.core.utils.stage import get_stage_units

from . import BUILD_TOWER_CHECK_IDS, CAMERA_NAMES
from .geometry import array, ground_pixel, organized_cloud, pose, transform
from .kinematics import DualKinematics
from .motion import NumericalMotion


CAMERA_ALIASES = {
    "cam_high": ("cam_head", "cam_high", "head_camera", "top_camera"),
    "cam_left_wrist": ("cam_left_wrist", "left_camera"),
    "cam_right_wrist": ("cam_right_wrist", "right_camera"),
}


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def register_native_evaluation(env):
    env.run_reward()
    if hasattr(env, "get_score"):
        env.get_score()
    names = ("check_list", "final_check_list", "trigger_check_list")
    counts = {name: [len(group) for group in getattr(env.reward_manager, name)] for name in names}
    if not all(sum(counts[name][index] for name in names) > 0 for index in range(env.num_envs)):
        raise ValueError("Native task completion conditions must be registered.")
    support = []
    if getattr(env, "interact", False) and hasattr(env, "query_support_arm_traj"):
        support = list(env.get_running_env_idx_list())
        for index in support:
            env.query_support_arm_traj(env_idx=index)
    return {"registered": True, "source": "native EvalEnv.run_eval preamble",
            "condition_group_counts": counts, "initial_support_arm_query_envs": support}


class RoboDojoSession:
    def __init__(self, env, output, task):
        self.env, self.output = env, Path(output)
        self.output.mkdir(parents=True, exist_ok=False)
        self.episode_id, self.step_id = None, 0
        self.status_audit_position = 0
        self.check_audit_position, self.owner_thread_id = 0, get_ident()
        self.terminated = self.truncated = self.success = False
        self.poisoned, self.finished = True, False
        self.video_writer, self.video_frames = None, 0
        self.source, self.control_epoch = "student", 0
        self.finish_reason = None
        self.metadata = {
            "task": task, "instruction": task, "simulator": "RoboDojo",
            "service": "EDH", "robot_adapter": "dual_arx_x5",
            "control_dt": 1 / env.obs_manager.collect_freq,
            "physics_count_source": "isaac_simulation_context.current_time_step_index",
            "max_episode_steps": int(env.step_lim), "action_dim": 14, "action_horizon": 150,
            "frame": "environment_origin", "eef_link": "link6", "no_rollback": True,
            "supports_fk_preview": True, "supports_grounding": True,
            "supports_dual_arm_absolute": True, "supports_get_depth": True,
            "supports_joint_control": True, "motion_planner": "numerical_ik",
            "control_version": "edh_grounded_direct_v1", "cameras": list(CAMERA_NAMES),
            "gripper_semantics": "continuous_0_closed_1_open",
            "supported_check_ids": ["task_success", *BUILD_TOWER_CHECK_IDS] if task == "build_tower" else ["task_success"]}
        env._stream_vision = lambda *arguments, **keywords: None

    def _record_physics_provenance(self):
        env = self.env
        if get_stage_units() != 1.0:
            raise ValueError("RoboDojo metric measurements require a meter-based native stage.")
        self.metadata["physics_timestep_s"] = float(env.sim.sim.get_physics_dt())
        sources = {}
        for operation, function in (("take_action", env.take_action), ("native_control_step", env.step),
                                    ("decimated_physics_step", env.sim.sim_step),
                                    ("physics_counter", type(env.sim.sim).current_time_step_index.fget),
                                    ("simulation_context", type(env.sim.sim))):
            source_path = Path(inspect.getsourcefile(function)).resolve(strict=True)
            data = source_path.read_bytes()
            sources[operation] = {"path": str(source_path), "sha256": hashlib.sha256(data).hexdigest()}
            (self.output / f"physics-source-{operation}.py").write_bytes(data)
        write_json(self.output / "physics-provenance.json", {
            "schema_version": "edh.robodojo.native_physics.v1",
            "counter_source": self.metadata["physics_count_source"],
            "physics_timestep_s": self.metadata["physics_timestep_s"],
            "decimation": int(env.sim.cfg.decimation),
            "collect_interval": int(env.obs_manager.collect_interval),
            "sources": sources,
        })

    def _check_identity(self, episode_id, step_id):
        if self.poisoned or episode_id != self.episode_id or step_id != self.step_id:
            raise ValueError("Stale episode/step or uncertain simulator state.")

    def _observe(self, record=False):
        raw = self.env.get_obs()
        state, vision = raw["state"], raw["vision"]
        states = np.concatenate([np.r_[state[f"{arm}_arm_joint_state"], state[f"{arm}_ee_joint_state"]]
                                 for arm in ("left", "right")]).astype(np.float32)
        if states.shape != (14,) or not np.isfinite(states).all():
            raise ValueError("The native dual-arm state must contain 14 finite values.")
        images, depths, names = {}, {}, {}
        for camera, aliases in CAMERA_ALIASES.items():
            matches = [name for name in aliases if name in vision]
            if len(matches) != 1:
                raise ValueError(f"Expected one native RGB-D sensor for {camera}.")
            name = names[camera] = matches[0]
            images[camera] = np.asarray(vision[name]["color"], dtype=np.uint8)[..., :3].copy()
            depth = array(vision[name]["depth"])
            if depth.ndim == 3 and depth.shape[-1] == 1:
                depth = depth[..., 0]
            if depth.ndim != 2 or depth.shape != images[camera].shape[:2]:
                raise ValueError(f"Native RGB and metric depth dimensions differ for {camera}.")
            depths[camera] = depth.copy()
        self.depths = depths
        native_names = self.env.camera_manager.camera_names[0]
        metric_frames = {}
        for name, native_name in names.items():
            sensor = self.env.camera_manager.cameras[0][native_names.index(native_name)]
            position, quaternion = sensor.get_world_pose(camera_axes="usd")
            near, far = sensor.get_clipping_range()
            metric_frames[name] = {
                "axial_depth_m": np.asarray(depths[name], dtype=np.float32),
                "intrinsic_matrix": array(sensor.get_intrinsics_matrix()),
                "camera_to_world": transform(position, quaternion) @ np.diag([1.0, -1.0, -1.0, 1.0]),
                "near_m": float(near), "far_m": float(far),
            }
        camera = self.env.camera_manager.cameras[0][native_names.index(names["cam_high"])]
        position, quaternion = camera.get_world_pose(camera_axes="usd")
        self.head_cloud = organized_cloud(depths["cam_high"], camera.get_intrinsics_matrix(),
                                         transform(position, quaternion))
        world_bases, base_poses = {}, []
        for arm, robot in self.kinematics.robots.items():
            value = array(self.kinematics.manager.get_link_pose(robot, robot.base_link, is_relative=False)[0])
            world_bases[arm] = transform(value[:3], value[3:])
            value = array(state[f"{arm}_ee_pose"])
            base_pose = pose(np.linalg.inv(self.kinematics.root(arm)) @ transform(value[:3], value[3:]))
            base_poses.append([*base_pose["position"], *base_pose["quaternion_wxyz"]])
        self.world_from_env = world_bases["left"] @ np.linalg.inv(self.kinematics.root("left"))
        poses = np.asarray([state[f"{arm}_ee_pose"] for arm in ("left", "right")], dtype=np.float32)
        self.obs = {**images, "states": states, "eef_positions": poses[:, :3],
                    "eef_quaternions_wxyz": poses[:, 3:], "eef_base_poses": np.asarray(base_poses),
                    "instruction": raw["instruction"],
                    "metric_frames": metric_frames,
                    "simulation_time_s": float(self.env.sim.sim.current_time),
                    "remaining_steps": max(0, self.metadata["max_episode_steps"] - self.step_id)}
        if record:
            directory = self.episode_dir / "observations"
            directory.mkdir(exist_ok=True)
            np.savez_compressed(directory / f"{self.step_id:06d}.npz",
                                **{key: value for key, value in self.obs.items() if key != "metric_frames"},
                                **{f"{key}_depth": value for key, value in depths.items()},
                                **{f"{camera}_{key}": frame[key] for camera, frame in metric_frames.items()
                                   for key in ("intrinsic_matrix", "camera_to_world", "near_m", "far_m")})
            if self.video_writer is None:
                self.video_writer = imageio.get_writer(
                    str(self.output / "sensors.mp4"), fps=1 / self.metadata["control_dt"],
                    codec="libx264", pixelformat="yuv420p", macro_block_size=2,
                    output_params=["-movflags", "+frag_keyframe+empty_moov", "-frag_duration", "1000000"])
            frames = [np.asarray(Image.fromarray(images[key]).resize((640, 480))) for key in CAMERA_NAMES]
            self.video_writer.append_data(np.concatenate(frames, axis=1))
            self.video_frames += 1
        return self.obs

    def reset(self, seed, source, policy_version):
        if self.episode_id is not None or type(seed) is not int or seed < 0:
            raise ValueError("A fresh episode and a nonnegative native layout ID are required.")
        if source not in ("student", "gpt_eef", "gpt_joint"):
            raise ValueError("Invalid control source.")
        self.env.reset(seed=[seed])
        self._record_physics_provenance()
        write_json(self.output / "native_evaluation.json", register_native_evaluation(self.env))
        if self.metadata["task"] == "build_tower":
            self._record_tower_check_provenance()
        self.episode_id = uuid4().hex
        self.episode_dir = self.output / self.episode_id
        self.episode_dir.mkdir()
        self.source = source
        self.kinematics = DualKinematics(self.env)
        self.motion = NumericalMotion(self.kinematics, self.metadata["control_dt"])
        write_json(self.output / "fk_validation.json", self.kinematics.check())
        self._observe(record=True)
        self.poisoned = False
        if self.metadata["task"] == "build_tower":
            self.tower_structure_checks(list(BUILD_TOWER_CHECK_IDS))
        self.metadata["instruction"] = self.obs["instruction"]
        result = {"episode_id": self.episode_id, "step_id": 0,
                  "initial_state_hash": hashlib.sha256(self.obs["states"].tobytes()).hexdigest(),
                  "instruction": self.obs["instruction"],
                  "metadata": {**self.metadata, "layout_id": seed,
                               "eval_seed": getattr(self.env, "eval_seed", None),
                               "policy_version": policy_version,
                               "initial_state_hash_scope": "robot_proprio_only_not_complete_scene",
                               "native_reset_settling_not_counted_as_policy_controls": True}}
        write_json(self.output / "reset.json", result)
        return result

    def get_depth(self, arm, x, y):
        if arm not in ("left", "right"):
            raise ValueError("The wrist arm must be left or right.")
        camera = f"cam_{arm}_wrist"
        depth = self.depths[camera]
        height, width = depth.shape
        if type(x) is not int or type(y) is not int or not (0 <= x < width and 0 <= y < height):
            raise ValueError(f"An integer wrist pixel within {width}x{height} is required.")
        value = float(depth[y, x])
        if not np.isfinite(value) or value <= 0:
            return {"ok": False, "physical_steps": 0, "error": "The wrist pixel has no valid metric depth."}
        return {"ok": True, "arm": arm, "camera": camera, "pixel": [x, y],
                "image_size": [width, height], "pixel_origin": "top_left", "depth_m": value,
                "units": "m", "depth_type": "distance_to_image_plane", "frame": f"{camera}_optical",
                "source": "wrist_camera_metric_depth", "step_id": self.step_id, "physical_steps": 0}

    def grounding(self, x, y):
        height, width, _ = self.head_cloud.shape
        if type(x) is not int or type(y) is not int or not (0 <= x < width and 0 <= y < height):
            raise ValueError(f"An integer head pixel within {width}x{height} is required.")
        if not np.isfinite(self.head_cloud[y, x]).all():
            return {"ok": False, "physical_steps": 0, "error": "The head pixel has no valid metric depth."}
        point = ground_pixel(self.head_cloud, x, y, self.world_from_env)
        return {"ok": True, "grounding_id": uuid4().hex, "pixel": [x, y],
                "image_size": [self.head_cloud.shape[1], self.head_cloud.shape[0]],
                "position": point.tolist(), "frame": "environment_origin", "units": "m",
                "world_axes_in_env": self.world_from_env[:3, :3].T.tolist(),
                "source": "head_camera_metric_depth_organized_point_cloud",
                "step_id": self.step_id, "physical_steps": 0}

    def joint_state(self):
        arms = self.motion.joint_state()
        for index, arm in enumerate(("left", "right")):
            arms[arm]["gripper_opening"] = float(self.obs["states"][index * 7 + 6])
        return {"arms": arms, "physical_steps": 0}

    def chunk_step(self, actions):
        if self.finished or self.terminated or self.truncated:
            raise ValueError("The episode has ended.")
        actions = np.asarray(actions, dtype=np.float32)
        if (actions.ndim != 2 or actions.shape[1] != 14 or not 1 <= len(actions) <= 15
                or not np.isfinite(actions).all() or np.any(actions[:, [6, 13]] < 0)
                or np.any(actions[:, [6, 13]] > 1)):
            raise ValueError("Expected 1..15 finite 14D actions with grippers in [0, 1].")
        rows = []
        for action in actions:
            command = {key: value for arm, offset in (("left", 0), ("right", 7))
                       for key, value in ((f"{arm}_arm_joint_state", action[offset:offset + 6]),
                                          (f"{arm}_ee_joint_state", action[offset + 6:offset + 7]))}
            before = int(self.env.take_action_cnt[0])
            physics_before = int(self.env.sim.sim.current_time_step_index)
            self.env.take_action(command)
            physics_after = int(self.env.sim.sim.current_time_step_index)
            raw_sim_steps = physics_after - physics_before
            if raw_sim_steps <= 0:
                raise RuntimeError("An admitted native action must advance the actual physics counter.")
            if int(self.env.take_action_cnt[0]) != before + 1:
                raise RuntimeError("The native simulator must execute exactly one admitted action.")
            self.step_id += 1
            ended = bool(self.env.end_flag[0])
            self.success = bool(ended and self.env.success[0])
            self.truncated = bool(ended and not self.success and self.step_id >= self.env.step_lim)
            self.terminated = bool(ended and not self.truncated)
            observation = self._observe(record=True)
            row = {"valid": True, "executed_action": action.copy(),
                   "obs": {"states": observation["states"]}, "step_id": self.step_id,
                   "terminated": self.terminated, "truncated": self.truncated, "success": self.success,
                   "source": self.source, "control_epoch": self.control_epoch}
            row.update(raw_sim_steps=raw_sim_steps, native_physics_step_before=physics_before,
                       native_physics_step_after=physics_after,
                       simulation_time_s=float(self.env.sim.sim.current_time),
                       physics_timestep_s=self.metadata["physics_timestep_s"])
            row.update(episode_id=self.episode_id, physics_count_source=self.metadata["physics_count_source"])
            row["camera_calibration"] = {
                camera: {key: frame[key].tolist() if isinstance(frame[key], np.ndarray) else frame[key]
                         for key in ("intrinsic_matrix", "camera_to_world", "near_m", "far_m")}
                for camera, frame in observation["metric_frames"].items()
            }
            write_json(self.episode_dir / f"action_{self.step_id - 1:06d}.json",
                       {**row, "executed_action": action.tolist(), "obs": {"states": observation["states"].tolist()}})
            if self.metadata["task"] == "build_tower":
                self.tower_structure_checks(list(BUILD_TOWER_CHECK_IDS))
            rows.append(row)
            if ended:
                self._write_summary("terminal")
                break
        return {"episode_id": self.episode_id, "step_id": self.step_id, "steps": rows}

    def _write_summary(self, reason):
        if self.video_writer is not None:
            self.video_writer.close()
            self.video_writer = None
        complete = self.terminated or self.truncated
        eligible = complete and not self.poisoned and 0 not in getattr(self.env, "unstable_envs", set())
        write_json(self.output / "summary.json", {
            "episode_id": self.episode_id, "step_id": self.step_id, "success": self.success,
            "terminated": self.terminated, "truncated": self.truncated,
            "complete": complete, "valid_for_success_rate": eligible,
            "native_success": self.success if eligible else None,
            "reason": self.finish_reason or reason, "video_frames": self.video_frames,
            "control_dt": self.metadata["control_dt"], "native_step_limit": self.metadata["max_episode_steps"]})

    def episode_status(self):
        simulator = self.env.sim.sim
        physics_before = int(simulator.current_time_step_index)
        time_before = float(simulator.current_time)
        native_counter = int(self.env.take_action_cnt[0])
        native_ended, native_success = bool(self.env.end_flag[0]), bool(self.env.success[0])
        if native_counter != self.step_id:
            raise RuntimeError("Native episode status control counter differs from the retained episode step.")
        success = bool(native_ended and native_success)
        truncated = bool(native_ended and not success and self.step_id >= self.env.step_lim)
        status = {"terminated": bool(native_ended and not truncated), "truncated": truncated,
                  "success": success, "finished": self.finished}
        observation_path = self.episode_dir / "observations" / f"{self.step_id:06d}.npz"
        provenance_path = self.output / "physics-provenance.json"
        physics_after, time_after = int(simulator.current_time_step_index), float(simulator.current_time)
        if physics_before != physics_after or time_before != time_after:
            raise RuntimeError("Read-only native episode status advanced the physics counter or simulation time.")
        record = {
            "schema_version": "edh.robodojo.episode_status.v1",
            "episode_id": self.episode_id, "step_id": self.step_id,
            "audit_position": self.status_audit_position, "monotonic_ns": time.monotonic_ns(),
            "recorded_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "native_control_counter": native_counter, "native_end_flag": native_ended,
            "native_success_flag": native_success, "native_step_limit": int(self.env.step_lim),
            **status, "native_physics_step_before": physics_before,
            "native_physics_step_after": physics_after, "simulation_time_before_s": time_before,
            "simulation_time_after_s": time_after, "physics_timestep_s": float(simulator.get_physics_dt()),
            "physics_count_source": self.metadata["physics_count_source"], "physical_steps": 0,
            "observation_path": str(observation_path.relative_to(self.output)),
            "observation_sha256": hashlib.sha256(observation_path.read_bytes()).hexdigest(),
            "physics_provenance_sha256": hashlib.sha256(provenance_path.read_bytes()).hexdigest(),
        }
        with (self.episode_dir / f"episode_status_{self.status_audit_position:06d}.json").open("x") as output:
            output.write(json.dumps(record, indent=2, allow_nan=False) + "\n")
        self.status_audit_position += 1
        return status

    def _record_tower_check_provenance(self):
        from task.RoboDojo.tasks.build_tower import BuildTowerCommon

        if not isinstance(self.env, BuildTowerCommon) or self.env.num_envs != 1:
            raise ValueError("Tower checks require the original single-environment native build_tower task.")
        if (self.env._base_structure_checks.__func__ is not BuildTowerCommon._base_structure_checks
                or self.env._middle_structure_checks.__func__ is not BuildTowerCommon._middle_structure_checks):
            raise ValueError("Native tower stage builders differ from the original task implementation.")
        rm = self.env.reward_manager
        operations = {
            "base": BuildTowerCommon._base_structure_checks,
            "middle": BuildTowerCommon._middle_structure_checks,
            "check_once": rm.check_once,
            "is_axis_up": rm.func_parser.is_axis_up,
            "is_A_up_B": rm.func_parser.is_A_up_B,
            "is_A_in_B_support_circle": rm.func_parser.is_A_in_B_support_circle,
        }
        sources = {}
        for name, function in operations.items():
            path = Path(inspect.getsourcefile(function)).resolve(strict=True)
            data = path.read_bytes()
            sources[name] = {"path": str(path), "sha256": hashlib.sha256(data).hexdigest()}
            (self.output / f"native-check-source-{name}.py").write_bytes(data)
        write_json(self.output / "native-check-provenance.json", {
            "schema_version": "edh.robodojo.tower_check_sources.v1",
            "task": "build_tower", "check_ids": list(BUILD_TOWER_CHECK_IDS), "sources": sources,
        })

    def _tower_read_state(self):
        simulator, rm = self.env.sim.sim, self.env.reward_manager
        layout = rm.func_parser.layout_manager
        poses = {}
        for index in range(8):
            label = f"block{index}"
            name = layout.get_instance_name(label=label, env_idx=0)
            if name is None:
                raise ValueError(f"Native tower block is unavailable: {label}.")
            position, quaternion = layout.get_instance_pose(inst_name=name, env_idx=0)
            value = np.concatenate([array(position).reshape(-1), array(quaternion).reshape(-1)])
            if value.shape != (7,) or not np.isfinite(value).all():
                raise ValueError(f"Native tower block pose is invalid: {label}.")
            poses[label] = {"instance_name": name, "pose": value.tolist()}
        # 记录 RewardManager 的原生可变数据，检查过程必须保留全部内容。
        reward_state = {key: value for key, value in vars(rm).items() if key not in {"env", "func_parser"}}
        parser_state = {key: value for key, value in vars(rm.func_parser).items()
                        if key not in {"env", "layout_manager", "robot_manager"}}
        return {
            "native_physics_step": int(simulator.current_time_step_index),
            "simulation_time_s": float(simulator.current_time),
            "native_control_counter": int(self.env.take_action_cnt[0]),
            "native_end_flag": bool(self.env.end_flag[0]), "native_success_flag": bool(self.env.success[0]),
            "object_poses": poses,
            "reward_state_sha256": hashlib.sha256(pickle.dumps((reward_state, parser_state), protocol=5)).hexdigest(),
        }

    def tower_structure_checks(self, check_ids):
        if (self.metadata["task"] != "build_tower" or get_ident() != self.owner_thread_id
                or not isinstance(check_ids, list) or not check_ids or len(set(check_ids)) != len(check_ids)
                or any(check_id not in BUILD_TOWER_CHECK_IDS for check_id in check_ids)):
            raise ValueError("Native tower checks require declared IDs on the simulator owner thread.")
        before = self._tower_read_state()
        if before["native_control_counter"] != self.step_id:
            raise RuntimeError("Native tower check control counter differs from the retained episode step.")
        rm = self.env.reward_manager
        builders = {"tower_base_structure": self.env._base_structure_checks,
                    "tower_middle_structure": self.env._middle_structure_checks}
        facts = []
        for check_id in check_ids:
            conditions = builders[check_id]()
            if not conditions:
                raise ValueError("Original native tower stage conditions must be nonempty.")
            # 原生 TaskEnv 以 AND 检查每个顶层条件，嵌套条件由 check_once 处理。
            values = [bool(rm.check_once(condition, 0)) for condition in conditions]
            facts.append({"check_id": check_id, "value": all(values), "condition_values": values})
        after = self._tower_read_state()
        if before != after:
            raise RuntimeError("Read-only native tower checks changed simulator or reward state.")
        observation_path = self.episode_dir / "observations" / f"{self.step_id:06d}.npz"
        audit_id = f"tower_check_{self.check_audit_position:06d}"
        record = {
            "schema_version": "edh.robodojo.tower_structure_checks.v1", "audit_id": audit_id,
            "episode_id": self.episode_id, "step_id": self.step_id, "audit_position": self.check_audit_position,
            "owner_thread_id": self.owner_thread_id, "monotonic_ns": time.monotonic_ns(),
            "recorded_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "checks": facts, "physical_steps": 0, "native_control_counter": before["native_control_counter"],
            "native_physics_step_before": before["native_physics_step"],
            "native_physics_step_after": after["native_physics_step"],
            "simulation_time_before_s": before["simulation_time_s"], "simulation_time_after_s": after["simulation_time_s"],
            "state_before": before, "state_after": after,
            "observation_path": str(observation_path.relative_to(self.output)),
            "observation_sha256": hashlib.sha256(observation_path.read_bytes()).hexdigest(),
            "physics_provenance_sha256": hashlib.sha256((self.output / "physics-provenance.json").read_bytes()).hexdigest(),
            "check_provenance_sha256": hashlib.sha256((self.output / "native-check-provenance.json").read_bytes()).hexdigest(),
        }
        with (self.episode_dir / f"{audit_id}.json").open("x") as output:
            output.write(json.dumps(record, indent=2, allow_nan=False) + "\n")
        self.check_audit_position += 1
        return record

    def dispatch(self, operation, arguments):
        if operation == "metadata":
            return self.metadata
        if operation == "reset":
            return self.reset(**arguments)
        self._check_identity(arguments["episode_id"], arguments["step_id"])
        values = {key: value for key, value in arguments.items() if key not in ("episode_id", "step_id")}
        if operation == "teacher_observation":
            return self.obs
        if operation == "episode_status":
            return self.episode_status()
        if operation == "tower_structure_checks":
            return self.tower_structure_checks(**values)
        if operation == "begin_combination":
            write_json(self.output / "combination.json", values)
            return {"physical_steps": 0}
        if operation == "finish_pilot":
            self.finished, self.finish_reason = True, values["reason"]
            self._write_summary(self.finish_reason)
            return {"episode_id": self.episode_id, "step_id": self.step_id,
                    "success": self.success, "terminated": self.terminated, "truncated": self.truncated}
        if self.finished or self.terminated or self.truncated:
            raise ValueError("The episode has ended.")
        if operation == "switch_control_source":
            if values["source"] not in ("student", "gpt_eef", "gpt_joint"):
                raise ValueError("Invalid control source.")
            self.source, self.control_epoch = values["source"], self.control_epoch + 1
            write_json(self.episode_dir / f"source_{self.control_epoch:04d}.json", {"step_id": self.step_id, **values})
            return {"physical_steps": 0, "source": self.source, "control_epoch": self.control_epoch}
        if operation in ("grounding", "get_depth", "joint_state", "chunk_step"):
            return getattr(self, operation)(**values)
        if operation == "prepare_targets":
            return self.motion.prepare(values["targets"], self.step_id)
        if operation == "prepare_joints":
            return self.motion.prepare_joints(values["targets"], values["coordinate_mode"], self.step_id)
        if operation == "eef_joint_target":
            return self.motion.target(values["targets"], self.step_id)
        if operation == "fk_preview":
            return self.kinematics.preview(values["actions"])
        raise ValueError(f"Unsupported native operation: {operation}.")
