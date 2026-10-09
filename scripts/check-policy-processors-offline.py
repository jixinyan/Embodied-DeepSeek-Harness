import argparse
from copy import deepcopy
from hashlib import sha256
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import sys

import numpy as np

from physical_harness.validation import ContractValidator


def inspect(args):
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work") or os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("Installed SDK processor checks require a new .local/work output and CUDA_VISIBLE_DEVICES=''.")
    output.mkdir(parents=True, exist_ok=False)
    sources = {}

    def original(path):
        path = Path(path).resolve(strict=True)
        digest = sha256(path.read_bytes()).hexdigest()
        if str(path) in sources and sources[str(path)] != digest:
            raise ValueError(f"Original source changed during processor checks: {path}")
        sources[str(path)] = digest
        return path

    document = json.loads(original(args.configuration).read_bytes())
    schema = original(root / "harness/contracts/schema/physical.schema.json")
    validator = ContractValidator.from_path(schema)
    audit_path = original(root / "scripts/audit-recorded-run.py")
    spec = importlib.util.spec_from_file_location("edh_original_sdk_processor_audit", audit_path)
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)
    if args.provider == "robodojo":
        from physical_harness.policies.openpi_audit import task_sources
        entry = document["openpiTask"]
        run = json.loads(original(entry["run"]).read_bytes())
        inferences, requests, _ = task_sources(
            run, Path(entry["requests"]), Path(entry["bridgeDirectory"]), original(entry["bridgeLog"]),
            original(entry["nativeLog"]), original(entry["verification"]), validator, entry["policyId"],
        )
        from openpi_client import msgpack_numpy
        from physical_harness.policies.openpi_robodojo import prepare_policy_input
        processor = None
        sdk_version = importlib.metadata.version("openpi-client")
    else:
        entry = next(item for item in document["conventional"] if Path(item["manifest"]).stem.endswith(args.provider))
        run = json.loads(original(entry["run"]).read_bytes())
        manifest_path = original(entry["manifest"])
        provider, inferences, requests, _ = audit.conventional_policy_sources(
            run, Path(entry["requests"]), original(entry["serviceLog"]), manifest_path, schema,
        )
        if provider != args.provider or args.checkpoint is None:
            raise ValueError("A matching original provider and local checkpoint are required.")
        checkpoint = args.checkpoint.resolve(strict=True)
        manifest = json.loads(manifest_path.read_bytes())
        import torch
        from torch.utils._pytree import tree_flatten_with_path
        if torch.cuda.is_initialized():
            raise ValueError("The installed SDK check requires an uninitialized CUDA context.")
        if args.provider == "robotwin":
            if args.tokenizer is None:
                raise ValueError("A local PaliGemma tokenizer is required.")
            from lerobot.configs import PreTrainedConfig
            from lerobot.policies import make_pre_post_processors
            from physical_harness.policies.lerobot_pi05_robotwin import TOKENIZER_HASHES, prepare_policy_input
            tokenizer = args.tokenizer.resolve(strict=True)
            for name, digest in TOKENIZER_HASHES.items():
                path = original(tokenizer / name)
                if sources[str(path)] != digest:
                    raise ValueError(f"Tokenizer source differs from the admitted {name}.")
            names = ("config.json", "policy_preprocessor.json", "policy_postprocessor.json",
                     "policy_preprocessor_step_3_normalizer_processor.safetensors",
                     "policy_postprocessor_step_0_unnormalizer_processor.safetensors")
            for name in names:
                path = original(checkpoint / name)
                if sources[str(path)] != manifest["upstream"]["checkpoint_files_sha256"][name]:
                    raise ValueError(f"Processor checkpoint source differs from the original {name}.")
            configuration = PreTrainedConfig.from_pretrained(checkpoint, local_files_only=True)
            configuration.device = "cpu"
            processor, _ = make_pre_post_processors(
                configuration, pretrained_path=str(checkpoint),
                preprocessor_overrides={"device_processor": {"device": "cpu"},
                                       "tokenizer_processor": {"tokenizer_name": str(tokenizer)}},
            )
            sdk_version = importlib.metadata.version("lerobot")
        else:
            import gr00t.model
            from gr00t.data.embodiment_tags import EmbodimentTag
            from gr00t.data.types import MessageType, VLAStepData
            from gr00t.policy.gr00t_policy import _rec_to_dtype
            from transformers import AutoProcessor
            if args.provider == "behavior":
                from physical_harness.policies.gr00t_n1d6_behavior import prepare_policy_input
                embodiment = EmbodimentTag.BEHAVIOR_R1_PRO
            else:
                from physical_harness.policies.gr00t_n1d6_robocasa import prepare_policy_input
                embodiment = EmbodimentTag.ROBOCASA_PANDA_OMRON
            for name in ("config.json", "processor_config.json", "statistics.json", "embodiment_id.json"):
                path = original(checkpoint / name)
                if sources[str(path)] != manifest["upstream"]["checkpoint_files_sha256"][name]:
                    raise ValueError(f"Processor checkpoint source differs from the original {name}.")
            processor = AutoProcessor.from_pretrained(
                checkpoint, transformers_loading_kwargs={"trust_remote_code": True, "local_files_only": True},
            )
            processor.eval()
            modalities = processor.get_modality_configs()[embodiment.value]
            language_key = modalities["language"].modality_keys[0]
            sdk_version = importlib.metadata.version("gr00t")
    original(Path(__file__).resolve())
    for name, module in sorted(sys.modules.items()):
        if name.startswith(("physical_harness.policies", "lerobot", "gr00t", "openpi_client")):
            path = getattr(module, "__file__", None)
            if path is not None and Path(path).is_file():
                original(path)
    cases, prepared_records = [], []
    for request_id in sorted(requests):
        request = requests[request_id]
        before = deepcopy(request)
        original(Path(entry["requests"]) / f"{request_id}.json")
        if args.provider == "robodojo":
            original(Path(entry["bridgeDirectory"]) / f"{request_id}.request.json")
            original(Path(entry["bridgeDirectory"]) / f"{request_id}.inference.json")
            prepared = prepare_policy_input(request)
            packed = msgpack_numpy.Packer().pack({**prepared, "edh_request_id": request_id})
            decoded = msgpack_numpy.unpackb(packed)
            if decoded["edh_request_id"] != request_id or decoded["prompt"] != prepared["prompt"]:
                raise ValueError("Actual OpenPI codec changed request or instruction identity.")
            record = inferences[request_id]
            if sha256(decoded["state"].tobytes()).hexdigest() != record["state_sha256"]:
                raise ValueError("OpenPI prepared state differs from the original actual inference.")
            for name, value in decoded["images"].items():
                if value.dtype != np.uint8 or sha256(value.tobytes()).hexdigest() != record["camera_sha256"][name]:
                    raise ValueError("OpenPI prepared pixels differ from the original actual inference.")
            details = {"packedSha256": sha256(packed).hexdigest(), "packedBytes": len(packed)}
        else:
            if args.provider == "robotwin":
                prepared = processor(prepare_policy_input(request))
            else:
                batch = prepare_policy_input(request, language_key=language_key)
                if set(batch["video"]) != set(modalities["video"].modality_keys) or set(batch["state"]) != set(modalities["state"].modality_keys):
                    raise ValueError("Prepared modalities differ from the actual checkpoint processor.")
                step = VLAStepData(images={name: value[0] for name, value in batch["video"].items()},
                                   states={name: value[0] for name, value in batch["state"].items()},
                                   actions={}, text=batch["language"][language_key][0][0], embodiment=embodiment)
                transformed = processor([{"type": MessageType.EPISODE_STEP.value, "content": step}])
                prepared = _rec_to_dtype(processor.collator([transformed]), dtype=torch.bfloat16)
            tensors, _ = tree_flatten_with_path(prepared)
            details = []
            for path, value in tensors:
                if isinstance(value, torch.Tensor):
                    if value.device.type != "cpu" or not torch.isfinite(value).all():
                        raise ValueError("The actual SDK processor returned nonfinite or non-CPU tensors.")
                    details.append({"path": str(path), "shape": list(value.shape), "dtype": str(value.dtype),
                                    "sha256": sha256(value.contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()).hexdigest()})
            if not details or torch.cuda.is_initialized():
                raise ValueError("Actual processor tensors and an uninitialized GPU are required.")
        if request != before:
            raise ValueError("The original policy request changed during SDK preparation.")
        cases.append({"requestId": request_id, "result": "passed"})
        prepared_records.append({"requestId": request_id, "observationId": request["observation_id"],
                                 "instructionSha256": sha256(request["instruction"].encode()).hexdigest(),
                                 "prepared": details})
    for name, module in sorted(sys.modules.items()):
        if name.startswith(("physical_harness.policies", "lerobot", "gr00t", "openpi_client")):
            path = getattr(module, "__file__", None)
            if path is not None and Path(path).is_file():
                original(path)
    if not cases or any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("The original SDK input/checkpoint/source files changed or no requests were inspected.")
    report = {"provider": args.provider, "runId": run["id"], "sdkVersion": sdk_version,
              "sources": sources, "cases": cases, "preparedRecords": prepared_records,
              "originalFilesUnchanged": True, "gpuInitialized": False, "gpuJobs": 0, "modelLoads": 0, "modelCalls": 0,
              "environmentAllocations": 0, "controls": 0,
              "scope": "Actual installed checkpoint processor or OpenPI codec on original requests; no NN inference, simulation or task acceptance."}
    (output / "acceptance.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"provider": args.provider, "requests": len(cases), "sources": len(sources), "sdkVersion": sdk_version, "gpuJobs": 0}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", required=True, type=Path)
    parser.add_argument("--provider", required=True, choices=("robotwin", "robocasa", "behavior", "robodojo"))
    parser.add_argument("--checkpoint", type=Path)
    parser.add_argument("--tokenizer", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    inspect(parser.parse_args())
