import argparse
import asyncio
from hashlib import sha256
import json
import os
from pathlib import Path
from threading import Event, enumerate as thread_list
from time import monotonic

from physical_harness.execution.policy_records import record_policy_request
from physical_harness.policies.inference import ThreadedInference, recorded_inference
from physical_harness.validation import ContractValidator


async def wait_started(started: Event) -> None:
    if not await asyncio.to_thread(started.wait, 5):
        raise TimeoutError("CPU pipe operation did not reach its actual owner thread.")


async def reject_busy(owner: ThreadedInference, path: Path) -> None:
    try:
        await owner.run(path.read_bytes)
    except RuntimeError as error:
        if str(error) != "Policy inference is already in progress.":
            raise
    else:
        raise AssertionError("Concurrent policy owner admission was accepted.")


async def inspect(args) -> None:
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local" / "work"):
        raise ValueError("CPU policy owner output must remain under .local/work.")
    output.mkdir(parents=True, exist_ok=False)
    source = args.request.resolve()
    original = source.read_bytes()
    request = json.loads(original)
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    validator.parse("PolicyRequest", request)
    records = output / "requests"
    records.mkdir()
    errors = []

    def observed_error(_loop, context):
        errors.append(context)

    loop = asyncio.get_running_loop()
    previous_handler = loop.get_exception_handler()
    loop.set_exception_handler(observed_error)
    owner = ThreadedInference("edh-policy-cpu-file-owner")
    started_at = monotonic()
    cases = []

    def save_original(ticket):
        record_policy_request(ticket, records)

    try:
        await owner.run(recorded_inference, save_original, request, {})
        saved = records / f"{request['request_id']}.json"
        if json.loads(saved.read_bytes()) != request:
            raise AssertionError("Production recorder changed the original request.")
        cases.append("original-request-recorded")
        try:
            await owner.run(recorded_inference, save_original, request, {})
        except FileExistsError:
            pass
        else:
            raise AssertionError("Duplicate original request recording was accepted.")
        if await owner.run(source.read_bytes) != original:
            raise AssertionError("Actual source read differs after recorder failure.")
        cases.append("recorder-error-releases-owner")

        for cancel_waiter, error_after_read in ((False, False), (True, False), (True, True)):
            read_fd, write_fd = os.pipe()
            started = Event()
            reader = os.fdopen(read_fd, "rb")
            writer = os.fdopen(write_fd, "wb")

            def read_original_pipe(ticket):
                started.set()
                data = reader.read()
                if data != original:
                    raise AssertionError("Actual pipe changed original request bytes.")
                if error_after_read:
                    record_policy_request(ticket, records)
                return data

            task = asyncio.create_task(owner.run(recorded_inference, read_original_pipe, request, {}))
            try:
                await wait_started(started)
                await reject_busy(owner, source)
                if cancel_waiter:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                    else:
                        raise AssertionError("Caller cancellation did not propagate.")
                    if not owner.snapshot()["active"]:
                        raise AssertionError("Cancelled waiter released its active owner thread.")
                    await reject_busy(owner, source)
                await asyncio.to_thread(writer.write, original)
                writer.close()
                if not cancel_waiter and await task != original:
                    raise AssertionError("Owner returned different original pipe bytes.")
            finally:
                writer.close()
                if not task.done():
                    await task
                await asyncio.to_thread(reader.close)
            while owner.snapshot()["active"]:
                await asyncio.sleep(0)
            cases.append("cancelled-operation-error-observed" if error_after_read else
                         "cancelled-waiter-retains-owner" if cancel_waiter else "concurrent-admission-rejected")

        read_fd, write_fd = os.pipe()
        reader = os.fdopen(read_fd, "rb")
        writer = os.fdopen(write_fd, "wb")
        started = Event()

        def drain_original_pipe():
            started.set()
            return reader.read()

        active = asyncio.create_task(owner.run(drain_original_pipe))
        close_waiter = None
        try:
            await wait_started(started)
            close_waiter = asyncio.create_task(owner.close())
            await asyncio.sleep(0)
            if not owner.snapshot()["closed"] or close_waiter.done():
                raise AssertionError("Owner close did not wait for its active operation.")
            close_waiter.cancel()
            try:
                await close_waiter
            except asyncio.CancelledError:
                pass
            else:
                raise AssertionError("Close waiter cancellation did not propagate.")
            try:
                await owner.run(source.read_bytes)
            except RuntimeError as error:
                if str(error) != "Policy inference owner is closed.":
                    raise
            else:
                raise AssertionError("Closing owner accepted another operation.")
            await asyncio.to_thread(writer.write, original)
            writer.close()
            if await active != original:
                raise AssertionError("Closing owner changed original request bytes.")
            await asyncio.gather(owner.close(), owner.close())
        finally:
            writer.close()
            if not active.done():
                await active
            if close_waiter is not None and not close_waiter.done():
                await close_waiter
            await asyncio.to_thread(reader.close)
        cases.append("cancelled-close-drains-owner")
        if owner.snapshot() != {"closed": True, "active": False}:
            raise AssertionError("Policy owner retained a running thread operation.")
        if any(thread.name.startswith("edh-policy-cpu-file-owner") for thread in thread_list()):
            raise AssertionError("Closed policy owner retained its executor thread.")
        await asyncio.sleep(0)
        if errors:
            raise AssertionError(f"Unobserved asynchronous errors: {errors}")
        if source.read_bytes() != original:
            raise AssertionError("Original policy request changed.")
        report = {
            "schemaVersion": "edh.policy_owner_cpu.v1",
            "sources": {
                str(path): sha256(path.read_bytes()).hexdigest()
                for path in (source, root / "harness/physical-runtime/src/physical_harness/policies/inference.py",
                             root / "scripts/check-policy-owner-offline.py")
            },
            "cases": cases,
            "owner": owner.snapshot(),
            "elapsedS": monotonic() - started_at,
            "originalSourceHashUnchanged": True,
            "modelInferencePerformed": False,
            "environmentAllocationPerformed": False,
            "physicalControlPerformed": False,
            "scope": "Production policy thread ownership using actual original-request recording, file reads and OS pipes.",
        }
        with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
            json.dump(report, stream, indent=2, allow_nan=False)
        print(json.dumps(report, allow_nan=False))
    finally:
        await owner.close()
        loop.set_exception_handler(previous_handler)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    asyncio.run(inspect(parser.parse_args()))


if __name__ == "__main__":
    main()
