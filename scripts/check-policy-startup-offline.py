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
from physical_harness.policies.listener import native_policy_listener
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
          "--checkpoint-sha256", "fbf1abbda5863ebe4193754a9db16a1637d9127f042052b828e2aaeee7cc5dc7"]),
        ("openpi-robodojo-native", "serve_openpi_robodojo_native.py", "physical_harness.policies.services.openpi_robodojo_native",
         ["--checkpoint", str(output / "absent-checkpoint"),
          "--inventory", str(output / "absent-inventory"), "--verification-output", str(output / "verification.json")]),
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
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    upstream = WebSocketPolicyClient("ws://127.0.0.1:1", validator)
    initializing = await serve_policy(upstream.infer, validator, start_serving=False)
    initializing_port = initializing.sockets[0].getsockname()[1]
    try:
        async with initializing:
            for name, filename, module_name, arguments in entries:
                for entry, module in (("example", None), ("module", module_name)):
                    pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable, filename,
                        arguments + ["--port", str(initializing_port)], f"{name}.{entry}", "initializing-port", module)
                    if (exit_code == 0 or b"OSError" not in stderr
                            or b"address already in use" not in stderr.lower() or b"ModuleNotFoundError" in stderr
                            or b"FileNotFoundError" in stderr or stdout):
                        raise AssertionError(f"Initializing policy port did not reject before source/model loading: {name}/{entry}")
                    if (initializing.is_serving() or initializing.connections or upstream._connection is not None
                            or initializing.sockets[0].getsockname() != ("127.0.0.1", initializing_port)):
                        raise AssertionError("Policy CLI changed the original initializing listener or admitted inference.")
                    cases.append({"service": name, "entry": entry, "mode": "initializing-port", "pid": pid,
                                  "exitCode": exit_code, "ownedProcessExited": True,
                                  "originalListenerPreserved": True, "modelLoaded": False})
    finally:
        await upstream.close()
    with native_policy_listener(initializing_port):
        pass
    for name, filename, module_name, arguments in entries:
        for entry, module in (("example", None), ("module", module_name)):
            pid, exit_code, stdout, stderr = await invoke_cli(root, output, executable, filename,
                arguments + ["--checkpoint-sha256", "invalid"], f"{name}.{entry}", "invalid-checkpoint-digest", module)
            if (exit_code != 2 or b"--checkpoint-sha256" not in stderr
                    or b"ModuleNotFoundError" in stderr or b"Traceback" in stderr or stdout):
                raise AssertionError(f"Policy checkpoint digest syntax did not fail during argument admission: {name}/{entry}")
            cases.append({"service": name, "entry": entry, "mode": "invalid-checkpoint-digest", "pid": pid,
                          "exitCode": exit_code, "ownedProcessExited": True, "modelLoaded": False})
            if name in ("openpi-robodojo-json", "openpi-robodojo-native"):
                continue
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
        arguments = ["--checkpoint", str(output / "absent-checkpoint"),
                     "--inventory", str(output / "absent-inventory"),
                     "--verification-output", str(output / "verification.json")]
        with socket.create_server(("127.0.0.1", 0)) as candidate:
            native_port = candidate.getsockname()[1]
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
                 "--verification-output", str(output / "verification.json"), "--port", str(native_port)],
                f"openpi-robodojo-native.{entry}", mode, module)
            if (exit_code == 0 or b"FileNotFoundError" not in stderr or b"ModuleNotFoundError" in stderr
                    or os.fsencode(str(absent)) not in stderr or stdout):
                raise AssertionError(f"Native OpenPI file admission did not preserve its actual source error: {entry}/{mode}")
            with socket.create_server(("127.0.0.1", native_port)):
                pass
            cases.append({"service": "openpi-robodojo-native", "entry": entry, "mode": mode, "pid": pid,
                          "exitCode": exit_code, "ownedProcessExited": True,
                          "originalFileErrorPreserved": True, "boundPortReusable": True, "modelLoaded": False})
        if (output / "verification.json").exists():
            raise AssertionError("Rejected native OpenPI startup published a checkpoint verification result.")
    return cases


