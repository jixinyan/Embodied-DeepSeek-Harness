import argparse
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
from time import monotonic
from uuid import uuid4

from physical_harness.policies.openpi_audit import verify_actions, verify_request_inputs
from physical_harness.policies.openpi_robodojo import OpenPiRoboDojoPolicy
from physical_harness.validation import ContractValidator


def main():
    parser = argparse.ArgumentParser(description="Check real OpenPI reconnection and interleaved client identity on a retained native observation.")
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--native-policy-uri", required=True)
    parser.add_argument("--checkpoint-sha256", required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    original_bytes = args.request.read_bytes()
    original = json.loads(original_bytes)
    validator = ContractValidator.from_path(args.schema)
    validator.parse("PolicyRequest", original)
    if original["observation"].get("environment") != "robodojo":
        raise ValueError("The probe requires an original native RoboDojo policy observation.")
    args.output_directory.mkdir(parents=True, exist_ok=False)
    records = []

    def infer(client, name):
        request = deepcopy(original)
        request["request_id"] = str(uuid4())
        request["valid_until"] = (datetime.now(timezone.utc) + timedelta(seconds=600)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        validator.parse("PolicyRequest", request)
        started = monotonic()
        actions, record = client.infer(request)
        verify_actions(record)
        verify_request_inputs(request, record)
        if actions != record["actions"][:request["max_actions"]]:
            raise ValueError("The live result differs from its source-bound native action prefix.")
        if records and record["inference_index"] <= records[-1]["inference"]["inference_index"]:
            raise ValueError("The actual native service inference index did not advance.")
        result = {"client": name, "request": request, "inference": record,
                  "admitted_actions": actions, "elapsed_s": monotonic() - started}
        with (args.output_directory / f"inference-{len(records) + 1}.json").open("x", encoding="utf-8") as stream:
            json.dump(result, stream, indent=2, allow_nan=False)
        records.append(result)
        print(json.dumps({"client": name, "request_id": request["request_id"],
                          "inference_index": record["inference_index"], "elapsed_s": result["elapsed_s"]}), flush=True)

    first = OpenPiRoboDojoPolicy(args.native_policy_uri, args.checkpoint_sha256)
    try:
        infer(first, "first")
        second = OpenPiRoboDojoPolicy(args.native_policy_uri, args.checkpoint_sha256)
        try:
            infer(second, "second")
            infer(first, "first")
        finally:
            second.close()
    finally:
        first.close()
    reconnected = OpenPiRoboDojoPolicy(args.native_policy_uri, args.checkpoint_sha256)
    try:
        infer(reconnected, "reconnected")
    finally:
        reconnected.close()
    if args.request.read_bytes() != original_bytes:
        raise ValueError("The source native policy observation changed during inference admission.")
    report = {
        "scope": "Actual checkpoint inference, interleaved clients and connection replacement on retained native RGB/state",
        "source_request": str(args.request.resolve()), "source_request_sha256": sha256(original_bytes).hexdigest(),
        "checkpoint_sha256": args.checkpoint_sha256,
        "request_identity_version": "edh.openpi.request_identity.v1",
        "inference_indices": [item["inference"]["inference_index"] for item in records],
        "request_ids": [item["request"]["request_id"] for item in records],
        "completed_inferences": len(records), "source_unchanged": True,
        "physical_controls": 0, "task_completion_acceptance": False,
    }
    with (args.output_directory / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
    print(json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
