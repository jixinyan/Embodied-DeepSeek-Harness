import hashlib
import json
import os
from pathlib import Path
from uuid import uuid4

import numpy as np

from physical_harness.perception.metric_geometry import summarize_metric_region


class MetricCapture:
    def __init__(self, provider: str, world_frame: str) -> None:
        self.provider = provider
        self.world_frame = world_frame
        self.observation = None
        self.frames = {}
        self.simulation_time_s = None

    def replace(self, observation, simulation_time_s: float, frames: dict) -> None:
        if set(frames) != set(observation.images):
            raise ValueError("Metric capture cameras must match the native observation.")
        captured = {}
        for camera, frame in frames.items():
            copied = dict(frame)
            for key in ("axial_depth_m", "intrinsic_matrix", "camera_to_world"):
                value = np.array(frame[key], copy=True)
                value.setflags(write=False)
                copied[key] = value
            if copied["axial_depth_m"].dtype != np.float32:
                raise ValueError("Native axial depth must use float32 meters.")
            captured[camera] = copied
        self.observation = observation
        self.frames = captured
        self.simulation_time_s = float(simulation_time_s)
        directory = os.environ.get("EDH_METRIC_CAPTURE_RECORD_DIR")
        if directory is not None:
            target = Path(directory).resolve(strict=True) / self.provider / observation.observation_id
            target.mkdir(parents=True, exist_ok=False)
            cameras = {}
            for camera, frame in captured.items():
                camera_directory = target / camera
                camera_directory.mkdir()
                image = observation.images[camera]
                (camera_directory / "source.png").write_bytes(image)
                arrays_path = camera_directory / "calibration.npz"
                np.savez_compressed(arrays_path, axial_depth_m=frame["axial_depth_m"],
                                    intrinsic_matrix=frame["intrinsic_matrix"],
                                    camera_to_world=frame["camera_to_world"])
                cameras[camera] = {"source_image_sha256": hashlib.sha256(image).hexdigest(),
                                  "calibration_npz_sha256": hashlib.sha256(arrays_path.read_bytes()).hexdigest(),
                                  "near_m": float(frame["near_m"]), "far_m": float(frame["far_m"])}
            source_path = Path(__file__).resolve(strict=True)
            record = {"schema_version": "edh.native_rgbd_capture.v1", "provider": self.provider,
                      "observation_id": observation.observation_id, "observed_at": observation.observed_at,
                      "simulation_time_s": self.simulation_time_s, "world_frame": self.world_frame,
                      "source": f"{self.provider}-native-rgbd", "native_pid": os.getpid(),
                      "recording_source": {"path": str(source_path),
                                           "sha256": hashlib.sha256(source_path.read_bytes()).hexdigest()},
                      "cameras": cameras}
            (target / "capture.json").write_text(json.dumps(record, indent=2, allow_nan=False) + "\n")

    def measure(self, observation_id: str, camera: str, source_image_sha256: str,
                mask_png: bytes) -> dict:
        observation = self.observation
        if observation is None or observation_id != observation.observation_id or camera not in self.frames:
            raise ValueError("Metric measurement requires the current calibrated native observation.")
        frame = self.frames[camera]
        capture_id = str(uuid4())
        calibration = {
            "provider": self.provider, "capture_id": capture_id,
            "observation_id": observation_id, "camera": camera,
            "source_image_sha256": source_image_sha256,
            "simulation_time_s": self.simulation_time_s,
            "intrinsic_matrix": frame["intrinsic_matrix"].tolist(),
            "camera_to_world": frame["camera_to_world"].tolist(),
            "minimum_depth_m": frame["near_m"], "maximum_depth_m": frame["far_m"],
        }
        calibration_id = hashlib.sha256(json.dumps(
            calibration, sort_keys=True, separators=(",", ":"), allow_nan=False,
        ).encode()).hexdigest()
        result = summarize_metric_region(
            axial_depth_m=frame["axial_depth_m"], mask_png=mask_png,
            source_image_png=observation.images[camera],
            expected_source_image_sha256=source_image_sha256,
            intrinsic_matrix=frame["intrinsic_matrix"], camera_to_world=frame["camera_to_world"],
            calibration_id=calibration_id, observation_id=observation_id, camera_name=camera,
            observed_at=observation.observed_at, simulation_time_s=self.simulation_time_s,
            source=f"{self.provider}-native-rgbd", world_frame=self.world_frame,
            minimum_depth_m=frame["near_m"], maximum_depth_m=frame["far_m"],
        )
        result.update(provider=self.provider, camera_frame=f"{self.provider}.{camera}.optical",
                      measurement_capture_id=capture_id)
        directory = os.environ.get("EDH_METRIC_RECORD_DIR")
        if directory is not None:
            target = Path(directory).resolve() / self.provider / capture_id
            target.mkdir(parents=True, exist_ok=False)
            (target / "source.png").write_bytes(observation.images[camera])
            (target / "mask.png").write_bytes(mask_png)
            np.savez_compressed(target / "calibration.npz", axial_depth_m=frame["axial_depth_m"],
                                intrinsic_matrix=frame["intrinsic_matrix"], camera_to_world=frame["camera_to_world"])
            (target / "measurement.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
        return result
