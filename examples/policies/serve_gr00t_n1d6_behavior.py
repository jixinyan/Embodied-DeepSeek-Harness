from __future__ import annotations

import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import signal
import sys
from threading import BoundedSemaphore
from time import monotonic
import traceback

from physical_harness.policies.gr00t_n1d6_behavior import Gr00tN1d6Behavior
from physical_harness.policies.provenance import checkpoint_identity
from physical_harness.policies.server import serve_policy
from physical_harness.validation import ContractValidator


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8007)
    parser.add_argument("--timeout-s", type=float, default=600)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    identity = checkpoint_identity(args.checkpoint, root / "examples/policies/gr00t-n1d6-behavior.json")
    if identity["checkpoint_revision"] is None:
        raise ValueError("BEHAVIOR GR00T checkpoint differs from the pinned revision.")
    policy = Gr00tN1d6Behavior(args.checkpoint, device=args.device)
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="edh-gr00t-behavior")
    admission = BoundedSemaphore(1)

    async def infer(request: dict) -> list[list[float]]:
        if not admission.acquire(blocking=False):
            raise RuntimeError("BEHAVIOR GR00T inference is already in progress.")
        started = monotonic()
        received_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        future = executor.submit(policy.infer_with_record, request)

        def completed(result):
            admission.release()
            error = result.exception()
            if error is not None:
                print(json.dumps({"event": "policy_inference_failed", **identity,
                      "request_id": request["request_id"], "execution_id": request["execution_id"],
                      "task_scope": request["task_scope"], "generation": request["generation"],
                      "observation_id": request["observation_id"], "error_type": type(error).__name__,
                      "error": str(error)}), flush=True)
                traceback.print_exception(error, file=sys.stderr)

        future.add_done_callback(completed)
        actions, model_actions = await asyncio.wrap_future(future)
        print(json.dumps({
            "event": "policy_inference_completed",
            **identity,
            "request_id": request["request_id"],
            "execution_id": request["execution_id"],
            "task_scope": request["task_scope"],
            "generation": request["generation"],
            "observation_id": request["observation_id"],
            "received_at": received_at,
            "completed_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "duration_s": monotonic() - started,
            "action_count": len(actions),
            "actions": actions,
            "model_actions": model_actions,
            "native_action_conversion": "omnigibson-r1pro-controller-clipping-v1",
        }), flush=True)
        return actions

    server = await serve_policy(infer, validator, host=args.host, port=args.port, timeout_s=args.timeout_s)
    print(json.dumps({
        "service": "gr00t-n1d6-behavior-r1pro",
        "source": "NVIDIA/Isaac-GR00T@n1d6:9b37aa1ce69c73c6d165233fa88128283bba4508",
        **identity,
        "device": args.device,
        "host": args.host,
        "port": server.sockets[0].getsockname()[1],
        "timeout_s": args.timeout_s,
    }), flush=True)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    loop.add_signal_handler(signal.SIGINT, stop.set)
    loop.add_signal_handler(signal.SIGTERM, stop.set)
    await stop.wait()
    server.close()
    await server.wait_closed()
    await loop.run_in_executor(None, executor.shutdown, True)


if __name__ == "__main__":
    asyncio.run(main())
