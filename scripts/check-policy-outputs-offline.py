import argparse
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import sys

import numpy as np

from physical_harness.policies.action_outputs import read_action_array
from physical_harness.policies.openpi_audit import task_sources
from physical_harness.validation import ContractValidator


def inspect(configuration: Path, output: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    output = output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Policy output checks require a new output under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    sources = {}

    def original(path):
        resolved = Path(path).resolve(strict=True)
        sources[str(resolved)] = sha256(resolved.read_bytes()).hexdigest()
        return resolved

    document = json.loads(original(configuration).read_bytes())
    audit_path = original(root / "scripts/audit-recorded-run.py")
    spec = importlib.util.spec_from_file_location("edh_original_policy_output_audit", audit_path)
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)
    schema = original(root / "harness/contracts/schema/physical.schema.json")
    validator = ContractValidator.from_path(schema)
    records = []
    for entry in document["conventional"]:
        run = json.loads(original(entry["run"]).read_bytes())
        provider, inferences, requests, _ = audit.conventional_policy_sources(
            run, Path(entry["requests"]), original(entry["serviceLog"]),
            original(entry["manifest"]), schema,
        )
        request_id = sorted(requests)[0]
        original(Path(entry["requests"]) / f"{request_id}.json")
        record = inferences[request_id]
        field = "model_actions" if "model_actions" in record else "actions"
        records.append((provider, run["id"], request_id, record[field], field))
    entry = document["openpiTask"]
    run = json.loads(original(entry["run"]).read_bytes())
    inferences, requests, _ = task_sources(
        run, Path(entry["requests"]), Path(entry["bridgeDirectory"]),
        original(entry["bridgeLog"]), original(entry["nativeLog"]),
        original(entry["verification"]), validator, entry["policyId"],
    )
    request_id = sorted(requests)[0]
    original(Path(entry["requests"]) / f"{request_id}.json")
    original(Path(entry["bridgeDirectory"]) / f"{request_id}.request.json")
    original(Path(entry["bridgeDirectory"]) / f"{request_id}.inference.json")
    records.append(("robodojo", run["id"], request_id, inferences[request_id]["raw_actions"], "raw_actions"))
    if {item[0] for item in records} != {"behavior", "robocasa", "robotwin", "robodojo"}:
        raise ValueError("Original policy outputs must cover all four providers exactly once.")
    for name in ("action_outputs.py", "gr00t_n1d6_behavior.py", "gr00t_n1d6_robocasa.py",
                 "lerobot_pi05_robotwin.py", "openpi_robodojo.py", "openpi_audit.py"):
        original(root / "harness/physical-runtime/src/physical_harness/policies" / name)
    original(Path(__file__).resolve())
    cases, original_outputs = [], []

    def rejected(name, value, dimensions, *, float32=False):
        try:
            read_action_array(value, dimensions=dimensions, source=name, float32=float32)
        except ValueError as error:
            cases.append({"name": name, "result": "rejected", "originalError": str(error)})
        else:
            raise AssertionError(f"Invalid policy output was accepted: {name}")

    for provider, run_id, request_id, values, field in records:
        width = {"behavior": 23, "robocasa": 12, "robotwin": 14, "robodojo": 14}[provider]
        dimensions = (50, width) if provider == "robodojo" else (None, width)
        # JSON 记录恢复为数值数组，原始 SDK dtype 不属于此项验收。
        restored = np.array(values, dtype=np.float64)
        before = restored.copy()
        admitted = read_action_array(restored, dimensions=dimensions, source=provider)
        if admitted is not restored or not np.array_equal(admitted, before):
            raise ValueError("Recorded numeric output changed during admission.")
        cases.append({"name": f"{provider}.original-recorded-matrix", "result": "passed"})
        narrowed = read_action_array(restored, dimensions=dimensions, source=provider, float32=True)
        if narrowed.dtype != np.float32 or not np.isfinite(narrowed).all():
            raise ValueError("Recorded numeric output did not prepare as finite float32.")
        if provider == "robodojo" and narrowed.tolist() != values:
            raise ValueError("Prepared OpenPI actions differ from the original native float32 record.")
        cases.append({"name": f"{provider}.recorded-float32-admission", "result": "passed"})
        group = restored[None, ...]
        if not np.array_equal(read_action_array(group, dimensions=(1, None, width), source=provider)[0], before):
            raise ValueError("Recorded channel matrix changed during batched numeric admission.")
        cases.append({"name": f"{provider}.recorded-channel-batch", "result": "passed"})
        for name, value in (("list", values), ("boolean", restored.astype(np.bool_)),
                            ("string", restored.astype(str)), ("object", restored.astype(object)),
                            ("complex", restored.astype(np.complex128)),
                            ("empty-horizon", restored[:0]), ("rank", group),
                            ("channel-count", restored[:, :-1])):
            rejected(f"{provider}.{name}", value, dimensions)
        for name, value in (("nan", float("nan")), ("positive-infinity", float("inf")),
                            ("negative-infinity", -float("inf")),
                            ("positive-float32-overflow", 1e40), ("negative-float32-overflow", -1e40)):
            invalid = restored.copy()
            invalid[0, 0] = value
            rejected(f"{provider}.{name}", invalid, dimensions, float32=True)
        rejected(f"{provider}.batch-count", np.repeat(group, 2, axis=0), (1, None, width))
        rejected(f"{provider}.empty-batched-horizon", group[:, :0], (1, None, width))
        rejected(f"{provider}.batched-channel-count", group[:, :, :-1], (1, None, width))
        if not np.array_equal(restored, before):
            raise ValueError("Original recorded action matrix changed during output checks.")
        original_outputs.append({"provider": provider, "runId": run_id, "requestId": request_id,
                                 "recordField": field, "shape": list(restored.shape),
                                 "restoredFloat64Sha256": sha256(restored.tobytes()).hexdigest(),
                                 "preparedFloat32Sha256": sha256(narrowed.tobytes()).hexdigest()})
    if any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("Original input/source file changed during policy output checks.")
    if any(name == "torch" or name.startswith(("lerobot", "gr00t", "openpi_client")) for name in sys.modules):
        raise ValueError("Offline numeric output checks imported a model SDK.")
    report = {"sources": sources, "cases": cases, "originalOutputs": original_outputs,
              "originalFilesUnchanged": True, "modelSdkImported": False, "modelCalls": 0,
              "gpuJobs": 0, "environmentAllocations": 0, "controls": 0,
              "scope": "Original recorded numeric output admission and declared invalid derivatives; raw SDK groups, Torch conversions and loaded models require native acceptance."}
    (output / "acceptance.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"cases": len(cases), "providers": len(original_outputs), "modelCalls": 0}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    inspect(args.configuration, args.output)
