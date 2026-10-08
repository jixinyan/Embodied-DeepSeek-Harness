from __future__ import annotations

import asyncio
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
import json
import sys
from threading import Lock
import traceback
from typing import ParamSpec, TypeVar


P = ParamSpec("P")
T = TypeVar("T")


def recorded_inference(operation: Callable[[dict], T], request: dict, identity: dict) -> T:
    try:
        return operation(request)
    except Exception as error:
        print(json.dumps({
            "event": "policy_inference_failed",
            **identity,
            **{key: request[key] for key in (
                "request_id", "execution_id", "task_scope", "generation", "observation_id"
            )},
            "error_type": f"{type(error).__module__}.{type(error).__qualname__}",
            "error": str(error),
        }, allow_nan=False), file=sys.stderr, flush=True)
        traceback.print_exception(error, file=sys.stderr)
        raise


class ThreadedInference:
    def __init__(self, name: str) -> None:
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Policy inference owner requires a thread name.")
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix=name)
        self._guard = Lock()
        self._active: Future | None = None
        self._closed = False
        self._closing: asyncio.Task[None] | None = None

    def snapshot(self) -> dict[str, bool]:
        with self._guard:
            return {"closed": self._closed, "active": self._active is not None}

    def _settled(self, operation: Future) -> None:
        with self._guard:
            if self._active is operation:
                self._active = None

    @staticmethod
    def _observe(operation: asyncio.Future) -> None:
        if not operation.cancelled():
            operation.exception()

    async def run(self, operation: Callable[P, T], *args: P.args, **kwargs: P.kwargs) -> T:
        with self._guard:
            if self._closed:
                raise RuntimeError("Policy inference owner is closed.")
            if self._active is not None:
                raise RuntimeError("Policy inference is already in progress.")
            future = self._executor.submit(operation, *args, **kwargs)
            self._active = future
        future.add_done_callback(self._settled)
        result = asyncio.wrap_future(future)
        result.add_done_callback(self._observe)
        # 调用方取消等待后，线程继续负责当前操作及记录，完成以后才能接收新的操作。
        await asyncio.wait({result})
        return result.result()

    async def close(self) -> None:
        with self._guard:
            self._closed = True
        if self._closing is None:
            self._closing = asyncio.create_task(asyncio.to_thread(self._executor.shutdown, True))
            self._closing.add_done_callback(self._observe)
        await asyncio.wait({self._closing})
        self._closing.result()
