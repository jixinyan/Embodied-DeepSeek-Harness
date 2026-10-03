from __future__ import annotations

from hashlib import sha256
from importlib import import_module
import json
import os
from pathlib import Path
import time


def admit_camera_parameters(simulator, sensors: dict):
    import torch
    from pxr import UsdGeom, UsdRender

    bindings = {}
    for name, sensor in sensors.items():
        camera = simulator.stage.GetPrimAtPath(sensor.prim_path)
        product = simulator.stage.GetPrimAtPath(sensor.render_product.path)
        targets = [str(target) for target in UsdRender.Product(product).GetCameraRel().GetTargets()] if product else []
        bindings[name] = {
            "camera_path": sensor.prim_path, "camera_valid": bool(camera),
            "camera_type": camera.GetTypeName() if camera else None,
            "camera_schema_valid": bool(camera and camera.IsA(UsdGeom.Camera)),
            "render_product_path": sensor.render_product.path, "render_product_valid": bool(product),
            "camera_targets": targets,
            "fabric_camera_valid": bool(simulator.usdrt_stage.GetPrimAtPath(sensor.prim_path)),
            "fabric_render_product_valid": bool(simulator.usdrt_stage.GetPrimAtPath(sensor.render_product.path)),
        }
    record = None
    if "EDH_METRIC_CAPTURE_RECORD_DIR" in os.environ:
        record = Path(os.environ["EDH_METRIC_CAPTURE_RECORD_DIR"]) / "camera-annotator-admission.json"
        with record.open("x") as output:
            json.dump({"stage_identifier": simulator.stage.GetRootLayer().identifier, "bindings": bindings}, output)
            output.flush()
            os.fsync(output.fileno())
    if any(not value["camera_schema_valid"] or value["camera_targets"] != [value["camera_path"]]
           for value in bindings.values()):
        raise RuntimeError(f"BEHAVIOR native render products have invalid USD camera bindings: {bindings!r}.")

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
        if record is not None:
            with record.open("w") as output:
                json.dump({"stage_identifier": simulator.stage.GetRootLayer().identifier,
                           "bindings": bindings, "native_before": before, "observations": observations},
                          output, allow_nan=False)
                output.flush()
                os.fsync(output.fileno())
        after = {"step": int(simulator.current_time_step_index), "time": float(simulator.current_time)}
        if before != after:
            raise RuntimeError("BEHAVIOR camera annotator admission advanced native physics or time.")
        if ready:
            intrinsics = {name: sensor.intrinsic_matrix.tolist() for name, sensor in sensors.items()}
            source = Path(import_module("omnigibson.sensors.vision_sensor").__file__).resolve(strict=True)
            return {
                "native_before": before, "native_after": after, "render_updates": rendered,
                "observations": observations, "intrinsics": intrinsics,
                "bindings": bindings,
                "source_file": str(source), "source_sha256": sha256(source.read_bytes()).hexdigest(),
            }
        if time.monotonic() - started >= 30:
            break
    raise RuntimeError(f"BEHAVIOR native camera annotators did not initialize within their render deadline: {observations[-1]!r}.")
