import argparse
import asyncio
from hashlib import sha256
import json
from pathlib import Path
import secrets
import socket
import os

import jsonlines
from websockets.asyncio.client import connect
from websockets.exceptions import InvalidStatus

from physical_harness.policies.client import JsonPolicyCodec, PolicyProtocolError, WebSocketPolicyClient, validate_policy_event
from physical_harness.policies.server import serve_policy
from physical_harness.execution.policy_records import record_policy_request
from physical_harness.validation import ContractValidator


def read_telemetry(path: Path, validator: ContractValidator) -> dict[str, int]:
    states: dict[str, tuple[str, int]] = {}
    count = 0
    with jsonlines.open(path) as reader:
        for record in reader.iter(type=dict, skip_invalid=False):
            if record.get("kind") != "policy_event":
                continue
            event = {key: value for key, value in record.items() if key != "kind"}
            binding = {source: event[field] for field, source in (
                ("requestId", "request_id"), ("executionId", "execution_id"),
                ("taskScope", "task_scope"), ("generation", "generation"),
                ("observationId", "observation_id"))}
            previous = states.get(event["requestId"])
            validate_policy_event(validator, binding, event,
                                  session_id=previous[0] if previous else None,
                                  sequence=previous[1] if previous else 0)
            states[event["requestId"]] = (event["sessionId"], event["sequence"])
            count += 1
    assert count > 0, "Supply an original policy telemetry journal."
    return {"events": count, "requests": len(states)}


async def run(args: argparse.Namespace) -> None:
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    assert output.is_relative_to(root / ".local" / "work")
    output.mkdir(parents=True, exist_ok=False)
    sources = [args.request.resolve(), args.telemetry.resolve(), args.schema.resolve(),
               root / "harness/physical-runtime/src/physical_harness/execution/policy_records.py"]
    hashes = {str(path): sha256(path.read_bytes()).hexdigest() for path in sources}
    validator = ContractValidator.from_path(args.schema)
    request = json.loads(args.request.read_text(encoding="utf-8"))
    validator.parse("PolicyRequest", request)
    assert JsonPolicyCodec().decode(JsonPolicyCodec().encode(request), request) == request
    record_directory = output / "requests"
    record_directory.mkdir()
    record_policy_request(request, record_directory)
    record_path = record_directory / f"{request['request_id']}.json"
    recorded_hash = sha256(record_path.read_bytes()).hexdigest()
    assert json.loads(record_path.read_text(encoding="utf-8")) == request
    if os.name == "posix":
        assert record_path.stat().st_mode & 0o777 == 0o600
    try:
        record_policy_request(request, record_directory)
    except FileExistsError:
        pass
    else:
        raise AssertionError("The original recorded policy request was overwritten.")
    assert sha256(record_path.read_bytes()).hexdigest() == recorded_hash
    telemetry = read_telemetry(args.telemetry, validator)
    key = secrets.token_urlsafe(32)
    closed_port = socket.socket()
    closed_port.bind(("127.0.0.1", 0))
    upstream = WebSocketPolicyClient(f"ws://127.0.0.1:{closed_port.getsockname()[1]}", validator, timeout_s=3)
    upstream_failure: dict[str, str] = {}

    async def forward(original: dict) -> dict:
        try:
            return await upstream.infer(original)
        except (OSError, TimeoutError) as error:
            upstream_failure["error_type"] = f"{type(error).__module__}.{type(error).__qualname__}"
            raise

    server = await serve_policy(forward, validator, api_key=key, timeout_s=5)
    address = server.sockets[0].getsockname()
    uri = f"ws://127.0.0.1:{address[1]}"
    client = WebSocketPolicyClient(uri, validator, api_key=key, timeout_s=10)
    try:
        try:
            async with connect(uri, proxy=None, open_timeout=3):
                raise AssertionError("An unauthenticated policy connection was admitted.")
        except InvalidStatus as error:
            assert error.response.status_code == 401
        try:
            await client.infer(request)
        except PolicyProtocolError as error:
            assert str(error) == "Policy server reported an inference failure."
        else:
            raise AssertionError("An unavailable inference endpoint returned policy actions.")
        assert client.last_response is None and client.motion is None
        assert client._connection is None and upstream._connection is None
        assert upstream_failure, "Require an observed network connection failure."
    finally:
        server.close()
        results = await asyncio.gather(client.close(), upstream.close(), server.wait_closed(), return_exceptions=True)
        closed_port.close()
        errors = [result for result in results if isinstance(result, BaseException)]
        if errors:
            raise BaseExceptionGroup("Policy transport diagnostic cleanup failed.", errors)
    assert not server.connections
    try:
        async with connect(uri, proxy=None, open_timeout=3):
            raise AssertionError("The closed policy listener admitted a connection.")
    except ConnectionRefusedError:
        pass
    assert all(sha256(Path(path).read_bytes()).hexdigest() == digest for path, digest in hashes.items())
    report = {
        "sources": hashes,
        "request_id": request["request_id"],
        "original_request_codec": "passed",
        "original_request_recording": {"sha256": recorded_hash, "exact_content": True,
                                       "duplicate_write_rejected": True, "unchanged_after_rejection": True},
        "original_telemetry": telemetry,
        "bearer_admission": "passed",
        "actual_upstream_connection_failure": upstream_failure,
        "generic_failure_response": "passed",
        "discarded_connections": "passed",
        "listener_closed": "passed",
        "source_files_unchanged": True,
        "model_inference_performed": False,
        "physical_controls_performed": False,
        "scope": "Original policy records and actual WebSocket transport failure; no model or simulator acceptance.",
    }
    (output / "acceptance.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report), flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", required=True, type=Path)
    parser.add_argument("--telemetry", required=True, type=Path)
    parser.add_argument("--schema", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
