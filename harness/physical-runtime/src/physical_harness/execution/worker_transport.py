from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
import faulthandler
import json
import math
import os
import sys
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from physical_harness.execution.worker import NativeWorkerSession


MAX_MESSAGE_BYTES = 32 * 1024 * 1024


class _WriteProtocol(asyncio.streams.FlowControlMixin):
    def __init__(self) -> None:
        super().__init__()
        self._closed = asyncio.get_running_loop().create_future()

    def connection_lost(self, error: Exception | None) -> None:
        super().connection_lost(error)
        if error is None:
            self._closed.set_result(None)
        else:
            self._closed.set_exception(error)

    def _get_close_waiter(self, stream: asyncio.StreamWriter) -> asyncio.Future[None]:
        return self._closed


def _nonfinite_constant(value: str) -> None:
    raise ValueError(f"Native worker request contains a nonfinite JSON constant: {value}.")


def _finite_float(value: str) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Native worker request contains a nonfinite JSON number.")
    return number


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for name, value in pairs:
        if name in result:
            raise ValueError("Native worker request contains a duplicate JSON field.")
        result[name] = value
    return result


def _request(line: bytes) -> dict[str, Any]:
    payload = line.removesuffix(b"\n").removesuffix(b"\r")
    if len(payload) > MAX_MESSAGE_BYTES:
        raise ValueError("Native worker request exceeds the transport bound.")
    message = json.loads(payload.decode("utf-8"), parse_constant=_nonfinite_constant,
                         parse_float=_finite_float, object_pairs_hook=_unique_object)
    if (type(message) is not dict or set(message) - {"id", "op", "args"}
            or not {"id", "op"} <= set(message)):
        raise ValueError("Invalid native worker request envelope.")
    if (not isinstance(message["id"], str) or not 1 <= len(message["id"]) <= 128
            or not message["id"].strip() or not isinstance(message["op"], str)
            or not 1 <= len(message["op"]) <= 64 or not message["op"].strip()):
        raise ValueError("Invalid native worker request identity or operation.")
    return message


async def serve(session_factory: Callable[[Callable[[dict[str, Any]], Awaitable[None]]], NativeWorkerSession]) -> None:
    loop = asyncio.get_running_loop()
    trace_after = os.environ.get("EDH_WORKER_TRACE_AFTER_S")
    interval = None
    if trace_after is not None:
        interval = float(trace_after)
        if not math.isfinite(interval) or not 1 <= interval <= 300:
            raise ValueError("Worker diagnostic interval must be 1 to 300 seconds.")
    diagnostic: asyncio.TimerHandle | None = None

    def dump_tasks() -> None:
        nonlocal diagnostic
        for task in asyncio.all_tasks(loop):
            print(f"Worker coroutine {task.get_name()}: {task!r}", file=sys.stderr)
            task.print_stack(limit=8, file=sys.stderr)
        diagnostic = loop.call_later(interval, dump_tasks)

    writer: asyncio.StreamWriter | None = None
    input_transport: asyncio.ReadTransport | None = None
    output_lock = asyncio.Lock()

    async def emit(message: dict[str, Any]) -> None:
        try:
            serialized = json.dumps(message, allow_nan=False, separators=(",", ":")).encode("utf-8")
            if len(serialized) > MAX_MESSAGE_BYTES:
                raise ValueError("Native worker message exceeds the transport bound.")
            if writer is None:
                raise RuntimeError("Native worker output pipe is unavailable.")
            async with asyncio.timeout(session.transport_write_timeout_s):
                async with output_lock:
                    writer.write(serialized + b"\n")
                    await writer.drain()
        except BaseException:
            session.revoke_lease()
            raise

    session = session_factory(emit)
    handlers = {
        "initialize": session.initialize,
        "open_task": session.open_task,
        "start": session.start,
        "pause": session.pause,
        "stop": lambda args: session.pause(args, terminal=True),
        "end": lambda args: session.pause(args, terminal=True, review=True),
        "resume": session.resume,
        "capture": session.capture,
        "capture_review": session.capture_review,
        "measure_object": session.measure_object,
        "turn_view": session.turn_view,
        "rotate_view": session.rotate_view,
        "check": session.check,
        "inspect_simulator": session.inspect_simulator,
        "close_task": lambda _args: session.close_task(),
        "close": lambda _args: session.close(),
    }
    active: set[asyncio.Task[None]] = set()
    active_ids: set[str] = set()

    async def handle(message: dict[str, Any]) -> None:
        request_id = message["id"]
        try:
            try:
                operation = message["op"]
                if operation not in handlers:
                    raise ValueError("Unknown native worker operation.")
                arguments = message.get("args", {})
                if type(arguments) is not dict:
                    raise ValueError("Expected a JSON object.")
                result = await handlers[operation](arguments)
            except Exception as error:
                await emit({"id": request_id, "error": {"type": type(error).__name__, "message": str(error)}})
            else:
                await emit({"id": request_id, "result": result})
        finally:
            active_ids.remove(request_id)

    errors: list[BaseException] = []
    try:
        transport, protocol = await loop.connect_write_pipe(_WriteProtocol, os.fdopen(3, "wb", buffering=0))
        writer = asyncio.StreamWriter(transport, protocol, None, loop)
        reader = asyncio.StreamReader(limit=MAX_MESSAGE_BYTES + 1)
        input_transport, _ = await loop.connect_read_pipe(lambda: asyncio.StreamReaderProtocol(reader), sys.stdin.buffer)
        if interval is not None:
            faulthandler.dump_traceback_later(interval, repeat=True, file=sys.stderr)
            diagnostic = loop.call_later(interval, dump_tasks)
        # TaskGroup 负责取得所有请求任务的异常，并取消正在等待的输入读取。
        async with asyncio.TaskGroup() as group:
            try:
                while line := await reader.readline():
                    message = _request(line)
                    if message["id"] in active_ids:
                        raise ValueError("Native worker request identity is already active.")
                    active_ids.add(message["id"])
                    task = group.create_task(handle(message), name=f"native-worker-{message['op']}")
                    active.add(task)
                    task.add_done_callback(active.discard)
            finally:
                session.revoke_lease()
                for task in active:
                    task.cancel()
    except BaseException as error:
        errors.append(error)
    finally:
        session.revoke_lease()
        try:
            await session.transport_disconnected()
        except BaseException as error:
            errors.append(error)
        if diagnostic is not None:
            diagnostic.cancel()
            faulthandler.cancel_dump_traceback_later()
        if input_transport is not None:
            input_transport.close()
        if writer is not None:
            try:
                writer.close()
                await writer.wait_closed()
            except BaseException as error:
                errors.append(error)
    if len(errors) == 1:
        raise errors[0]
    if errors:
        raise BaseExceptionGroup("Native worker transport and cleanup failed.", errors)
