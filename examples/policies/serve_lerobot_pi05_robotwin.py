from __future__ import annotations

import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import signal
from threading import BoundedSemaphore
from time import monotonic

from physical_harness.policies.lerobot_pi05_robotwin import LeRobotPi05RoboTwin
from physical_harness.policies.provenance import checkpoint_identity
from physical_harness.policies.server import serve_policy
from physical_harness.validation import ContractValidator


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--tokenizer", required=True)
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8004)
    parser.add_argument("--timeout-s", type=float, default=120)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    identity = checkpoint_identity(args.checkpoint, root / "examples/policies/lerobot-pi05-robotwin.json")
    policy = LeRobotPi05RoboTwin(args.checkpoint, args.tokenizer, device=args.device)
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="edh-lerobot-pi05")
    admission = BoundedSemaphore(1)

    async def infer(request: dict) -> list[list[float]]:
        if not admission.acquire(blocking=False):
            raise RuntimeError("LeRobot π0.5 inference is already in progress.")
        started = monotonic()
        received_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        future = executor.submit(policy.infer_with_record, request)
        future.add_done_callback(lambda _: admission.release())
        actions, model_actions = await asyncio.wrap_future(future)
        print(json.dumps({
            "event": "policy_inference_completed",
            **identity,
            "tokenizer_revision": "35e4f46485b4d07967e7e9935bc3786aad50687c",
            "request_id": request["request_id"],
            "execution_id": request["execution_id"],
            "task_scope": request["task_scope"],
            "generation": request["generation"],
            "observation_id": request["observation_id"],
            "received_at": received_at,
            "completed_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "duration_s": monotonic() - started,
            "model_actions": model_actions,
            "actions": actions,
        }), flush=True)
        return actions

    server = await serve_policy(infer, validator, host=args.host, port=args.port, timeout_s=args.timeout_s)
    print(json.dumps({
        "service": "lerobot-pi05-robotwin-aloha-agilex",
        "policy_source": "huggingface/lerobot@v0.6.1:7e241bd630a3719a56157a497ce5d08f244784f1",
        **identity,
        "tokenizer_revision": "35e4f46485b4d07967e7e9935bc3786aad50687c",
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
