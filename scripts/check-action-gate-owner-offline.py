import argparse
import asyncio
from hashlib import sha256
import json
import os
from pathlib import Path
from threading import Event, enumerate as thread_list

from physical_harness.environments.robodojo import RoboDojoEnvironment
from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.execution.resources import ResourceArbiter
from physical_harness.validation import ContractValidator


async def cancel_waiter(waiter: asyncio.Task) -> None:
    waiter.cancel()
    try:
        await waiter
    except asyncio.CancelledError:
        return
    raise AssertionError("Cancelled ActionGate waiter returned a result.")


def assert_unknown(gate: ActionGate) -> dict:
    snapshot = gate.snapshot()
    if snapshot["state"] != "pausing" or snapshot["device_confirmed"] or snapshot["boundary_id"] is not None:
        raise AssertionError("Failed ActionGate stop published a confirmed boundary.")
    if snapshot["executed_actions"] or snapshot["reserved_actions"] or snapshot["dispatch_in_flight"]:
        raise AssertionError("CPU stop ownership supplied action effects.")
    return snapshot


async def inspect_case(request, validator, directory: Path, source: Path, case: str) -> dict:
    directory.mkdir()
    device = NativeActionDevice(RoboDojoEnvironment(validator))
    await device.bind_execution(request["execution_id"])
    arbiter = ResourceArbiter(directory / "resources", f"cpu-stop-owner:{case}")
    lease = arbiter.acquire(("motion",))
    timeout = 0.05 if case in ("actual_stop_deadline", "original_error_and_stop_deadline") else 5
    gate = ActionGate(validator, device, execution_id=request["execution_id"],
                      task_scope=request["task_scope"], action_spec=request["action_spec"],
                      max_control_steps=request["max_actions"], max_wall_time_s=30,
                      lease_valid=lease.valid, device_timeout_s=timeout)
    original = None
    target = directory / "missing" / "original-record.json"
    if case.startswith("original_error"):
        try:
            await device.on_owner(target.read_bytes)
        except FileNotFoundError as error:
            original = error
        else:
            raise AssertionError("Missing source file read did not preserve its actual error.")
    reader = writer = None
    tasks = []
    closing = None
    data = source.read_bytes()
    errors = []
    try:
        if case == "original_error_and_closed_owner":
            await device.close()
            try:
                await gate._raise_after_stop(original)
            except BaseExceptionGroup as error:
                errors.append(error)
            else:
                raise AssertionError("ActionGate discarded original file and stop errors.")
        else:
            read_fd, write_fd = os.pipe()
            reader, writer = os.fdopen(read_fd, "rb"), os.fdopen(write_fd, "wb")
            started = Event()

            def read_original() -> bytes:
                started.set()
                received = reader.read()
                if received != data:
                    raise AssertionError("ActionGate owner changed its actual pipe source bytes.")
                return received

            reading = asyncio.create_task(device.on_owner(read_original))
            tasks.append(reading)
            if not await asyncio.to_thread(started.wait, 5):
                raise TimeoutError("ActionGate CPU owner did not start its pipe operation.")
            stopping = asyncio.create_task(gate._raise_after_stop(original) if original else
                                           gate.pause("user_stop", terminal=True))
            tasks.append(stopping)
            async with asyncio.timeout(5):
                while device.diagnostic_snapshot()["pending_owner_operations"] != 2:
                    await asyncio.sleep(0)
            shared_stop = gate._stop_task
            if case == "cancelled_stop_and_owner_close":
                await cancel_waiter(stopping)
                followers = [asyncio.create_task(gate.pause("user_stop", terminal=True)) for _ in range(3)]
                tasks.extend(followers)
                closing = asyncio.create_task(device.close())
                await asyncio.sleep(0)
                if shared_stop is not gate._stop_task or shared_stop.done():
                    raise AssertionError("Cancelled stop waiter discarded actual stop ownership.")
                await asyncio.to_thread(writer.write, data)
                writer.close()
                errors = await asyncio.wait_for(asyncio.gather(*followers, return_exceptions=True), 5)
            else:
                try:
                    await stopping
                except BaseException as error:
                    errors.append(error)
                else:
                    raise AssertionError("Blocked native owner supplied a stop acknowledgement.")
                if not device.diagnostic_snapshot()["pending_cancelled_operations"]:
                    raise AssertionError("Stop deadline discarded its actual pending owner barrier.")
                await asyncio.to_thread(writer.write, data)
                writer.close()
            await reading
            if closing is not None:
                await closing
        if not lease.valid():
            raise AssertionError("Failed stopping released its actual motion resource lease.")
        snapshot = assert_unknown(gate)
        if original:
            group = errors[0]
            if not isinstance(group, BaseExceptionGroup) or len(group.exceptions) != 2:
                raise AssertionError("ActionGate did not aggregate both original failures.")
            if group.exceptions[0] is not original or Path(original.filename) != target:
                raise AssertionError("ActionGate changed original file-error identity.")
            stop_error = group.exceptions[1]
            if str(original) not in group.message or type(stop_error).__name__ not in group.message:
                raise AssertionError("ActionGate receipt text omitted original failure details.")
        else:
            stop_error = errors[0]
            if any(error is not stop_error for error in errors):
                raise AssertionError("Concurrent stop callers changed shared failure identity.")
        expected = TimeoutError if case.endswith("deadline") else RuntimeError
        if not isinstance(stop_error, expected) or gate._stop_task.exception() is not stop_error:
            raise AssertionError("ActionGate changed the actual stop failure.")
        try:
            await gate.pause("user_stop", terminal=True)
        except BaseException as repeated:
            if repeated is not stop_error:
                raise AssertionError("Repeated stop caller changed original stop failure identity.")
        else:
            raise AssertionError("Repeated ActionGate stop hid the original failure.")
        result = {
            "case": case,
            "originalError": type(original).__name__ if original else None,
            "stopError": type(stop_error).__name__,
            "sharedStopFailureIdentity": True,
            "motionLeaseRetainedWhileUnknown": True,
            "gate": {key: value for key, value in snapshot.items() if key != "error"},
        }
    finally:
        if writer is not None and not writer.closed:
            writer.write(data)
            writer.close()
        await asyncio.gather(*tasks, return_exceptions=True)
        if closing is not None:
            await closing
        await device.close()
        lease.release()
        if reader is not None:
            reader.close()
    owner = device.diagnostic_snapshot()
    if not owner["closed"] or owner["pending_owner_operations"] or owner["retained_cancelled_operations"]:
        raise AssertionError("ActionGate diagnostic retained native owner operations.")
    if any(thread.name.startswith("edh-simulation") for thread in thread_list()) or lease.valid():
        raise AssertionError("ActionGate diagnostic retained its actual CPU thread or lock.")
    result["ownerReleased"] = True
    result["diagnosticLeaseReleasedAfterDrain"] = True
    return result


