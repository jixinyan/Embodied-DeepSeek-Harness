from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
import json
import signal
from time import monotonic

from physical_harness.policies.inference import ThreadedInference, recorded_inference
from physical_harness.policies.provenance import checkpoint_identity
from physical_harness.policies.server import serve_policy
from physical_harness.validation import ContractValidator
from . import REPOSITORY_ROOT


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8003)
    args = parser.parse_args()
    root = REPOSITORY_ROOT
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    owner = ThreadedInference("edh-gr00t")

    def infer_recorded(request: dict) -> list[list[float]]:
        started = monotonic()
        received_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        actions, model_actions = policy.infer_with_record(request)
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
            "requested_max_actions": request["max_actions"],
            "model_horizon": len(model_actions),
            "sent_actions": len(actions),
            "model_actions": model_actions,
            "actions": actions,
        }), flush=True)
        return actions

    async def infer(request: dict) -> list[list[float]]:
        return await owner.run(recorded_inference, infer_recorded, request, identity)

    try:
        async with await serve_policy(infer, validator, host=args.host, port=args.port,
                                      timeout_s=120, start_serving=False) as server:
            identity = checkpoint_identity(args.checkpoint, root / "examples/policies/gr00t-n1d6-robocasa.json")
            from physical_harness.policies.gr00t_n1d6_robocasa import Gr00tN1d6RoboCasa
            policy = Gr00tN1d6RoboCasa(args.checkpoint, device=args.device)
            await server.start_serving()
            print(json.dumps({
                "service": "gr00t-n1d6-robocasa-pandaomron",
                "source": "NVIDIA/Isaac-GR00T@n1d6:9b37aa1ce69c73c6d165233fa88128283bba4508",
                **identity,
                "device": args.device,
                "host": args.host,
                "port": server.sockets[0].getsockname()[1],
            }), flush=True)
            stop = asyncio.Event()
            loop = asyncio.get_running_loop()
            loop.add_signal_handler(signal.SIGINT, stop.set)
            loop.add_signal_handler(signal.SIGTERM, stop.set)
            await stop.wait()
    finally:
        await owner.close()


if __name__ == "__main__":
    asyncio.run(main())
