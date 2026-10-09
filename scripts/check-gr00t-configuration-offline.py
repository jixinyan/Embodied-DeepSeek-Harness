import argparse
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import shutil
import sys

from jsonschema import ValidationError

from physical_harness.policies.gr00t_n1d6_behavior import Gr00tN1d6Behavior, verify_checkpoint_configuration as verify_behavior
from physical_harness.policies.gr00t_n1d6_robocasa import Gr00tN1d6RoboCasa, verify_checkpoint_configuration as verify_robocasa


def inspect(provider: str, checkpoint: Path, output: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    checkpoint = checkpoint.resolve(strict=True)
    output = output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("GR00T configuration inspection requires a new output under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    sources = {}

    def original(path):
        resolved = Path(path).resolve(strict=True)
        sources[str(resolved)] = sha256(resolved.read_bytes()).hexdigest()
        return resolved

    manifest = json.loads(original(root / f"examples/policies/gr00t-n1d6-{provider}.json").read_bytes())
    names = ("config.json", "processor_config.json", "statistics.json")
    documents = {}
    for name in names:
        path = original(checkpoint / name)
        if sources[str(path)] != manifest["upstream"]["checkpoint_files_sha256"][name]:
            raise ValueError(f"Configuration source differs from the admitted original {name}.")
        documents[name] = json.loads(path.read_bytes())
    for name in ("gr00t_checkpoint.py", "gr00t_n1d6_behavior.py", "gr00t_n1d6_robocasa.py"):
        original(root / "harness/physical-runtime/src/physical_harness/policies" / name)
    original(Path(__file__).resolve())
    verify, adapter = (verify_behavior, Gr00tN1d6Behavior) if provider == "behavior" else (verify_robocasa, Gr00tN1d6RoboCasa)
    admitted = verify(str(checkpoint))
    body = admitted["embodimentId"]
    configuration_hashes = {name: sources[str(checkpoint / name)] for name in names}
    if admitted["configurationSha256"] != configuration_hashes:
        raise ValueError("Configuration admission changed original file identity.")
    cases = [{"name": "original-checkpoint-configuration", "result": "passed", "admission": admitted}]

    def kwargs(doc):
        return doc["processor_config.json"]["processor_kwargs"]

    def modalities(doc):
        return kwargs(doc)["modality_configs"][body]

    def statistics(doc):
        return doc["statistics.json"][body]

    derivatives = [
        ("model-type", lambda doc: doc["config.json"].update(model_type="unsupported")),
        ("processor-class", lambda doc: doc["processor_config.json"].update(processor_class="unsupported")),
        ("missing-embodiment", lambda doc: kwargs(doc)["modality_configs"].pop(body)),
        ("missing-language", lambda doc: modalities(doc).pop("language")),
        ("multiple-language-keys", lambda doc: modalities(doc)["language"]["modality_keys"].append("unsupported")),
        ("processor-name", lambda doc: kwargs(doc).update(model_name="unsupported")),
        ("processor-type", lambda doc: kwargs(doc).update(model_type="unsupported")),
        ("state-capacity-mismatch", lambda doc: kwargs(doc).update(max_state_dim=kwargs(doc)["max_state_dim"] + 1)),
        ("action-capacity-mismatch", lambda doc: kwargs(doc).update(max_action_dim=kwargs(doc)["max_action_dim"] + 1)),
        ("horizon-capacity-mismatch", lambda doc: kwargs(doc).update(max_action_horizon=kwargs(doc)["max_action_horizon"] + 1)),
        ("boolean-capacity", lambda doc: kwargs(doc).update(max_action_dim=True)),
        ("invalid-processor-flag", lambda doc: kwargs(doc).update(use_relative_action="true")),
        ("action-representation-count", lambda doc: modalities(doc)["action"]["action_configs"].pop()),
        ("action-representation-type", lambda doc: modalities(doc)["action"]["action_configs"][0].update(type="EEF")),
        ("action-representation-format", lambda doc: modalities(doc)["action"]["action_configs"][0].update(format="unsupported")),
        ("action-reference", lambda doc: modalities(doc)["action"]["action_configs"][0].update(state_key="unsupported")),
    ]
    for kind in ("video", "state", "action"):
        derivatives.extend([
            (f"{kind}-key-order", lambda doc, kind=kind: modalities(doc)[kind]["modality_keys"].reverse()),
            (f"{kind}-duplicate-key", lambda doc, kind=kind: modalities(doc)[kind]["modality_keys"].append(modalities(doc)[kind]["modality_keys"][0])),
            (f"{kind}-unknown-encoding", lambda doc, kind=kind: modalities(doc)[kind].update(sin_cos_embedding_keys=["unsupported"])),
        ])
    for kind in ("video", "state", "action", "language"):
        derivatives.append((f"{kind}-temporal-indices", lambda doc, kind=kind: modalities(doc)[kind].update(delta_indices=[-1])))
    for processor_key, model_key, minimum in (
        ("max_state_dim", "max_state_dim", admitted["stateDimension"]),
        ("max_action_dim", "max_action_dim", admitted["actionDimension"]),
        ("max_action_horizon", "action_horizon", admitted["actionHorizon"]),
    ):
        def insufficient(doc, processor_key=processor_key, model_key=model_key, minimum=minimum):
            kwargs(doc)[processor_key] = minimum - 1
            doc["config.json"][model_key] = minimum - 1
        derivatives.append((f"insufficient-{processor_key}", insufficient))
    for kind in ("state", "action"):
        key = modalities(documents)[kind]["modality_keys"][0]
        derivatives.extend([
            (f"{kind}-missing-statistics", lambda doc, kind=kind, key=key: statistics(doc)[kind].pop(key)),
            (f"{kind}-statistic-dimension", lambda doc, kind=kind, key=key: statistics(doc)[kind][key]["mean"].pop()),
            (f"{kind}-boolean-statistic", lambda doc, kind=kind, key=key: statistics(doc)[kind][key]["mean"].__setitem__(0, True)),
            (f"{kind}-string-statistic", lambda doc, kind=kind, key=key: statistics(doc)[kind][key]["mean"].__setitem__(0, "1")),
            (f"{kind}-negative-standard-deviation", lambda doc, kind=kind, key=key: statistics(doc)[kind][key]["std"].__setitem__(0, -1)),
        ])
        for lower, upper in (("min", "max"), ("q01", "q99")):
            def reversed_bounds(doc, kind=kind, key=key, lower=lower, upper=upper):
                stats = statistics(doc)[kind][key]
                stats[lower][0] = stats[upper][0] + 1
            def overflowing_range(doc, kind=kind, key=key, lower=lower, upper=upper):
                stats = statistics(doc)[kind][key]
                stats[lower][0], stats[upper][0] = -1e308, 1e308
            derivatives.extend([(f"{kind}-{lower}-{upper}-order", reversed_bounds),
                                (f"{kind}-{lower}-{upper}-range", overflowing_range)])
    if provider == "behavior":
        derivatives.extend([
            ("relative-action-disabled", lambda doc: kwargs(doc).update(use_relative_action=False)),
            ("relative-configurations-missing", lambda doc: modalities(doc)["action"].update(action_configs=None)),
            ("relative-representation", lambda doc: modalities(doc)["action"]["action_configs"][1].update(rep="ABSOLUTE")),
            ("relative-state-reference", lambda doc: modalities(doc)["action"]["action_configs"][1].update(state_key="arm_left_qpos")),
            ("relative-statistics-missing", lambda doc: statistics(doc)["relative_action"].pop("torso")),
            ("relative-statistic-horizon", lambda doc: statistics(doc)["relative_action"]["torso"]["mean"].pop()),
            ("relative-statistic-dimension", lambda doc: statistics(doc)["relative_action"]["torso"]["mean"][0].pop()),
            ("language-key", lambda doc: modalities(doc)["language"].update(modality_keys=["unsupported"])),
        ])
    else:
        derivatives.append(("absolute-action-representation", lambda doc: modalities(doc)["action"]["action_configs"][0].update(rep="RELATIVE")))
    for name, operation in derivatives:
        sample = deepcopy(documents)
        operation(sample)
        directory = output / "derivatives" / name
        directory.mkdir(parents=True)
        for filename in names:
            if sample[filename] == documents[filename]:
                shutil.copyfile(checkpoint / filename, directory / filename)
            else:
                (directory / filename).write_text(json.dumps(sample[filename], allow_nan=False) + "\n", encoding="utf-8")
        try:
            adapter(str(directory), device="cpu")
        except (ValueError, KeyError, ValidationError) as error:
            cases.append({"name": name, "result": "rejected", "originalError": str(error),
                          "derivativeSha256": {filename: sha256((directory / filename).read_bytes()).hexdigest() for filename in names}})
        else:
            raise AssertionError(f"Invalid checkpoint configuration reached policy construction: {name}")
    if any(name == "torch" or name.startswith("gr00t") for name in sys.modules):
        raise ValueError("Configuration admission imported a model SDK.")
    if any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("Original checkpoint/source files changed during configuration admission.")
    report = {"provider": provider, "sources": sources, "cases": cases, "originalFilesUnchanged": True,
              "modelSdkImported": False, "modelLoads": 0, "modelCalls": 0, "gpuJobs": 0,
              "environmentAllocations": 0, "controls": 0,
              "scope": "Actual checkpoint metadata and declared invalid derivatives through production constructor admission; no NN or task acceptance."}
    (output / "acceptance.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"provider": provider, "cases": len(cases), "sources": len(sources), "modelLoads": 0}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", required=True, choices=("behavior", "robocasa"))
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    inspect(args.provider, args.checkpoint, args.output)
