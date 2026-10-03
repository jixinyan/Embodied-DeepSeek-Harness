from __future__ import annotations

import argparse
from dataclasses import replace
import faulthandler
import os
from multiprocessing.connection import Connection
from pathlib import Path
import pickle
import signal
import socket
import subprocess
from threading import Event, Lock, Timer, current_thread, main_thread
import time
import traceback
from typing import Callable, Mapping, Sequence
from uuid import uuid4

from physical_harness.environments import NativeCheck, NativeEnvironmentDescription, NativeFrame, NativeObservation, NativeRotation, NativeStep
from physical_harness.validation import ContractValidator


MAX_PACKET_BYTES = 32 * 1024 * 1024


def _send(connection: Connection, value: object) -> None:
    packet = pickle.dumps(value, protocol=5)
    if len(packet) > MAX_PACKET_BYTES:
        raise RuntimeError("BEHAVIOR native IPC packet exceeds its byte limit.")
    connection.send_bytes(packet)


def _receive(connection: Connection) -> dict:
    value = pickle.loads(connection.recv_bytes(MAX_PACKET_BYTES))
    if type(value) is not dict:
        raise RuntimeError("BEHAVIOR native IPC envelope must be a dictionary.")
    return value


class BehaviorProcessEnvironment:
    def __init__(self, source_root: Path, validator: ContractValidator) -> None:
        native_python = Path(os.environ["EDH_BEHAVIOR_NATIVE_PYTHON"])
        if not native_python.is_absolute() or not native_python.is_file():
            raise ValueError("BEHAVIOR native Python executable must be an existing absolute path.")
        self._timeout_s = float(os.environ.get("EDH_BEHAVIOR_NATIVE_TIMEOUT_S", "900"))
        if not 0 < self._timeout_s <= 1800:
            raise ValueError("BEHAVIOR native operation timeout must be within 1800 seconds.")
        self._lock = Lock()
        self._closed = False
        self._failed = False
        self._initialized = False
        self._last_control_duration_s = 0.0
        self._last_native_state: dict = {}
        self._close_acknowledged = False
        self._control_in_flight = Event()
        parent_socket, child_socket = socket.socketpair()
        self._connection = Connection(parent_socket.detach())
        try:
            self._process = subprocess.Popen(
                [str(native_python), "-m", __name__, "--connection-fd", str(child_socket.fileno())],
                pass_fds=(child_socket.fileno(),),
                stdin=subprocess.DEVNULL,
            )
        except BaseException:
            self._connection.close()
            raise
        finally:
            child_socket.close()
        try:
            self._rpc("initialize", str(source_root.resolve(strict=True)), validator._schema)
        except BaseException as error:
            try:
                self.close()
            except BaseException as close_error:
                error.add_note(f"Native cleanup also failed: {close_error}")
            raise

    @property
    def initialized(self) -> bool:
        return self._initialized and not self._closed and not self._failed and self._process.poll() is None

    @property
    def process_exit_code(self) -> int | None:
        return self._process.poll()

    @property
    def native_pid(self) -> int:
        return self._process.pid

    @property
    def close_acknowledged(self) -> bool:
        return self._close_acknowledged

    @property
    def native_close_diagnostics(self) -> dict | None:
        return self._last_native_state.get("close_diagnostics")

    @property
    def control_in_flight(self) -> bool:
        return self._control_in_flight.is_set()

    def _rpc(self, operation: str, *args: object, should_stop: Callable[[], bool] | None = None):
        with self._lock:
            if self._closed or self._failed:
                raise RuntimeError("BEHAVIOR native process no longer admits operations.")
            request_id = str(uuid4())
            expired = Event()

            def expire() -> None:
                expired.set()
                if self._process.poll() is None:
                    self._process.kill()

            deadline = Timer(self._timeout_s, expire)
            deadline.daemon = True
            deadline.start()
            try:
                _send(self._connection, {"request_id": request_id, "operation": operation, "args": args})
                if not self._connection.poll(self._timeout_s):
                    raise TimeoutError(f"BEHAVIOR native operation timed out: {operation}")
                response = _receive(self._connection)
                if response.get("event") == "control_started":
                    if operation not in ("step", "rotate_view") or response.get("request_id") != request_id or response.get("pid") != self.native_pid:
                        raise RuntimeError("BEHAVIOR native control-start identity is invalid.")
                    self._control_in_flight.set()
                    cancellation_sent = False
                    while not self._connection.poll(0.025):
                        if should_stop is not None and should_stop() and not cancellation_sent:
                            os.kill(self.native_pid, signal.SIGUSR2)
                            cancellation_sent = True
                        if expired.is_set():
                            raise TimeoutError(f"BEHAVIOR native operation timed out: {operation}")
                    response = _receive(self._connection)
                if expired.is_set():
                    raise TimeoutError(f"BEHAVIOR native operation timed out: {operation}")
                if response.get("request_id") != request_id or response.get("pid") != self.native_pid:
                    raise RuntimeError("BEHAVIOR native response identity differs from its request.")
                if "error" in response:
                    raise RuntimeError(f"BEHAVIOR native {operation} failed:\n{response['error']}")
                self._last_native_state = response["native_state"]
                self._last_control_duration_s = self._last_native_state["last_control_duration_s"]
                return response["result"]
            except BaseException as error:
                self._failed = True
                if expired.is_set():
                    raise TimeoutError(f"BEHAVIOR native operation timed out: {operation}") from error
                raise
            finally:
                deadline.cancel()
                self._control_in_flight.clear()

    def native_state(self) -> dict:
        return self._rpc("native_state")

    def describe(self) -> NativeEnvironmentDescription:
        return self._rpc("describe")

    def reset(self, task_id: str, configuration: Mapping[str, object]) -> NativeObservation:
        result = self._rpc("reset", task_id, dict(configuration))
        self._initialized = True
        return result

    def bind_task(self, task_id: str) -> None:
        self._rpc("bind_task", task_id)

    def observe(self) -> NativeObservation:
        return self._rpc("observe")

    def measure_object(self, observation_id: str, camera: str, source_image_sha256: str,
                       mask_png: bytes) -> dict[str, object]:
        return self._rpc("measure_object", observation_id, camera, source_image_sha256, mask_png)

    def step(
        self,
        action: Sequence[float],
        should_stop: Callable[[], bool],
        on_live_frame: Callable[[NativeFrame], bool] | None = None,
    ) -> NativeStep:
        if should_stop():
            return NativeStep(self.observe(), 0, False, 0, self._last_native_state["episode_terminated"])
        result = self._rpc("step", tuple(action))
        if on_live_frame is not None:
            for frame in result.native_frames:
                if not on_live_frame(frame):
                    return replace(result, interruption_reason="live_frame_capacity_exhausted")
        return result

    def check(self, check_ids: Sequence[str]) -> Sequence[NativeCheck]:
        return self._rpc("check", tuple(check_ids))

    def episode_terminated(self) -> bool:
        return self._rpc("episode_terminated")

    def turn_view(self, direction: str) -> NativeObservation:
        return self._rpc("turn_view", direction)

    def rotate_view(self, yaw_deg: float, pitch_deg: float, should_stop: Callable[[], bool]) -> NativeRotation:
        return self._rpc("rotate_view", yaw_deg, pitch_deg, bool(should_stop()), should_stop=should_stop)

    def close(self) -> None:
        if self._closed:
            return
        close_started = time.monotonic()
        close_error = None
        try:
            if not self._failed:
                try:
                    self._rpc("close")
                    self._close_acknowledged = True
                except BaseException as error:
                    close_error = error
            try:
                remaining_s = max(0.0, self._timeout_s - (time.monotonic() - close_started))
                status = self._process.wait(timeout=remaining_s)
            except subprocess.TimeoutExpired:
                self._process.terminate()
                try:
                    self._process.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    self._process.kill()
                    self._process.wait(timeout=30)
                raise TimeoutError("BEHAVIOR native process did not complete shutdown.")
            if close_error is not None:
                close_error.add_note(f"Native process pid={self.native_pid}, exit={status}.")
                raise close_error
            if status != 0 or not self._close_acknowledged:
                raise RuntimeError(f"BEHAVIOR native shutdown is unconfirmed: pid={self.native_pid}, exit={status}, acknowledged={self._close_acknowledged}.")
        finally:
            self._initialized = False
            self._closed = True
            self._connection.close()


