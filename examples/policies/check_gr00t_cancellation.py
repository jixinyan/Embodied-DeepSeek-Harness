from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
from time import monotonic

from websockets.asyncio.client import connect


async def exchange(uri: str, request: dict) -> dict:
    async with connect(uri, proxy=None, compression=None, close_timeout=1, max_size=32 * 1024 * 1024) as connection:
        await connection.send(json.dumps(request, allow_nan=False))
        return json.loads(await asyncio.wait_for(connection.recv(), timeout=120))


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--uri", default="ws://127.0.0.1:8003")
    parser.add_argument("--first-request", type=Path, required=True)
    parser.add_argument("--second-request", type=Path, required=True)
    parser.add_argument("--settle-seconds", type=float, default=70)
    args = parser.parse_args()
    first_request = json.loads(args.first_request.read_text(encoding="utf-8"))
    second_request = json.loads(args.second_request.read_text(encoding="utf-8"))
    if first_request["request_id"] == second_request["request_id"]:
        raise ValueError("Cancellation check requires two recorded request identities.")
    if first_request["observation"]["source_observation_id"] != first_request["observation_id"]:
        raise ValueError("First recorded observation identity is inconsistent.")
    if second_request["observation"]["source_observation_id"] != second_request["observation_id"]:
        raise ValueError("Second recorded observation identity is inconsistent.")
    if args.settle_seconds <= 0 or args.settle_seconds > 120:
        raise ValueError("Settle interval must be within the policy server timeout.")

    started = monotonic()
    async with connect(args.uri, proxy=None, compression=None, close_timeout=1, max_size=32 * 1024 * 1024) as first:
        await first.send(json.dumps(first_request, allow_nan=False))
        await asyncio.sleep(0.02)
        await first.close()
    busy = await exchange(args.uri, second_request)
    if busy != {"error": "policy_inference_failed"}:
        raise AssertionError(f"Concurrent inference was admitted: {busy}")
    await asyncio.sleep(args.settle_seconds)
    completed = await exchange(args.uri, second_request)
    if completed.get("request_id") != second_request["request_id"] or not completed.get("actions"):
        raise AssertionError(f"Policy service did not recover after the cancelled request: {completed}")
    if completed.get("action_spec") != second_request["action_spec"]:
        raise AssertionError("Recovered policy response changed the recorded ActionSpec.")
    print(json.dumps({
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "first_request_id": first_request["request_id"],
        "second_request_id": second_request["request_id"],
        "first_client_closed": True,
        "concurrent_response": busy,
        "recovered_action_count": len(completed["actions"]),
        "recovered_action_width": len(completed["actions"][0]),
        "duration_s": monotonic() - started,
        "simulator_control_sent": False,
    }), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
