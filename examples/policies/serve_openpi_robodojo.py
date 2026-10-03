import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import signal
from threading import BoundedSemaphore

from physical_harness.policies.openpi_robodojo import OpenPiRoboDojoPolicy
from physical_harness.policies.server import serve_policy
from physical_harness.validation import ContractValidator


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--native-policy-uri", required=True)
    parser.add_argument("--checkpoint-sha256", required=True)
    parser.add_argument("--port", type=int, default=18831)
    parser.add_argument("--audit-directory", type=Path)
    args = parser.parse_args()
    if args.audit_directory is not None:
        args.audit_directory.mkdir(parents=True, exist_ok=False)
    root = Path(__file__).resolve().parents[2]
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    policy = OpenPiRoboDojoPolicy(args.native_policy_uri, args.checkpoint_sha256)
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="edh-openpi-robodojo")
    admission = BoundedSemaphore(1)

    async def infer(request):
        if not admission.acquire(blocking=False):
            raise RuntimeError("OpenPI RoboDojo inference is already in progress.")
        if args.audit_directory is not None:
            with (args.audit_directory / f"{request['request_id']}.request.json").open("x", encoding="utf-8") as stream:
                json.dump(request, stream, allow_nan=False)
        future = executor.submit(policy.infer, request)
        future.add_done_callback(lambda _: admission.release())
        actions, record = await asyncio.wrap_future(future)
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

    server = await serve_policy(infer, validator, port=args.port, timeout_s=300)
    print(json.dumps({"service": "openpi-robodojo-json", "port": args.port,
                      "checkpoint_sha256": args.checkpoint_sha256, "metadata": policy.metadata}), flush=True)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for item in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(item, stop.set)
    try:
        await stop.wait()
    finally:
        server.close()
        await server.wait_closed()
        await loop.run_in_executor(None, executor.shutdown, True)
        policy.close()


if __name__ == "__main__":
    asyncio.run(main())
