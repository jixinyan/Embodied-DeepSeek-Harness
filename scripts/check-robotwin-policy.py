import argparse
import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path

from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.validation import ContractValidator


async def run(request_path: Path, schema_path: Path, uri: str, output_path: Path, timeout_s: float) -> None:
    validator = ContractValidator.from_path(schema_path)
    request = json.loads(request_path.read_text(encoding="utf-8"))
    validator.parse("PolicyRequest", request)
    valid_until = datetime.fromisoformat(request["valid_until"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) >= valid_until:
        raise ValueError("PolicyRequest observation has expired.")
    started_at = datetime.now(timezone.utc).isoformat()
    client = WebSocketPolicyClient(uri, validator, timeout_s=timeout_s)
    try:
        response = await client.infer(request)
    finally:
        await client.close()
    completed_at = datetime.now(timezone.utc).isoformat()
    result = {
        "started_at": started_at,
        "completed_at": completed_at,
        "request_id": request["request_id"],
        "execution_id": request["execution_id"],
        "observation_id": request["observation_id"],
        "action_spec": response["action_spec"],
        "actions": response["actions"],
    }
    output_path.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("request_id", "execution_id", "observation_id", "started_at", "completed_at")}, indent=2))
    print(f"action_count={len(result['actions'])} action_width={len(result['actions'][0])}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", required=True, type=Path)
    parser.add_argument("--schema", required=True, type=Path)
    parser.add_argument("--uri", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--timeout-s", type=float, default=120)
    args = parser.parse_args()
    asyncio.run(run(args.request, args.schema, args.uri, args.output, args.timeout_s))


if __name__ == "__main__":
    main()
