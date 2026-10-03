import ast
import hashlib
import math
from pathlib import Path
from statistics import fmean

import jsonlines


def official_task_horizon(source_root: Path, data_root: Path, task_id: str) -> dict:
    source = source_root / "gr00t/eval/sim/BEHAVIOR/behavior_env.py"
    contents = source.read_bytes()
    assignments = [node for node in ast.parse(contents).body if isinstance(node, ast.Assign)
                   and any(isinstance(target, ast.Name) and target.id == "TASK_NAMES_TO_INDICES"
                           for target in node.targets)]
    if len(assignments) != 1:
        raise ValueError("GR00T BEHAVIOR evaluation task index mapping is unavailable.")
    indices = ast.literal_eval(assignments[0].value)
    index = indices[task_id]
    if type(index) is not int or index < 0:
        raise ValueError("GR00T BEHAVIOR evaluation task index must be a nonnegative integer.")
    episodes_path = data_root / "2025-challenge-task-instances/metadata/episodes.jsonl"
    with jsonlines.open(episodes_path) as episodes:
        lengths = [episode["length"] for episode in episodes
                   if episode["episode_index"] // 10000 == index]
    if not lengths or any(type(length) not in (int, float) or not math.isfinite(length)
                          or length <= 0 for length in lengths):
        raise ValueError("BEHAVIOR human episode lengths must be available and positive.")
    mean_length = fmean(lengths)
    return {
        "source": "gr00t.eval.sim.BEHAVIOR.behavior_env.BEHAVIORGr00tEnv.load_env",
        "source_sha256": hashlib.sha256(contents).hexdigest(),
        "human_metadata_sha256": hashlib.sha256(episodes_path.read_bytes()).hexdigest(),
        "task_index": index, "human_episode_count": len(lengths),
        "mean_human_controls": mean_length, "max_controls": int(mean_length * 2),
    }
