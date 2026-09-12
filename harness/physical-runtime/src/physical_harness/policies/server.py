"""Optional EDH WebSocket server wrapper for a deployment-owned inference callback."""
from __future__ import annotations

import asyncio
import copy
from http import HTTPStatus
import json
import math
import secrets
from typing import Any, Awaitable, Callable

from physical_harness.validation import ContractValidator
from .client import JsonPolicyCodec, validate_response


async def serve_policy(infer: Callable[[dict[str, Any]], Awaitable[list[list[float]]]],
                       validator: ContractValidator, *, host: str = "127.0.0.1", port: int = 0,
                       api_key: str | None = None, timeout_s: float = 30,
                       max_bytes: int = 32 * 1024 * 1024, ssl: Any = None) -> Any:
    """Return a websockets Server; caller closes it and awaits wait_closed during shutdown."""
    from websockets.asyncio.server import serve
    from websockets.exceptions import ConnectionClosed
    if not math.isfinite(timeout_s) or timeout_s <= 0 or type(max_bytes) is not int or max_bytes <= 0:
        raise ValueError("Policy transport bounds must be positive.")
    if api_key is not None and not api_key:
        raise ValueError("Configured policy key must not be empty.")
    codec = JsonPolicyCodec()

    def authenticate(connection: Any, request: Any) -> Any:
        if api_key is not None and not secrets.compare_digest(request.headers.get("Authorization", ""), f"Bearer {api_key}"):
            return connection.respond(HTTPStatus.UNAUTHORIZED, "Unauthorized\n")
        return None

    async def handler(connection: Any) -> None:
        async for message in connection:
            try:
                request = codec.decode(message, {})
                validator.parse("PolicyRequest", request)
                validator.parse("ActionSpec", request["action_spec"])
                async with asyncio.timeout(timeout_s):
                    actions = await infer(copy.deepcopy(request))
                response = {key: copy.deepcopy(request[key]) for key in (
                    "request_id", "execution_id", "task_scope", "generation", "observation_id", "valid_until", "action_spec")}
                response.update(schema_version="physical.action_chunk.v1", actions=actions)
                validate_response(validator, request, response)
                encoded = json.dumps(response, allow_nan=False)
                if len(encoded.encode("utf-8")) > max_bytes:
                    raise ValueError("Policy response too large.")
                await connection.send(encoded)
            except ConnectionClosed:
                return
            except Exception:
                # Do not send exception strings that may contain model paths, keys or request bytes.
                try:
                    await connection.send(json.dumps({"error": "policy_inference_failed"}))
                    await connection.close(code=1011, reason="Policy request failed")
                except ConnectionClosed:
                    pass
                return

    return await serve(handler, host, port, process_request=authenticate, ssl=ssl,
                       compression=None, max_size=max_bytes, max_queue=4, close_timeout=1)
