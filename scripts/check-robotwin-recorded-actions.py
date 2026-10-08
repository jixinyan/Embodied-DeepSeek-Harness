import argparse
from hashlib import sha256
import json
import math
from pathlib import Path

import torch

from physical_harness.policies.lerobot_pi05_robotwin import native_action_record
from physical_harness.validation import ContractValidator


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--record", required=True, type=Path)
    binding = parser.add_mutually_exclusive_group(required=True)
    binding.add_argument("--request", type=Path)
    binding.add_argument("--conversion-only", action="store_true")
    parser.add_argument("--schema-path", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    record = json.loads(args.record.read_text(encoding="utf-8"))
    root = Path(__file__).resolve().parents[1]
    manifest_path = root / "examples/policies/lerobot-pi05-robotwin.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if record["checkpoint_revision"] != manifest["upstream"]["checkpoint_revision"]:
        raise ValueError("Recorded model output has an unbound checkpoint revision.")
    sources = [args.record.resolve(), manifest_path]
    request = None
    if args.request:
        if not args.schema_path:
            raise ValueError("Request identity checking requires --schema-path.")
        request = json.loads(args.request.read_text(encoding="utf-8"))
        ContractValidator.from_path(args.schema_path).parse("PolicyRequest", request)
        if record["source_request_id"] != request["request_id"]:
            raise ValueError("Recorded model output belongs to another native request.")
        sources.extend([args.request.resolve(), args.schema_path.resolve()])
    elif args.schema_path:
        raise ValueError("--schema-path requires --request.")
    hashes = {str(path): sha256(path.read_bytes()).hexdigest() for path in sources}
    model_actions = record["model_actions"]
    if (not isinstance(model_actions, list) or not 1 <= len(model_actions) <= manifest["action"]["horizon"] or
            any(not isinstance(action, list) or len(action) != len(manifest["action"]["native_channels"]) or
                any(type(value) not in (int, float) or not math.isfinite(value) for value in action)
                for action in model_actions)):
        raise ValueError("Recorded model output requires finite native-sized action rows within its horizon.")
    native, raw = native_action_record(torch.tensor(model_actions, dtype=torch.float64, device="cpu"))
    if raw != model_actions or native != record["native_actions"]:
        raise ValueError("Recorded π0.5 conversion differs from the production adapter.")
    if request and (len(native) > request["max_actions"] or len(request["action_spec"]["channels"]) != len(native[0])):
        raise ValueError("Recorded native actions differ from the request budget or dimensions.")
    for model_action, native_action in zip(raw, native, strict=True):
        for index, (model_value, native_value) in enumerate(zip(model_action, native_action, strict=True)):
            if request:
                channel = request["action_spec"]["channels"][index]
                if not channel["minimum"] <= native_value <= channel["maximum"]:
                    raise ValueError(f"Native action exceeds its recorded channel {index} range.")
            if index not in (6, 13) and model_value != native_value:
                raise ValueError("Production adapter changed an arm joint target.")
    if any(sha256(Path(path).read_bytes()).hexdigest() != digest for path, digest in hashes.items()):
        raise ValueError("Recorded action source changed during conversion inspection.")
    report = {
        "request_id": record["source_request_id"],
        "requestIdentityChecked": request is not None,
        "checkpoint_revision": record["checkpoint_revision"],
        "sources": hashes,
        "action_count": len(native),
        "changed_channels": sorted({
            index for model_action, native_action in zip(raw, native, strict=True)
            for index, (model_value, native_value) in enumerate(zip(model_action, native_action, strict=True))
            if model_value != native_value
        }),
        "sourceFilesUnchanged": True,
        "newModelInferencePerformed": False,
        "newPhysicalControlsPerformed": False,
        "scope": "Production CPU conversion of original recorded model actions; no new inference or physical acceptance.",
    }
    if args.output:
        output = args.output.resolve()
        if not output.is_relative_to(root / ".local" / "work"):
            raise ValueError("Action diagnostic output must remain under .local/work.")
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("x", encoding="utf-8") as stream:
            stream.write(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    main()
