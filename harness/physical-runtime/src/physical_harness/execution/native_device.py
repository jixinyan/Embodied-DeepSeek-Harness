from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import partial
import json
import os
from pathlib import Path
from threading import Lock
from typing import Callable, ParamSpec, TypeVar
from uuid import uuid4

from physical_harness.environments import NativeEnvironment, NativeObservation, NativeStep


T = TypeVar("T")
P = ParamSpec("P")


class NativeActionDevice:
    def __init__(self, environment: NativeEnvironment) -> None:
        self.environment = environment
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="edh-simulation")
        self._lock = Lock()
        self._execution_id: str | None = None
        self._generation = 0
        self._stopped = False
        self._closed = False
        self._raw_sim_steps = 0
        self._executed_actions = 0
        self._uncertain_actions = 0
        self._last_step: NativeStep | None = None
        self._owner_operations: set[asyncio.Future] = set()
        self._cancelled_operations: set[asyncio.Future] = set()

    async def on_owner(self, action: Callable[P, T], *args: P.args, **kwargs: P.kwargs) -> T:
        if self._closed:
            raise RuntimeError("Native simulation owner is closed.")
        operation = asyncio.get_running_loop().run_in_executor(self._executor, partial(action, *args, **kwargs))
        self._owner_operations.add(operation)
        operation.add_done_callback(self._owner_operations.discard)
        try:
            return await asyncio.shield(operation)
        except asyncio.CancelledError:
            # 调用方按原有期限退出；所属线程的操作仍由设备负责确认和关闭。
            self._cancelled_operations.add(operation)
            raise

    @property
    def raw_sim_steps(self) -> int:
        with self._lock:
            return self._raw_sim_steps

    @property
    def execution_id(self) -> str | None:
        with self._lock:
            return self._execution_id

    @property
    def executed_actions(self) -> int:
        with self._lock:
            return self._executed_actions

    @property
    def uncertain_actions(self) -> int:
        with self._lock:
            return self._uncertain_actions

    @property
    def last_observation(self) -> NativeObservation | None:
        with self._lock:
            return self._last_step.observation if self._last_step else None

    @property
    def last_step(self) -> NativeStep | None:
        with self._lock:
            return self._last_step

    async def bind_execution(self, execution_id: str) -> None:
        if not execution_id:
            raise ValueError("Native execution ID is required.")
        await self.on_owner(lambda: None)
        with self._lock:
            if self._execution_id is not None and not self._stopped:
                raise RuntimeError("Previous native execution is not stopped.")
            self._execution_id = execution_id
            self._generation = 0
            self._stopped = False
            self._raw_sim_steps = 0
            self._executed_actions = 0
            self._uncertain_actions = 0
            self._last_step = None

    def _should_stop(self, execution_id: str, generation: int) -> bool:
        with self._lock:
            return self._closed or self._stopped or self._execution_id != execution_id or self._generation != generation

    def fence_execution(self, execution_id: str) -> None:
        with self._lock:
            if self._execution_id == execution_id:
                self._stopped = True

    async def dispatch(self, segment: dict) -> dict:
        execution_id = segment["execution_id"]
        generation = segment["generation"]
        with self._lock:
            if self._closed or self._stopped or execution_id != self._execution_id or generation != self._generation:
                raise RuntimeError("Native action generation is no longer admitted.")
        if len(segment["actions"]) != 1:
            raise ValueError("Native simulation device commits one control action per segment.")
        uncertain = False

        def mark_uncertain() -> None:
            nonlocal uncertain
            with self._lock:
                if not uncertain:
                    self._uncertain_actions += 1
                    uncertain = True

        def execute() -> NativeStep:
            if self._should_stop(execution_id, generation):
                return NativeStep(self.environment.observe(), 0, False, 0, False)
            try:
                step = self.environment.step(
                    segment["actions"][0],
                    lambda: self._should_stop(execution_id, generation),
                )
            except BaseException:
                mark_uncertain()
                raise
            if step.executed_actions not in (0, 1) or step.raw_sim_steps < 0:
                mark_uncertain()
                raise RuntimeError("Native simulator returned an invalid action receipt.")
            if step.executed_actions == 0 and (step.action_completed or step.raw_sim_steps != 0):
                mark_uncertain()
                raise RuntimeError("Native simulator reported motion without an admitted action.")
            if step.interruption_reason is not None and step.interruption_reason != "recording_capacity_exhausted":
                mark_uncertain()
                raise RuntimeError("Native simulator returned an unsupported interruption reason.")
            if step.executed_actions == 1 and not step.action_completed and not (
                self._should_stop(execution_id, generation)
                or step.interruption_reason == "recording_capacity_exhausted"
            ):
                mark_uncertain()
                raise RuntimeError("Native action stopped early without a matching stop request.")
            with self._lock:
                self._last_step = step
                self._executed_actions += step.executed_actions
                self._raw_sim_steps += step.raw_sim_steps
            return step

        try:
            step = await self.on_owner(execute)
        except BaseException:
            mark_uncertain()
            self.fence_execution(execution_id)
            raise
        return {
            "schema_version": "physical.action_receipt.v1",
            "execution_id": segment["execution_id"],
            "generation": generation,
            "segment_id": segment["segment_id"],
            "executed_actions": step.executed_actions,
        }

    async def stop(self, execution_id: str, generation: int) -> dict:
        with self._lock:
            if self._closed or execution_id != self._execution_id or generation <= self._generation:
                raise RuntimeError("Native stop generation is invalid.")
            self._generation = generation
            self._stopped = True
        await self.on_owner(lambda: None)
        with self._lock:
            if self._closed or execution_id != self._execution_id or generation != self._generation:
                raise RuntimeError("Native stop was superseded before confirmation.")
        acknowledgement = {
            "schema_version": "physical.stop_ack.v1",
            "execution_id": execution_id,
            "generation": generation,
            "device_confirmed": True,
            "boundary_id": str(uuid4()),
        }
        record_directory = os.environ.get("EDH_POLICY_REQUEST_RECORD_DIR")
        if record_directory is not None:
            with self._lock:
                record = {
                    "schema_version": "edh.native_stop_record.v1",
                    "recorded_at": datetime.now(timezone.utc).isoformat(),
                    "acknowledgement": acknowledgement,
                    "executed_actions": self._executed_actions,
                    "raw_sim_steps": self._raw_sim_steps,
                    "uncertain_actions": self._uncertain_actions,
                    "observation_id": self._last_step.observation.observation_id if self._last_step else None,
                    "native_physics": self._last_step.native_physics if self._last_step else None,
                }
            directory = Path(record_directory).resolve(strict=True) / execution_id
            directory.mkdir(exist_ok=True)
            path = directory / f"stop-{acknowledgement['boundary_id']}.json"
            await asyncio.to_thread(self._record_stop, path, record)
        return acknowledgement

    @staticmethod
    def _record_stop(path: Path, record: dict) -> None:
        with path.open("x", encoding="utf-8") as stream:
            json.dump(record, stream, allow_nan=False)

    async def resume(self, execution_id: str, generation: int) -> bool:
        with self._lock:
            if self._closed or execution_id != self._execution_id or generation != self._generation or not self._stopped:
                raise RuntimeError("Native resume generation is invalid.")
        await self.on_owner(lambda: None)
        with self._lock:
            if self._closed or execution_id != self._execution_id or generation != self._generation or not self._stopped:
                raise RuntimeError("Native resume was superseded by a stop.")
            self._stopped = False
        return True

    async def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._stopped = True
        errors: list[BaseException] = []
        try:
            await self.on_owner(self.environment.close)
        except BaseException as error:
            errors.append(error)
        finally:
            with self._lock:
                self._closed = True
            await asyncio.to_thread(self._executor.shutdown, True)
            for operation in self._cancelled_operations:
                try:
                    operation.result()
                except BaseException as error:
                    errors.append(error)
            self._cancelled_operations.clear()
        if errors:
            raise BaseExceptionGroup("Native owner close failed.", errors)
