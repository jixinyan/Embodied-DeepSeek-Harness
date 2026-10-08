import argparse
import asyncio
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
from time import monotonic

from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.validation import ContractValidator


async def run(args: argparse.Namespace) -> None:
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local" / "work") or output.exists():
        raise ValueError("Inference diagnostic requires a new output under .local/work.")
    source = args.request.resolve(strict=True)
    source_hash = sha256(source.read_bytes()).hexdigest()
    validator = ContractValidator.from_path(args.schema_path)
    request = json.loads(args.request.read_text(encoding="utf-8"))
    validator.parse("PolicyRequest", request)
    client = WebSocketPolicyClient(args.policy_uri, validator, timeout_s=args.timeout_s,
                                  api_key=os.environ[args.api_key_env] if args.api_key_env else None)
    started = monotonic()
    try:
        response = await client.infer(request)
    finally:
        await client.close()
    if sha256(source.read_bytes()).hexdigest() != source_hash:
        raise ValueError("Recorded request changed during policy inference.")
    report = {
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "request_id": request["request_id"],
        "observation_id": request["observation_id"],
        "source_request": str(source),
        "source_request_sha256": source_hash,
        "elapsed_inference_s": monotonic() - started,
        "action_count": len(response["actions"]),
        "response": response,
        "source_files_unchanged": True,
        "physical_controls_performed": False,
        "checkpoint_source_audit_required": True,
        "scope": "Actual policy endpoint response on a recorded input; checkpoint provenance and simulator acceptance require independent evidence.",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "response"}), flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema-path", required=True, type=Path)
    parser.add_argument("--request", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--policy-uri", required=True)
    parser.add_argument("--api-key-env")
    parser.add_argument("--timeout-s", type=float, default=600)
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
