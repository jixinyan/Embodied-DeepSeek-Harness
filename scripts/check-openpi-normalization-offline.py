import argparse
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import sys

from jsonschema import ValidationError

from physical_harness.policies.openpi_checkpoint import verify_arx_x5_normalization
from physical_harness.policies.provenance import validate_checkpoint_sha256


def inspect(args):
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Normalization inspection output must remain under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    checkpoint = args.checkpoint.resolve(strict=True)
    original = checkpoint / "assets/arx_x5_sim/norm_stats.json"
    original_data = original.read_bytes()
    if sha256(original_data).hexdigest() != args.expected_sha256:
        raise AssertionError("The original normalization file differs from its selected identity.")
    accepted = verify_arx_x5_normalization(checkpoint)
    if accepted["sha256"] != args.expected_sha256 or accepted["dimensions"] != {"state": 14, "actions": 14}:
        raise AssertionError("The selected original ARX X5 normalization was not admitted.")
    document = json.loads(original_data)
    cases = []
    missing = output / "missing-normalization"
    missing.mkdir()
    try:
        verify_arx_x5_normalization(missing)
    except FileNotFoundError as error:
        if error.filename != str(missing / "assets"):
            raise
        cases.append({"case": "missing-normalization", "originalError": type(error).__name__})
    else:
        raise AssertionError("A checkpoint directory without its normalization file was admitted.")
    for name, expected_error in (
            ("missing-state", ValidationError), ("missing-quantile", ValidationError),
            ("incorrect-dimensions", ValidationError), ("boolean-value", ValidationError),
            ("negative-std", ValidationError), ("nonfinite-value", ValueError),
            ("reversed-quantiles", ValueError)):
        invalid = deepcopy(document)
        statistics = invalid["norm_stats"]["state"]
        if name == "missing-state":
            del invalid["norm_stats"]["state"]
        elif name == "missing-quantile":
            del statistics["q01"]
        elif name == "incorrect-dimensions":
            statistics["mean"].pop()
        elif name == "boolean-value":
            statistics["q99"][0] = True
        elif name == "negative-std":
            statistics["std"][0] = -1
        elif name == "nonfinite-value":
            statistics["mean"][0] = float("nan")
        elif name == "reversed-quantiles":
            statistics["q99"][0] = statistics["q01"][0] - 1
        invalid_root = output / name
        invalid_file = invalid_root / "assets/arx_x5_sim/norm_stats.json"
        invalid_file.parent.mkdir(parents=True)
        with invalid_file.open("x", encoding="utf-8") as stream:
            json.dump(invalid, stream, allow_nan=name == "nonfinite-value")
        try:
            verify_arx_x5_normalization(invalid_root)
        except expected_error as error:
            cases.append({"case": name, "originalError": type(error).__name__,
                          "inputSha256": sha256(invalid_file.read_bytes()).hexdigest(),
                          "input": "Explicit invalid derivative of the original normalization document."})
        else:
            raise AssertionError(f"Invalid normalization was admitted: {name}")
    if original.read_bytes() != original_data or verify_arx_x5_normalization(checkpoint) != accepted:
        raise AssertionError("Normalization inspection changed its original artifact.")
    if any(name.split(".")[0] in {"jax", "torch", "gr00t", "lerobot", "openpi", "transformers"} for name in sys.modules):
        raise AssertionError("Normalization inspection imported a model SDK.")
    sources = [Path(__file__), root / "harness/physical-runtime/src/physical_harness/policies/openpi_checkpoint.py",
               root / "harness/physical-runtime/src/physical_harness/policies/provenance.py"]
    report = {"sources": {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in sources},
              "originalNormalization": accepted, "cases": cases, "originalFileUnchanged": True,
              "modelSdkImported": False, "gpuJobs": 0, "modelLoads": 0, "modelCalls": 0,
              "environmentAllocations": 0, "controls": 0,
              "scope": "Actual original normalization file admission and declared invalid derivative rejection; no complete checkpoint, model inference or task acceptance."}
    with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
    print(json.dumps({"cases": len(cases), "state": "passed", "gpuJobs": 0}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--expected-sha256", type=validate_checkpoint_sha256, required=True)
    parser.add_argument("--output", type=Path, required=True)
    inspect(parser.parse_args())