async def inspect_reservations(root: Path, output: Path) -> list[dict]:
    validator = ContractValidator.from_path(root / "harness/contracts/schema/physical.schema.json")
    upstream = WebSocketPolicyClient("ws://127.0.0.1:1", validator)
    cases = []
    try:
        server = await serve_policy(upstream.infer, validator, start_serving=False)
        port = server.sockets[0].getsockname()[1]
        async with server:
            if server.is_serving() or server.connections:
                raise AssertionError("Initializing JSON policy server did not reserve its port without WebSocket admission.")
            with socket.create_connection(("127.0.0.1", port), timeout=1) as probe:
                if probe.getpeername() != ("127.0.0.1", port):
                    raise AssertionError("Initializing JSON policy TCP listener has a different endpoint.")
            try:
                contender = await serve_policy(upstream.infer, validator, port=port, start_serving=False)
            except OSError as error:
                if error.errno != errno.EADDRINUSE:
                    raise
                cases.append({"owner": "json", "contender": "json", "originalError": type(error).__name__,
                              "rejected": True, "ownerPreserved": True})
            else:
                contender.close()
                await contender.wait_closed()
                raise AssertionError("Two initializing JSON policy servers acquired the same port.")
            try:
                with native_policy_listener(port):
                    raise AssertionError("Initializing native policy acquired a JSON policy's port.")
            except OSError as error:
                if error.errno != errno.EADDRINUSE:
                    raise
                cases.append({"owner": "json", "contender": "native", "originalError": type(error).__name__,
                              "rejected": True, "ownerPreserved": True})
            if server.sockets[0].getsockname() != ("127.0.0.1", port) or server.is_serving() or server.connections:
                raise AssertionError("Rejected contenders changed the JSON listener's ownership.")
        with native_policy_listener(port) as listener:
            with socket.create_connection(("127.0.0.1", port), timeout=1) as probe:
                if probe.getpeername() != listener.getsockname():
                    raise AssertionError("Initializing native policy TCP listener has a different endpoint.")
            try:
                contender = await serve_policy(upstream.infer, validator, port=port, start_serving=False)
            except OSError as error:
                if error.errno != errno.EADDRINUSE:
                    raise
                cases.append({"owner": "native", "contender": "json", "originalError": type(error).__name__,
                              "rejected": True, "ownerPreserved": True})
            else:
                contender.close()
                await contender.wait_closed()
                raise AssertionError("Initializing JSON policy acquired a native policy's port.")
            try:
                with native_policy_listener(port):
                    raise AssertionError("Two initializing native policy services acquired the same port.")
            except OSError as error:
                if error.errno != errno.EADDRINUSE:
                    raise
                cases.append({"owner": "native", "contender": "native", "originalError": type(error).__name__,
                              "rejected": True, "ownerPreserved": True})
            if listener.getsockname() != ("127.0.0.1", port):
                raise AssertionError("Rejected contenders changed the native listener's ownership.")
        absent = output / "absent-native-policy-source"
        try:
            with native_policy_listener(port):
                absent.read_bytes()
        except FileNotFoundError as error:
            if Path(error.filename) != absent:
                raise
            cases.append({"owner": "native", "contender": "source-file", "originalError": type(error).__name__,
                          "rejected": True, "portReleased": True})
        else:
            raise AssertionError("Native initialization did not preserve its original file error.")
        reopened = await serve_policy(upstream.infer, validator, port=port, start_serving=False)
        async with reopened:
            if reopened.is_serving() or reopened.connections:
                raise AssertionError("Reopened initializing policy admitted WebSocket work.")
        with native_policy_listener(port):
            pass
        attempts = await asyncio.gather(
            serve_policy(upstream.infer, validator, port=port, start_serving=False),
            serve_policy(upstream.infer, validator, port=port, start_serving=False),
            return_exceptions=True,
        )
        owners = [value for value in attempts if not isinstance(value, BaseException)]
        failures = [value for value in attempts if isinstance(value, BaseException)]
        try:
            if (len(owners) != 1 or len(failures) != 1
                    or not isinstance(failures[0], OSError) or failures[0].errno != errno.EADDRINUSE
                    or owners[0].is_serving() or owners[0].connections):
                raise AssertionError("Concurrent initializing JSON policy servers did not preserve one exclusive owner.")
            cases.append({"owner": "json", "contender": "concurrent-json", "originalError": type(failures[0]).__name__,
                          "rejected": True, "ownerPreserved": True})
        finally:
            for owner in owners:
                owner.close()
            await asyncio.gather(*(owner.wait_closed() for owner in owners))
        with native_policy_listener(port):
            pass
        if upstream._connection is not None:
            raise AssertionError("Policy reservation inspection opened the inference upstream.")
    finally:
        await upstream.close()
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
            if server.is_serving() or server.connections or received:
                raise AssertionError("Initializing policy admitted a WebSocket handler or original request.")
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
    restarted = await serve_policy(forward, validator, port=port, start_serving=False)
    async with restarted:
        if restarted.is_serving() or restarted.connections:
            raise AssertionError("Restarted policy admitted work before readiness.")
        await restarted.start_serving()
        if not restarted.is_serving():
            raise AssertionError("Policy could not restart after actual request traffic.")
    if restarted.is_serving() or restarted.connections:
        raise AssertionError("Restarted policy retained network resources after closure.")

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
            "allPortsReusableAfterClosure": True, "actualPolicyRestartAfterTraffic": True, "policyResponses": 0}


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
    reservations = await inspect_reservations(root, output)
    listener = await inspect_listener(root, output, request)
    if original.read_bytes() != original_data:
        raise AssertionError("Policy startup inspection changed its original request.")
    sources = [Path(__file__), root / "harness/physical-runtime/src/physical_harness/policies/server.py",
               root / "harness/physical-runtime/src/physical_harness/policies/listener.py",
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
              "originalRequestSha256": sha256(original_data).hexdigest(), "cliCases": cli,
              "reservationCases": reservations, "listener": listener,
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
