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
                     arguments: list[str], name: str, mode: str, module: str | None = None) -> tuple:
    entry = ["-m", module] if module is not None else [str(root / "examples/policies" / filename)]
    process = await asyncio.create_subprocess_exec(str(executable), *entry,
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
        ("gr00t-robocasa", "serve_gr00t_n1d6_robocasa.py", "physical_harness.policies.services.gr00t_n1d6_robocasa",
         ["--checkpoint", str(output / "absent-checkpoint")]),
        ("gr00t-behavior", "serve_gr00t_n1d6_behavior.py", "physical_harness.policies.services.gr00t_n1d6_behavior",
         ["--checkpoint", str(output / "absent-checkpoint")]),
        ("lerobot-robotwin", "serve_lerobot_pi05_robotwin.py", "physical_harness.policies.services.lerobot_pi05_robotwin",
         ["--checkpoint", str(output / "absent-checkpoint"),
                                                              "--tokenizer", str(output / "absent-tokenizer")]),
        ("openpi-robodojo-json", "serve_openpi_robodojo.py", "physical_harness.policies.services.openpi_robodojo",
         ["--native-policy-uri", "ws://127.0.0.1:1",
                                                           "--checkpoint-sha256", "invalid-checkpoint-digest"]),
    )
    cases = []
    with socket.create_server(("127.0.0.1", 0)) as listener:
        port = listener.getsockname()[1]
        for name, filename, module_name, arguments in entries:
            for entry, module in (("example", None), ("module", module_name)):
                for mode in ("help", "occupied-port"):
                    pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable, filename,
                        arguments + (["--help"] if mode == "help" else ["--port", str(port)]),
                        f"{name}.{entry}", mode, module)
                    if mode == "help":
                        if exit_code != 0 or b"usage:" not in stdout or stderr:
                            raise AssertionError(f"Policy CLI help did not finish before optional model loading: {name}/{entry}")
                    elif (exit_code == 0 or b"OSError" not in stderr
                          or b"address already in use" not in stderr.lower() or b"ModuleNotFoundError" in stderr
                          or stdout):
                        raise AssertionError(f"Occupied policy port did not fail before model loading: {name}/{entry}")
                    with socket.create_connection(("127.0.0.1", port), timeout=1) as probe:
                        accepted, _ = listener.accept()
                        with accepted:
                            if accepted.getpeername() != probe.getsockname():
                                raise AssertionError("Policy CLI altered the diagnostic-owned original listener.")
                    cases.append({"service": name, "entry": entry, "mode": mode, "pid": pid,
                                  "exitCode": exit_code, "ownedProcessExited": True,
                                  "originalListenerPreserved": True, "modelLoaded": False})
    with socket.create_server(("127.0.0.1", port)):
        pass
    for name, filename, module_name, arguments in entries[:3]:
        for entry, module in (("example", None), ("module", module_name)):
            pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable, filename,
                arguments + ["--checkpoint-sha256", "invalid"], f"{name}.{entry}", "invalid-checkpoint-digest", module)
            if (exit_code != 2 or b"--checkpoint-sha256" not in stderr
                    or b"ModuleNotFoundError" in stderr or b"Traceback" in stderr or stdout):
                raise AssertionError(f"Policy checkpoint digest syntax did not fail during argument admission: {name}/{entry}")
            cases.append({"service": name, "entry": entry, "mode": "invalid-checkpoint-digest", "pid": pid,
                          "exitCode": exit_code, "ownedProcessExited": True, "modelLoaded": False})
            with socket.create_server(("127.0.0.1", 0)) as candidate:
                selected_port = candidate.getsockname()[1]
            pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable, filename,
                arguments + ["--port", str(selected_port)], f"{name}.{entry}", "missing-checkpoint", module)
            if (exit_code == 0 or b"FileNotFoundError" not in stderr or b"ModuleNotFoundError" in stderr
                    or os.fsencode(str(output / "absent-checkpoint")) not in stderr or stdout):
                raise AssertionError(f"Policy checkpoint admission did not preserve its actual source error: {name}/{entry}")
            with socket.create_server(("127.0.0.1", selected_port)):
                pass
            cases.append({"service": name, "entry": entry, "mode": "missing-checkpoint", "pid": pid,
                          "exitCode": exit_code, "ownedProcessExited": True,
                          "boundPortReusable": True, "originalFileErrorPreserved": True, "modelLoaded": False})
    for entry, module in (("example", None), ("module", "physical_harness.policies.services.openpi_robodojo_native")):
        pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable,
            "serve_openpi_robodojo_native.py", ["--help"], f"openpi-robodojo-native.{entry}", "help", module)
        if exit_code != 0 or b"usage:" not in stdout or stderr:
            raise AssertionError(f"Native OpenPI help did not finish before optional model loading: {entry}")
        cases.append({"service": "openpi-robodojo-native", "entry": entry, "mode": "help", "pid": pid,
                      "exitCode": exit_code, "ownedProcessExited": True, "modelLoaded": False})
        arguments = ["--checkpoint", str(output / "absent-checkpoint"),
                     "--inventory", str(output / "absent-inventory"),
                     "--verification-output", str(output / "verification.json")]
        pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable,
            "serve_openpi_robodojo_native.py", arguments + ["--checkpoint-sha256", "invalid"],
            f"openpi-robodojo-native.{entry}", "invalid-checkpoint-digest", module)
        if (exit_code != 2 or b"--checkpoint-sha256" not in stderr
                or b"ModuleNotFoundError" in stderr or b"Traceback" in stderr or stdout):
            raise AssertionError(f"Native OpenPI checkpoint digest syntax did not fail during argument admission: {entry}")
        cases.append({"service": "openpi-robodojo-native", "entry": entry,
                      "mode": "invalid-checkpoint-digest", "pid": pid, "exitCode": exit_code,
                      "ownedProcessExited": True, "modelLoaded": False})
        for selected_port in (-1, 0, 65536):
            mode = f"invalid-port-{selected_port}"
            pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable,
                "serve_openpi_robodojo_native.py", arguments + ["--port", str(selected_port)],
                f"openpi-robodojo-native.{entry}", mode, module)
            if (exit_code != 2 or b"--port must be between 1 and 65535." not in stderr
                    or b"ModuleNotFoundError" in stderr or b"Traceback" in stderr or stdout):
                raise AssertionError(f"Native OpenPI port admission did not finish before source/model loading: {entry}")
            cases.append({"service": "openpi-robodojo-native", "entry": entry, "mode": mode, "pid": pid,
                          "exitCode": exit_code, "ownedProcessExited": True, "modelLoaded": False})
        for mode, checkpoint, absent in (
                ("missing-checkpoint", output / "absent-checkpoint", output / "absent-checkpoint"),
                ("missing-inventory", root, output / "absent-inventory")):
            pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable,
                "serve_openpi_robodojo_native.py",
                ["--checkpoint", str(checkpoint), "--inventory", str(output / "absent-inventory"),
                 "--verification-output", str(output / "verification.json")],
                f"openpi-robodojo-native.{entry}", mode, module)
            if (exit_code == 0 or b"FileNotFoundError" not in stderr or b"ModuleNotFoundError" in stderr
                    or os.fsencode(str(absent)) not in stderr or stdout):
                raise AssertionError(f"Native OpenPI file admission did not preserve its actual source error: {entry}/{mode}")
            cases.append({"service": "openpi-robodojo-native", "entry": entry, "mode": mode, "pid": pid,
                          "exitCode": exit_code, "ownedProcessExited": True,
                          "originalFileErrorPreserved": True, "modelLoaded": False})
        if (output / "verification.json").exists():
            raise AssertionError("Rejected native OpenPI startup published a checkpoint verification result.")
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
               root / "harness/physical-runtime/src/physical_harness/policies/provenance.py",
               root / "harness/physical-runtime/src/physical_harness/policies/openpi_checkpoint.py",
               root / "harness/contracts/schema/physical.schema.json",
               *(root / "examples/policies" / filename for filename in (
                   "serve_gr00t_n1d6_robocasa.py", "serve_gr00t_n1d6_behavior.py",
                   "serve_lerobot_pi05_robotwin.py", "serve_openpi_robodojo.py", "serve_openpi_robodojo_native.py")),
               *(root / "harness/physical-runtime/src/physical_harness/policies/services").glob("*.py")]
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
