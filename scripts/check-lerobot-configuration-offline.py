import argparse
from copy import deepcopy
from hashlib import sha256
import json
import os
from pathlib import Path
import shutil

from safetensors.torch import load_file, save_file
import torch

from physical_harness.policies.lerobot_pi05_robotwin import TOKENIZER_HASHES, prepare_checkpoint_processors


def inspect(checkpoint: Path, tokenizer: Path, output: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    checkpoint, tokenizer = checkpoint.resolve(strict=True), tokenizer.resolve(strict=True)
    output = output.resolve()
    if not output.is_relative_to(root / ".local/work") or os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("LeRobot configuration checks require a new .local/work output and CUDA_VISIBLE_DEVICES=''.")
    if torch.cuda.is_initialized():
        raise ValueError("LeRobot configuration checks require uninitialized CUDA.")
    output.mkdir(parents=True, exist_ok=False)
    sources = {}

    def original(path):
        path = Path(path).resolve(strict=True)
        sources[str(path)] = sha256(path.read_bytes()).hexdigest()
        return path

    manifest = json.loads(original(root / "examples/policies/lerobot-pi05-robotwin.json").read_bytes())
    names = ("config.json", "policy_preprocessor.json", "policy_postprocessor.json",
             "policy_preprocessor_step_3_normalizer_processor.safetensors",
             "policy_postprocessor_step_0_unnormalizer_processor.safetensors")
    for name in names:
        path = original(checkpoint / name)
        if sources[str(path)] != manifest["upstream"]["checkpoint_files_sha256"][name]:
            raise ValueError(f"LeRobot configuration differs from the admitted original {name}.")
    for name, digest in TOKENIZER_HASHES.items():
        path = original(tokenizer / name)
        if sources[str(path)] != digest:
            raise ValueError(f"Tokenizer differs from the admitted original {name}.")
    original(root / "harness/physical-runtime/src/physical_harness/policies/lerobot_pi05_robotwin.py")
    original(Path(__file__).resolve())
    config, preprocessor, postprocessor = prepare_checkpoint_processors(str(checkpoint), str(tokenizer), device="cpu")
    cases = [{"name": "original-checkpoint-processors", "result": "passed",
              "policyType": config.type, "chunkSize": config.chunk_size,
              "preprocessorSteps": [type(step).__name__ for step in preprocessor.steps],
              "postprocessorSteps": [type(step).__name__ for step in postprocessor.steps]}]
    documents = {name: json.loads((checkpoint / name).read_bytes()) for name in names if name.endswith(".json")}

    def step(doc, filename, name):
        return next(item["config"] for item in doc[filename]["steps"] if item["registry_name"] == name)

    def sample(name):
        directory = output / "derivatives" / name
        directory.mkdir(parents=True)
        for filename in names:
            shutil.copyfile(checkpoint / filename, directory / filename)
        return directory

    def rejected(name, directory, **arguments):
        try:
            prepare_checkpoint_processors(str(directory), str(tokenizer), device="cpu", **arguments)
        except (ValueError, KeyError) as error:
            cases.append({"name": name, "result": "rejected", "originalError": str(error),
                          "derivativeSha256": {filename: sha256((directory / filename).read_bytes()).hexdigest() for filename in names}})
        else:
            raise AssertionError(f"Invalid LeRobot checkpoint processing was accepted: {name}")
        if torch.cuda.is_initialized():
            raise ValueError("Configuration admission initialized CUDA.")

    derivatives = [
        ("missing-input-camera", lambda doc: doc["config.json"]["input_features"].pop("observation.images.cam_high")),
        ("state-dimension", lambda doc: doc["config.json"]["input_features"]["observation.state"].update(shape=[13])),
        ("camera-dimension", lambda doc: doc["config.json"]["input_features"]["observation.images.cam_high"].update(shape=[640, 480, 3])),
        ("action-dimension", lambda doc: doc["config.json"]["output_features"]["action"].update(shape=[13])),
        ("relative-model-actions", lambda doc: doc["config.json"].update(use_relative_actions=True)),
        ("model-normalization", lambda doc: doc["config.json"]["normalization_mapping"].update(STATE="IDENTITY")),
        ("tokenizer-name", lambda doc: step(doc, "policy_preprocessor.json", "tokenizer_processor").update(tokenizer_name="unsupported")),
        ("relative-preprocessor-actions", lambda doc: step(doc, "policy_preprocessor.json", "relative_actions_processor").update(enabled=True)),
        ("relative-postprocessor-actions", lambda doc: step(doc, "policy_postprocessor.json", "absolute_actions_processor").update(enabled=True)),
        ("saved-state-dimension", lambda doc: step(doc, "policy_preprocessor.json", "normalizer_processor")["features"]["observation.state"].update(shape=[13])),
        ("saved-action-dimension", lambda doc: step(doc, "policy_postprocessor.json", "unnormalizer_processor")["features"]["action"].update(shape=[13])),
        ("saved-state-normalization", lambda doc: step(doc, "policy_preprocessor.json", "normalizer_processor")["norm_map"].update(STATE="IDENTITY")),
        ("excluded-state-normalization", lambda doc: step(doc, "policy_preprocessor.json", "normalizer_processor").update(normalize_observation_keys=[])),
        ("negative-epsilon", lambda doc: step(doc, "policy_preprocessor.json", "normalizer_processor").update(eps=-1)),
        ("zero-epsilon", lambda doc: step(doc, "policy_postprocessor.json", "unnormalizer_processor").update(eps=0)),
    ]
    for name, operation in derivatives:
        directory, doc = sample(name), deepcopy(documents)
        operation(doc)
        for filename, value in doc.items():
            if value != documents[filename]:
                (directory / filename).write_text(json.dumps(value, allow_nan=False) + "\n", encoding="utf-8")
        rejected(name, directory)
    for name, filename, operation in (
        ("negative-state-std", names[3], lambda values: values["observation.state.std"].__setitem__(0, -1)),
        ("nonfinite-state-mean", names[3], lambda values: values["observation.state.mean"].__setitem__(0, float("inf"))),
        ("missing-state-mean", names[3], lambda values: values.pop("observation.state.mean")),
        ("action-statistic-dimension", names[4], lambda values: values.update({"action.std": values["action.std"][:-1].clone()})),
        ("action-inverse-statistics", names[4], lambda values: values["action.mean"].__setitem__(0, values["action.mean"][0] + 1)),
    ):
        directory = sample(name)
        tensors = load_file(str(directory / filename))
        operation(tensors)
        save_file(tensors, str(directory / filename))
        rejected(name, directory)
    rejected("invalid-compile-selector", sample("invalid-compile-selector"), compile_model="true")
    if any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("Original LeRobot configuration/tokenizer/source files changed during CPU admission.")
    if torch.cuda.is_initialized():
        raise ValueError("CPU checkpoint processor admission initialized CUDA.")
    report = {"provider": "robotwin", "sources": sources, "cases": cases, "originalFilesUnchanged": True,
              "gpuInitialized": False, "modelLoads": 0, "modelCalls": 0, "gpuJobs": 0,
              "environmentAllocations": 0, "controls": 0,
              "scope": "Actual saved LeRobot checkpoint/tokenizer processors and declared invalid metadata/statistics; no policy network, inference or task acceptance."}
    (output / "acceptance.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"provider": "robotwin", "cases": len(cases), "sources": len(sources), "modelLoads": 0}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--tokenizer", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    inspect(args.checkpoint, args.tokenizer, args.output)
