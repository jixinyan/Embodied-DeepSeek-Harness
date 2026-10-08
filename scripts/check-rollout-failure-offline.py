import argparse
import asyncio
from hashlib import sha256
import json
import os
from pathlib import Path
import socket
from threading import Event, enumerate as thread_list
import time
import traceback

from physical_harness.environments.robodojo import RoboDojoEnvironment
from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.execution.policy_rollout import PolicyRollout
from physical_harness.execution.resources import ResourceArbiter
from physical_harness.execution.worker import NativeWorkerSession
from physical_harness.execution.worker_transport import operation_error
from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.validation import ContractValidator


async def inspect_case(request: dict, validator: ContractValidator, directory: Path, source: Path,
                       *, worker: bool, deadline: bool) -> dict:
    directory.mkdir()
    environment = RoboDojoEnvironment(validator)
    device = NativeActionDevice(environment)
    await device.bind_execution(request["execution_id"])
    lease = ResourceArbiter(directory / "resources", directory.name).acquire(("motion",))
    gate = ActionGate(validator, device, execution_id=request["execution_id"],
                      task_scope=request["task_scope"], action_spec=request["action_spec"],
                      max_control_steps=request["max_actions"], max_wall_time_s=30,
                      lease_valid=lease.valid, observation_ttl_s=5,
                      device_timeout_s=0.05 if deadline else 5)
    messages = []

    async def emit(message: dict) -> None:
        with (directory / "worker-events.jsonl").open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(message, allow_nan=False) + "\n")
        messages.append(message)

    reader = writer = reading = endpoint = rollout = None
    original_data = source.read_bytes()
    try:
        if deadline:
            read_fd, write_fd = os.pipe()
            reader, writer = os.fdopen(read_fd, "rb"), os.fdopen(write_fd, "wb")
            started = Event()

            def read_original() -> bytes:
                started.set()
                received = reader.read()
                if received != original_data:
                    raise AssertionError("Rollout owner changed the original pipe bytes.")
                return received

            reading = asyncio.create_task(device.on_owner(read_original))
            if not await asyncio.to_thread(started.wait, 5):
                raise TimeoutError("Rollout owner did not begin its actual pipe operation.")
        else:
            await device.close()
        session = None
        if worker:
            session = NativeWorkerSession(emit)
            session._device, session._environment, session._gate = device, environment, gate
            session._request = request["task_scope"]
            session._motion_lease, session._lease_active = lease, True
            operation = session._guard_background(session._run_policy())
        else:
            # 保持实际 TCP 端口的独占绑定和未监听状态。
            endpoint = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            endpoint.bind(("127.0.0.1", 0))
            policy = WebSocketPolicyClient(f"ws://127.0.0.1:{endpoint.getsockname()[1]}", validator, timeout_s=1)
            rollout = PolicyRollout(policy, gate)
            operation = rollout.step(request["instruction"], request["observation_id"], request["observation"],
                                     observed_monotonic=time.monotonic())
        try:
            await operation
        except ExceptionGroup as error:
            failure = error
        else:
            raise AssertionError("Rollout omitted its original operation or stopping failure.")
        if len(failure.exceptions) != 2:
            raise AssertionError("Rollout did not retain both original failures.")
        wire = operation_error(failure)
        with (directory / "original-error-receipt.json").open("x", encoding="utf-8") as stream:
            json.dump(wire, stream, allow_nan=False, indent=2)
        original, stopping = failure.exceptions
        if not isinstance(original, RuntimeError if worker else (ConnectionRefusedError, TimeoutError)):
            raise AssertionError(f"Unexpected actual rollout failure: {type(original).__name__}: {original}")
        if not worker and not any(
            frame.filename.endswith("policies/client.py") and frame.name == "infer"
            for frame in traceback.extract_tb(original.__traceback__)
        ):
            raise AssertionError("Rollout connection failure did not originate in its actual policy client.")
        if not isinstance(stopping, TimeoutError if deadline else RuntimeError):
            raise AssertionError("Rollout changed its actual device stop failure.")
        if gate._stop_task.exception() is not stopping:
            raise AssertionError("Rollout did not preserve the device's original stop error.")
        state = gate.snapshot()
        if state["state"] != "pausing" or state["device_confirmed"] or state["boundary_id"] is not None:
            raise AssertionError("Failed rollout stopping supplied a confirmed device boundary.")
        if state["executed_actions"] or state["reserved_actions"] or not lease.valid():
            raise AssertionError("Failed rollout supplied actions or released uncertain resources.")
        if any(str(error) not in wire["message"] for error in failure.exceptions):
            raise AssertionError("Rollout error receipt omitted an original cause.")
        if worker:
            if session._background_fault is not failure or session._lease_active or len(messages) != 1:
                raise AssertionError("Native background ownership changed its original failure or admission.")
            event = messages[0]
            if (event["event"] != "fault" or event["data"]["task_scope"] != request["task_scope"]
                    or event["data"]["execution_id"] != request["execution_id"]):
                raise AssertionError("Native background fault differs from its original task/execution scope.")
        else:
            if rollout._active or policy._active is not None or policy._connection is not None:
                raise AssertionError("Rollout failure retained an active inference or connection.")
            try:
                await rollout.close()
            except BaseException as error:
                if error is not stopping:
                    raise AssertionError("Rollout close changed the original stop failure.")
            else:
                raise AssertionError("Rollout close omitted the failed device stop.")
            if not policy._closed or policy._active is not None or policy._connection is not None:
                raise AssertionError("Rollout close retained the actual policy connection.")
        result = {"worker": worker, "stopDeadline": deadline,
                  "originalError": type(original).__name__, "stopError": type(stopping).__name__,
                  "originalPairPreserved": True, "unknownMotionLeaseRetained": True,
                  "scopedWorkerFaults": len(messages), "policyConnectionAttempts": 0 if worker else 1,
                  "inferenceTicketsIssued": 0 if worker else 1,
                  "confirmedBoundaries": 0, "controls": 0}
    finally:
        if writer is not None and not writer.closed:
            await asyncio.to_thread(writer.write, original_data)
            writer.close()
        if reading is not None:
            await reading
        await device.close()
        lease.release()
        if reader is not None:
            reader.close()
        if endpoint is not None:
            endpoint.close()
    if any(thread.name.startswith("edh-simulation") for thread in thread_list()) or lease.valid():
        raise AssertionError("Rollout CPU diagnostic retained an owner thread or resource lease.")
    result["diagnosticResourcesReleasedAfterDrain"] = True
    return result


