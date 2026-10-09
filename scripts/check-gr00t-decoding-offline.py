import argparse
import ast
from copy import deepcopy
from functools import partial
from hashlib import sha256
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import sys

import numpy as np
import torch
import gr00t.model
from gr00t.data.embodiment_tags import EmbodimentTag
from transformers import AutoProcessor

from physical_harness.policies import gr00t_n1d6_behavior as behavior
from physical_harness.policies import gr00t_n1d6_robocasa as robocasa
from physical_harness.policies.gr00t_model_output import decode_model_action


def inspect(args):
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work") or os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("GR00T decoding checks require a new .local/work output and CUDA_VISIBLE_DEVICES=''.")
    if torch.cuda.is_initialized():
        raise ValueError("GR00T decoding checks require an uninitialized CUDA context.")
    output.mkdir(parents=True, exist_ok=False)
    sources = {}

    def original(path):
        path = Path(path).resolve(strict=True)
        digest = sha256(path.read_bytes()).hexdigest()
        if str(path) in sources and sources[str(path)] != digest:
            raise ValueError(f"Original decoding source changed: {path}")
        sources[str(path)] = digest
        return path

    configuration = json.loads(original(args.configuration).read_bytes())
    schema = original(root / "harness/contracts/schema/physical.schema.json")
    audit_path = original(root / "scripts/audit-recorded-run.py")
    spec = importlib.util.spec_from_file_location("edh_original_gr00t_decoding_audit", audit_path)
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)
    module = behavior if args.provider == "behavior" else robocasa
    dimensions = module.ACTION_GROUPS if args.provider == "behavior" else module.ACTION_SIZES
    horizon = 32 if args.provider == "behavior" else 16
    embodiment = EmbodimentTag.BEHAVIOR_R1_PRO if args.provider == "behavior" else EmbodimentTag.ROBOCASA_PANDA_OMRON
    entry = next(item for item in configuration["conventional"] if Path(item["manifest"]).stem.endswith(args.provider))
    run = json.loads(original(entry["run"]).read_bytes())
    manifest_path = original(entry["manifest"])
    provider, inferences, requests, _ = audit.conventional_policy_sources(
        run, Path(entry["requests"]), original(entry["serviceLog"]), manifest_path, schema,
    )
    if provider != args.provider:
        raise ValueError("GR00T decoding requires the selected original provider.")
    checkpoint = args.checkpoint.resolve(strict=True)
    manifest = json.loads(manifest_path.read_bytes())
    for name in ("config.json", "processor_config.json", "statistics.json"):
        path = original(checkpoint / name)
        if sources[str(path)] != manifest["upstream"]["checkpoint_files_sha256"][name]:
            raise ValueError("GR00T decoding requires the identified original checkpoint configuration.")
    original(checkpoint / "embodiment_id.json")
    admitted = module.verify_checkpoint_configuration(str(checkpoint))
    tree = ast.parse(original(module.__file__).read_bytes())
    constructor = next(node for node in ast.walk(tree)
                       if isinstance(node, ast.FunctionDef) and node.name == "__init__")
    if not any(isinstance(node, ast.Assign) and
               any(ast.unparse(target) == "self.policy.processor.decode_action" for target in node.targets) and
               isinstance(node.value, ast.Call) and ast.unparse(node.value.func) == "partial" and
               [ast.unparse(argument) for argument in node.value.args] ==
               ["decode_model_action", "self.policy.processor.decode_action"] and
               {keyword.arg: ast.unparse(keyword.value) for keyword in node.value.keywords} ==
               {"action_dimensions": "ACTION_GROUPS" if provider == "behavior" else "ACTION_SIZES",
                "action_horizon": str(horizon)} for node in constructor.body):
        raise ValueError("Online GR00T construction must bind the inspected decoding admission.")
    processor = AutoProcessor.from_pretrained(
        checkpoint, transformers_loading_kwargs={"trust_remote_code": True, "local_files_only": True},
    )
    processor.eval()
    if processor.modality_configs[embodiment.value]["action"].modality_keys != list(dimensions):
        raise ValueError("Actual GR00T decoder modalities differ from its native controller grouping.")
    decoder = partial(decode_model_action, processor.decode_action,
                      action_dimensions=dimensions, action_horizon=horizon)
    original(Path(__file__).resolve())
    for name, loaded in sorted(sys.modules.items()):
        if name.startswith(("physical_harness.policies", "gr00t")):
            path = getattr(loaded, "__file__", None)
            if path is not None and Path(path).is_file():
                original(path)
    cases, records = [], []

    def rejected(name, action, states):
        try:
            decoder(action, embodiment, states)
        except (ValueError, FloatingPointError) as error:
            cases.append({"name": name, "result": "rejected", "originalError": str(error)})
        else:
            raise ValueError(f"Invalid GR00T decoding input was accepted: {name}")

    for request_id in sorted(requests):
        original(Path(entry["requests"]) / f"{request_id}.json")
        request = requests[request_id]
        before = deepcopy(request)
        record = inferences[request_id]
        if "model_actions" not in record or len(record["model_actions"]) != horizon:
            raise ValueError("GR00T decoding requires a complete original model/controller record.")
        matrix = np.asarray(record["model_actions"], dtype=np.float32)
        if matrix.shape != (horizon, sum(dimensions.values())) or not np.isfinite(matrix).all():
            raise ValueError("Original GR00T model/controller channels are incompatible or nonfinite.")
        groups, offset = {}, 0
        for key, width in dimensions.items():
            groups[key] = matrix[:, offset:offset + width].copy()
            offset += width
        inputs = module.prepare_policy_input(request, language_key=admitted["languageKey"])
        states = {key: value.copy() for key, value in inputs["state"].items()}
        normalized_groups = processor.state_action_processor.apply_action(
            groups, embodiment.value, state={key: value[0] for key, value in states.items()},
        )
        normalized = np.concatenate([normalized_groups[key] for key in dimensions], axis=1)[None].astype(np.float32)
        normalized_before = normalized.copy()
        states_before = {key: value.copy() for key, value in states.items()}
        decoded = processor.decode_action(normalized, embodiment, states)
        expected = {key: value.astype(np.float32) for key, value in decoded.items()}
        actual = decoder(normalized, embodiment, states)
        if any(not np.array_equal(actual[key], expected[key]) for key in dimensions):
            raise ValueError("Decoding admission changed the actual SDK's float32 action values.")
        actual_native, _ = module.native_action_record(actual, request)
        expected_native, _ = module.native_action_record(expected, request)
        if actual_native != expected_native:
            raise ValueError("Decoding admission changed the SDK-derived controller sequence.")
        cases.append({"name": f"{request_id}.sdk-record-derivative", "result": "passed"})
        records.append({"requestId": request_id, "observationId": request["observation_id"],
                        "sourceKind": "original-model-groups-normalized-by-sdk" if provider == "behavior" else "recorded-controller-groups-normalized-by-sdk",
                        "normalizedSha256": sha256(normalized.tobytes()).hexdigest(),
                        "decoded": {key: {"shape": list(value.shape), "dtype": str(value.dtype),
                                          "sha256": sha256(value.tobytes()).hexdigest()} for key, value in actual.items()}})
        if request_id == min(requests):
            padded = np.zeros((1, processor.max_action_horizon, processor.max_action_dim), dtype=np.float32)
            padded[:, :horizon, :normalized.shape[2]] = normalized
            padded_before = padded.copy()
            padded_actual = decoder(padded, embodiment, states)
            if (any(not np.array_equal(padded_actual[key], expected[key]) for key in dimensions) or
                    not np.array_equal(padded, padded_before)):
                raise ValueError("Checkpoint model padding changed native action decoding or original inputs.")
            cases.append({"name": "checkpoint-capacity-padding", "result": "passed",
                          "shape": list(padded.shape), "sourceKind": "original-record-derived-checkpoint-padding"})
            for name, value in (("nan", float("nan")), ("infinity", float("inf")),
                                ("negative-infinity", -float("inf"))):
                invalid = normalized.copy()
                invalid[0, 0, 0] = value
                rejected(name, invalid, states)
            for name, dtype in (("boolean", np.bool_), ("complex", np.complex64), ("string", str),
                                ("object", object), ("float16", np.float16), ("float64", np.float64)):
                rejected(name, normalized.astype(dtype), states)
            for name, value in (("rank", normalized[0]), ("batch", np.repeat(normalized, 2, axis=0)),
                                ("horizon", normalized[:, :-1]), ("channels", normalized[:, :, :-1]),
                                ("empty", normalized[:, :0])):
                rejected(name, value, states)
            if provider == "behavior":
                invalid_states = deepcopy(states)
                invalid_states["arm_left_qpos"][0, 0, 0] = float("nan")
                rejected("relative-state-nan", normalized, invalid_states)
                invalid_states["arm_left_qpos"][0, 0, 0] = float("inf")
                rejected("relative-state-infinity", normalized, invalid_states)
                for sign in (1, -1):
                    invalid_states = {key: value.astype(np.float64) for key, value in states.items()}
                    invalid_states["arm_left_qpos"][0, 0, 0] = sign * np.finfo(np.float64).max
                    rejected(f"relative-action-float32-overflow-{sign}", normalized, invalid_states)
        if (request != before or not np.array_equal(normalized, normalized_before) or
                any(not np.array_equal(states[key], states_before[key]) for key in states)):
            raise ValueError("Actual GR00T decoding changed its original inputs.")
    original(Path(__file__).resolve())
    for name, loaded in sorted(sys.modules.items()):
        if name.startswith(("physical_harness.policies", "gr00t")):
            path = getattr(loaded, "__file__", None)
            if path is not None and Path(path).is_file():
                original(path)
    if torch.cuda.is_initialized() or not records:
        raise ValueError("GR00T decoding requires original CPU records without CUDA initialization.")
    if any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("Original GR00T decoding sources changed.")
    report = {"provider": provider, "runId": run["id"], "sdkVersion": importlib.metadata.version("gr00t"),
              "processId": os.getpid(), "processGroupId": os.getpgid(0),
              "sources": sources, "cases": cases, "records": records, "originalFilesUnchanged": True,
              "originalInputsUnchanged": True, "gpuInitialized": False, "modelLoads": 0, "modelCalls": 0,
              "gpuJobs": 0, "environmentAllocations": 0, "controls": 0,
              "scope": "Actual checkpoint action normalization/relative decoding on explicitly original-record-derived normalized inputs. Guarded float32 groups and native conversion match the same SDK decoding exactly. No original normalized NN predictions, NN inference or task acceptance."}
    (output / "acceptance.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"provider": provider, "records": len(records), "cases": len(cases), "gpuJobs": 0}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", type=Path, required=True)
    parser.add_argument("--provider", choices=("behavior", "robocasa"), required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    inspect(parser.parse_args())
