from __future__ import annotations

from hashlib import sha256
from importlib import import_module
from pathlib import Path
import time


def admit_camera_parameters(simulator, sensors: dict):
    import torch

    before = {"step": int(simulator.current_time_step_index), "time": float(simulator.current_time)}
    started = time.monotonic()
    observations = []
    for rendered in range(1, 65):
        simulator.render()
        parameters = {}
        ready = True
        for name, sensor in sensors.items():
            native = sensor.camera_parameters
            projection = torch.as_tensor(native["cameraProjection"]).reshape(4, 4)
            resolution = torch.as_tensor(native["renderProductResolution"]).reshape(2)
            if not torch.isfinite(projection).all().item() or not torch.isfinite(resolution).all().item():
                raise RuntimeError(f"BEHAVIOR native camera parameters are nonfinite: {name}.")
            camera_ready = resolution.tolist() == [256, 256] and projection[0, 0].item() > 0 and projection[1, 1].item() > 0
            parameters[name] = {
                "render_product_resolution": resolution.tolist(), "camera_projection": projection.tolist(),
                "ready": camera_ready,
            }
            ready = ready and camera_ready
        observations.append({"render_updates": rendered, "elapsed_s": time.monotonic() - started,
                             "parameters": parameters})
        after = {"step": int(simulator.current_time_step_index), "time": float(simulator.current_time)}
        if before != after:
            raise RuntimeError("BEHAVIOR camera annotator admission advanced native physics or time.")
        if ready:
            intrinsics = {name: sensor.intrinsic_matrix.tolist() for name, sensor in sensors.items()}
            source = Path(import_module("omnigibson.sensors.vision_sensor").__file__).resolve(strict=True)
            return {
                "native_before": before, "native_after": after, "render_updates": rendered,
                "observations": observations, "intrinsics": intrinsics,
                "source_file": str(source), "source_sha256": sha256(source.read_bytes()).hexdigest(),
            }
        if time.monotonic() - started >= 30:
            break
    raise RuntimeError(f"BEHAVIOR native camera annotators did not initialize within their render deadline: {observations[-1]!r}.")
