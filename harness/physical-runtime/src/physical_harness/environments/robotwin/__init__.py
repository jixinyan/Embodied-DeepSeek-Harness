from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from importlib import import_module
from importlib.metadata import version
from io import BytesIO
import json
import math
import os
from pathlib import Path
import time
from typing import Callable, Mapping, Sequence
from uuid import uuid4

import numpy as np
from PIL import Image
import sapien
import yaml

from physical_harness.environments import NativeCheck, NativeEnvironmentDescription, NativeFrame, NativeObservation, NativeStep
from physical_harness.validation import ContractValidator


CAMERA_NAMES = ("head_camera", "left_camera", "right_camera")
STATE_CHANNELS = ("joint_action.vector",)
ACTION_CHANNELS = tuple([f"fl_joint{index}" for index in range(1, 8)] + [f"fr_joint{index}" for index in range(1, 8)])
ACTION_SPEC = {
    "schema_version": "physical.action_spec.v1",
    "embodiment_id": "robotwin.aloha-agilex",
    "version": "robotwin-bf44be51-qpos-v1",
    "coordinate_frame": "robotwin.aloha-agilex.joint",
    "control_mode": "robotwin.qpos_target",
    "frequency_hz": None,
    "channels": [
        {
            "name": name,
            "quantity": "normalized" if name.endswith("joint7") else "angular",
            "unit": "dimensionless" if name.endswith("joint7") else "radian",
            "minimum": 0 if name.endswith("joint7") else -10,
            "maximum": 1 if name.endswith("joint7") else 10,
        }
        for name in ACTION_CHANNELS
    ],
}


