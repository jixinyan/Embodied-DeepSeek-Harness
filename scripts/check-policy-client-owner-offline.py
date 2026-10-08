import argparse
import asyncio
from hashlib import sha256
import json
import multiprocessing
import os
from pathlib import Path
import signal
import socket

import psutil
from websockets.asyncio.client import connect

from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.policies.server import serve_policy
from physical_harness.execution.policy_records import record_policy_request
from physical_harness.validation import ContractValidator


def serve_recorded_policy(schema: str, upstream_uri: str, directory: str, channel, ending) -> None:
    async def run() -> None:
        validator = ContractValidator.from_path(Path(schema))
        upstream = WebSocketPolicyClient(upstream_uri, validator, timeout_s=1)
        requests = []

        async def forward(request: dict) -> dict:
            requests.append(request["request_id"])
            record_policy_request(request, Path(directory))
            return await upstream.infer(request)

        server = await serve_policy(forward, validator)
        channel.send({"pid": os.getpid(), "port": server.sockets[0].getsockname()[1]})
        try:
            await asyncio.to_thread(ending.wait)
        finally:
            server.close()
            await server.wait_closed()
            await upstream.close()
            channel.send({"requests": requests, "connections": len(server.connections)})
            channel.close()

    asyncio.run(run())


async def inspect_case(root: Path, output: Path, request: dict, *, mode: str) -> dict:
    output.mkdir()
    (output / "requests").mkdir()
    schema = root / "harness/contracts/schema/physical.schema.json"
    validator = ContractValidator.from_path(schema)
    context = multiprocessing.get_context("spawn")
    parent_channel, child_channel = context.Pipe(duplex=False)
    ending = context.Event()
    upstream_endpoint = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    upstream_endpoint.bind(("127.0.0.1", 0))
    process = context.Process(target=serve_recorded_policy, args=(str(schema),
        f"ws://127.0.0.1:{upstream_endpoint.getsockname()[1]}", str(output / "requests"), child_channel, ending))
    process.start()
    child_channel.close()
    client = connection = None
    tasks = []
    stopped = False
    try:
        if not await asyncio.to_thread(parent_channel.poll, 10):
            raise TimeoutError("Actual policy server did not publish its listener identity.")
        ready = parent_channel.recv()
        if ready["pid"] != process.pid or not process.is_alive():
            raise AssertionError("Policy server differs from its actual owned process.")
        native_process = psutil.Process(process.pid)
        created_at = native_process.create_time()
        uri = f"ws://127.0.0.1:{ready['port']}"
        client = WebSocketPolicyClient(uri, validator)
        connection = await connect(uri, proxy=None, compression=None, close_timeout=1)
        client._connection = connection
        # 暂停本检查创建的 peer，等待实际连接关闭帧及确认。
        os.kill(process.pid, signal.SIGSTOP)
        stopped = True
        async with asyncio.timeout(3):
            while native_process.status() != psutil.STATUS_STOPPED:
                await asyncio.sleep(0)
        inference = None
        caller_cleanup = []
        if mode != "idle":
            async def infer_with_cleanup() -> dict:
                try:
                    return await client.infer(request)
                finally:
                    await client.close()
                    caller_cleanup.append(True)

            inference = asyncio.create_task(infer_with_cleanup() if mode == "caller_cleanup" else client.infer(request))
            tasks.append(inference)
            async with asyncio.timeout(3):
                while client._active is not inference:
                    await asyncio.sleep(0)
            if mode == "cancelled_inference":
                inference.cancel()
                async with asyncio.timeout(3):
                    while connection.protocol.close_sent is None:
                        await asyncio.sleep(0)
                inference.cancel()
                try:
                    await inference
                except asyncio.CancelledError:
                    pass
                else:
                    raise AssertionError("Cancelled inference caller returned a policy response.")
                if client._disconnecting is None or client._disconnecting.done():
                    raise AssertionError("Cancelled inference discarded the actual connection close.")
                try:
                    await client.infer(request)
                except RuntimeError as error:
                    if str(error) != "Policy connection closure is pending or failed.":
                        raise
                else:
                    raise AssertionError("Policy client admitted inference during pending connection closure.")
        first = asyncio.create_task(client.close())
        tasks.append(first)
        async with asyncio.timeout(3):
            while connection.protocol.close_sent is None:
                await asyncio.sleep(0)
        second = asyncio.create_task(client.close())
        tasks.append(second)
        await asyncio.sleep(0.03)
        if first.done() or second.done():
            raise AssertionError("Concurrent policy close returned before its actual connection drained.")
        first.cancel()
        try:
            await first
        except asyncio.CancelledError:
            pass
        else:
            raise AssertionError("Cancelled policy close waiter returned a release result.")
        third = asyncio.create_task(client.close())
        tasks.append(third)
        await asyncio.sleep(0.03)
        if second.done() or third.done():
            raise AssertionError("Cancelled caller discarded the owned policy connection close.")
        os.kill(process.pid, signal.SIGCONT)
        stopped = False
        await asyncio.wait_for(asyncio.gather(second, third), 3)
        await connection.wait_closed()
        await client.close()
        if inference is not None:
            try:
                await inference
            except asyncio.CancelledError:
                pass
            else:
                raise AssertionError("Policy client close returned an inference response.")
        if (connection.close_code != 1000 or client._connection is not None or client._active is not None
                or client._disconnecting is not None or client._closing_active is not None or not client._closing.done()):
            raise AssertionError("Policy connection did not complete its actual normal close.")
        if caller_cleanup != ([True] if mode == "caller_cleanup" else []):
            raise AssertionError("Policy caller cleanup did not complete with its external close owner.")
        ending.set()
        if not await asyncio.to_thread(parent_channel.poll, 10):
            raise TimeoutError("Actual policy server did not publish its release state.")
        released = parent_channel.recv()
        await asyncio.to_thread(process.join, 10)
        expected_requests = [] if mode == "idle" else [request["request_id"]]
        if process.exitcode != 0 or released != {"requests": expected_requests, "connections": 0}:
            raise AssertionError("Policy ownership check differs from its original request or release scope.")
        if mode != "idle":
            recorded = output / "requests" / f"{request['request_id']}.json"
            if json.loads(recorded.read_bytes()) != request:
                raise AssertionError("Actual policy service changed its original recorded request.")
        report = {"mode": mode, "peer": {"pid": process.pid, "createTime": created_at, "exitCode": process.exitcode},
                  "sharedCloseWaiters": 3, "cancelledWaiters": 1,
                  "normalCloseCode": connection.close_code, "connectionDrained": True,
                  "peerReleased": True, "recordedRequests": len(expected_requests), "policyResponses": 0,
                  "pendingClosureAdmissionRejected": mode == "cancelled_inference",
                  "callerCleanupCompleted": bool(caller_cleanup),
                  "gpuJobs": 0, "modelCalls": 0, "nativeEnvironmentAllocations": 0,
                  "controls": 0, "stopAcknowledgements": 0}
        return report
    finally:
        if stopped and process.is_alive():
            os.kill(process.pid, signal.SIGCONT)
        ending.set()
        if client is not None:
            await client.close()
        if connection is not None:
            await connection.wait_closed()
        await asyncio.gather(*tasks, return_exceptions=True)
        await asyncio.to_thread(process.join, 10)
        forced_termination = process.is_alive()
        if forced_termination:
            process.terminate()
            await asyncio.to_thread(process.join, 10)
        parent_channel.close()
        upstream_endpoint.close()
        process.close()
        if forced_termination:
            raise RuntimeError("Actual policy server required termination during diagnostic cleanup.")


