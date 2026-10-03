import ast
from hashlib import sha256
import json
import math
from pathlib import Path

import numpy as np


def audit_native_physics(episode_root: Path, native_physics: dict, action: list, raw_steps: int) -> dict:
    episode_id = native_physics["episode_id"]
    if (not isinstance(episode_id, str) or len(episode_id) != 32
            or any(character not in "0123456789abcdef" for character in episode_id)):
        raise ValueError("Native RoboDojo physics requires an identified episode.")
    candidates = [path for path in episode_root.rglob(episode_id) if path.is_dir()]
    if len(candidates) != 1:
        raise ValueError("Native RoboDojo physics requires exactly one retained episode source.")
    episode = candidates[0]
    step_id = native_physics["step_id"]
    action_path = episode / f"action_{step_id - 1:06d}.json"
    recorded = json.loads(action_path.read_text())
    if (recorded["executed_action"] != action or recorded["raw_sim_steps"] != raw_steps
            or any(recorded[key] != value for key, value in native_physics.items())):
        raise ValueError("Worker RoboDojo physics differs from its retained actual native action.")
    counter_before = native_physics["native_physics_step_before"]
    counter_after = native_physics["native_physics_step_after"]
    if (type(counter_before) is not int or type(counter_after) is not int or counter_before < 0
            or counter_after - counter_before != raw_steps
            or native_physics["physics_count_source"] != "isaac_simulation_context.current_time_step_index"):
        raise ValueError("Native RoboDojo actual physics counter difference is invalid.")
    provenance_path = episode.parent / "physics-provenance.json"
    provenance = json.loads(provenance_path.read_text())
    timestep = native_physics["physics_timestep_s"]
    if (provenance["schema_version"] != "edh.robodojo.native_physics.v1"
            or provenance["counter_source"] != native_physics["physics_count_source"]
            or provenance["physics_timestep_s"] != timestep or not math.isfinite(timestep) or timestep <= 0
            or type(provenance["decimation"]) is not int or provenance["decimation"] < 1):
        raise ValueError("Native RoboDojo physics calibration differs from the admitted SDK.")
    for operation, source in provenance["sources"].items():
        data = (episode.parent / f"physics-source-{operation}.py").read_bytes()
        if sha256(data).hexdigest() != source["sha256"]:
            raise ValueError("Retained native SDK source differs from its original source hash.")
        ast.parse(data, filename=source["path"])
    if set(provenance["sources"]) != {
        "take_action", "native_control_step", "decimated_physics_step", "physics_counter", "simulation_context",
    }:
        raise ValueError("Native RoboDojo physics lacks its complete SDK source identity.")
    observation_path = episode / "observations" / f"{step_id:06d}.npz"
    with np.load(observation_path, allow_pickle=False) as captured:
        if float(captured["simulation_time_s"]) != native_physics["simulation_time_s"]:
            raise ValueError("Native RoboDojo observation clock differs from its action receipt.")
        for camera, calibration in native_physics["camera_calibration"].items():
            if any(not np.array_equal(captured[f"{camera}_{key}"], value)
                   for key, value in calibration.items()):
                raise ValueError("Native RoboDojo action calibration differs from its actual RGB-D source.")
            if captured[f"{camera}_depth"].shape != captured[camera].shape[:2]:
                raise ValueError("Native RoboDojo recorded RGB and depth shapes differ.")
    return {"episodeId": episode_id, "stepId": step_id, "rawPhysicsSteps": raw_steps,
            "nativeActionSha256": sha256(action_path.read_bytes()).hexdigest(),
            "nativeObservationSha256": sha256(observation_path.read_bytes()).hexdigest(),
            "physicsProvenanceSha256": sha256(provenance_path.read_bytes()).hexdigest()}
