from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from importlib.metadata import version
from io import BytesIO
import hashlib
import json
import math
import time
from typing import Callable, Mapping, Sequence
from uuid import uuid4

import numpy as np
from PIL import Image
from robocasa.utils.env_utils import create_env
from robocasa.models.fixtures import FixtureType
from robosuite import macros
from robosuite.utils.camera_utils import (
    get_camera_extrinsic_matrix,
    get_camera_intrinsic_matrix,
    get_real_depth_map,
)

from physical_harness.environments import (
    NativeCheck,
    NativeEnvironmentDescription,
    NativeFrame,
    NativeObservation,
    NativeStep,
)
from physical_harness.validation import ContractValidator
from physical_harness.perception.metric_geometry import summarize_metric_region


CAMERA_NAMES = (
    "robot0_agentview_left",
    "robot0_agentview_right",
    "robot0_eye_in_hand",
)
STATE_CHANNELS = (
    "robot0_gripper_qpos",
    "robot0_base_pos",
    "robot0_base_quat",
    "robot0_base_to_eef_pos",
    "robot0_base_to_eef_quat",
)
STATE_CHANNEL_SIZES = (2, 3, 4, 3, 4)
ACTION_CHANNELS = (
    "right_0", "right_1", "right_2", "right_3", "right_4", "right_5",
    "right_gripper", "base_0", "base_1", "base_2", "torso", "base_mode",
)
ACTION_SPEC = {
    "schema_version": "physical.action_spec.v1",
    "embodiment_id": "robocasa.pandaomron",
    "version": "robocasa-1.0.1-pandaomron-hybrid-v1",
    "coordinate_frame": "robosuite.pandaomron.native",
    "control_mode": "robosuite.hybrid_mobile_base",
    "frequency_hz": 20,
    "channels": [
        {"name": name, "quantity": "normalized", "unit": "dimensionless", "minimum": -1, "maximum": 1}
        for name in ACTION_CHANNELS
    ],
}