async def inspect(args) -> None:
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work") or os.name != "posix":
        raise ValueError("Policy client ownership checks require POSIX and new .local/work output.")
    output.mkdir(parents=True, exist_ok=False)
    source = args.request.resolve(strict=True)
    original_data = source.read_bytes()
    request = json.loads(original_data)
    ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json").parse("PolicyRequest", request)
    cases = [await inspect_case(root, output / mode, request, mode=mode)
             for mode in ("idle", "active_inference", "cancelled_inference", "caller_cleanup")]
    if source.read_bytes() != original_data:
        raise AssertionError("Policy client diagnostic changed its original request source.")
    paths = (Path(__file__), root / "harness/contracts/schema/physical.schema.json",
             root / "harness/physical-runtime/src/physical_harness/policies/client.py",
             root / "harness/physical-runtime/src/physical_harness/policies/server.py",
             root / "harness/physical-runtime/src/physical_harness/execution/policy_records.py")
    report = {"sources": {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in paths},
              "originalRequest": {"sha256": sha256(original_data).hexdigest(), "requestId": request["request_id"]},
              "cases": cases, "actualPolicyRequests": 3, "policyResponses": 0,
              "gpuJobs": 0, "modelCalls": 0, "nativeEnvironmentAllocations": 0,
              "controls": 0, "stopAcknowledgements": 0}
    with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, allow_nan=False, indent=2)
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    asyncio.run(inspect(parser.parse_args()))