class RoboTwinEnvironment:
    def __init__(self, source_root: Path, validator: ContractValidator) -> None:
        validator.parse("ActionSpec", ACTION_SPEC)
        if version("sapien") != "3.0.0b1" or version("mplib") != "0.2.1":
            raise RuntimeError("Installed SAPIEN or mplib version differs from the pinned RoboTwin adapter.")
        self._source_root = source_root.resolve()
        if self._source_root != Path.cwd().resolve():
            raise RuntimeError("RoboTwin process working directory must be the pinned source root.")
        if os.environ.get("ROBOTWIN_RENDER_DEVICE") is None:
            raise RuntimeError("ROBOTWIN_RENDER_DEVICE must select the admitted SAPIEN device.")
        warp_arch = os.environ.get("ROBOTWIN_WARP_PTX_TARGET_ARCH")
        if warp_arch is not None:
            if not warp_arch.isdecimal() or int(warp_arch) < 10:
                raise ValueError("ROBOTWIN_WARP_PTX_TARGET_ARCH must be a positive CUDA architecture number.")
            import warp

            warp.config.cuda_output = "ptx"
            warp.config.ptx_target_arch = int(warp_arch)
        if not (self._source_root / "task_config" / "demo_clean.yml").is_file():
            raise RuntimeError("Pinned RoboTwin task configuration is unavailable.")
        self._env = None
        self._task_id: str | None = None
        self._seed: int | None = None
        self._controlled_physics_steps = 0
        self._frame_sample_interval_steps = 10
        self._max_frames_per_action = 300
        self._ray_tracing_denoiser = "none"

    def _require_env(self):
        if self._env is None:
            raise RuntimeError("RoboTwin task has not been reset.")
        return self._env

    def describe(self) -> NativeEnvironmentDescription:
        env = self._require_env()
        if abs(float(env.scene.get_timestep()) - 1 / 250) > 1e-9:
            raise RuntimeError("RoboTwin physics timestep differs from the pinned task configuration.")
        if len(env.robot.left_arm_joints) != 6 or len(env.robot.right_arm_joints) != 6:
            raise RuntimeError("RoboTwin arm joint count differs from the declared ActionSpec.")
        arm_joints = (*env.robot.left_arm_joints, *env.robot.right_arm_joints)
        arm_names = (*ACTION_CHANNELS[:6], *ACTION_CHANNELS[7:13])
        for joint, name in zip(arm_joints, arm_names):
            if joint.get_name() != name or not np.allclose(joint.get_limits(), [[-10, 10]], atol=1e-5):
                raise RuntimeError(f"RoboTwin native joint limits or order differ for {name}.")
        for joint, name in ((env.robot.left_gripper[0][0], "fl_joint7"), (env.robot.right_gripper[0][0], "fr_joint7")):
            if joint.get_name() != name or not np.allclose(joint.get_limits(), [[0, 0.04765]], atol=1e-5):
                raise RuntimeError(f"RoboTwin native gripper limits or order differ for {name}.")
        with (self._source_root / "description" / "task_instruction" / "adjust_bottle.json").open(encoding="utf-8") as stream:
            instruction = json.load(stream)["full_description"]
        if not isinstance(instruction, str) or not instruction.strip():
            raise RuntimeError("RoboTwin adjust_bottle task instruction is unavailable.")
        if self._seed is None or type(env.model_id) not in (int, np.int64) or type(env.qpose_tag) not in (int, np.int64):
            raise RuntimeError("RoboTwin scene parameters are unavailable.")
        return NativeEnvironmentDescription(
            provider="robotwin",
            embodiment_id="robotwin.aloha-agilex",
            action_spec=deepcopy(ACTION_SPEC),
            camera_names=CAMERA_NAMES,
            state_channels=STATE_CHANNELS,
            supported_check_ids=("task_success",),
            active_view_directions=(),
            task_instruction=instruction,
            scene_metadata={
                "native_task_id": "adjust_bottle",
                "task_config": "demo_clean",
                "seed": self._seed,
                "bottle_model_id": int(env.model_id),
                "bottle_orientation_tag": int(env.qpose_tag),
                "scene_identifier": f"adjust_bottle:{self._seed}:{int(env.model_id)}:{int(env.qpose_tag)}",
                "physics_timestep_s": 1 / 250,
                "ray_tracing_denoiser": self._ray_tracing_denoiser,
            },
        )

    def _configuration(self, task_id: str, configuration: Mapping[str, object]) -> dict[str, object]:
        if task_id != "adjust_bottle":
            raise ValueError("This RoboTwin adapter supports the adjust_bottle native task.")
        if set(configuration) - {"seed", "frame_sample_interval_steps", "max_frames_per_action", "ray_tracing_denoiser"}:
            raise ValueError("Unknown RoboTwin scene configuration field.")
        denoiser = configuration.get("ray_tracing_denoiser", "none")
        if not isinstance(denoiser, str) or denoiser not in {"none", "oidn", "optix"}:
            raise ValueError("RoboTwin ray_tracing_denoiser must be none, oidn or optix.")
        self._ray_tracing_denoiser = denoiser
        seed = configuration.get("seed", 0)
        if type(seed) is not int or seed < 0:
            raise ValueError("RoboTwin seed must be a nonnegative integer.")
        interval = configuration.get("frame_sample_interval_steps", 10)
        frame_limit = configuration.get("max_frames_per_action", 300)
        if type(interval) is not int or interval <= 0 or type(frame_limit) is not int or frame_limit <= 0:
            raise ValueError("RoboTwin frame sampling interval and limit must be positive integers.")
        self._frame_sample_interval_steps = interval
        self._max_frames_per_action = frame_limit
        with (self._source_root / "task_config" / "demo_clean.yml").open(encoding="utf-8") as stream:
            selected = yaml.safe_load(stream)
        if selected["embodiment"] != ["aloha-agilex"]:
            raise RuntimeError("RoboTwin task config embodiment differs from the adapter mapping.")
        with (self._source_root / "task_config" / "_camera_config.yml").open(encoding="utf-8") as stream:
            camera_config = yaml.safe_load(stream)["Large_D435"]
        if camera_config["w"] != 640 or camera_config["h"] != 480:
            raise RuntimeError("RoboTwin Large_D435 resolution differs from the adapter mapping.")
        robot_path = "./assets/embodiments/aloha-agilex/"
        with (self._source_root / robot_path / "config.yml").open(encoding="utf-8") as stream:
            robot_config = yaml.safe_load(stream)
        if robot_config["arm_joints_name"] != [list(ACTION_CHANNELS[:6]), list(ACTION_CHANNELS[7:13])]:
            raise RuntimeError("RoboTwin arm joint order differs from the adapter mapping.")
        if [gripper["base"] for gripper in robot_config["gripper_name"]] != ["fl_joint7", "fr_joint7"]:
            raise RuntimeError("RoboTwin gripper order differs from the adapter mapping.")
        selected["camera"] = dict(selected["camera"])
        selected["camera"]["head_camera_type"] = "Large_D435"
        selected["camera"]["wrist_camera_type"] = "Large_D435"
        selected["render_freq"] = 0
        selected["collect_data"] = False
        selected["eval_video_log"] = False
        selected["save_data"] = False
        selected["eval_mode"] = True
        selected["task_name"] = task_id
        selected["task_config"] = "demo_clean"
        selected["head_camera_h"] = 480
        selected["head_camera_w"] = 640
        selected["left_robot_file"] = robot_path
        selected["right_robot_file"] = robot_path
        selected["dual_arm_embodied"] = True
        selected["left_embodiment_config"] = robot_config
        selected["right_embodiment_config"] = robot_config
        selected["seed"] = seed
        selected["now_ep_num"] = 0
        selected["is_test"] = True
        return selected

    def _observation(self, raw: Mapping[str, object]) -> NativeObservation:
        observed_monotonic = time.monotonic()
        observed_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        images: dict[str, bytes] = {}
        camera_data = raw["observation"]
        for camera in CAMERA_NAMES:
            pixels = camera_data[camera]["rgb"]
            if not isinstance(pixels, np.ndarray) or pixels.shape != (480, 640, 3) or pixels.dtype != np.uint8:
                raise RuntimeError(f"RoboTwin camera {camera} returned an invalid RGB frame.")
            output = BytesIO()
            Image.fromarray(pixels).save(output, format="PNG")
            if output.tell() > 1024 * 1024:
                raise RuntimeError(f"RoboTwin camera {camera} exceeds the policy observation limit.")
            images[camera] = output.getvalue()
        vector = raw["joint_action"]["vector"]
        if not isinstance(vector, np.ndarray) or vector.shape != (14,) or not np.isfinite(vector).all():
            raise RuntimeError("RoboTwin joint_action.vector is not a finite 14-value array.")
        state = {"joint_action.vector": tuple(float(value) for value in vector)}
        return NativeObservation(str(uuid4()), observed_at, observed_monotonic, images, state)

    def reset(self, task_id: str, configuration: Mapping[str, object]) -> NativeObservation:
        if self._env is not None:
            raise RuntimeError("RoboTwin session is already initialized; task admission preserves its scene.")
        selected = self._configuration(task_id, configuration)
        task_class = getattr(import_module(f"envs.{task_id}"), task_id)
        denoiser = self._ray_tracing_denoiser

        class RenderConfiguredTask(task_class):
            def setup_scene(self, **kwargs):
                super().setup_scene(**kwargs)
                sapien.render.set_ray_tracing_denoiser(denoiser)
                if sapien.render.get_ray_tracing_denoiser() != denoiser:
                    raise RuntimeError("SAPIEN denoiser differs from the admitted scene configuration.")

        env = RenderConfiguredTask()
        try:
            env.setup_demo(**selected)
            if sapien.render.get_ray_tracing_denoiser() != self._ray_tracing_denoiser:
                raise RuntimeError("SAPIEN denoiser differs from the admitted scene configuration.")
            self._env = env
            self._task_id = task_id
            self._seed = selected["seed"]
            self._controlled_physics_steps = 0
            self.describe()
            return self._observation(env.get_obs())
        except Exception as setup_error:
            self._env = None
            self._task_id = None
            self._seed = None
            self._controlled_physics_steps = 0
            try:
                env.close_env(clear_cache=False)
            except Exception as close_error:
                raise ExceptionGroup("RoboTwin setup and cleanup both failed.", [setup_error, close_error]) from setup_error
            raise

    def bind_task(self, task_id: str) -> None:
        self._require_env()
        if task_id != self._task_id:
            raise ValueError("RoboTwin session cannot change its native task without an explicit reset.")

    def observe(self) -> NativeObservation:
        return self._observation(self._require_env().get_obs())

    def step(
        self,
        action: Sequence[float],
        should_stop: Callable[[], bool],
        on_live_frame: Callable[[NativeFrame], bool] | None = None,
    ) -> NativeStep:
        env = self._require_env()
        if should_stop():
            return NativeStep(self.observe(), 0, False, 0, bool(env.eval_success))
        if len(action) != 14 or any(
            type(value) not in (int, float) or not math.isfinite(value)
            or not ACTION_SPEC["channels"][index]["minimum"] <= value <= ACTION_SPEC["channels"][index]["maximum"]
            for index, value in enumerate(action)
        ):
            raise ValueError("RoboTwin action violates its 14-channel absolute qpos target bounds.")
        frames: list[NativeFrame] = []
        starting_steps = self._controlled_physics_steps
        recording_exhausted = False
        live_frame_exhausted = False

        def on_physics_step(native_step_index: int) -> bool:
            nonlocal recording_exhausted, live_frame_exhausted
            self._controlled_physics_steps += 1
            if native_step_index != self._controlled_physics_steps - starting_steps:
                raise RuntimeError("RoboTwin native physics callback index differs from the actual step count.")
            if (native_step_index - 1) % self._frame_sample_interval_steps:
                return True
            sampled = self._observation(env.get_obs())
            frame = NativeFrame(
                sampled.observation_id,
                sampled.observed_at,
                sampled.images,
                native_step_index,
                self._controlled_physics_steps / 250,
            )
            frames.append(frame)
            if on_live_frame is not None and not on_live_frame(frame):
                live_frame_exhausted = True
                return False
            recording_exhausted = len(frames) == self._max_frames_per_action
            return not recording_exhausted

        raw_steps, completed = env.take_action(
            np.asarray(action, dtype=np.float64), should_stop=should_stop, on_physics_step=on_physics_step
        )
        if self._controlled_physics_steps - starting_steps != raw_steps:
            raise RuntimeError("RoboTwin native physics count differs from sampled step callbacks.")
        executed_actions = int(raw_steps > 0)
        if raw_steps < 0 or completed and not executed_actions:
            raise RuntimeError("RoboTwin native action returned inconsistent execution counts.")
        terminated = bool(env.eval_success or env.take_action_cnt == env.step_lim)
        return NativeStep(
            self.observe(), executed_actions, bool(completed), int(raw_steps), terminated, tuple(frames),
            "live_frame_capacity_exhausted" if live_frame_exhausted else (
                "recording_capacity_exhausted" if recording_exhausted else None
            ),
        )

    def check(self, check_ids: Sequence[str]) -> Sequence[NativeCheck]:
        env = self._require_env()
        if not check_ids or any(check_id != "task_success" for check_id in check_ids):
            raise ValueError("Unsupported RoboTwin check ID.")
        value = bool(env.check_success())
        return tuple(NativeCheck(check_id, value) for check_id in check_ids)

    def turn_view(self, direction: str) -> NativeObservation:
        raise ValueError(f"RoboTwin active view direction is unsupported: {direction}")

    def close(self) -> None:
        env, self._env = self._env, None
        self._task_id = None
        self._seed = None
        self._controlled_physics_steps = 0
        if env is not None:
            env.close_env(clear_cache=False)
