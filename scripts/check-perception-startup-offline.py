import argparse
import asyncio
from hashlib import sha256
import json
import os
from pathlib import Path
import runpy
import signal
import socket
import sys


def observe_sdk_import(args):
    source = args.observe_sdk_import.resolve(strict=True)
    sys.argv = [str(source), *args.service_arguments]

    def observe(event, values):
        if event == "import" and values[0] == "numpy":
            with (args.output / "sdk-import.json").open("x", encoding="utf-8") as stream:
                json.dump({"pid": os.getpid(), "source": str(source),
                           "module": values[0], "sourceSha256": sha256(source.read_bytes()).hexdigest()}, stream)
            os.kill(os.getpid(), signal.SIGSTOP)

    sys.addaudithook(observe)
    runpy.run_path(str(source), run_name="__main__")


async def invoke(source, executable, arguments, output, mode):
    process = await asyncio.create_subprocess_exec(str(executable), str(source), *arguments,
        cwd=source.parents[5], env={**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1"},
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    try:
        async with asyncio.timeout(10):
            stdout, stderr = await process.communicate()
    finally:
        if process.returncode is None:
            process.terminate()
            await process.wait()
    (output / f"{source.stem}.{mode}.stdout.txt").write_bytes(stdout)
    (output / f"{source.stem}.{mode}.stderr.txt").write_bytes(stderr)
    return process.pid, process.returncode, stdout, stderr


async def inspect_listener(root, output, executable, source):
    arguments = ["--checkpoint", str(source), "--checkpoint-sha256", sha256(source.read_bytes()).hexdigest(),
                 "--source-revision", "invalid-admission-source"]
    arguments += ["--work-root", str(output)] if source.stem == "sam31" else ["--device", "cpu"]
    cases = []
    with socket.create_server(("127.0.0.1", 0)) as listener:
        port = listener.getsockname()[1]
        pid, code, stdout, stderr = await invoke(source, executable, [*arguments, "--port", str(port)], output, "occupied-port")
        if code != 1 or b"address already in use" not in stderr.lower() or b"ModuleNotFoundError" in stderr or stdout:
            raise AssertionError("Perception port collision did not fail before its SDK import.")
        with socket.create_connection(("127.0.0.1", port), timeout=1) as connection:
            accepted, _ = listener.accept()
            with accepted:
                if accepted.getpeername() != connection.getsockname():
                    raise AssertionError("Perception candidate changed the original occupied listener.")
        cases.append({"service": source.stem, "mode": "occupied-port", "pid": pid, "exitCode": code,
                      "ownedProcessExited": True, "sdkAdmissionReached": False, "sourceUnchanged": True,
                      "originalListenerPreserved": True, "declaredInvalidCheckpointInput": True})

    observed = output / f"{source.stem}.initializing"
    observed.mkdir()
    process = await asyncio.create_subprocess_exec(str(executable), "-S", str(Path(__file__).resolve()),
        "--output", str(observed), "--observe-sdk-import", str(source), "--service-arguments",
        *arguments, "--port", str(port), cwd=root,
        env={**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1", "PYTHONPATH": ""},
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    try:
        async with asyncio.timeout(10):
            while True:
                state = os.waitid(os.P_PID, process.pid, os.WSTOPPED | os.WNOHANG | os.WNOWAIT)
                if state is not None:
                    if state.si_code != os.CLD_STOPPED or state.si_status != signal.SIGSTOP:
                        raise AssertionError("Perception initialization observer has an unexpected process state.")
                    break
                if process.returncode is not None:
                    raise AssertionError("Perception service ended before its observed SDK import.")
                await asyncio.sleep(0.01)
        receipt = json.loads((observed / "sdk-import.json").read_bytes())
        if receipt != {"pid": process.pid, "source": str(source), "module": "numpy",
                       "sourceSha256": sha256(source.read_bytes()).hexdigest()}:
            raise AssertionError("SDK import observation does not identify the original service process/source.")
        with socket.create_connection(("127.0.0.1", port), timeout=1) as connection:
            connection.settimeout(0.1)
            connection.sendall(b"GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
            try:
                connection.recv(1)
            except TimeoutError:
                pass
            else:
                raise AssertionError("Initializing perception service returned a health response before SDK/model readiness.")
        pid, code, stdout, stderr = await invoke(source, executable, [*arguments, "--port", str(port)], output, "initializing-port")
        if code != 1 or b"address already in use" not in stderr.lower() or b"ModuleNotFoundError" in stderr or stdout:
            raise AssertionError("Initializing perception listener admitted a competing service.")
        cases.append({"service": source.stem, "mode": "initializing-port", "pid": pid, "exitCode": code,
                      "ownedProcessExited": True, "sdkAdmissionReached": False, "sourceUnchanged": True,
                      "initializingListenerReserved": True, "healthResponseBeforeReady": False,
                      "declaredInvalidCheckpointInput": True})
        process.send_signal(signal.SIGCONT)
        async with asyncio.timeout(10):
            stdout, stderr = await process.communicate()
        (observed / "stdout.txt").write_bytes(stdout)
        (observed / "stderr.txt").write_bytes(stderr)
        if process.returncode != 1 or b"ModuleNotFoundError: No module named 'numpy'" not in stderr or stdout:
            raise AssertionError("Actual absent-SDK failure did not preserve its original import error.")
    finally:
        if process.returncode is None:
            process.send_signal(signal.SIGCONT)
            process.terminate()
            await process.wait()
    with socket.create_server(("127.0.0.1", port)):
        pass
    cases.append({"service": source.stem, "mode": "sdk-import-failure", "pid": process.pid,
                  "exitCode": process.returncode, "ownedProcessExited": True, "sourceUnchanged": True,
                  "sdkAdmissionReached": True, "originalImportErrorPreserved": True,
                  "boundPortReusable": True, "declaredInvalidCheckpointInput": True})
    return cases


async def inspect(args):
    if os.name != "posix":
        raise ValueError("Perception startup observation requires POSIX process suspension.")
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Perception startup output must remain in a new .local/work directory.")
    output.mkdir(parents=True, exist_ok=False)
    executable = args.python.absolute()
    if not executable.is_file():
        raise FileNotFoundError(executable)
    sources = [Path(__file__)]
    cases = []
    for name in ("sam31", "yolo26_depth"):
        source = root / "harness/physical-runtime/src/physical_harness/perception" / f"{name}.py"
        sources.append(source)
        original = source.read_bytes()
        arguments = ["--checkpoint", str(output / "absent-checkpoint"),
                     "--checkpoint-sha256", "invalid-checkpoint-digest",
                     "--source-revision", "invalid-source-revision"]
        if name == "sam31":
            arguments += ["--work-root", str(output)]
            missing_text = b"Checkpoint and work directory must already exist."
            invalid_text = b"Invalid listening port."
        else:
            arguments += ["--device", "cpu"]
            missing_text = invalid_text = b"Checkpoint and listening port must be valid."
        for mode, supplied, expected in (
            ("help", ["--help"], None),
            ("required-arguments", [], b"the following arguments are required"),
            ("invalid-port", [*arguments, "--port", "65536"], invalid_text),
            ("missing-checkpoint", [*arguments, "--port", "18877"], missing_text),
        ):
            process = await asyncio.create_subprocess_exec(str(executable), str(source), *supplied,
                cwd=root, env={**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1"},
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            try:
                async with asyncio.timeout(10):
                    stdout, stderr = await process.communicate()
            finally:
                if process.returncode is None:
                    process.terminate()
                    await process.wait()
            (output / f"{name}.{mode}.stdout.txt").write_bytes(stdout)
            (output / f"{name}.{mode}.stderr.txt").write_bytes(stderr)
            if mode == "help":
                if process.returncode != 0 or b"usage:" not in stdout or stderr:
                    raise AssertionError(f"Perception help did not finish before optional SDK imports: {name}")
            elif (process.returncode != (2 if mode == "required-arguments" else 1)
                  or expected not in stderr or b"ModuleNotFoundError" in stderr or stdout):
                raise AssertionError(f"Perception argument admission did not preserve its original error: {name}/{mode}")
            if source.read_bytes() != original:
                raise AssertionError("Perception argument inspection changed its executable source.")
            cases.append({"service": name, "mode": mode, "pid": process.pid,
                          "exitCode": process.returncode, "ownedProcessExited": True,
                          "sdkAdmissionReached": False, "sourceUnchanged": True})
        cases += await inspect_listener(root, output, executable, source)
        if source.read_bytes() != original:
            raise AssertionError("Perception listener inspection changed its original service source.")
    report = {"sources": {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in sources},
              "cases": cases, "gpuJobs": 0, "modelLoads": 0, "modelCalls": 0,
              "nativeEnvironments": 0, "controls": 0,
              "scope": "Actual SAM/YOLO arguments, listener reservation and absent-SDK failure; declared invalid source-file checkpoint input; no loaded SDK/model or perception-result acceptance."}
    with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, allow_nan=False, indent=2)
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--python", type=Path, default=Path(sys.executable))
    parser.add_argument("--observe-sdk-import", type=Path)
    parser.add_argument("--service-arguments", nargs=argparse.REMAINDER)
    arguments = parser.parse_args()
    if arguments.observe_sdk_import is not None:
        observe_sdk_import(arguments)
    else:
        asyncio.run(inspect(arguments))