async def inspect(args) -> None:
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("ActionGate CPU evidence must remain under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    source = args.request.resolve(strict=True)
    data = source.read_bytes()
    request = json.loads(data)
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    validator.parse("PolicyRequest", request)
    if request["action_spec"]["embodiment_id"] != "robodojo.dual-arx-x5":
        raise ValueError("ActionGate CPU check requires original RoboDojo scope and ActionSpec.")
    observed = []
    loop = asyncio.get_running_loop()
    previous_handler = loop.get_exception_handler()
    loop.set_exception_handler(lambda _loop, context: observed.append(context))
    try:
        cases = []
        for case in (
            "cancelled_stop_and_owner_close", "actual_stop_deadline",
            "original_error_and_closed_owner", "original_error_and_stop_deadline",
        ):
            cases.append(await inspect_case(request, validator, output / case, source, case))
        await asyncio.sleep(0)
        if observed:
            raise BaseExceptionGroup("ActionGate stop left unobserved failures.", [
                context.get("exception", RuntimeError(context["message"])) for context in observed
            ])
        if source.read_bytes() != data:
            raise AssertionError("ActionGate diagnostic changed its original request source.")
        paths = (
            Path(__file__), root / "harness/contracts/schema/physical.schema.json",
            *(root / "harness/physical-runtime/src/physical_harness/execution" / name for name in (
                "action_gate.py", "native_device.py", "resources.py",
            )),
            root / "harness/physical-runtime/src/physical_harness/environments/robodojo/__init__.py",
        )
        result = {
            "sources": {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in paths},
            "originalRequest": {"sha256": sha256(data).hexdigest(), "requestId": request["request_id"]},
            "cases": cases, "unobservedErrors": 0,
            "gpuJobs": 0, "modelCalls": 0, "policyCalls": 0, "inferenceTickets": 0,
            "nativeEnvironmentAllocations": 0, "controls": 0, "stopAcknowledgements": 0,
        }
        with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
            json.dump(result, stream, allow_nan=False, indent=2)
        print(json.dumps(result, allow_nan=False))
    finally:
        loop.set_exception_handler(previous_handler)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    asyncio.run(inspect(parser.parse_args()))