def _native_state(environment, scene_id: str) -> dict:
    return {
        "pid": os.getpid(),
        "main_thread": current_thread() is main_thread(),
        "scene_id": scene_id if environment._env is not None else None,
        "native_time_step_index": int(environment._og.sim.current_time_step_index) if environment._env is not None else None,
        "controlled_physics_steps": environment._controlled_physics_steps,
        "episode_terminated": environment._episode_terminated,
        "last_control_duration_s": environment._last_control_duration_s,
        "close_diagnostics": environment._close_diagnostics,
    }


def _serve(connection_fd: int) -> None:
    from physical_harness.environments.behavior import BehaviorEnvironment

    faulthandler.enable()
    faulthandler.register(signal.SIGUSR1, all_threads=True)
    connection = Connection(connection_fd)
    environment = None
    scene_id = str(uuid4())
    closed = False
    cancellation = Event()
    previous_handler = signal.signal(signal.SIGUSR2, lambda signum, frame: cancellation.set())
    try:
        while True:
            request = _receive(connection)
            request_id = request["request_id"]
            operation = request["operation"]
            args = request["args"]
            try:
                if operation == "initialize" and environment is None:
                    environment = BehaviorEnvironment(Path(args[0]), ContractValidator(args[1]))
                    result = None
                elif environment is None:
                    raise RuntimeError("BEHAVIOR native process requires initialization.")
                elif operation == "step":
                    _send(connection, {"request_id": request_id, "pid": os.getpid(), "event": "control_started"})
                    result = environment.step(args[0], lambda: False)
                elif operation == "rotate_view":
                    cancellation.clear()
                    if args[2]:
                        cancellation.set()
                    _send(connection, {"request_id": request_id, "pid": os.getpid(), "event": "control_started"})
                    result = environment.rotate_view(args[0], args[1], cancellation.is_set)
                elif operation == "native_state":
                    result = _native_state(environment, scene_id)
                elif operation in ("reset", "bind_task", "observe", "describe", "check", "turn_view", "measure_object", "episode_terminated", "close"):
                    result = getattr(environment, operation)(*args)
                else:
                    raise ValueError(f"Unsupported BEHAVIOR native operation: {operation}")
                closed = operation == "close"
                _send(connection, {"request_id": request_id, "pid": os.getpid(), "result": result,
                                   "native_state": _native_state(environment, scene_id)})
            except BaseException:
                error = traceback.format_exc()
                traceback.print_exc()
                _send(connection, {"request_id": request_id, "pid": os.getpid(), "error": error})
                raise
            if closed:
                return
    finally:
        try:
            if environment is not None and not closed:
                environment.close()
        finally:
            signal.signal(signal.SIGUSR2, previous_handler)
            connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--connection-fd", type=int, required=True)
    _serve(parser.parse_args().connection_fd)


if __name__ == "__main__":
    main()
