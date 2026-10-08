import argparse
import asyncio
from hashlib import sha256
import json
import os
from pathlib import Path
from threading import Event, enumerate as thread_list

from physical_harness.environments.robodojo import RoboDojoEnvironment
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.execution.video import SimulationVideoRecorder
from physical_harness.execution.worker import NativeWorkerSession
from physical_harness.validation import ContractValidator


async def cancel_waiter(waiter: asyncio.Task) -> None:
    waiter.cancel()
    try:
        await waiter
    except asyncio.CancelledError:
        return
    raise AssertionError("Cancelled Session close caller returned a result.")


def leaf_errors(error: BaseException) -> list[BaseException]:
    if isinstance(error, BaseExceptionGroup):
        return [leaf for child in error.exceptions for leaf in leaf_errors(child)]
    return [error]


async def inspect_case(root: Path, directory: Path, *, device_error: bool, video_error: bool) -> dict:
    directory.mkdir()
    source = root / "harness/contracts/schema/physical.schema.json"
    original = source.read_bytes()
    emitted = directory / "emitted.jsonl"

    async def emit(message: dict) -> None:
        with emitted.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(message, allow_nan=False) + "\n")

    session = NativeWorkerSession(emit)
    validator = ContractValidator.from_path(source)
    device = NativeActionDevice(RoboDojoEnvironment(validator))
    recorder = SimulationVideoRecorder(directory, "cpu-resource-owner")
    session._device = device
    session._video_recorder = recorder
    if video_error:
        (recorder.directory / "manifest.json").mkdir()
    read_fd, write_fd = os.pipe()
    reader = os.fdopen(read_fd, "rb")
    writer = os.fdopen(write_fd, "wb")
    started = Event()
    target = directory / "missing" / "original-record.json"
    tasks = []
    original_error = None

    def read_original() -> bytes:
        started.set()
        received = reader.read()
        if received != original:
            raise AssertionError("Session resource owner changed its actual source bytes.")
        return target.read_bytes() if device_error else received

    try:
        reading = asyncio.create_task(device.on_owner(read_original))
        tasks.append(reading)
        if not await asyncio.to_thread(started.wait, 5):
            raise TimeoutError("Session device owner did not start its pipe operation.")
        await cancel_waiter(reading)
        first = asyncio.create_task(session.close())
        tasks.append(first)
        async with asyncio.timeout(5):
            while session._native_closing is None:
                await asyncio.sleep(0)
        shared = session._native_closing
        if shared is None:
            raise AssertionError("Session did not establish shared resource closure.")
        await cancel_waiter(first)
        followers = [asyncio.create_task(session.close()), asyncio.create_task(session.transport_disconnected())]
        tasks.extend(followers)
        await asyncio.sleep(0)
        if session._native_closing is not shared or shared.done() or any(task.done() for task in followers):
            raise AssertionError("Session callers did not retain actual thread/resource drain.")
        await asyncio.to_thread(writer.write, original)
        writer.close()
        values = await asyncio.wait_for(asyncio.gather(*followers, return_exceptions=True), 5)
        if device_error or video_error:
            original_error = values[0]
            if not isinstance(original_error, BaseException) or values[1] is not original_error:
                raise AssertionError("Session shutdown callers changed original failure identity.")
            errors = leaf_errors(original_error)
            expected = ([FileNotFoundError] if device_error else []) + ([IsADirectoryError] if video_error else [])
            if [type(error) for error in errors] != expected:
                raise AssertionError("Session shutdown did not preserve all original resource errors.")
            for close in (session.close, session.transport_disconnected):
                try:
                    await close()
                except BaseException as repeated:
                    if repeated is not original_error:
                        raise AssertionError("Repeated Session close changed its original failure.")
                else:
                    raise AssertionError("Repeated Session shutdown discarded a resource error.")
        elif values != [{"closed": True}, None]:
            raise AssertionError(f"Session resource shutdown returned unexpected values: {values}")
        snapshot = device.diagnostic_snapshot()
        if not snapshot["closed"] or snapshot["closing"] or not recorder.journal.closed:
            raise AssertionError("Session shutdown retained its device owner or recording journal.")
        if any(snapshot[field] != 0 for field in (
            "pending_owner_operations", "pending_cancelled_operations", "retained_cancelled_operations",
            "executed_actions", "uncertain_actions", "raw_sim_steps",
        )):
            raise AssertionError("Session resource diagnostic retained work or supplied controls.")
        if any(thread.name.startswith("edh-simulation") for thread in thread_list()):
            raise AssertionError("Session resource shutdown retained its device thread.")
        if not video_error:
            manifest = json.loads((recorder.directory / "manifest.json").read_text())
            if manifest["frames"] != 0 or manifest["cameras"] != [] or not recorder.closed:
                raise AssertionError("Empty recording finalized with invented frame data.")
        elif recorder.closed:
            raise AssertionError("Failed recording publication claimed confirmed closure.")
        if emitted.exists() or (recorder.directory / "frames.jsonl").stat().st_size:
            raise AssertionError("CPU resource shutdown published model/device/frame evidence.")
        return {
            "deviceError": device_error,
            "videoPublicationError": video_error,
            "originalErrors": [type(error).__name__ for error in leaf_errors(original_error)] if original_error else [],
            "cancelledCloseRetained": True,
            "sharedCompletionIdentity": True,
            "owner": snapshot,
            "recordingJournalClosed": True,
            "recordingManifestPublished": not video_error,
            "recordingFrames": 0,
            "nativeEnvironmentAllocations": 0,
        }
    finally:
        if not writer.closed:
            writer.write(original)
            writer.close()
        await asyncio.gather(*tasks, return_exceptions=True)
        try:
            await session.transport_disconnected()
        except BaseException as error:
            if error is not original_error:
                raise
        reader.close()


async def inspect(args) -> None:
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Session CPU owner output must remain under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    observed = []
    loop = asyncio.get_running_loop()
    previous_handler = loop.get_exception_handler()
    loop.set_exception_handler(lambda _loop, context: observed.append(context))
    paths = [
        Path(__file__), root / "harness/contracts/schema/physical.schema.json",
        *(root / "harness/physical-runtime/src/physical_harness/execution" / name for name in (
            "native_device.py", "worker.py", "video.py",
        )),
        root / "harness/physical-runtime/src/physical_harness/environments/robodojo/__init__.py",
    ]
    sources = {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in paths}
    try:
        cases = []
        for device_error, video_error in ((False, False), (True, False), (False, True), (True, True)):
            cases.append(await inspect_case(root, output / f"device-{device_error}-video-{video_error}",
                                            device_error=device_error, video_error=video_error))
        await asyncio.sleep(0)
        if observed:
            raise BaseExceptionGroup("Session shutdown left unobserved failures.", [
                context.get("exception", RuntimeError(context["message"])) for context in observed
            ])
        if sources != {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in paths}:
            raise AssertionError("Session resource diagnostic modified its original sources.")
        result = {
            "sources": sources, "cases": cases, "unobservedErrors": 0,
            "gpuJobs": 0, "modelCalls": 0, "policyCalls": 0, "nativeEnvironmentAllocations": 0,
            "controls": 0, "recordedFrames": 0,
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
