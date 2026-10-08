from __future__ import annotations

import asyncio
import copy
from http import HTTPStatus
import json
import math
import secrets
import sys
import traceback
from typing import Any, Awaitable, Callable

from physical_harness.validation import ContractValidator
from physical_harness.execution.modes import ExecutionMode, normalize_mode_response
from .client import JsonPolicyCodec, validate_response
from .provenance import validate_checkpoint_sha256


async def serve_policy(infer: Callable[[dict[str, Any]], Awaitable[list[list[float]] | dict[str, Any]]],
                       validator: ContractValidator, *, host: str = "127.0.0.1", port: int = 0,
                       api_key: str | None = None, timeout_s: float = 30,
                       max_bytes: int = 32 * 1024 * 1024, ssl: Any = None,
                       start_serving: bool = True,
                       checkpoint_sha256: Callable[[], str] | None = None) -> Any:
    """Return a websockets Server; caller closes it and awaits wait_closed during shutdown."""
    from websockets.asyncio.server import serve
    from websockets.exceptions import ConnectionClosed
    if not math.isfinite(timeout_s) or timeout_s <= 0 or type(max_bytes) is not int or max_bytes <= 0:
        raise ValueError("Policy transport bounds must be positive.")
    if api_key is not None and not api_key:
        raise ValueError("Configured policy key must not be empty.")
    if type(start_serving) is not bool:
        raise ValueError("Policy connection admission must be a boolean.")
    if checkpoint_sha256 is not None and not callable(checkpoint_sha256):
        raise ValueError("Policy checkpoint identity requires its service-owned reader.")
    codec = JsonPolicyCodec()

    def authenticate(connection: Any, request: Any) -> Any:
        if api_key is not None and not secrets.compare_digest(request.headers.get("Authorization", ""), f"Bearer {api_key}"):
            return connection.respond(HTTPStatus.UNAUTHORIZED, "Unauthorized\n")
        return None

    async def handler(connection: Any) -> None:
        async for message in connection:
            request_id: str | None = None
            try:
                request = codec.decode(message, {})
                validator.parse("PolicyRequest", request)
                validator.parse("ActionSpec", request["action_spec"])
                request_id = request["request_id"]
                identity = validate_checkpoint_sha256(checkpoint_sha256()) if checkpoint_sha256 is not None else None
                if "checkpoint_sha256" in request and request["checkpoint_sha256"] != identity:
                    raise ValueError("Policy request selects a different or unidentified checkpoint.")
                async with asyncio.timeout(timeout_s):
                    result = await infer(copy.deepcopy(request))
                mode = ExecutionMode.parse(
                    request.get("observation", {}).get("execution_mode", ExecutionMode.POLICY.value)
                    if isinstance(request.get("observation"), dict) else ExecutionMode.POLICY.value
                )
                if isinstance(result, dict):
                    # 服务端和客户端分别检查 execution mode 的响应内容。
                    response = copy.deepcopy(result)
                    if identity is not None:
                        if "checkpoint_sha256" in response and response["checkpoint_sha256"] != identity:
                            raise ValueError("Policy response changed its service checkpoint identity.")
                        response["checkpoint_sha256"] = identity
                    validate_response(validator, request, normalize_mode_response(response, request, mode))
                else:
                    response = {key: copy.deepcopy(request[key]) for key in (
                        "request_id", "execution_id", "task_scope", "generation", "observation_id", "valid_until", "action_spec")}
                    response.update(schema_version="physical.action_chunk.v1", actions=result)
                    if identity is not None:
                        response["checkpoint_sha256"] = identity
                    validate_response(validator, request, response)
                if identity is not None and response.get("checkpoint_sha256") != identity:
                    raise ValueError("Policy response changed its service checkpoint identity.")
                encoded = json.dumps(response, allow_nan=False)
                if len(encoded.encode("utf-8")) > max_bytes:
                    raise ValueError("Policy response too large.")
                await connection.send(encoded)
            except ConnectionClosed:
                return
            except Exception as error:
                print(json.dumps({
                    "event": "policy_inference_failed",
                    "request_id": request_id,
                    "error_type": f"{type(error).__module__}.{type(error).__qualname__}",
                    "traceback": [
                        {"file": frame.filename, "line": frame.lineno, "function": frame.name}
                        for frame in traceback.extract_tb(error.__traceback__)
                    ],
                }), file=sys.stderr, flush=True)
                # 客户端只接收公开错误标识，详细错误保存在服务端日志。
                try:
                    await connection.send(json.dumps({"error": "policy_inference_failed"}))
                    await connection.close(code=1011, reason="Policy request failed")
                except ConnectionClosed:
                    pass
                return

    return await serve(handler, host, port, process_request=authenticate, ssl=ssl,
                       compression=None, max_size=max_bytes, max_queue=4, close_timeout=1,
                       start_serving=start_serving)
