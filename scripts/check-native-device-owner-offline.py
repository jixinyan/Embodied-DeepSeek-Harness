import argparse
import asyncio
from hashlib import sha256
import json
import os
from pathlib import Path
from threading import Event, enumerate as thread_list

from physical_harness.environments.robodojo import RoboDojoEnvironment
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.validation import ContractValidator


async def wait_started(started: Event) -> None:
    if not await asyncio.to_thread(started.wait, 5):
        raise TimeoutError("Native CPU owner did not start its pipe operation.")


async def cancel_waiter(waiter: asyncio.Task) -> None:
    waiter.cancel()
    try:
        await waiter
    except asyncio.CancelledError:
        return
    raise AssertionError("Cancelled native owner waiter returned a result.")


async def reject_closed(device: NativeActionDevice, source: Path) -> None:
    try:
        await device.on_owner(source.read_bytes)
    except RuntimeError as error:
        if str(error) != "Native simulation owner is closed.":
            raise
    else:
        raise AssertionError("Closing native owner admitted another operation.")


def assert_released(device: NativeActionDevice) -> dict:
    snapshot = device.diagnostic_snapshot()
    if not snapshot["closed"] or snapshot["closing"] or not snapshot["stopped"]:
        raise AssertionError("Native CPU owner did not complete its shared shutdown.")
    if any(snapshot[field] != 0 for field in (
        "pending_owner_operations", "retained_cancelled_operations", "pending_cancelled_operations",
        "executed_actions", "uncertain_actions", "raw_sim_steps",
    )):
        raise AssertionError("Native CPU owner retained operations or supplied physical effects.")
    if any(thread.name.startswith("edh-simulation") for thread in thread_list()):
        raise AssertionError("Native CPU executor thread remains active after shutdown.")
    return snapshot


async def inspect_drain(validator, source: Path, output: Path, *, late_error: bool) -> dict:
    environment = RoboDojoEnvironment(validator)
    device = NativeActionDevice(environment)
    original = source.read_bytes()
    read_fd, write_fd = os.pipe()
    reader = os.fdopen(read_fd, "rb")
    writer = os.fdopen(write_fd, "wb")
    started = Event()
    target = output / "missing" / "original-record.json"
    tasks = []
    close_error = None

    def read_original() -> bytes:
        started.set()
        received = reader.read()
        if received != original:
            raise AssertionError("Native CPU owner changed its actual source bytes.")
        return target.read_bytes() if late_error else received

    try:
        reading = asyncio.create_task(device.on_owner(read_original))
        tasks.append(reading)
        await wait_started(started)
        await cancel_waiter(reading)
        first = asyncio.create_task(device.close())
        tasks.append(first)
        await asyncio.sleep(0)
        closing = device._closing
        if closing is None:
            raise AssertionError("Native close did not establish its shared operation.")
        followers = [asyncio.create_task(device.close()) for _ in range(3)]
        tasks.extend(followers)
        await asyncio.sleep(0)
        await cancel_waiter(first)
        snapshot = device.diagnostic_snapshot()
        if snapshot["closed"] or not snapshot["closing"] or not snapshot["stopped"]:
            raise AssertionError("Cancelled close waiter discarded active thread ownership.")
        if device._closing is not closing or any(task.done() for task in followers):
            raise AssertionError("Concurrent close returned before actual owner drain.")
        await reject_closed(device, source)
        await asyncio.to_thread(writer.write, original)
        writer.close()
        results = await asyncio.wait_for(asyncio.gather(*followers, return_exceptions=True), 5)
        if late_error:
            if not all(isinstance(error, BaseExceptionGroup) for error in results):
                raise AssertionError("Native close discarded a late original file error.")
            close_error = results[0]
            if any(error is not close_error for error in results):
                raise AssertionError("Concurrent native close lost its shared failure identity.")
            if len(close_error.exceptions) != 1:
                raise AssertionError("Native owner error aggregation changed original error count.")
            original_error = close_error.exceptions[0]
            if not isinstance(original_error, FileNotFoundError) or Path(original_error.filename) != target:
                raise AssertionError("Native owner changed its original file failure.")
            try:
                await device.close()
            except BaseExceptionGroup as repeated:
                if repeated is not close_error:
                    raise AssertionError("Repeated native close lost its original failure.")
            else:
                raise AssertionError("Repeated native close hid its failed shutdown outcome.")
        elif results != [None] * len(followers):
            raise AssertionError(f"Native CPU owner drain returned unexpected results: {results}")
        else:
            await device.close()
        await reject_closed(device, source)
        released = assert_released(device)
    finally:
        if not writer.closed:
            writer.write(original)
            writer.close()
        await asyncio.gather(*tasks, return_exceptions=True)
        try:
            await device.close()
        except BaseExceptionGroup as error:
            if error is not close_error:
                raise
        reader.close()
    return {
        "case": "late_original_file_error" if late_error else "cancelled_and_concurrent_close",
        "cancelledOperationRetained": True,
        "cancelledCloseRetained": True,
        "concurrentCloseWaiters": len(followers),
        "newOperationRejected": True,
        "sharedCloseIdentity": True,
        "originalError": type(close_error.exceptions[0]).__name__ if close_error else None,
        "owner": released,
        "nativeEnvironmentAllocated": False,
    }