async def inspect(args) -> None:
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Rollout CPU evidence must remain under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    source = args.request.resolve(strict=True)
    original_data = source.read_bytes()
    request = json.loads(original_data)
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    validator.parse("PolicyRequest", request)
    if request["action_spec"]["embodiment_id"] != "robodojo.dual-arx-x5":
        raise ValueError("Rollout CPU check requires original RoboDojo scope and ActionSpec.")
    cases = []
    for worker, deadline in ((False, False), (False, True), (True, False)):
        cases.append(await inspect_case(request, validator, output / f"worker-{worker}-deadline-{deadline}",
                                        source, worker=worker, deadline=deadline))
    if source.read_bytes() != original_data:
        raise AssertionError("Rollout CPU diagnostic changed its original request source.")
    paths = (Path(__file__), root / "harness/contracts/schema/physical.schema.json",
             *(root / "harness/physical-runtime/src/physical_harness/execution" / name for name in (
                 "action_gate.py", "native_device.py", "policy_rollout.py", "worker.py", "worker_transport.py",
             )), root / "harness/physical-runtime/src/physical_harness/policies/client.py",
             root / "harness/physical-runtime/src/physical_harness/environments/robodojo/__init__.py")
    result = {"sources": {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in paths},
              "originalRequest": {"sha256": sha256(original_data).hexdigest(), "requestId": request["request_id"]},
              "cases": cases, "gpuJobs": 0, "modelCalls": 0, "policyServerCalls": 0,
              "nativeEnvironmentAllocations": 0, "controls": 0, "stopAcknowledgements": 0}
    with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(result, stream, allow_nan=False, indent=2)
    print(json.dumps(result, allow_nan=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    asyncio.run(inspect(parser.parse_args()))
