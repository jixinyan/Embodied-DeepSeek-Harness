import argparse
import asyncio
import json
from pathlib import Path
import signal

from physical_harness.policies.inference import ThreadedInference, recorded_inference
from physical_harness.policies.server import serve_policy
from physical_harness.validation import ContractValidator
from . import REPOSITORY_ROOT


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--native-policy-uri", required=True)
    parser.add_argument("--checkpoint-sha256", required=True)
    parser.add_argument("--port", type=int, default=18831)
    parser.add_argument("--audit-directory", type=Path)
    args = parser.parse_args()
    if args.audit_directory is not None:
        args.audit_directory.mkdir(parents=True, exist_ok=False)
    root = REPOSITORY_ROOT
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    policy = None
    owner = ThreadedInference("edh-openpi-robodojo")

    def infer_recorded(request):
        if args.audit_directory is not None:
            with (args.audit_directory / f"{request['request_id']}.request.json").open("x", encoding="utf-8") as stream:
                json.dump(request, stream, allow_nan=False)
        actions, record = policy.infer(request)
        if args.audit_directory is not None:
            with (args.audit_directory / f"{request['request_id']}.inference.json").open("x", encoding="utf-8") as stream:
                json.dump({"request_id": request["request_id"], "execution_id": request["execution_id"],
                           "task_scope": request["task_scope"], "generation": request["generation"],
                           "observation_id": request["observation_id"], "admitted_actions": actions,
                           **record}, stream, allow_nan=False)
        print(json.dumps({"event": "policy_inference_completed", "request_id": request["request_id"],
                          "execution_id": request["execution_id"], "task_scope": request["task_scope"],
                          "generation": request["generation"], "observation_id": request["observation_id"],
                          **record}, allow_nan=False), flush=True)
        return actions

    async def infer(request):
        return await owner.run(recorded_inference, infer_recorded, request,
                               {"checkpoint_sha256": args.checkpoint_sha256})

    try:
        async with await serve_policy(infer, validator, port=args.port, timeout_s=300,
                                      start_serving=False) as server:
            from physical_harness.policies.openpi_robodojo import OpenPiRoboDojoPolicy
            policy = OpenPiRoboDojoPolicy(args.native_policy_uri, args.checkpoint_sha256)
            await server.start_serving()
            print(json.dumps({"service": "openpi-robodojo-json", "port": server.sockets[0].getsockname()[1],
                              "checkpoint_sha256": args.checkpoint_sha256, "metadata": policy.metadata}), flush=True)
            stop = asyncio.Event()
            loop = asyncio.get_running_loop()
            for item in (signal.SIGINT, signal.SIGTERM):
                loop.add_signal_handler(item, stop.set)
            await stop.wait()
    finally:
        try:
            await owner.close()
        finally:
            if policy is not None:
                policy.close()


if __name__ == "__main__":
    asyncio.run(main())
