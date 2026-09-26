"""Deterministic admission between policy inference and device dispatch.

The device must fence old generations at its actual command boundary. This layer
cannot retract commands already committed inside an external controller.
"""
from __future__ import annotations

import asyncio
import copy
from datetime import datetime, timedelta, timezone
import math
import time
from typing import Any, Awaitable, Callable, Protocol
from uuid import uuid4

from physical_harness.validation import ContractValidator
from physical_harness.policies.client import validate_response


class GateRejected(RuntimeError):
    """No further action may be dispatched from the rejected request/chunk."""


class ActionDevice(Protocol):
    """Generation-fenced device boundary; dispatch acknowledges actual executed actions."""
    async def dispatch(self, segment: dict[str, Any]) -> dict[str, Any]: ...
    async def stop(self, execution_id: str, generation: int) -> dict[str, Any]: ...
    async def resume(self, execution_id: str, generation: int) -> bool: ...


class ActionGate:
    def __init__(self, validator: ContractValidator, device: ActionDevice, *, execution_id: str,
                 task_scope: dict[str, Any], action_spec: dict[str, Any], max_control_steps: int,
                 max_wall_time_s: float, lease_valid: Callable[[], bool],
                 max_segment_actions: int = 1, observation_ttl_s: float = 2,
                 device_timeout_s: float = 10, clock: Callable[[], float] = time.monotonic,
                 on_segment: Callable[[dict[str, Any], dict[str, Any]], Awaitable[None]] | None = None,
                 max_policy_actions: int = 512) -> None:
        validator.parse("ActionSpec", action_spec)
        validator.parse("ExecutionScope", task_scope)
        if type(max_control_steps) is not int or not 0 < max_control_steps <= 9007199254740991:
            raise ValueError("Invalid control-step budget.")
        if type(max_segment_actions) is not int or not 0 < max_segment_actions <= 512:
            raise ValueError("Invalid committed segment bound.")
        if type(max_policy_actions) is not int or not 0 < max_policy_actions <= 512:
            raise ValueError("Invalid policy action bound.")
        if any(not math.isfinite(value) or value <= 0 for value in (max_wall_time_s, observation_ttl_s, device_timeout_s)):
            raise ValueError("Gate time bounds must be positive and finite.")
        self._validator, self._device = validator, device
        self._execution_id, self._scope, self._spec = execution_id, copy.deepcopy(task_scope), copy.deepcopy(action_spec)
        self._budget, self._wall_budget = max_control_steps, max_wall_time_s
        self._lease, self._segment = lease_valid, max_segment_actions
        self._max_policy_actions = max_policy_actions
        self._ttl, self._device_timeout, self._clock = observation_ttl_s, device_timeout_s, clock
        self._on_segment = on_segment
        self._started = clock()
        self._generation = 0
        self._state = "running"
        self._reserved = self._executed = 0
        self._confirmed = False
        self._boundary: str | None = None
        self._reason: str | None = None
        self._error: str | None = None
        self._ticket: dict[str, Any] | None = None
        self._deadline = self._started
        self._busy = False
        self._terminal_stop = False
        self._stop_task: asyncio.Task[None] | None = None

    def snapshot(self) -> dict[str, Any]:
        return {
            "execution_id": self._execution_id, "generation": self._generation,
            "state": self._state, "reserved_actions": self._reserved, "executed_actions": self._executed,
            "remaining_actions": self._budget - self._reserved,
            "device_confirmed": self._confirmed, "boundary_id": self._boundary,
            "stop_reason": self._reason, "error": self._error,
            "dispatch_in_flight": self._busy,
        }

    def remaining_wall_time(self) -> float:
        return max(0, self._started + self._wall_budget - self._clock())

    def ticket_remaining_time(self) -> float:
        return max(0, self._deadline - self._clock())

    def failure_reason(self) -> str:
        return "budget_exhausted" if self.remaining_wall_time() <= 0 else "backend_error"

    def _admission(self, generation: int) -> None:
        if self._state != "running" or generation != self._generation:
            raise GateRejected("Action generation is no longer admitted.")
        if not self._lease():
            raise GateRejected("Execution no longer owns its device resource lease.")
        if self._clock() - self._started >= self._wall_budget:
            raise GateRejected("Execution wall-time budget exhausted.")
        if self._reserved >= self._budget:
            raise GateRejected("Execution control-step budget exhausted.")

    def request(self, instruction: str, observation_id: str, observation: dict[str, Any], *, observed_monotonic: float) -> dict[str, Any]:
        """Issue one inference ticket. A replacement ticket invalidates the earlier response."""
        if self._busy:
            raise GateRejected("A chunk is already being dispatched.")
        self._admission(self._generation)
        now = self._clock()
        if not math.isfinite(observed_monotonic) or observed_monotonic > now or now - observed_monotonic >= self._ttl:
            raise GateRejected("Observation is stale or has a future local timestamp.")
        deadline = min(observed_monotonic + self._ttl, self._started + self._wall_budget)
        valid_until = (datetime.now(timezone.utc) + timedelta(seconds=deadline - now)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        request = {
            "schema_version": "physical.policy_request.v1", "request_id": str(uuid4()),
            "execution_id": self._execution_id, "task_scope": copy.deepcopy(self._scope),
            "generation": self._generation, "observation_id": observation_id,
            "valid_until": valid_until, "action_spec": copy.deepcopy(self._spec),
            "instruction": instruction, "observation": copy.deepcopy(observation),
            "max_actions": min(self._max_policy_actions, self._budget - self._reserved),
        }
        self._validator.parse("PolicyRequest", request)
        self._deadline, self._ticket = deadline, request
        return copy.deepcopy(request)

    async def execute(self, chunk: dict[str, Any]) -> dict[str, Any]:
        if self._busy or self._ticket is None:
            raise GateRejected("No unused inference ticket is available.")
        bound = copy.deepcopy(chunk)
        validate_response(self._validator, self._ticket, bound)
        self._admission(bound["generation"])
        if self._clock() >= self._deadline:
            raise GateRejected("Policy result arrived after the observation deadline.")
        self._ticket = None  # Consume exactly once before any device side effect.
        self._busy = True
        try:
            for index in range(0, len(bound["actions"]), self._segment):
                if self._state != "running" or self._generation != bound["generation"]:
                    break
                self._admission(bound["generation"])
                if self._clock() >= self._deadline:
                    raise GateRejected("Observation expired during action dispatch.")
                actions = bound["actions"][index:index + self._segment]
                if len(actions) > self._budget - self._reserved:
                    raise GateRejected("Segment exceeds remaining execution budget.")
                segment = {**bound, "schema_version": "physical.action_segment.v1", "segment_id": str(uuid4()), "actions": actions}
                self._validator.parse("ActionSegment", segment)
                self._reserved += len(actions)  # Uncertain dispatches remain charged; never silently replay.
                async with asyncio.timeout(min(self._device_timeout, self.ticket_remaining_time())):
                    receipt = await self._device.dispatch(copy.deepcopy(segment))
                self._validator.parse("ActionReceipt", receipt)
                if any(receipt[key] != segment[key] for key in ("execution_id", "generation", "segment_id")) or receipt["executed_actions"] > len(actions):
                    raise GateRejected("Device receipt does not match the issued segment.")
                self._executed += receipt["executed_actions"]
                if self._on_segment is not None and receipt["executed_actions"]:
                    await self._on_segment(copy.deepcopy(segment), copy.deepcopy(receipt))
                if self._generation != bound["generation"] or self._state != "running":
                    break
                if receipt["executed_actions"] != len(actions):
                    raise GateRejected("Device only executed part of an admitted segment.")
            if self._state == "running" and self._reserved >= self._budget:
                await self.pause("budget_exhausted", terminal=True)
        except BaseException as error:
            self._error = str(error) or type(error).__name__
            if self._state == "running":
                try:
                    await self.pause(self.failure_reason(), terminal=True)
                except Exception:
                    pass
            raise
        finally:
            self._busy = False
        return self.snapshot()

    async def pause(self, reason: str = "planner_pause", *, terminal: bool = False) -> dict[str, Any]:
        if self._state == "ended":
            return self.snapshot()
        if reason not in ("verifier_pause", "planner_pause", "user_stop", "budget_exhausted", "backend_error", "policy_stop", "episode_terminated"):
            raise ValueError("Unknown stop reason.")
        if self._state == "paused" and not terminal:
            return self.snapshot()
        if self._state == "pausing":
            if terminal:
                self._terminal_stop, self._reason = True, reason
            if self._stop_task is not None:
                await asyncio.shield(self._stop_task)
            return self.snapshot()
        self._generation += 1
        self._state, self._confirmed, self._boundary = "pausing", False, None
        self._ticket = None
        self._reason, self._terminal_stop = reason, terminal
        generation = self._generation

        async def stop_device() -> None:
            try:
                async with asyncio.timeout(self._device_timeout):
                    acknowledgement = await self._device.stop(self._execution_id, generation)
                self.confirm_stop(acknowledgement)
            except Exception as error:
                self._error = str(error) or type(error).__name__
                raise

        self._stop_task = asyncio.create_task(stop_device())
        self._stop_task.add_done_callback(lambda task: None if task.cancelled() else task.exception())
        await asyncio.shield(self._stop_task)
        return self.snapshot()

    def confirm_stop(self, acknowledgement: dict[str, Any]) -> None:
        """Accept a delayed matching acknowledgement; duplicate confirmation is idempotent."""
        self._validator.parse("StopAcknowledgement", acknowledgement)
        if acknowledgement["execution_id"] != self._execution_id or acknowledgement["generation"] != self._generation:
            raise GateRejected("Stop acknowledgement belongs to another control generation.")
        if self._state in ("paused", "ended") and acknowledgement["device_confirmed"] and acknowledgement["boundary_id"] == self._boundary:
            return
        if self._state != "pausing":
            raise GateRejected("No matching stop is awaiting confirmation.")
        if not acknowledgement["device_confirmed"]:
            return
        self._confirmed, self._boundary = True, acknowledgement["boundary_id"]
        self._state = "ended" if self._terminal_stop else "paused"

    async def resume(self) -> dict[str, Any]:
        """The worker must authenticate the upper decision owner's resume authorization."""
        if self._state != "paused" or not self._confirmed or self._busy or not self._lease():
            raise GateRejected("Resume requires a confirmed, drained boundary and resource ownership.")
        if self._reserved >= self._budget or self.remaining_wall_time() <= 0:
            raise GateRejected("Execution budget is exhausted.")
        generation = self._generation
        # A resume request can reach the device even if its acknowledgement is lost.
        # Invalidate the earlier stop confirmation before sending that request.
        self._state, self._confirmed, self._boundary = "resuming", False, None
        self._stop_task = None
        try:
            async with asyncio.timeout(min(self._device_timeout, self.remaining_wall_time())):
                resumed = await self._device.resume(self._execution_id, generation)
            if resumed is not True or self._state != "resuming" or self._generation != generation or not self._lease() or self.remaining_wall_time() <= 0:
                raise GateRejected("Device resume did not match the current control boundary.")
            self._state, self._reason = "running", None
        except BaseException:
            if self._state == "resuming" and self._generation == generation:
                try:
                    await self.pause(self.failure_reason(), terminal=True)
                except Exception:
                    pass
            raise
        return self.snapshot()
