import argparse
import ast
from copy import deepcopy
from hashlib import sha256
import importlib.util
import json
import os
from pathlib import Path
import sys

import numpy as np

from physical_harness.policies import gr00t_n1d6_behavior as behavior
from physical_harness.policies import gr00t_n1d6_robocasa as robocasa


def inspect(configuration: Path, output: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    output = output.resolve()
    if not output.is_relative_to(root / ".local/work") or os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("GR00T action checks require a new .local/work output and CUDA_VISIBLE_DEVICES=''.")
    output.mkdir(parents=True, exist_ok=False)
    sources = {}

    def original(path):
        path = Path(path).resolve(strict=True)
        digest = sha256(path.read_bytes()).hexdigest()
        if str(path) in sources and sources[str(path)] != digest:
            raise ValueError(f"Original GR00T action source changed: {path}")
        sources[str(path)] = digest
        return path

    document = json.loads(original(configuration).read_bytes())
    audit_path = original(root / "scripts/audit-recorded-run.py")
    spec = importlib.util.spec_from_file_location("edh_original_gr00t_action_audit", audit_path)
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)
    schema = original(root / "harness/contracts/schema/physical.schema.json")
    original(root / "harness/physical-runtime/src/physical_harness/policies/action_outputs.py")
    original(Path(__file__).resolve())
    adapters = {"behavior": behavior, "robocasa": robocasa}
    for module in adapters.values():
        tree = ast.parse(original(module.__file__).read_bytes())
        method = next(node for node in ast.walk(tree)
                      if isinstance(node, ast.FunctionDef) and node.name == "infer_with_record")
        if (not isinstance(method.body[-1], ast.Return) or
                ast.unparse(method.body[-1].value) != "native_action_record(action, request)" or
                sum(isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                    and node.func.attr == "get_action" for node in ast.walk(method)) != 1):
            raise ValueError("Online GR00T inference must use the inspected native action conversion.")
    cases, records, providers = [], [], set()

    def rejected(name, module, groups, request):
        try:
            module.native_action_record(groups, request)
        except ValueError as error:
            cases.append({"name": name, "result": "rejected", "originalError": str(error)})
        else:
            raise ValueError(f"Invalid native GR00T action input was accepted: {name}")

    for entry in document["conventional"]:
        if not Path(entry["manifest"]).stem.endswith(("behavior", "robocasa")):
            continue
        run = json.loads(original(entry["run"]).read_bytes())
        provider, inferences, requests, _ = audit.conventional_policy_sources(
            run, Path(entry["requests"]), original(entry["serviceLog"]),
            original(entry["manifest"]), schema,
        )
        if provider not in adapters or provider in providers:
            raise ValueError("GR00T action sources require each selected provider exactly once.")
        providers.add(provider)
        module = adapters[provider]
        dimensions = module.ACTION_GROUPS if provider == "behavior" else module.ACTION_SIZES
        for request_id in sorted(requests):
            original(Path(entry["requests"]) / f"{request_id}.json")
            request = requests[request_id]
            record = inferences[request_id]
            if provider == "behavior" and "model_actions" in record:
                field, source_kind = "model_actions", "original-concatenated-model-groups"
            elif provider == "behavior":
                field, source_kind = "actions", "recorded-native-prefix-derivative"
            else:
                field, source_kind = "model_actions", "recorded-controller-action-derivative"
            matrix = np.array(record[field], dtype=np.float64)
            groups, offset = {}, 0
            for key, width in dimensions.items():
                groups[key] = matrix[None, :, offset:offset + width].copy()
                offset += width
            if offset != matrix.shape[1]:
                raise ValueError("Recorded native channels differ from the selected GR00T grouping.")
            before = {key: value.copy() for key, value in groups.items()}
            actions, model_actions = module.native_action_record(groups, request)
            if actions != record["actions"] or model_actions != record[field]:
                raise ValueError("Native GR00T conversion differs from the original recorded controller values.")
            cases.append({"name": f"{provider}.{request_id}.original-record", "result": "passed"})
            records.append({"provider": provider, "runId": run["id"], "requestId": request_id,
                            "sourceKind": source_kind, "recordField": field,
                            "restoredFloat64Sha256": sha256(matrix.tobytes()).hexdigest(),
                            "modelHorizon": len(model_actions), "returnedActions": len(actions)})
            if request_id == min(requests):
                for maximum in (1, 512):
                    derived_request = {**request, "max_actions": maximum}
                    selected, complete = module.native_action_record(groups, derived_request)
                    known_prefix = min(len(selected), len(actions))
                    if selected[:known_prefix] != actions[:known_prefix]:
                        raise ValueError("Native GR00T selection changed the recorded prefix.")
                    if complete != model_actions or len(selected) != min(maximum, len(matrix)):
                        raise ValueError("Native GR00T selection changed its complete controller record.")
                    cases.append({"name": f"{provider}.declared-limit-{maximum}", "result": "passed"})
                for name, value in (("true", True), ("false", False), ("zero", 0), ("negative", -1),
                                    ("overflow", 513), ("fraction", 1.5), ("string", "1"), ("null", None)):
                    rejected(f"{provider}.limit-{name}", module, groups, {**request, "max_actions": value})
                first = next(iter(groups))
                for name, dtype in (("boolean", np.bool_), ("string", str),
                                    ("object", object), ("complex", np.complex128)):
                    rejected(f"{provider}.group-{name}", module,
                             {**groups, first: groups[first].astype(dtype)}, request)
                for name, value in (("rank", groups[first][0]),
                                    ("batch", np.repeat(groups[first], 2, axis=0)),
                                    ("channels", groups[first][:, :, :-1]),
                                    ("empty", groups[first][:, :0]),
                                    ("horizon", groups[first][:, :-1])):
                    rejected(f"{provider}.group-{name}", module, {**groups, first: value}, request)
                for name, value in (("nan", float("nan")), ("infinity", float("inf")),
                                    ("negative-infinity", -float("inf"))):
                    derived = deepcopy(groups)
                    derived[first][0, 0, 0] = value
                    rejected(f"{provider}.group-{name}", module, derived, request)
                incompatible = deepcopy(request)
                incompatible["action_spec"]["channels"][0]["name"] = "unregistered-native-channel"
                rejected(f"{provider}.channel-order", module, groups, incompatible)
                if provider == "robocasa":
                    for key, index in (("gripper_close", 6), ("control_mode", 11)):
                        for value, expected in ((0.4999, -1.0), (0.5, 1.0), (0.5001, 1.0)):
                            derived = deepcopy(groups)
                            derived[key][0, 0, 0] = value
                            selected, _ = module.native_action_record(derived, request)
                            if selected[0][index] != expected:
                                raise ValueError("RoboCasa native threshold differs from its controller mapping.")
                            cases.append({"name": f"{provider}.{key}.{value}", "result": "passed"})
                    for value in (-1.01, 1.01):
                        derived = deepcopy(groups)
                        derived[first][0, 0, 0] = value
                        rejected(f"{provider}.controller-range-{value}", module, derived, request)
                else:
                    for key, index in (("base", 0), ("torso", 3)):
                        channel = request["action_spec"]["channels"][index]
                        for direction, expected in ((-1, channel["minimum"]), (1, channel["maximum"])):
                            derived = deepcopy(groups)
                            derived[key][0, 0, 0] = expected + direction
                            selected, complete = module.native_action_record(derived, request)
                            if selected[0][index] != expected or complete[0][index] != expected + direction:
                                raise ValueError("BEHAVIOR native clipping changed its original model record.")
                            cases.append({"name": f"{provider}.{key}.clipping-{direction}", "result": "passed"})
            if any(not np.array_equal(groups[key], before[key]) for key in groups):
                raise ValueError("Native GR00T conversion changed its supplied action groups.")
    if providers != set(adapters):
        raise ValueError("Original GR00T action records must cover BEHAVIOR and RoboCasa.")
    if any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("Original source changed during native GR00T action checks.")
    if any(name == "torch" or name.startswith(("gr00t", "lerobot", "openpi_client")) for name in sys.modules):
        raise ValueError("Native GR00T action checks imported a model SDK.")
    report = {"sources": sources, "cases": cases, "records": records, "originalFilesUnchanged": True,
              "originalGroupsUnchanged": True, "modelSdkImported": False, "rawSdkGroupDtypesRetained": False,
              "modelCalls": 0, "gpuJobs": 0, "environmentAllocations": 0, "controls": 0,
              "scope": "Production controller conversion on original concatenated BEHAVIOR groups and explicitly record-derived native/controller groups, plus declared derivatives. Raw RoboCasa probabilities, SDK dtypes and loaded inference require native acceptance."}
    (output / "acceptance.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"cases": len(cases), "records": len(records), "providers": sorted(providers),
                      "modelCalls": 0, "gpuJobs": 0}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    inspect(args.configuration, args.output)
