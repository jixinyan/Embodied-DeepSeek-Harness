import argparse
import ast
from copy import deepcopy
from hashlib import sha256
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import sys

import torch
from lerobot.processor.normalize_processor import NormalizerProcessorStep, UnnormalizerProcessorStep
from lerobot.lerobot_types import TransitionKey

from physical_harness.policies import lerobot_pi05_robotwin as robotwin
from physical_harness.policies.action_outputs import selected_action_count


def inspect(args):
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work") or os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("RoboTwin postprocessor checks require a new .local/work output and CUDA_VISIBLE_DEVICES=''.")
    if torch.cuda.is_initialized():
        raise ValueError("RoboTwin postprocessor checks require an uninitialized CUDA context.")
    output.mkdir(parents=True, exist_ok=False)
    sources = {}

    def original(path):
        path = Path(path).resolve(strict=True)
        digest = sha256(path.read_bytes()).hexdigest()
        if str(path) in sources and sources[str(path)] != digest:
            raise ValueError(f"Original postprocessor source changed: {path}")
        sources[str(path)] = digest
        return path

    configuration = json.loads(original(args.configuration).read_bytes())
    audit_path = original(root / "scripts/audit-recorded-run.py")
    spec = importlib.util.spec_from_file_location("edh_original_robotwin_postprocessor_audit", audit_path)
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)
    schema = original(root / "harness/contracts/schema/physical.schema.json")
    entry = next(item for item in configuration["conventional"] if Path(item["manifest"]).stem.endswith("robotwin"))
    run = json.loads(original(entry["run"]).read_bytes())
    manifest_path = original(entry["manifest"])
    provider, inferences, requests, _ = audit.conventional_policy_sources(
        run, Path(entry["requests"]), original(entry["serviceLog"]), manifest_path, schema,
    )
    if provider != "robotwin":
        raise ValueError("RoboTwin postprocessor checks require identified original inference records.")
    checkpoint = args.checkpoint.resolve(strict=True)
    tokenizer = args.tokenizer.resolve(strict=True)
    manifest = json.loads(manifest_path.read_bytes())
    for name in ("config.json", "policy_preprocessor.json", "policy_postprocessor.json",
                 "policy_preprocessor_step_3_normalizer_processor.safetensors",
                 "policy_postprocessor_step_0_unnormalizer_processor.safetensors"):
        path = original(checkpoint / name)
        if sources[str(path)] != manifest["upstream"]["checkpoint_files_sha256"][name]:
            raise ValueError("Saved RoboTwin processor differs from the original checkpoint identity.")
    for name, digest in robotwin.TOKENIZER_HASHES.items():
        path = original(tokenizer / name)
        if sources[str(path)] != digest:
            raise ValueError("Saved RoboTwin tokenizer identity differs.")
    config, preprocessor, postprocessor = robotwin.prepare_checkpoint_processors(str(checkpoint), str(tokenizer), device="cpu")
    normalizer = next(step for step in preprocessor.steps if isinstance(step, NormalizerProcessorStep))
    tree = ast.parse(original(robotwin.__file__).read_bytes())
    method = next(node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef) and node.name == "infer_with_record")
    if (ast.unparse(method.body[0]) != "count = selected_action_count(request['max_actions'], 50, source='LeRobot π0.5 RoboTwin')" or
            sum(isinstance(node, ast.Call) and ast.unparse(node.func) == "decode_model_actions" for node in ast.walk(method)) != 1 or
            not any(isinstance(node, ast.Call) and ast.unparse(node.func) == "decode_model_actions" and
                    [ast.unparse(argument) for argument in node.args] == ["normalized", "self.postprocessor"] for node in ast.walk(method))):
        raise ValueError("Online RoboTwin inference must admit count and use the inspected saved postprocessor.")
    original(Path(__file__).resolve())
    for name, loaded in sorted(sys.modules.items()):
        if name.startswith(("physical_harness.policies", "lerobot")):
            path = getattr(loaded, "__file__", None)
            if path is not None and Path(path).is_file():
                original(path)
    cases, records = [], []

    def rejected(name, value):
        try:
            robotwin.decode_model_actions(value, postprocessor)
        except ValueError as error:
            cases.append({"name": name, "result": "rejected", "originalError": str(error)})
        else:
            raise ValueError(f"Invalid RoboTwin postprocessor input was accepted: {name}")

    for request_id in sorted(requests):
        original(Path(entry["requests"]) / f"{request_id}.json")
        request = requests[request_id]
        before = deepcopy(request)
        robotwin.prepare_model_input(request, preprocessor)
        record = inferences[request_id]
        raw = torch.tensor(record["model_actions"], dtype=torch.float32)
        if raw.shape != (len(record["actions"]), 14) or not 0 < len(raw) <= config.chunk_size or not torch.isfinite(raw).all():
            raise ValueError("Original RoboTwin selected model prefix has incompatible dimensions or values.")
        raw_before = raw.clone()
        prefix = normalizer({TransitionKey.ACTION: raw[None]})[TransitionKey.ACTION]
        normalized = torch.zeros((1, config.chunk_size, 14), dtype=prefix.dtype)
        normalized[:, :len(raw)] = prefix
        normalized_before = normalized.clone()
        expected = postprocessor(normalized)
        actual = robotwin.decode_model_actions(normalized, postprocessor)
        if actual.device.type != "cpu" or not torch.equal(actual, expected):
            raise ValueError("RoboTwin admission changed the actual saved postprocessor's actions.")
        count = selected_action_count(request["max_actions"], config.chunk_size, source="LeRobot π0.5 RoboTwin")
        actual_native = robotwin.native_action_record(actual[0, :count])
        if actual_native != robotwin.native_action_record(expected[0, :count]):
            raise ValueError("RoboTwin admission changed the SDK-derived native controller sequence.")
        cases.append({"name": f"{request_id}.sdk-prefix-derivative", "result": "passed"})
        records.append({"requestId": request_id, "observationId": request["observation_id"],
                        "sourceKind": "original-selected-model-prefix-normalized-and-capacity-padded-by-sdk",
                        "originalPrefixActions": len(raw), "decodedShape": list(actual.shape),
                        "dtype": str(actual.dtype), "normalizedSha256": sha256(normalized.numpy().tobytes()).hexdigest(),
                        "decodedSha256": sha256(actual.numpy().tobytes()).hexdigest()})
        if request_id == min(requests):
            for name, dtype in (("float16", torch.float16), ("bfloat16", torch.bfloat16), ("float64", torch.float64)):
                saved = deepcopy(postprocessor)
                value = normalized.to(dtype=dtype)
                wanted = saved(value)
                observed = robotwin.decode_model_actions(value, saved)
                if not torch.equal(wanted, observed) or observed.dtype != wanted.dtype:
                    raise ValueError("Floating-point RoboTwin admission changed saved postprocessing.")
                cases.append({"name": name, "result": "passed", "dtype": str(observed.dtype)})
            for name, dtype in (("boolean", torch.bool), ("integer", torch.int64), ("complex", torch.complex64)):
                rejected(name, normalized.to(dtype=dtype))
            for name, value in (("nan", float("nan")), ("infinity", float("inf")), ("negative-infinity", -float("inf"))):
                invalid = normalized.clone()
                invalid[0, 0, 0] = value
                rejected(name, invalid)
            for name, value in (("rank", normalized[0]), ("batch", normalized.repeat(2, 1, 1)),
                                ("horizon", normalized[:, :-1]), ("channels", normalized[:, :, :-1]),
                                ("empty", normalized[:, :0]), ("non-tensor", normalized.tolist())):
                rejected(name, value)
            inverse = next(step for step in postprocessor.steps if isinstance(step, UnnormalizerProcessorStep))
            overflow_channel = int(torch.argmax(inverse.state_dict()["action.std"]).item())
            if inverse.state_dict()["action.std"][overflow_channel] <= 1:
                raise ValueError("The original saved statistics do not establish the selected inverse overflow case.")
            for sign in (1, -1):
                invalid = normalized.clone()
                invalid[0, 0, overflow_channel] = sign * torch.finfo(torch.float32).max
                rejected(f"saved-unnormalization-overflow-{sign}", invalid)
            for maximum in (1, 512):
                selected = selected_action_count(maximum, config.chunk_size, source="LeRobot π0.5 RoboTwin")
                native, model = robotwin.native_action_record(actual[0, :selected])
                if len(native) != min(maximum, 50) or len(model) != len(native):
                    raise ValueError("RoboTwin action-count admission changed its declared native prefix.")
                cases.append({"name": f"limit-{maximum}", "result": "passed"})
            for name, value in (("true", True), ("false", False), ("zero", 0), ("negative", -1),
                                ("overflow", 513), ("fraction", 1.5), ("string", "1"), ("null", None)):
                try:
                    selected_action_count(value, config.chunk_size, source="LeRobot π0.5 RoboTwin")
                except ValueError as error:
                    cases.append({"name": f"limit-{name}", "result": "rejected", "originalError": str(error)})
                else:
                    raise ValueError("Invalid RoboTwin action count was accepted.")
        if request != before or not torch.equal(raw, raw_before) or not torch.equal(normalized, normalized_before):
            raise ValueError("Saved RoboTwin postprocessing changed its original inputs.")
    for name, loaded in sorted(sys.modules.items()):
        if name.startswith(("physical_harness.policies", "lerobot")):
            path = getattr(loaded, "__file__", None)
            if path is not None and Path(path).is_file():
                original(path)
    if torch.cuda.is_initialized() or not records:
        raise ValueError("Saved RoboTwin postprocessor checks require original CPU records.")
    if any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("Original saved-postprocessor inputs or sources changed.")
    report = {"sdkVersion": importlib.metadata.version("lerobot"), "runId": run["id"],
              "processId": os.getpid(), "processGroupId": os.getpgid(0), "sources": sources,
              "cases": cases, "records": records, "originalFilesUnchanged": True, "originalInputsUnchanged": True,
              "gpuInitialized": False, "modelLoads": 0, "modelCalls": 0, "gpuJobs": 0, "environmentAllocations": 0,
              "controls": 0, "scope": "Actual saved checkpoint processors on explicitly original-selected-prefix-derived normalized inputs and declared capacity padding. Guarded actions match the same SDK postprocessor exactly. No original full normalized predictions, NN inference or task acceptance."}
    (output / "acceptance.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"records": len(records), "cases": len(cases), "gpuJobs": 0}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--tokenizer", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    inspect(parser.parse_args())
