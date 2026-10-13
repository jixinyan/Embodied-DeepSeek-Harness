import argparse
from hashlib import sha256
from importlib.metadata import version
import json
import os
from pathlib import Path
from threading import Barrier, Event, Thread, enumerate as thread_list
import time

from physical_harness.execution.resources import ResourceArbiter
from physical_harness.execution.watchdog import ExecutionWatchdog


def inspect(output: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    output = output.resolve()
    output.relative_to(root / ".local/work")
    if output == root / ".local/work" or os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("Watchdog checks require a new .local/work output and CUDA_VISIBLE_DEVICES=''.")
    sources = {
        path.relative_to(root).as_posix(): sha256(path.read_bytes()).hexdigest()
        for path in (
            root / "harness/physical-runtime/src/physical_harness/execution/watchdog.py",
            root / "harness/physical-runtime/src/physical_harness/execution/resources.py",
            Path(__file__).resolve(),
        )
    }
    output.mkdir(parents=True, exist_ok=False)
    cases = []

    def rejected(watchdog: ExecutionWatchdog) -> None:
        try:
            watchdog.start()
        except RuntimeError as error:
            if str(error) != "Execution watchdog is closed.":
                raise
        else:
            raise AssertionError("Closed watchdog created a thread.")

    for mode in ("close-unstarted", "close-running", "repeat-start", "deadline", "lease-loss", "self-close", "concurrent-start-close"):
        arbiter = ResourceArbiter(output / mode, f"actual-cpu-watchdog:{mode}")
        lease = arbiter.acquire(("motion",))
        notifications = []
        notified = Event()

        def notify(reason: str) -> None:
            if lease.valid():
                raise AssertionError("Watchdog notified before its actual lease was fenced.")
            notifications.append(reason)
            if mode == "self-close":
                watchdog.close()
            notified.set()

        watchdog = ExecutionWatchdog(
            deadline=time.monotonic() + (-1 if mode in ("deadline", "self-close") else 30),
            lease_valid=lease.valid, fence=lease.release, notify=notify,
        )
        original_thread = watchdog._thread
        start_rejected = False
        try:
            if mode == "close-unstarted":
                watchdog.close()
                watchdog.close()
                if original_thread.ident is not None:
                    raise AssertionError("Unstarted close created a watchdog thread.")
                rejected(watchdog)
            elif mode == "concurrent-start-close":
                ready = Barrier(3, timeout=5)
                errors = []

                def start() -> None:
                    nonlocal start_rejected
                    ready.wait()
                    try:
                        watchdog.start()
                    except RuntimeError as error:
                        if str(error) != "Execution watchdog is closed.":
                            errors.append(error)
                        else:
                            start_rejected = True

                def close() -> None:
                    ready.wait()
                    try:
                        watchdog.close()
                    except BaseException as error:
                        errors.append(error)

                starters = [Thread(target=start), Thread(target=close)]
                for thread in starters:
                    thread.start()
                ready.wait()
                for thread in starters:
                    thread.join(timeout=5)
                if errors:
                    raise BaseExceptionGroup("Concurrent watchdog lifecycle failed.", errors)
                if any(thread.is_alive() for thread in starters):
                    raise AssertionError("Concurrent watchdog lifecycle did not release its threads.")
                rejected(watchdog)
            else:
                watchdog.start()
                if original_thread.ident is None:
                    raise AssertionError("Successful watchdog start created no actual thread.")
                if mode == "repeat-start":
                    try:
                        watchdog.start()
                    except RuntimeError:
                        pass
                    else:
                        raise AssertionError("Watchdog started its thread twice.")
                    if watchdog._thread is not original_thread:
                        raise AssertionError("Repeated start replaced the owned thread.")
                if mode == "lease-loss":
                    lease.release()
                if mode in ("deadline", "lease-loss", "self-close"):
                    if not notified.wait(5):
                        raise TimeoutError("Actual watchdog did not report its fenced lease.")
                    expected = "backend_error" if mode == "lease-loss" else "budget_exhausted"
                    if notifications != [expected]:
                        raise AssertionError("Watchdog changed its original stop reason or repeated its notification.")
                watchdog.close()
                rejected(watchdog)
            watchdog.close()
            if original_thread.is_alive():
                raise AssertionError("Watchdog close retained its actual thread.")
            if mode in ("close-unstarted", "close-running", "repeat-start", "concurrent-start-close"):
                if notifications or not lease.valid():
                    raise AssertionError("Disarmed watchdog changed its actual resource lease.")
            cases.append({
                "name": mode, "threadStarted": original_thread.ident is not None,
                "threadReleased": not original_thread.is_alive(),
                "closedStartRejected": True, "notifications": notifications.copy(),
                "concurrentStartRejected": start_rejected,
            })
        finally:
            watchdog.close()
            lease.release()
        readmitted = arbiter.acquire(("motion",))
        readmitted.release()
        cases[-1]["actualResourceReadmitted"] = True

    if any(thread.name == "edh-device-watchdog" for thread in thread_list()):
        raise AssertionError("Actual watchdog thread remains after CPU checks.")
    for path, expected in sources.items():
        if sha256((root / path).read_bytes()).hexdigest() != expected:
            raise AssertionError("Watchdog diagnostic source changed during execution.")
    report = {
        "schemaVersion": "edh.watchdog_owner_cpu.v1", "sources": sources, "cases": cases,
        "filelockVersion": version("filelock"), "actualThreadsReleased": True,
        "gpuJobs": 0, "modelCalls": 0, "nativeEnvironmentAllocations": 0, "controls": 0,
        "scope": "Actual watchdog threads, lifecycle admission and OS resource leases; no device stop or native task acceptance.",
    }
    with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, allow_nan=False, indent=2)
    print(json.dumps({"output": str(output), "cases": len(cases), "sources": len(sources)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check actual watchdog ownership without provider allocation.")
    parser.add_argument("--output", type=Path, required=True)
    inspect(parser.parse_args().output)
