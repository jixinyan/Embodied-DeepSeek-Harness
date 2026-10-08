import argparse
import asyncio
import copy
import errno
from hashlib import sha256
import json
import os
from pathlib import Path
import socket
import sys

from websockets.asyncio.client import connect

from physical_harness.policies.client import PolicyProtocolError, WebSocketPolicyClient
from physical_harness.policies.server import serve_policy
from physical_harness.validation import ContractValidator


async def invoke_cli(root: Path, output: Path, executable: Path, filename: str,
                     arguments: list[str], name: str, mode: str) -> tuple:
    process = await asyncio.create_subprocess_exec(str(executable), str(root / "examples/policies" / filename),
        *arguments, cwd=root,
        env={**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1",
             "PYTHONPATH": str(root / "harness/physical-runtime/src")},
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
    return process.pid, process.returncode, stdout, stderr


async def inspect_cli(root: Path, output: Path, executable: Path) -> list[dict]:
    entries = (
        ("gr00t-robocasa", "serve_gr00t_n1d6_robocasa.py", ["--checkpoint", str(output / "absent-checkpoint")]),
        ("gr00t-behavior", "serve_gr00t_n1d6_behavior.py", ["--checkpoint", str(output / "absent-checkpoint")]),
        ("lerobot-robotwin", "serve_lerobot_pi05_robotwin.py", ["--checkpoint", str(output / "absent-checkpoint"),
                                                              "--tokenizer", str(output / "absent-tokenizer")]),
        ("openpi-robodojo-json", "serve_openpi_robodojo.py", ["--native-policy-uri", "ws://127.0.0.1:1",
                                                           "--checkpoint-sha256", "invalid-checkpoint-digest"]),
    )
    cases = []
    with socket.create_server(("127.0.0.1", 0)) as listener:
        port = listener.getsockname()[1]
        for name, filename, arguments in entries:
            for mode in ("help", "occupied-port"):
                pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable, filename,
                    arguments + (["--help"] if mode == "help" else ["--port", str(port)]), name, mode)
                if mode == "help":
                    if exit_code != 0 or b"usage:" not in stdout or stderr:
                        raise AssertionError(f"Policy CLI help did not finish before optional model loading: {name}")
                elif (exit_code == 0 or b"OSError" not in stderr
                      or b"address already in use" not in stderr.lower() or b"ModuleNotFoundError" in stderr
                      or stdout):
                    raise AssertionError(f"Occupied policy port did not fail before model loading: {name}")
                with socket.create_connection(("127.0.0.1", port), timeout=1) as probe:
                    accepted, _ = listener.accept()
                    with accepted:
                        if accepted.getpeername() != probe.getsockname():
                            raise AssertionError("Policy CLI altered the diagnostic-owned original listener.")
                cases.append({"service": name, "mode": mode, "pid": pid,
                              "exitCode": exit_code, "ownedProcessExited": True,
                              "originalListenerPreserved": True, "modelLoaded": False})
    with socket.create_server(("127.0.0.1", port)):
        pass
    for name, filename, arguments in entries[:3]:
        with socket.create_server(("127.0.0.1", 0)) as candidate:
            selected_port = candidate.getsockname()[1]
        pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable, filename,
            arguments + ["--port", str(selected_port)], name, "missing-checkpoint")
        if exit_code == 0 or b"FileNotFoundError" not in stderr or b"ModuleNotFoundError" in stderr or stdout:
            raise AssertionError(f"Policy checkpoint admission did not preserve its actual source error: {name}")
        with socket.create_server(("127.0.0.1", selected_port)):
            pass
        cases.append({"service": name, "mode": "missing-checkpoint", "pid": pid,
                      "exitCode": exit_code, "ownedProcessExited": True,
                      "boundPortReusable": True, "originalFileErrorPreserved": True, "modelLoaded": False})
    pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable,
        "serve_openpi_robodojo_native.py", ["--help"], "openpi-robodojo-native", "help")
    if exit_code != 0 or b"usage:" not in stdout or stderr:
        raise AssertionError("Native OpenPI help did not finish before optional model loading.")
    cases.append({"service": "openpi-robodojo-native", "mode": "help", "pid": pid,
                  "exitCode": exit_code, "ownedProcessExited": True, "modelLoaded": False})
    return cases


