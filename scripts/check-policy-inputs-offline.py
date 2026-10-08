import argparse
import base64
from copy import deepcopy
from hashlib import sha256
import importlib.util
from io import BytesIO
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image

from physical_harness.policies.observation_inputs import decode_camera, decode_state, read_policy_observation
from physical_harness.policies.openpi_audit import task_sources
from physical_harness.validation import ContractValidator


def inspect(configuration: Path, output: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    output = output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Policy input checks require a new output under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    sources = {}

    def original(path):
        resolved = Path(path).resolve(strict=True)
        sources[str(resolved)] = sha256(resolved.read_bytes()).hexdigest()
        return resolved

    document = json.loads(original(configuration).read_bytes())
    audit_path = original(root / "scripts/audit-recorded-run.py")
    spec = importlib.util.spec_from_file_location("edh_original_policy_input_audit", audit_path)
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)
    validator = ContractValidator.from_path(original(root / "harness/contracts/schema/physical.schema.json"))
    records = []
    for entry in document["conventional"]:
        run = json.loads(original(entry["run"]).read_bytes())
        provider, _, requests, _ = audit.conventional_policy_sources(
            run, Path(entry["requests"]), original(entry["serviceLog"]), original(entry["manifest"]),
            root / "harness/contracts/schema/physical.schema.json",
        )
        request_id = sorted(requests)[0]
        original(Path(entry["requests"]) / f"{request_id}.json")
        records.append((provider, run["id"], requests[request_id], None))
    entry = document["openpiTask"]
    run = json.loads(original(entry["run"]).read_bytes())
    inferences, requests, _ = task_sources(
        run, Path(entry["requests"]), Path(entry["bridgeDirectory"]), original(entry["bridgeLog"]),
        original(entry["nativeLog"]), original(entry["verification"]), validator, entry["policyId"],
    )
    request_id = sorted(requests)[0]
    original(Path(entry["requests"]) / f"{request_id}.json")
    original(Path(entry["bridgeDirectory"]) / f"{request_id}.request.json")
    original(Path(entry["bridgeDirectory"]) / f"{request_id}.inference.json")
    records.append(("robodojo", run["id"], requests[request_id], inferences[request_id]))
    if {item[0] for item in records} != {"behavior", "robocasa", "robotwin", "robodojo"}:
        raise ValueError("Original policy inputs must cover all four providers exactly once.")
    for name in ("observation_inputs.py", "gr00t_n1d6_behavior.py", "gr00t_n1d6_robocasa.py",
                 "lerobot_pi05_robotwin.py", "openpi_robodojo.py", "openpi_audit.py"):
        original(root / "harness/physical-runtime/src/physical_harness/policies" / name)
    original(Path(__file__).resolve())
    cases, original_inputs = [], []

    def rejected(name, operation):
        try:
            operation()
        except ValueError as error:
            cases.append({"name": name, "result": "rejected", "originalError": str(error)})
        else:
            raise AssertionError(f"Invalid policy input was accepted: {name}")

    for provider, run_id, request, inference in records:
        before = deepcopy(request)
        embodiment_id = request["action_spec"]["embodiment_id"]
        observation = read_policy_observation(request, embodiment_id)
        camera_records, state_records = {}, {}
        for name, value in observation["cameras"].items():
            sizes = {"behavior": ((256, 256),), "robocasa": ((256, 256), (512, 512)),
                     "robotwin": ((640, 480),), "robodojo": ((value["width"], value["height"]),)}[provider]
            resized = (256, 256) if provider == "robocasa" else None
            decoded = decode_camera(value, expected_sizes=sizes, resize_to=resized)
            png = base64.b64decode(value["data_base64"], validate=True)
            with Image.open(BytesIO(png)) as image:
                if image.mode != "RGB":
                    raise ValueError("Original policy input has unsupported camera channels.")
                pixels = np.array(image, dtype=np.uint8, copy=True)
                native_size = image.size
            if resized is not None and native_size != resized:
                from cv2 import INTER_AREA, resize
                pixels = resize(pixels, resized, interpolation=INTER_AREA)
            if not np.array_equal(decoded, pixels):
                raise ValueError("Prepared camera pixels differ from the original native mapping.")
            camera_records[name] = {"sourcePngSha256": sha256(png).hexdigest(),
                                    "preparedRgbSha256": sha256(decoded.tobytes()).hexdigest(),
                                    "shape": list(decoded.shape)}
            if inference is not None and sha256(np.transpose(decoded, (2, 0, 1)).tobytes()).hexdigest() != inference["camera_sha256"][name]:
                raise ValueError("Prepared OpenPI camera differs from its actual inference record.")
        for name, value in observation["proprioception"].items():
            decoded = decode_state(value, len(value))
            if decoded.dtype != np.float32 or not np.isfinite(decoded).all():
                raise ValueError("Original policy state did not prepare as finite float32.")
            state_records[name] = {"preparedFloat32Sha256": sha256(decoded.tobytes()).hexdigest(),
                                   "dimension": len(value)}
            if inference is not None and sha256(decoded.tobytes()).hexdigest() != inference["state_sha256"]:
                raise ValueError("Prepared OpenPI state differs from its actual inference record.")
        original_inputs.append({"provider": provider, "runId": run_id, "requestId": request["request_id"],
                                "cameras": camera_records, "states": state_records})
        cases.append({"name": f"{provider}.original-observation", "result": "passed"})
        for field, value in (("schema_version", "unsupported"), ("source_observation_id", "unadmitted"),
                             ("embodiment_id", "unadmitted"), ("cameras", None)):
            invalid = deepcopy(request)
            invalid["observation"][field] = value
            rejected(f"{provider}.{field}", lambda: read_policy_observation(invalid, embodiment_id))
        values = next(iter(observation["proprioception"].values()))
        for name, value in (("boolean-state", True), ("nan-state", float("nan")),
                            ("positive-overflow-state", 1e40), ("negative-overflow-state", -1e40),
                            ("string-state", "1")):
            invalid = deepcopy(values)
            invalid[0] = value
            rejected(f"{provider}.{name}", lambda: decode_state(invalid, len(values)))
        rejected(f"{provider}.state-dimension", lambda: decode_state(values[:-1], len(values)))
        camera = next(iter(observation["cameras"].values()))
        sizes = ((camera["width"], camera["height"]),)
        for field, value in (("mime_type", "image/jpeg"), ("width", camera["width"] + 1),
                             ("data_base64", "invalid!"), ("height", True)):
            invalid = deepcopy(camera)
            invalid[field] = value
            rejected(f"{provider}.camera-{field}", lambda: decode_camera(invalid, expected_sizes=sizes))
        if request != before:
            raise ValueError("Original policy request changed during input checks.")
    if any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in sources.items()):
        raise ValueError("Original input/source file changed during policy checks.")
    if any(name == "torch" or name.startswith(("lerobot", "gr00t", "openpi_client")) for name in sys.modules):
        raise ValueError("Offline policy input checks imported a model SDK.")
    report = {"sources": sources, "cases": cases, "originalInputs": original_inputs,
              "originalFilesUnchanged": True, "modelSdkImported": False, "modelCalls": 0,
              "gpuJobs": 0, "environmentAllocations": 0, "controls": 0,
              "scope": "Actual original policy input decoding and declared invalid derivatives; no model or task acceptance."}
    (output / "acceptance.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"cases": len(cases), "providers": len(original_inputs), "stateGroups": sum(len(item["states"]) for item in original_inputs),
                      "cameras": sum(len(item["cameras"]) for item in original_inputs), "modelCalls": 0}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--configuration", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    inspect(args.configuration, args.output)