async def inspect_boundary(validator, source: Path, operation: str) -> dict:
    device = NativeActionDevice(RoboDojoEnvironment(validator))
    execution_id = "cpu-owner-boundary"
    if operation != "bind_execution":
        await device.bind_execution(execution_id)
    if operation == "resume":
        device.fence_execution(execution_id)
    read_fd, write_fd = os.pipe()
    reader = os.fdopen(read_fd, "rb")
    writer = os.fdopen(write_fd, "wb")
    original = source.read_bytes()
    started = Event()
    tasks = []

    def read_original() -> bytes:
        started.set()
        received = reader.read()
        if received != original:
            raise AssertionError("Native boundary owner changed original pipe bytes.")
        return received

    try:
        reading = asyncio.create_task(device.on_owner(read_original))
        tasks.append(reading)
        await wait_started(started)
        if operation == "bind_execution":
            boundary = asyncio.create_task(device.bind_execution(execution_id))
        elif operation == "stop":
            boundary = asyncio.create_task(device.stop(execution_id, 1))
        elif operation == "resume":
            boundary = asyncio.create_task(device.resume(execution_id, 0))
        else:
            raise ValueError("Unsupported native CPU boundary operation.")
        tasks.append(boundary)
        await asyncio.sleep(0)
        if device.diagnostic_snapshot()["pending_owner_operations"] != 2:
            raise AssertionError("Native boundary did not queue its actual owner barrier.")
        closing = asyncio.create_task(device.close())
        tasks.append(closing)
        await asyncio.sleep(0)
        await reject_closed(device, source)
        await asyncio.to_thread(writer.write, original)
        writer.close()
        values = await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), 5)
        if values[0] != original or values[2] is not None:
            raise AssertionError("Native boundary source read or shared close failed.")
        error = values[1]
        expected = {
            "bind_execution": "Native simulation owner is closed.",
            "stop": "Native stop was superseded before confirmation.",
            "resume": "Native resume was superseded by a stop.",
        }[operation]
        if not isinstance(error, RuntimeError) or str(error) != expected:
            raise AssertionError("Closing native owner published a queued execution boundary.")
        snapshot = assert_released(device)
        if snapshot["execution_id"] != (None if operation == "bind_execution" else execution_id):
            raise AssertionError("Closing native owner changed its execution binding.")
    finally:
        if not writer.closed:
            writer.write(original)
            writer.close()
        await asyncio.gather(*tasks, return_exceptions=True)
        await device.close()
        reader.close()
    return {
        "case": f"closing_during_{operation}",
        "queuedBoundaryRejected": True,
        "stopAcknowledgementPublished": False,
        "originalError": str(error),
        "owner": snapshot,
    }


async def inspect(args) -> None:
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local" / "work"):
        raise ValueError("Native CPU owner evidence must remain under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    source = root / "harness/contracts/schema/physical.schema.json"
    original_hash = sha256(source.read_bytes()).hexdigest()
    validator = ContractValidator.from_path(source)
    observed_errors = []
    loop = asyncio.get_running_loop()
    previous_handler = loop.get_exception_handler()
    loop.set_exception_handler(lambda _loop, context: observed_errors.append(context))
    cases = []
    try:
        environment = RoboDojoEnvironment(validator)
        device = NativeActionDevice(environment)
        try:
            received = await device.on_owner(source.read_bytes)
            if sha256(received).hexdigest() != original_hash:
                raise AssertionError("Native CPU owner changed its original file read.")
        finally:
            await device.close()
        await device.close()
        await reject_closed(device, source)
        cases.append({"case": "actual_source_read_and_close", "owner": assert_released(device)})
        for late_error in (False, True):
            cases.append(await inspect_drain(validator, source, output, late_error=late_error))
        for operation in ("bind_execution", "stop", "resume"):
            cases.append(await inspect_boundary(validator, source, operation))
        await asyncio.sleep(0)
        if observed_errors:
            raise BaseExceptionGroup("Native CPU owner left unobserved failures.", [
                item.get("exception", RuntimeError(item["message"])) for item in observed_errors
            ])
        if sha256(source.read_bytes()).hexdigest() != original_hash:
            raise AssertionError("Native CPU owner diagnostic modified its original source.")
        paths = (
            Path(__file__), source,
            root / "harness/physical-runtime/src/physical_harness/execution/native_device.py",
            root / "harness/physical-runtime/src/physical_harness/environments/robodojo/__init__.py",
        )
        result = {
            "sources": {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in paths},
            "cases": cases,
            "unobservedErrors": 0,
            "gpuJobs": 0,
            "modelCalls": 0,
            "policyCalls": 0,
            "nativeEnvironmentAllocations": 0,
            "controls": 0,
        }
        with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
            json.dump(result, stream, allow_nan=False, indent=2)
        print(json.dumps(result, allow_nan=False))
    finally:
        loop.set_exception_handler(previous_handler)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    asyncio.run(inspect(parser.parse_args()))