async def inspect_listener(root: Path, output: Path, request: dict) -> dict:
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    received = []
    original_failure = []
    cold_connection_error = None
    with socket.socket() as endpoint:
        endpoint.bind(("127.0.0.1", 0))
        upstream = WebSocketPolicyClient(f"ws://127.0.0.1:{endpoint.getsockname()[1]}", validator, timeout_s=1)

        async def forward(original: dict) -> dict:
            received.append(copy.deepcopy(original))
            try:
                return await upstream.infer(original)
            except (OSError, TimeoutError) as error:
                original_failure.append(type(error).__name__)
                raise

        server = await serve_policy(forward, validator, start_serving=False, timeout_s=3)
        port = server.sockets[0].getsockname()[1]
        uri = f"ws://127.0.0.1:{port}"
        client = WebSocketPolicyClient(uri, validator, timeout_s=5)
        try:
            if server.is_serving() or received:
                raise AssertionError("A bound unstarted policy server accepted inference.")
            try:
                async with connect(uri, proxy=None, open_timeout=1):
                    raise AssertionError("Policy startup admitted a connection before service readiness.")
            except (ConnectionRefusedError, TimeoutError) as error:
                cold_connection_error = type(error).__name__
            await server.start_serving()
            if not server.is_serving():
                raise AssertionError("Actual policy server did not enter its serving state.")
            try:
                await client.infer(request)
            except PolicyProtocolError as error:
                if str(error) != "Policy server reported an inference failure.":
                    raise
            else:
                raise AssertionError("Unavailable policy upstream returned model actions.")
            if received != [request] or len(original_failure) != 1:
                raise AssertionError("Started policy service differs from its actual original request/failure.")
        finally:
            server.close()
            errors = [result for result in await asyncio.gather(
                client.close(), upstream.close(), server.wait_closed(), return_exceptions=True
            ) if isinstance(result, BaseException)]
            if errors:
                raise BaseExceptionGroup("Policy startup diagnostic cleanup failed.", errors)
        if server.is_serving() or server.connections or client._connection is not None or upstream._connection is not None:
            raise AssertionError("Policy startup left actual network resources admitted.")
    with socket.create_server(("127.0.0.1", port)):
        pass

    failed_server = await serve_policy(forward, validator, start_serving=False)
    failed_port = failed_server.sockets[0].getsockname()[1]
    actual_file_error = False
    try:
        async with failed_server:
            (output / "absent-policy-source").read_bytes()
    except FileNotFoundError:
        actual_file_error = True
    if not actual_file_error or failed_server.is_serving() or failed_server.connections:
        raise AssertionError("Policy initialization failure did not close its unstarted server.")
    with socket.create_server(("127.0.0.1", failed_port)):
        pass

    with socket.create_server(("127.0.0.1", 0)) as occupied:
        occupied_port = occupied.getsockname()[1]
        try:
            unexpected = await serve_policy(forward, validator, port=occupied_port, start_serving=False)
        except OSError as error:
            if error.errno != errno.EADDRINUSE:
                raise
        else:
            unexpected.close()
            await unexpected.wait_closed()
            raise AssertionError("Policy initialization reused an already listening port.")
    return {"unstartedHandshakeRejected": True, "originalColdConnectionError": cold_connection_error,
            "actualStartServing": True,
            "actualOriginalRequestForwarded": True, "originalNetworkError": original_failure[0],
            "occupiedPortRejected": True, "originalFileErrorPreserved": actual_file_error,
            "allPortsReusableAfterClosure": True, "policyResponses": 0}


async def inspect(args) -> None:
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if not output.is_relative_to(root / ".local/work"):
        raise ValueError("Policy startup output must remain in a new .local/work directory.")
    output.mkdir(parents=True, exist_ok=False)
    original = args.request.resolve(strict=True)
    original_data = original.read_bytes()
    request = json.loads(original_data)
    ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json").parse("PolicyRequest", request)
    executable = args.python.absolute()
    if not executable.is_file():
        raise FileNotFoundError(executable)
    cli = await inspect_cli(root, output, executable)
    listener = await inspect_listener(root, output, request)
    if original.read_bytes() != original_data:
        raise AssertionError("Policy startup inspection changed its original request.")
    sources = [Path(__file__), root / "harness/physical-runtime/src/physical_harness/policies/server.py",
               root / "harness/physical-runtime/src/physical_harness/policies/client.py",
               root / "harness/physical-runtime/src/physical_harness/policies/inference.py",
               root / "harness/contracts/schema/physical.schema.json",
               *(root / "examples/policies" / filename for filename in (
                   "serve_gr00t_n1d6_robocasa.py", "serve_gr00t_n1d6_behavior.py",
                   "serve_lerobot_pi05_robotwin.py", "serve_openpi_robodojo.py", "serve_openpi_robodojo_native.py"))]
    report = {"sources": {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest() for path in sources},
              "originalRequestSha256": sha256(original_data).hexdigest(), "cliCases": cli, "listener": listener,
              "gpuJobs": 0, "modelLoads": 0, "modelCalls": 0, "nativeEnvironments": 0, "controls": 0,
              "scope": "Actual policy CLI, bound listeners and original request network failure; no loaded-model acceptance."}
    with (output / "acceptance.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, allow_nan=False, indent=2)
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--python", type=Path, default=Path(sys.executable))
    asyncio.run(inspect(parser.parse_args()))
