import argparse
import ast
from hashlib import sha256
import json
from pathlib import Path

import yaml

from physical_harness.environments.task_catalog import behavior_task_selection, robotwin_task_selection


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--robotwin-source-root", required=True, type=Path)
    parser.add_argument("--behavior-source-root", required=True, type=Path)
    parser.add_argument("--behavior-data-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    robotwin = args.robotwin_source_root.resolve(strict=True)
    behavior = args.behavior_source_root.resolve(strict=True)
    data_root = args.behavior_data_root.resolve(strict=True)
    robotwin_tasks = []
    for path in sorted((robotwin / "description" / "task_instruction").glob("*.json")):
        selected, instruction = robotwin_task_selection(robotwin, path.stem)
        module = robotwin / "envs" / f"{path.stem}.py"
        tree = ast.parse(module.read_text(encoding="utf-8"), filename=str(module))
        classes = [node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == path.stem]
        if len(classes) != 1 or not any(isinstance(node, ast.FunctionDef) and node.name == "check_success"
                                        for node in classes[0].body):
            raise ValueError(f"RoboTwin task lacks its actual named SDK class and check_success: {path.stem}")
        robotwin_tasks.append({"native_task_id": path.stem, "task_config": "demo_clean",
                               "embodiment": selected["embodiment"], "instruction": instruction,
                               "module_sha256": sha256(module.read_bytes()).hexdigest(),
                               "instruction_sha256": sha256(path.read_bytes()).hexdigest()})
    randomized, _ = robotwin_task_selection(robotwin, "adjust_bottle", "demo_randomized")
    catalog_path = behavior / "gr00t" / "eval" / "sim" / "BEHAVIOR" / "available_tasks.yaml"
    with catalog_path.open(encoding="utf-8") as stream:
        catalog = yaml.safe_load(stream)
    behavior_tasks = []
    prepared = []
    for task_id, configurations in sorted(catalog.items()):
        for config_id, configuration in sorted(configurations.items()):
            behavior_tasks.append({"native_task_id": task_id, "scene_config_id": config_id,
                                   "scene_model": configuration["scene_model"]})
            instance_directory = data_root / "2025-challenge-hidden-instances" / task_id
            if instance_directory.is_dir():
                for instance_id in range(10):
                    selected, instance_path = behavior_task_selection(behavior, data_root, task_id, config_id, instance_id)
                    with instance_path.open(encoding="utf-8") as stream:
                        instance = json.load(stream)
                    if "R1Pro" not in instance["robot_poses"]:
                        raise ValueError(f"BEHAVIOR native instance lacks its R1Pro robot pose: {instance_path}")
                    prepared.append({"native_task_id": task_id, "scene_config_id": config_id,
                                     "instance_id": instance_id, "scene_model": selected["scene_model"],
                                     "instance_path": str(instance_path),
                                     "instance_sha256": sha256(instance_path.read_bytes()).hexdigest()})
    selected, original = behavior_task_selection(behavior, data_root, "picking_up_trash")
    if selected["scene_model"] != "house_double_floor_lower" or not original.is_file():
        raise ValueError("BEHAVIOR default binding differs from the installed native SDK and instance data.")
    report = {"scope": "Read-only installed native SDK/task catalog and prepared-instance admission",
              "robotwinSourceRoot": str(robotwin), "behaviorSourceRoot": str(behavior),
              "robotwinTasks": robotwin_tasks, "robotwinTaskCount": len(robotwin_tasks),
              "robotwinRandomizedEmbodiment": randomized["embodiment"],
              "behaviorTaskConfigurations": behavior_tasks,
              "behaviorTaskConfigurationCount": len(behavior_tasks),
              "behaviorCatalogSHA256": sha256(catalog_path.read_bytes()).hexdigest(),
              "preparedBehaviorInstances": prepared, "preparedBehaviorInstanceCount": len(prepared),
              "nativeResets": 0, "physicalControls": 0, "taskCompletionAcceptance": False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items()
                      if key not in {"robotwinTasks", "behaviorTaskConfigurations", "preparedBehaviorInstances"}}))


if __name__ == "__main__":
    main()