class RoboCasaEnvironment:
    def __init__(self, validator: ContractValidator) -> None:
        validator.parse("ActionSpec", ACTION_SPEC)
        if (version("robocasa"), version("robosuite"), version("mujoco")) != ("1.0.1", "1.5.2", "3.3.1"):
            raise RuntimeError("Installed RoboCasa, robosuite or MuJoCo version differs from this adapter mapping.")
        self._env = None
        self._task_id: str | None = None
        self._simulation_time_s = 0.0
        self._scene_parameters: dict[str, object] | None = None
        self._camera_resolution = 256
        self._native_done = False

    @staticmethod
    def _scene_configuration(configuration: Mapping[str, object]) -> dict[str, object]:
        allowed = {
            "seed", "split", "layout_ids", "style_ids", "layout_and_style_ids",
            "generative_textures", "randomize_cameras",
            "fixture_type", "camera_resolution", "obj_instance_split",
        }
        if set(configuration) - allowed:
            raise ValueError("Unknown RoboCasa scene configuration field.")
        seed = configuration.get("seed", 0)
        split = configuration.get("split", "pretrain")
        if type(seed) is not int or seed < 0:
            raise ValueError("RoboCasa seed must be a nonnegative integer.")
        if split not in (None, "pretrain", "target", "all"):
            raise ValueError("Unsupported RoboCasa split.")
        scene_fields = ("layout_ids", "style_ids", "layout_and_style_ids")
        if split is not None and any(key in configuration for key in scene_fields):
            raise ValueError("Explicit RoboCasa scene selection requires split=null.")
        if "layout_and_style_ids" in configuration and any(key in configuration for key in ("layout_ids", "style_ids")):
            raise ValueError("RoboCasa scene pairs cannot be combined with layout/style lists.")
        selected: dict[str, object] = {"seed": seed, "split": split}
        if "fixture_type" in configuration:
            fixture_type = configuration["fixture_type"]
            if not isinstance(fixture_type, str) or fixture_type not in FixtureType.__members__:
                raise ValueError("RoboCasa fixture_type must name a native FixtureType.")
            selected["fixture_type"] = fixture_type
        if "camera_resolution" in configuration:
            resolution = configuration["camera_resolution"]
            if type(resolution) is not int or resolution not in (256, 512):
                raise ValueError("RoboCasa camera_resolution must be 256 or 512 pixels.")
            selected["camera_resolution"] = resolution
        if "obj_instance_split" in configuration:
            instance_split = configuration["obj_instance_split"]
            if split is not None or instance_split not in (None, "pretrain", "target"):
                raise ValueError("Explicit RoboCasa object split requires split=null and a native object split.")
            selected["obj_instance_split"] = instance_split
        for key in ("layout_ids", "style_ids"):
            if key in configuration:
                value = configuration[key]
                if not isinstance(value, list) or not value or any(type(item) is not int or item < 0 for item in value):
                    raise ValueError(f"RoboCasa {key} must be a nonempty list of nonnegative integers.")
                selected[key] = list(value)
        if "layout_and_style_ids" in configuration:
            value = configuration["layout_and_style_ids"]
            if not isinstance(value, list) or not value or any(
                not isinstance(item, list) or len(item) != 2 or any(type(part) is not int or part < 0 for part in item)
                for item in value
            ):
                raise ValueError("RoboCasa scene pairs must contain nonnegative layout/style IDs.")
            selected["layout_and_style_ids"] = [tuple(item) for item in value]
        for key in ("generative_textures", "randomize_cameras"):
            if key in configuration:
                if type(configuration[key]) is not bool:
                    raise ValueError(f"RoboCasa {key} must be boolean.")
                selected[key] = configuration[key]
        return selected

    def _require_env(self):
        if self._env is None:
            raise RuntimeError("RoboCasa task has not been reset.")
        return self._env

    def _check_native_contract(self) -> None:
        env = self._require_env()
        controller = env.robots[0].composite_controller
        layout = controller.get_action_info_dict()
        expected = {
            "Action Dimension": (12,),
            "right": (0, 6),
            "right_gripper": (6, 7),
            "base": (7, 10),
            "torso": (10, 11),
        }
        if controller.name != "HYBRID_MOBILE_BASE" or layout != expected:
            raise RuntimeError("RoboCasa controller layout does not match the declared action mapping.")
        low, high = env.action_spec
        if env.action_dim != 12 or low.shape != (12,) or high.shape != (12,):
            raise RuntimeError("RoboCasa action dimensions do not match the declared ActionSpec.")
        if not np.array_equal(low, np.full(12, -1)) or not np.array_equal(high, np.ones(12)):
            raise RuntimeError("RoboCasa action limits do not match the declared ActionSpec.")
        if env.control_freq != 20:
            raise RuntimeError("RoboCasa control frequency does not match the declared ActionSpec.")

    def describe(self) -> NativeEnvironmentDescription:
        self._check_native_contract()
        env = self._require_env()
        metadata = env.get_ep_meta()
        instruction = metadata.get("lang")
        if not isinstance(instruction, str) or not instruction.strip() or len(instruction) > 4000:
            raise RuntimeError("RoboCasa episode metadata has no valid task instruction.")
        if self._scene_parameters is None:
            raise RuntimeError("RoboCasa scene configuration is unavailable.")
        scene_metadata = {
            "native_task_id": self._task_id,
            "configuration": deepcopy(self._scene_parameters),
            "layout_id": metadata["layout_id"],
            "style_id": metadata["style_id"],
            "fixture_refs": deepcopy(metadata["fixture_refs"]),
        }
        return NativeEnvironmentDescription(
            provider="robocasa",
            embodiment_id="robocasa.pandaomron",
            action_spec=deepcopy(ACTION_SPEC),
            camera_names=CAMERA_NAMES,
            state_channels=STATE_CHANNELS,
            supported_check_ids=("task_success",),
            active_view_directions=(),
            task_instruction=instruction,
            scene_metadata=scene_metadata,
        )

    def _observation(self, raw: Mapping[str, object]) -> NativeObservation:
        observed_monotonic = time.monotonic()
        observed_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        images: dict[str, bytes] = {}
        for camera in CAMERA_NAMES:
            pixels = raw[f"{camera}_image"]
            if (not isinstance(pixels, np.ndarray) or pixels.shape != (self._camera_resolution, self._camera_resolution, 3)
                    or pixels.dtype != np.uint8):
                raise RuntimeError(f"RoboCasa camera {camera} returned an invalid RGB frame.")
            if macros.IMAGE_CONVENTION == "opengl":
                pixels = pixels[::-1]
            elif macros.IMAGE_CONVENTION != "opencv":
                raise RuntimeError("Unsupported robosuite image convention.")
            output = BytesIO()
            Image.fromarray(pixels).save(output, format="PNG")
            if output.tell() > 1024 * 1024:
                raise RuntimeError("RoboCasa camera frame exceeds the policy observation limit.")
            images[camera] = output.getvalue()
        state: dict[str, tuple[float, ...]] = {}
        for channel, expected_size in zip(STATE_CHANNELS, STATE_CHANNEL_SIZES):
            value = raw[channel]
            if not isinstance(value, np.ndarray) or value.shape != (expected_size,) or not np.isfinite(value).all():
                raise RuntimeError(f"RoboCasa state channel {channel} is invalid.")
            state[channel] = tuple(float(item) for item in value)
        return NativeObservation(str(uuid4()), observed_at, observed_monotonic, images, state)

    def reset(self, task_id: str, configuration: Mapping[str, object]) -> NativeObservation:
        if not task_id or not isinstance(task_id, str):
            raise ValueError("RoboCasa task ID must be nonempty.")
        scene = self._scene_configuration(configuration)
        if self._env is not None:
            raise RuntimeError("RoboCasa session is already initialized; task admission preserves its scene.")
        self._scene_parameters = deepcopy(scene)
        self._camera_resolution = scene.pop("camera_resolution", 256)
        fixture_type = scene.pop("fixture_type", None)
        if fixture_type is not None:
            scene["fixture_id"] = FixtureType[fixture_type]
        self._env = create_env(
            env_name=task_id,
            robots="PandaOmron",
            camera_names=list(CAMERA_NAMES),
            camera_widths=self._camera_resolution,
            camera_heights=self._camera_resolution,
            render_onscreen=False,
            **scene,
        )
        self._task_id = task_id
        self._simulation_time_s = 0.0
        raw = self._env.reset()
        self._check_native_contract()
        return self._observation(raw)

    def bind_task(self, task_id: str) -> None:
        self._require_env()
        if task_id != self._task_id:
            raise ValueError("RoboCasa session cannot change its native task without an explicit reset.")

    def observe(self) -> NativeObservation:
        env = self._require_env()
        raw = env.viewer._get_observations(force_update=True) if env.viewer_get_obs else env._get_observations(force_update=True)
        return self._observation(raw)

    def capture_metric_depth(self, camera_names: Sequence[str] = CAMERA_NAMES) -> dict[str, object]:
        env = self._require_env()
        if (not camera_names or len(camera_names) > len(CAMERA_NAMES)
                or len(set(camera_names)) != len(camera_names)
                or any(camera not in CAMERA_NAMES for camera in camera_names)):
            raise ValueError("Metric depth capture requires unique registered RoboCasa cameras.")
        simulation_time = float(env.sim.data.time)
        captures: dict[str, object] = {}
        for camera in camera_names:
            observed_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            resolution = self._camera_resolution
            rgb, normalized_depth = env.sim.render(camera_name=camera, width=resolution, height=resolution, depth=True)
            if (rgb.shape != (resolution, resolution, 3) or rgb.dtype != np.uint8
                    or normalized_depth.shape != (resolution, resolution)
                    or not np.isfinite(normalized_depth).all()
                    or np.any(normalized_depth < 0) or np.any(normalized_depth > 1)):
                raise RuntimeError("RoboCasa metric capture returned invalid RGB or normalized depth.")
            rgb = np.array(rgb[::-1], copy=True)
            depth = np.array(get_real_depth_map(env.sim, normalized_depth)[::-1], dtype=np.float32, copy=True)
            intrinsic = get_camera_intrinsic_matrix(env.sim, camera, resolution, resolution)
            camera_to_world = get_camera_extrinsic_matrix(env.sim, camera)
            if (not np.isfinite(depth).all() or np.any(depth <= 0)
                    or intrinsic.shape != (3, 3) or not np.isfinite(intrinsic).all()
                    or camera_to_world.shape != (4, 4) or not np.isfinite(camera_to_world).all()):
                raise RuntimeError("RoboCasa metric depth or camera calibration is invalid.")
            png = BytesIO()
            Image.fromarray(rgb).save(png, format="PNG")
            depth.setflags(write=False)
            captures[camera] = {
                "rgb_png": png.getvalue(),
                "axial_depth_m": depth,
                "intrinsic_matrix": intrinsic,
                "camera_to_world": camera_to_world,
                "observed_at": observed_at,
                "near_m": float(env.sim.model.vis.map.znear * env.sim.model.stat.extent),
                "far_m": float(env.sim.model.vis.map.zfar * env.sim.model.stat.extent),
            }
        if float(env.sim.data.time) != simulation_time:
            raise RuntimeError("Read-only metric capture advanced the native simulator clock.")
        return {"observation_id": str(uuid4()), "simulation_time_s": simulation_time, "cameras": captures}

    def measure_object(self, observation_id: str, camera: str, source_image_sha256: str,
                       mask_png: bytes) -> dict[str, object]:
        capture = self.capture_metric_depth((camera,))
        frame = capture["cameras"][camera]
        calibration = {
            "capture_id": capture["observation_id"],
            "observation_id": observation_id,
            "camera": camera,
            "source_image_sha256": source_image_sha256,
            "intrinsic_matrix": frame["intrinsic_matrix"].tolist(),
            "camera_to_world": frame["camera_to_world"].tolist(),
            "simulation_time_s": capture["simulation_time_s"],
        }
        calibration_id = hashlib.sha256(json.dumps(
            calibration, sort_keys=True, separators=(",", ":"), allow_nan=False
        ).encode("utf-8")).hexdigest()
        result = summarize_metric_region(
            axial_depth_m=frame["axial_depth_m"], mask_png=mask_png,
            source_image_png=frame["rgb_png"], expected_source_image_sha256=source_image_sha256,
            intrinsic_matrix=frame["intrinsic_matrix"], camera_to_world=frame["camera_to_world"],
            calibration_id=calibration_id, observation_id=observation_id, camera_name=camera,
            observed_at=frame["observed_at"], simulation_time_s=capture["simulation_time_s"],
            source="robocasa-native-rgbd", world_frame="robocasa.mujoco.world",
            minimum_depth_m=frame["near_m"], maximum_depth_m=frame["far_m"],
        )
        return {**result, "provider": "robocasa", "camera_frame": f"robocasa.{camera}.optical",
                "measurement_capture_id": capture["observation_id"]}

    def step(
        self,
        action: Sequence[float],
        should_stop: Callable[[], bool],
        on_live_frame: Callable[[NativeFrame], bool] | None = None,
    ) -> NativeStep:
        env = self._require_env()
        if should_stop():
            return NativeStep(self.observe(), 0, False, 0, False)
        if self.episode_terminated():
            raise RuntimeError("RoboCasa episode has ended; a new native session is required.")
        if len(action) != 12 or any(type(value) not in (int, float) or not math.isfinite(value) or abs(value) > 1 for value in action):
            raise ValueError("RoboCasa action must contain 12 finite normalized values.")
        if abs(action[11]) != 1:
            raise ValueError("RoboCasa base_mode must be -1 or 1.")
        if should_stop():
            return NativeStep(self.observe(), 0, False, 0, self._native_done)
        before = float(env.sim.data.time)
        raw, _reward, done, _info = env.step(np.asarray(action, dtype=np.float64))
        self._native_done = bool(done)
        elapsed = float(env.sim.data.time) - before
        raw_steps = round(elapsed / env.model_timestep)
        if raw_steps <= 0:
            raise RuntimeError("RoboCasa did not advance simulation time for the control action.")
        self._simulation_time_s += elapsed
        observation = self._observation(raw)
        frame = NativeFrame(
            observation.observation_id, observation.observed_at, observation.images,
            raw_steps, self._simulation_time_s,
        )
        return NativeStep(observation, 1, True, raw_steps, bool(done or env._check_success()), (frame,))

    def episode_terminated(self) -> bool:
        return self._native_done or bool(self._require_env()._check_success())

    def check(self, check_ids: Sequence[str]) -> Sequence[NativeCheck]:
        env = self._require_env()
        if not check_ids or any(check_id != "task_success" for check_id in check_ids):
            raise ValueError("Unsupported RoboCasa check ID.")
        return tuple(NativeCheck(check_id, bool(env._check_success())) for check_id in check_ids)

    def turn_view(self, direction: str) -> NativeObservation:
        raise ValueError(f"RoboCasa active view direction is unsupported: {direction}")

    def close(self) -> None:
        env, self._env = self._env, None
        self._task_id = None
        if env is not None:
            env.close()
