"""Bounded policy WebSocket requests with replaceable wire encoding; no device control."""
from __future__ import annotations

import asyncio
import copy
import json
import math
from typing import Any, Protocol
from urllib.parse import urlsplit

from physical_harness.validation import ContractValidator


class PolicyProtocolError(ValueError):
    """The peer did not return the expected policy response."""


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise PolicyProtocolError("Duplicate JSON field.")
        result[key] = value
    return result


class PolicyCodec(Protocol):
    """Map a provider's wire format to the canonical EDH request/response contracts."""
    def encode(self, request: dict[str, Any]) -> str | bytes: ...
    def decode(self, response: str | bytes, request: dict[str, Any]) -> dict[str, Any]: ...


class JsonPolicyCodec:
    """Default EDH JSON protocol. Other server formats require an explicit codec."""
    def encode(self, request: dict[str, Any]) -> str:
        return json.dumps(request, allow_nan=False, separators=(",", ":"))

    def decode(self, response: str | bytes, request: dict[str, Any]) -> dict[str, Any]:
        value = json.loads(response, object_pairs_hook=_unique_object)
        if not isinstance(value, dict):
            raise PolicyProtocolError("Expected an object policy response.")
        if "error" in value:
            raise PolicyProtocolError("Policy server reported an inference failure.")
        return value


def validate_response(validator: ContractValidator, request: dict[str, Any], response: Any) -> dict[str, Any]:
    validator.parse("ActionChunk", response)
    for key in ("request_id", "execution_id", "task_scope", "generation", "observation_id", "valid_until", "action_spec"):
        if response[key] != request[key]:
            raise PolicyProtocolError(f"Policy response has a mismatched {key}.")
    if len(response["actions"]) > request["max_actions"]:
        raise PolicyProtocolError("Policy response exceeds the requested action budget.")
    channels = request["action_spec"]["channels"]
    for action in response["actions"]:
        if len(action) != len(channels):
            raise PolicyProtocolError("Action dimensions do not match ActionSpec.")
        if any(value < channel["minimum"] or value > channel["maximum"] for value, channel in zip(action, channels)):
            raise PolicyProtocolError("Policy action exceeds configured channel limits.")
    return response


class WebSocketPolicyClient:
    """One in-flight inference per connection. Failures discard the connection; no implicit replay."""
    def __init__(self, uri: str, validator: ContractValidator, *, codec: PolicyCodec | None = None,
                 api_key: str | None = None, timeout_s: float = 30, max_bytes: int = 32 * 1024 * 1024) -> None:
        url = urlsplit(uri)
        if url.scheme not in ("ws", "wss") or not url.hostname or url.username or url.password or url.fragment:
            raise ValueError("Expected a ws(s) endpoint without embedded credentials or fragment.")
        if not math.isfinite(timeout_s) or timeout_s <= 0 or type(max_bytes) is not int or max_bytes <= 0:
            raise ValueError("Policy transport bounds must be positive.")
        if api_key is not None and not api_key:
            raise ValueError("Configured policy key must not be empty.")
        self._uri, self._validator = uri, validator
        self._codec = codec or JsonPolicyCodec()
        self._api_key, self._timeout, self._max_bytes = api_key, timeout_s, max_bytes
        self._connection: Any = None
        self._active: asyncio.Task[Any] | None = None
        self._closed = False

    async def _disconnect(self) -> None:
        connection, self._connection = self._connection, None
        if connection is not None:
            await connection.close()

    async def infer(self, request: dict[str, Any]) -> dict[str, Any]:
        if self._closed or self._active is not None:
            raise RuntimeError("Policy client is closed or already has an in-flight request.")
        bound = copy.deepcopy(request)
        self._validator.parse("PolicyRequest", bound)
        self._validator.parse("ActionSpec", bound["action_spec"])
        encoded = self._codec.encode(bound)
        if len(encoded.encode("utf-8") if isinstance(encoded, str) else encoded) > self._max_bytes:
            raise PolicyProtocolError("Policy request exceeds the transport byte limit.")
        self._active = asyncio.current_task()
        try:
            async with asyncio.timeout(self._timeout):
                if self._connection is None:
                    # Optional dependency: importing the CPU contracts doesn't load a socket provider.
                    from websockets.asyncio.client import connect
                    self._connection = await connect(
                        self._uri, proxy=None, compression=None,
                        additional_headers={"Authorization": f"Bearer {self._api_key}"} if self._api_key else None,
                        open_timeout=self._timeout, close_timeout=1,
                        max_size=self._max_bytes, max_queue=4,
                    )
                if self._closed:
                    raise RuntimeError("Policy client closed while connecting.")
                await self._connection.send(encoded)
                message = await self._connection.recv()
                response = self._codec.decode(message, copy.deepcopy(bound))
                return copy.deepcopy(validate_response(self._validator, bound, response))
        except BaseException:
            # Closing after cancellation/timeout prevents a late response becoming the next result.
            try:
                await self._disconnect()
            except Exception:
                pass
            raise
        finally:
            self._active = None

    async def close(self) -> None:
        self._closed = True
        active = self._active
        if active is not None and active is not asyncio.current_task():
            active.cancel()
            try:
                await active
            except (Exception, asyncio.CancelledError):
                pass
        await self._disconnect()
