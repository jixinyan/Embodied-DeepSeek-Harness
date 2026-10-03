from copy import deepcopy
import json
from pathlib import Path
import re

import yaml


def native_task_name(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,127}", value):
        raise ValueError("Native task identity must be a bounded SDK identifier.")
    return value


def robotwin_task_selection(source_root: Path, task_id: str, task_config: str = "demo_clean") -> tuple[dict, str]:
    native_task_name(task_id)
    native_task_name(task_config)
    if not (source_root / "envs" / f"{task_id}.py").is_file():
        raise ValueError(f"RoboTwin native task module is unavailable: {task_id}")
    with (source_root / "description" / "task_instruction" / f"{task_id}.json").open(encoding="utf-8") as stream:
        instruction = json.load(stream)["full_description"]
    if not isinstance(instruction, str) or not instruction.strip():
        raise ValueError(f"RoboTwin native task instruction is unavailable: {task_id}")
    with (source_root / "task_config" / f"{task_config}.yml").open(encoding="utf-8") as stream:
        configuration = yaml.safe_load(stream)
    if not isinstance(configuration, dict) or configuration["embodiment"] != ["aloha-agilex"]:
        raise ValueError("RoboTwin task configuration requires the admitted Aloha AgileX embodiment.")
    return deepcopy(configuration), instruction


def behavior_task_selection(source_root: Path, data_root: Path, task_id: str,
                            scene_config_id: int = 0, instance_id: int = 0) -> tuple[dict, Path]:
    native_task_name(task_id)
    if type(scene_config_id) is not int or scene_config_id < 0:
        raise ValueError("BEHAVIOR scene configuration identity must be a nonnegative integer.")
    if type(instance_id) is not int or not 0 <= instance_id < 10:
        raise ValueError("BEHAVIOR 2025 instance identity must be between zero and nine.")
    catalog_path = source_root / "gr00t" / "eval" / "sim" / "BEHAVIOR" / "available_tasks.yaml"
    with catalog_path.open(encoding="utf-8") as stream:
        catalog = yaml.safe_load(stream)
    if not isinstance(catalog, dict) or task_id not in catalog:
        raise ValueError(f"BEHAVIOR native task is unavailable in the selected SDK catalog: {task_id}")
    configurations = catalog[task_id]
    if not isinstance(configurations, dict) or scene_config_id not in configurations:
        raise ValueError(f"BEHAVIOR task scene configuration is unavailable: {task_id}/{scene_config_id}")
    selected = configurations[scene_config_id]
    if not isinstance(selected, dict):
        raise ValueError("BEHAVIOR native task scene configuration must be a mapping.")
    scene_model = native_task_name(selected["scene_model"])
    # 文件名来自所选OmniGibson版本的get_cached_activity_scene_filename定义。
    filename = f"{scene_model}_task_{task_id}_0_{instance_id}_template-tro_state.json"
    instance_path = data_root / "2025-challenge-hidden-instances" / task_id / filename
    if not instance_path.is_file():
        raise ValueError(f"BEHAVIOR native task instance data is unavailable: {instance_path}")
    return deepcopy(selected), instance_path
