import argparse
import ast
from copy import deepcopy
from hashlib import sha256
import importlib.metadata
import json
import os
from pathlib import Path
import sys

import jax
import numpy as np
import torch
from openpi import transforms
from openpi.shared import download
from openpi.training import checkpoints, config

from physical_harness.policies.action_outputs import read_action_array, selected_action_count
from physical_harness.policies.openpi_audit import task_sources
from physical_harness.policies.openpi_checkpoint import verify_arx_x5_normalization
from physical_harness.policies.openpi_model_input import prepare_model_input
from physical_harness.policies.openpi_model_output import decode_model_actions
from physical_harness.policies.openpi_robodojo import prepare_policy_input
from physical_harness.validation import ContractValidator


def inspect(args):
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if (not output.is_relative_to(root / ".local/work") or os.environ.get("CUDA_VISIBLE_DEVICES") != "" or
            os.environ.get("JAX_PLATFORMS") != "cpu" or torch.cuda.is_initialized()):
        raise ValueError("OpenPI transform checks require a new .local/work output and CPU-only JAX/CUDA configuration.")
    devices = jax.devices()
    if not devices or any(device.platform != "cpu" for device in devices):
        raise ValueError("OpenPI transform checks require actual CPU-only JAX devices.")
    output.mkdir(parents=True, exist_ok=False)
    sources = {}

    def original(path):
        path = Path(path).resolve(strict=True)
        digest = sha256(path.read_bytes()).hexdigest()
        if str(path) in sources and sources[str(path)] != digest:
            raise ValueError(f"Original OpenPI input/source changed: {path}")
        sources[str(path)] = digest
        return path

    document = json.loads(original(args.configuration).read_bytes())
    entry = document["openpiTask"]
    run = json.loads(original(entry["run"]).read_bytes())
    schema = original(root / "harness/contracts/schema/physical.schema.json")
    inferences, requests, identity = task_sources(
        run, Path(entry["requests"]), Path(entry["bridgeDirectory"]), original(entry["bridgeLog"]),
        original(entry["nativeLog"]), original(entry["verification"]), ContractValidator.from_path(schema), entry["policyId"],
    )
    checkpoint = args.checkpoint.resolve(strict=True)
    normalization = verify_arx_x5_normalization(checkpoint)
    original(checkpoint / normalization["path"])
    verified = json.loads(Path(entry["verification"]).read_bytes())
    saved = next(item for item in verified["files"] if item["path"] == normalization["path"])
    if saved["sha256"] != normalization["sha256"] or saved["bytes"] != normalization["bytes"]:
        raise ValueError("Saved normalization differs from the original verified checkpoint.")
    original(download.get_cache_dir() / "big_vision/paligemma_tokenizer.model")
    selected = config.get_config("pi05_base_aloha_full_sim_arx-x5_seed_0")
    data = selected.data.create(selected.assets_dirs, selected.model)
    if (data.asset_id != "arx_x5_sim" or not data.use_quantile_norm or
            selected.model.action_dim != 32 or selected.model.action_horizon != 50 or selected.model.max_token_len != 200):
        raise ValueError("Actual OpenPI configuration differs from the admitted ARX X5 model layout.")
    statistics = checkpoints.load_norm_stats(checkpoint / "assets", data.asset_id)
    input_transform = transforms.compose([
        transforms.InjectDefaultPrompt(None), *data.data_transforms.inputs,
        transforms.Normalize(statistics, use_quantiles=data.use_quantile_norm), *data.model_transforms.inputs,
    ])
    output_transform = transforms.compose([
        *data.model_transforms.outputs, transforms.Unnormalize(statistics, use_quantiles=data.use_quantile_norm),
        *data.data_transforms.outputs,
    ])
    normalize_actions = transforms.compose([
        *data.data_transforms.inputs, transforms.Normalize(statistics, use_quantiles=data.use_quantile_norm),
        transforms.PadStatesAndActions(selected.model.action_dim),
    ])
    native = original(root / "harness/physical-runtime/src/physical_harness/policies/services/openpi_robodojo_native.py")
    tree = ast.parse(native.read_bytes())
    assignments = {ast.unparse(node.targets[0]): ast.unparse(node.value) for node in ast.walk(tree)
                   if isinstance(node, ast.Assign) and len(node.targets) == 1}
    if (assignments.get("trained._input_transform") != "partial(prepare_model_input, transform=trained._input_transform)" or
            assignments.get("trained._output_transform") != "partial(decode_model_actions, transform=trained._output_transform)"):
        raise ValueError("Native OpenPI must bind inspected admission to its actual SDK transforms.")
    client = original(root / "harness/physical-runtime/src/physical_harness/policies/openpi_robodojo.py")
    method = next(node for node in ast.walk(ast.parse(client.read_bytes()))
                  if isinstance(node, ast.FunctionDef) and node.name == "infer")
    if ast.unparse(method.body[0]) != "count = selected_action_count(request['max_actions'], 50, source='OpenPI RoboDojo')":
        raise ValueError("OpenPI must admit action count before preparing or sending model inputs.")
    original(Path(__file__).resolve())
    cases, records = [], []

    def rejected(name, operation, value, transform):
        try:
            operation(value, transform)
        except (ValueError, FloatingPointError) as error:
            cases.append({"name": name, "result": "rejected", "originalError": str(error)})
        else:
            raise ValueError(f"Invalid OpenPI transform derivative was accepted: {name}")

    for request_id in sorted(requests):
        for path in (Path(entry["requests"]) / f"{request_id}.json",
                     Path(entry["bridgeDirectory"]) / f"{request_id}.request.json",
                     Path(entry["bridgeDirectory"]) / f"{request_id}.inference.json"):
            original(path)
        request = requests[request_id]
        before = deepcopy(request)
        prepared = prepare_policy_input(request)
        wanted = input_transform(deepcopy(prepared))
        admitted = prepare_model_input(deepcopy(prepared), input_transform)
        expected_leaves = jax.tree_util.tree_leaves(wanted)
        actual_leaves = jax.tree_util.tree_leaves(admitted)
        if (jax.tree_util.tree_structure(wanted) != jax.tree_util.tree_structure(admitted) or
                not all(np.array_equal(left, right) for left, right in zip(expected_leaves, actual_leaves, strict=True))):
            raise ValueError("OpenPI admission changed actual SDK model inputs.")
        raw = read_action_array(np.array(inferences[request_id]["raw_actions"], dtype=np.float32),
                                dimensions=(50, 14), source="Original OpenPI actions", float32=True)
        derivative = normalize_actions({**deepcopy(prepared), "actions": raw.copy()})
        normalized = {"state": derivative["state"], "actions": derivative["actions"]}
        expected = output_transform(deepcopy(normalized))["actions"].astype(np.float32)
        decoded = decode_model_actions(deepcopy(normalized), output_transform)["actions"]
        if not np.array_equal(expected, decoded):
            raise ValueError("OpenPI admission changed actual SDK-derived float32 actions.")
        count = selected_action_count(request["max_actions"], 50, source="OpenPI RoboDojo")
        native_actions = decoded.copy()
        native_actions[:, [6, 13]] = np.clip(native_actions[:, [6, 13]], 0, 1)
        baseline = expected.copy()
        baseline[:, [6, 13]] = np.clip(baseline[:, [6, 13]], 0, 1)
        if not np.array_equal(native_actions[:count], baseline[:count]):
            raise ValueError("OpenPI admission changed SDK-derived native controller actions.")
        cases.extend({"name": f"{request_id}.{name}", "result": "passed"}
                     for name in ("actual-input-transform", "sdk-normalized-action-derivative", "native-prefix"))
        details = [{"path": str(path), "shape": list(np.asarray(value).shape), "dtype": str(np.asarray(value).dtype),
                    "sha256": sha256(np.asarray(value).tobytes()).hexdigest()}
                   for path, value in jax.tree_util.tree_flatten_with_path(admitted)[0]]
        records.append({"requestId": request_id, "observationId": request["observation_id"], "prepared": details,
                        "sourceKind": "original-native-actions-delta-normalized-and-padded-by-actual-sdk",
                        "normalizedSha256": sha256(normalized["actions"].tobytes()).hexdigest(),
                        "decodedSha256": sha256(decoded.tobytes()).hexdigest(), "decodedShape": list(decoded.shape)})
        if request_id == min(requests):
            identity_transform = transforms.compose([])
            for field in ("state", "actions"):
                for name, dtype in (("boolean", np.bool_), ("integer", np.int64), ("complex", np.complex128)):
                    invalid = deepcopy(normalized)
                    invalid[field] = invalid[field].astype(dtype)
                    rejected(f"normalized-{field}-{name}", decode_model_actions, invalid, output_transform)
                for name, value in (("nan", float("nan")), ("infinity", float("inf")),
                                    ("negative-infinity", -float("inf")), ("overflow", 1e40), ("negative-overflow", -1e40)):
                    invalid = deepcopy(normalized)
                    invalid[field].reshape(-1)[0] = value
                    rejected(f"normalized-{field}-{name}", decode_model_actions, invalid, output_transform)
                invalid = deepcopy(normalized)
                invalid[field] = invalid[field][..., :-1]
                rejected(f"normalized-{field}-width", decode_model_actions, invalid, output_transform)
            for name, value in (("rank", normalized["actions"][None]), ("horizon", normalized["actions"][:-1]),
                                ("empty", normalized["actions"][:0]), ("list", normalized["actions"].tolist())):
                rejected(name, decode_model_actions, {**normalized, "actions": value}, output_transform)
            invalid = deepcopy(normalized)
            invalid["additional"] = True
            rejected("model-fields", decode_model_actions, invalid, output_transform)
            invalid = deepcopy(normalized)
            invalid["actions"][-1, -1] = float("nan")
            rejected("normalized-capacity-padding-nan", decode_model_actions, invalid, output_transform)
            invalid = deepcopy(normalized)
            invalid["actions"][-1, 0] = float("inf")
            rejected("normalized-after-prefix-infinity", decode_model_actions, invalid, output_transform)
            inverse_channel = int(np.argmax(statistics["actions"].q99 - statistics["actions"].q01))
            if statistics["actions"].q99[inverse_channel] - statistics["actions"].q01[inverse_channel] <= 2:
                raise ValueError("The original checkpoint does not establish the selected inverse range case.")
            for sign in (1, -1):
                invalid = deepcopy(normalized)
                invalid["actions"][0, inverse_channel] = sign * float(np.finfo(np.float32).max)
                rejected(f"actual-unnormalization-float32-overflow-{sign}", decode_model_actions, invalid, output_transform)
            for name, value in (("nan", float("nan")), ("infinity", float("inf")), ("overflow", 1e40)):
                invalid = deepcopy(admitted)
                invalid["state"][0] = value
                rejected(f"prepared-state-{name}", prepare_model_input, invalid, identity_transform)
            for name, field, value in (("negative-token", "tokenized_prompt", -1),
                                       ("int32-token-overflow", "tokenized_prompt", 2 ** 32)):
                invalid = deepcopy(admitted)
                invalid[field][0] = value
                rejected(name, prepare_model_input, invalid, identity_transform)
            invalid = deepcopy(admitted)
            invalid["tokenized_prompt_mask"][:] = False
            rejected("empty-prompt-mask", prepare_model_input, invalid, identity_transform)
            for camera in sorted(admitted["image"]):
                invalid = deepcopy(admitted)
                invalid["image_mask"][camera] = False
                rejected(f"unavailable-{camera}", prepare_model_input, invalid, identity_transform)
                invalid = deepcopy(admitted)
                invalid["image"][camera] = invalid["image"][camera].astype(np.float32)
                rejected(f"invalid-image-{camera}", prepare_model_input, invalid, identity_transform)
            for sign in (1, -1):
                invalid = deepcopy(prepared)
                invalid["state"] = invalid["state"].astype(np.float64)
                invalid["state"][0] = sign * float(np.finfo(np.float64).max)
                rejected(f"actual-normalization-overflow-{sign}", prepare_model_input, invalid, input_transform)
            for limit in (1, 50, 512):
                if selected_action_count(limit, 50, source="OpenPI RoboDojo") != min(limit, 50):
                    raise ValueError("OpenPI prefix admission changed the configured action limit.")
                cases.append({"name": f"limit-{limit}", "result": "passed"})
            for name, value in (("true", True), ("zero", 0), ("negative", -1), ("overflow", 513),
                                ("fraction", 1.5), ("string", "1"), ("null", None)):
                try:
                    selected_action_count(value, 50, source="OpenPI RoboDojo")
                except ValueError as error:
                    cases.append({"name": f"limit-{name}", "result": "rejected", "originalError": str(error)})
                else:
                    raise ValueError("Invalid OpenPI action count was accepted.")
        if request != before:
            raise ValueError("Actual OpenPI transforms changed the original request.")
    sdk_root = Path(config.__file__).resolve().parents[1]
    for name, module in sorted(sys.modules.items()):
        if name.startswith(("physical_harness.policies", "openpi.", "openpi_client")):
            path = getattr(module, "__file__", None)
            if path is not None and Path(path).is_file():
                path = original(path)
                if path.is_relative_to(sdk_root):
                    relative = str(path.relative_to(sdk_root))
                    if sources[str(path)] != identity["importedPolicySourceFileSha256"][relative]:
                        raise ValueError(f"Actual OpenPI SDK source differs from the original inference: {relative}")
    if torch.cuda.is_initialized() or not records or any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("Actual OpenPI checks require unchanged original sources and uninitialized CUDA.")
    report = {"sdkVersion": importlib.metadata.version("openpi"), "runId": run["id"],
              "processId": os.getpid(), "processGroupId": os.getpgid(0), "sources": sources,
              "cases": cases, "records": records, "jaxDevices": [str(device) for device in devices],
              "originalFilesUnchanged": True, "originalInputsUnchanged": True, "gpuInitialized": False,
              "modelLoads": 0, "modelCalls": 0, "gpuJobs": 0, "environmentAllocations": 0, "controls": 0,
              "scope": "Actual OpenPI checkpoint/configuration transforms on original requests and explicitly native-action-derived normalized outputs. Same-SDK inputs and float32 controls remain exact. No retained normalized NN predictions, model inference or task acceptance."}
    (output / "acceptance.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"records": len(records), "cases": len(cases), "sources": len(sources), "gpuJobs": 0}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    inspect(parser.parse_args())
