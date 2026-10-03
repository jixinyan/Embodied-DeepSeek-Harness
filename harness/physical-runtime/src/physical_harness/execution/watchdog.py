from __future__ import annotations

import math
from threading import Event, Thread, current_thread
import time
from typing import Callable


class ExecutionWatchdog:
    def __init__(self, *, deadline: float, lease_valid: Callable[[], bool],
                 fence: Callable[[], None], notify: Callable[[str], None],
                 interval_s: float = 0.05) -> None:
        if not math.isfinite(deadline) or not math.isfinite(interval_s) or not 0 < interval_s <= 1:
            raise ValueError("Watchdog deadline and polling interval must be finite and bounded.")
        self._deadline = deadline
        self._lease_valid = lease_valid
        self._fence = fence
        self._notify = notify
        self._interval_s = interval_s
        self._stop = Event()
        self._thread = Thread(target=self._run, name="edh-device-watchdog", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def close(self) -> None:
        self._stop.set()
        if current_thread() is not self._thread:
            self._thread.join()

    def _run(self) -> None:
        while not self._stop.is_set():
            reason = None
            try:
                lease_valid = self._lease_valid()
            except BaseException:
                self._fence()
                self._notify("backend_error")
                raise
            if not lease_valid:
                reason = "backend_error"
            elif time.monotonic() >= self._deadline:
                reason = "budget_exhausted"
            if reason is not None:
                # 独立线程关闭指令准入，SDK调用仍由设备所属线程执行。
                self._fence()
                self._notify(reason)
                return
            self._stop.wait(min(self._interval_s, max(0, self._deadline - time.monotonic())))
