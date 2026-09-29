from __future__ import annotations

import asyncio
import base64
from datetime import datetime, timezone
import faulthandler
import json
import math
import os
from pathlib import Path
import sys
import time
import traceback
from typing import Any, Awaitable, Callable
from uuid import uuid4

from physical_harness.environments import NativeEnvironment, NativeFrame, NativeObservation
from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.modes import ExecutionMode
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.execution.policy_observation import encode_policy_observation
from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.validation import ContractValidator


def wire_time() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def require_object(value: Any) -> dict[str, Any]:
    if type(value) is not dict:
        raise ValueError("Expected a JSON object.")
    return value


def record_policy_request(ticket: dict[str, Any], directory: Path) -> None:
    request_id = ticket["request_id"]
    if not isinstance(request_id, str) or not request_id.isascii() or not all(
        character in "0123456789abcdef-" for character in request_id
    ):
        raise ValueError("Policy request identity is invalid for local recording.")
    target = directory / f"{request_id}.json"
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as output:
        json.dump(ticket, output, allow_nan=False, separators=(",", ":"))
        output.write("\n")


class NativeWorkerSession:
    def __init__(self, emit: Callable[[dict[str, Any]], Awaitable[None]]) -> None:
        self._emit = emit
        self._validator: ContractValidator | None = None
        self._environment: NativeEnvironment | None = None
        self._device: NativeActionDevice | None = None
        self._description = None
        self._native_task_id: str | None = None
        self._catalog_task_id: str | None = None
        self._run_task_id: str | None = None
        self._seen_run_ids: set[str] = set()
        self._policy_uri: str | None = None
        self._policy_id: str | None = None
        self._execution_mode = ExecutionMode.POLICY
        self._control_mode = "0-shot"
        self._policy: WebSocketPolicyClient | None = None
        self._gate: ActionGate | None = None
        self._request: dict[str, Any] | None = None
        self._pump: asyncio.Task[None] | None = None
        self._initial_observation: NativeObservation | None = None
        self._latest_observation: NativeObservation | None = None
        self._status: dict[str, Any] | None = None
        self._clock_id = str(uuid4())
        self._started = 0.0
        self._state_version = 0
        self._policy_calls = 0
        self._policy_timeout_s = 30.0
        self._policy_max_actions_per_inference = 512
        self._monitor_every_actions = 1
        self._last_monitor_action = 0
        self._boundary_at: str | None = None
        self._lease_active = False
        self._host_connected = True
        self._failure_detail: str | None = None
        self._request_keys: dict[str, dict[str, Any]] = {}
        self._control_lock = asyncio.Lock()
        self._publish_lock = asyncio.Lock()
        self._last_boundary_publication: dict[str, Any] | None = None
        self._last_control: dict[str, Any] | None = None

    def revoke_lease(self) -> None:
        self._lease_active = False
        self._host_connected = False

    def _require_device(self) -> NativeActionDevice:
        if self._device is None:
            raise RuntimeError("Native session has not been initialized.")
        return self._device

    def _require_gate(self) -> ActionGate:
        if self._gate is None:
            raise RuntimeError("No native execution is active.")
        return self._gate

    def _status_for(self, observation: NativeObservation) -> dict[str, Any]:
        gate = self._require_gate()
        device = self._require_device()
        snapshot = gate.snapshot()
        self._state_version += 1
        state = snapshot["state"]
        status: dict[str, Any] = {
            "schema_version": "physical.execution.v1",
            "execution_id": snapshot["execution_id"],
            "task_scope": gate_scope(self._request),
            "state": state,
            "control_steps": device.executed_actions,
            "policy_calls": self._policy_calls,
            "raw_sim_steps": device.raw_sim_steps,
            "device_confirmed": snapshot["device_confirmed"],
            "observation_refs": [observation.observation_id],
            "state_version": self._state_version,
            "elapsed_wall_time_s": max(0.0, time.monotonic() - self._started),
            "clock_id": self._clock_id,
            "recorded_at": wire_time(),
        }
        if snapshot["stop_reason"] is not None and state in ("paused", "ended"):
            status["stop_reason"] = snapshot["stop_reason"]
        if snapshot["device_confirmed"]:
            if self._status is None or self._status.get("boundary_event_id") != snapshot["boundary_id"]:
                self._boundary_at = status["recorded_at"]
            status["boundary_event_id"] = snapshot["boundary_id"]
            status["boundary_at"] = self._boundary_at
        self._validator.parse("ExecutionStatus", status)
        self._status = status
        return status

    def _publication(self, observation: NativeObservation) -> dict[str, Any]:
        self._latest_observation = observation
        publication = {
            "status": self._status_for(observation),
            "observation": self._observation_wire(observation),
            "uncertain_actions": self._require_device().uncertain_actions,
        }
        if self._failure_detail is not None:
            publication["diagnostic"] = self._failure_detail
        return publication

    @staticmethod
    def _observation_wire(observation: NativeObservation | NativeFrame) -> dict[str, Any]:
        return {
            "observation_id": observation.observation_id,
            "observed_at": observation.observed_at,
            "images": {name: base64.b64encode(data).decode("ascii") for name, data in observation.images.items()},
        }

    async def _publish(self, observation: NativeObservation, control: dict[str, Any] | None = None,
                       *, require_running: bool = False) -> dict[str, Any] | None:
        async with self._publish_lock:
            snapshot = self._require_gate().snapshot()
            if require_running and snapshot["state"] != "running":
                return None
            if (snapshot["device_confirmed"] and self._last_boundary_publication is not None
                    and self._last_boundary_publication["status"]["boundary_event_id"] == snapshot["boundary_id"]):
                return self._last_boundary_publication
            publication = self._publication(observation)
            if control is not None:
                publication["control"] = control
            await self._emit({"event": "update", "data": publication})
            if snapshot["device_confirmed"]:
                self._last_boundary_publication = publication
            return publication

    async def initialize(self, arguments: dict[str, Any]) -> dict[str, Any]:
        if self._device is not None:
            raise RuntimeError("Native session is already initialized.")
        provider = arguments["provider"]
        self._native_task_id = arguments["native_task_id"]
        self._policy_uri = arguments["policy_uri"]
        self._policy_id = arguments["policy_id"]
        self._execution_mode = ExecutionMode.parse(arguments.get("execution_mode", "policy"))
        if not isinstance(self._policy_id, str) or not self._policy_id:
            raise ValueError("Native worker requires an explicit policy ID.")
        configuration = require_object(arguments["scene_configuration"])
        control_mode = configuration.get("control_mode", "0-shot")
        if control_mode not in ("0-shot", "textual-1-shot", "visual-1-shot"):
            raise ValueError("Native control_mode must be 0-shot, textual-1-shot or visual-1-shot.")
        self._control_mode = control_mode
        self._monitor_every_actions = arguments.get("monitor_every_actions", 1)
        if type(self._monitor_every_actions) is not int or not 1 <= self._monitor_every_actions <= 512:
            raise ValueError("Monitor interval must contain 1 to 512 control commands.")
        self._policy_max_actions_per_inference = arguments.get("policy_max_actions_per_inference", 512)
        if type(self._policy_max_actions_per_inference) is not int or not 1 <= self._policy_max_actions_per_inference <= 512:
            raise ValueError("Policy action limit must contain 1 to 512 control commands.")
        self._validator = ContractValidator.from_path(arguments["schema_path"])
        if provider == "robocasa":
            if "source_root" in arguments:
                raise ValueError("RoboCasa does not use a worker source_root override.")
            from physical_harness.environments.robocasa import RoboCasaEnvironment
            environment = RoboCasaEnvironment(self._validator)
        elif provider == "robotwin":
            from physical_harness.environments.robotwin import RoboTwinEnvironment
            source_root = Path(arguments["source_root"]).resolve(strict=True)
            os.chdir(source_root)
            environment = RoboTwinEnvironment(source_root, self._validator)
        elif provider == "behavior":
            from physical_harness.environments.behavior import BehaviorEnvironment
            environment = BehaviorEnvironment(Path(arguments["source_root"]).resolve(strict=True), self._validator)
        elif provider == "robodojo":
            if "source_root" in arguments:
                raise ValueError("RoboDojo is connected through its external RPC server, not a worker source_root.")
            from physical_harness.environments.robodojo import RoboDojoEnvironment
            environment = RoboDojoEnvironment(self._validator)
        else:
            raise ValueError("Unsupported native environment provider.")
        self._environment = environment
        self._device = NativeActionDevice(environment)
        self._initial_observation = await self._device.on_owner(
            lambda: environment.reset(self._native_task_id, configuration)
        )
        if not self._host_connected:
            raise RuntimeError("Native worker host disconnected during initialization.")
        self._description = await self._device.on_owner(environment.describe)
        if not self._host_connected:
            raise RuntimeError("Native worker host disconnected during initialization.")
        return {
            "provider": self._description.provider,
            "embodiment_id": self._description.embodiment_id,
            "action_spec": self._description.action_spec,
            "camera_names": self._description.camera_names,
            "supported_check_ids": self._description.supported_check_ids,
            "active_view_directions": self._description.active_view_directions,
            "task_instruction": self._description.task_instruction,
            "scene_metadata": self._description.scene_metadata,
            "native_task_id": self._native_task_id,
            "clock_id": self._clock_id,
            "policy_id": self._policy_id,
            "execution_mode": self._execution_mode.value,
        }

    async def start(self, arguments: dict[str, Any]) -> dict[str, Any]:
        async with self._control_lock:
            if not self._host_connected or not self._lease_active:
                raise RuntimeError("Native task lease is unavailable.")
            request = require_object(arguments["request"])
            self._validator.parse("SubgoalRequest", request)
            key = request["idempotency_key"]
            if key in self._request_keys:
                if self._request_keys[key] != request:
                    raise ValueError("Idempotency key was reused for a different native request.")
                raise ValueError("Native execution request was already admitted.")
            if len(self._request_keys) >= 1024:
                raise RuntimeError("Native session request history is full.")
            if self._run_task_id is None or request["task_id"] != self._run_task_id:
                raise ValueError("Execution request differs from the admitted session task.")
            if self._gate is not None and self._gate.snapshot()["state"] != "ended":
                raise RuntimeError("Previous native execution lacks a confirmed terminal boundary.")
            if self._gate is not None and not self._gate.snapshot()["device_confirmed"]:
                raise RuntimeError("Previous native execution has no device confirmation.")
            if self._pump is not None:
                await self._pump
                self._pump = None
            checks = request["success_contract"].get("all", request["success_contract"].get("any", []))
            if not checks or any(check["check_id"] not in self._description.supported_check_ids for check in checks):
                raise ValueError("Subgoal requires a native check unavailable in this session.")
            if arguments["native_task_id"] != self._native_task_id:
                raise ValueError("Task does not match the retained native scene.")
            for name in ("observation_ttl_s", "device_timeout_s", "policy_timeout_s"):
                value = arguments.get(name, 30)
                if type(value) not in (int, float) or not math.isfinite(value) or not 0 < value <= 300:
                    raise ValueError(f"Native {name} must be positive and at most 300 seconds.")
            self._request_keys[key] = request
            await self._device.on_owner(lambda: self._environment.bind_task(self._native_task_id))
            if not self._host_connected or not self._lease_active:
                raise RuntimeError("Native task lease ended during binding.")
            execution_id = str(uuid4())
            await self._device.bind_execution(execution_id)
            if not self._host_connected or not self._lease_active:
                raise RuntimeError("Native task lease ended during execution binding.")
            self._request = request
            self._policy_timeout_s = float(arguments.get("policy_timeout_s", 30))
            self._started = time.monotonic()
            self._state_version = 0
            self._policy_calls = 0
            self._last_monitor_action = 0
            self._boundary_at = None
            self._failure_detail = None
            self._last_boundary_publication = None
            self._last_control = None
            self._gate = ActionGate(
                self._validator, self._device, execution_id=execution_id,
                task_scope=gate_scope(request), action_spec=self._description.action_spec,
                max_control_steps=request["budget"]["max_control_steps"],
                max_wall_time_s=request["budget"]["max_wall_time_s"],
                lease_valid=lambda: self._lease_active, max_segment_actions=1,
                max_policy_actions=self._policy_max_actions_per_inference,
                observation_ttl_s=arguments.get("observation_ttl_s", 30),
                device_timeout_s=arguments.get("device_timeout_s", 30),
                on_segment=self._on_segment,
            )
            self._policy = WebSocketPolicyClient(
                self._policy_uri, self._validator,
                timeout_s=self._policy_timeout_s,
                execution_mode=self._execution_mode,
            )
            observation = await self._device.on_owner(self._environment.observe)
            if not self._host_connected or not self._lease_active:
                raise RuntimeError("Native task lease ended during capture.")
            publication = await self._publish(observation)
            self._pump = asyncio.create_task(self._run_policy())
            return publication

    async def _run_policy(self) -> None:
        gate = self._require_gate()
        try:
            while gate.snapshot()["state"] == "running":
                observation = await self._require_device().on_owner(self._environment.observe)
                if gate.snapshot()["state"] != "running":
                    return
                policy_observation = encode_policy_observation(self._description, observation, self._native_task_id)
                policy_observation["execution_mode"] = self._execution_mode.value
                policy_observation["control_mode"] = self._control_mode
                ticket = gate.request(
                    self._request["instruction"], observation.observation_id, policy_observation,
                    observed_monotonic=observation.observed_monotonic,
                )
                record_directory = os.environ.get("EDH_POLICY_REQUEST_RECORD_DIR")
                if record_directory is not None:
                    await asyncio.to_thread(
                        record_policy_request, ticket, Path(record_directory).resolve(strict=True)
                    )
                self._policy_calls += 1
                async with asyncio.timeout(gate.ticket_remaining_time()):
                    chunk = await self._policy.infer(ticket)
                if gate.snapshot()["state"] != "running":
                    return
                if not chunk["actions"]:
                    await gate.pause("policy_stop", terminal=True)
                else:
                    await gate.execute(chunk)
                if self._require_device().last_step is not None and self._require_device().last_step.episode_terminated:
                    await gate.pause("episode_terminated", terminal=True)
                if gate.snapshot()["state"] != "running":
                    self._last_monitor_action = self._require_device().executed_actions
                    if gate.snapshot()["stop_reason"] not in ("planner_pause", "user_stop"):
                        await self._publish(
                            await self._require_device().on_owner(self._environment.observe), self._last_control
                        )
        except asyncio.CancelledError:
            if gate.snapshot()["state"] == "running":
                await gate.pause("backend_error", terminal=True)
            if gate.snapshot()["state"] in ("paused", "ended") and gate.snapshot()["stop_reason"] not in ("planner_pause", "user_stop"):
                await self._publish(await self._require_device().on_owner(self._environment.observe), self._last_control)
        except Exception as error:
            traceback.print_exception(error, file=sys.stderr)
            self._failure_detail = f"{type(error).__name__}: {error}"[:1000]
            if gate.snapshot()["state"] in ("running", "pausing"):
                await gate.pause("backend_error", terminal=True)
            if gate.snapshot()["state"] in ("paused", "ended"):
                await self._publish(await self._require_device().on_owner(self._environment.observe), self._last_control)

    async def _on_segment(self, segment: dict[str, Any], receipt: dict[str, Any]) -> None:
        device = self._require_device()
        gate = self._require_gate()
        step = device.last_step
        if step is None:
            raise RuntimeError("Native action receipt has no completed step.")
        self._last_control = {
            "request_id": segment["request_id"],
            "segment_id": receipt["segment_id"],
            "action": segment["actions"][0],
            "executed_actions": step.executed_actions,
            "action_completed": step.action_completed,
            "raw_sim_steps": step.raw_sim_steps,
        }
        if len(step.native_frames) > 300:
            raise RuntimeError("Native action exceeded the bounded frame recording capacity.")
        prior_step_index = 0
        prior_simulation_time = -1.0
        for frame in step.native_frames:
            if (frame.native_step_index <= prior_step_index or
                    frame.native_step_index > step.raw_sim_steps or
                    not math.isfinite(frame.simulation_time_s) or
                    frame.simulation_time_s <= prior_simulation_time):
                raise RuntimeError("Native frame sequence or simulation time is invalid.")
            prior_step_index = frame.native_step_index
            prior_simulation_time = frame.simulation_time_s
            await self._emit({"event": "frame", "data": {
                "run_task_id": self._run_task_id,
                "execution_id": gate.snapshot()["execution_id"],
                "task_scope": gate_scope(self._request),
                "policy_request_id": segment["request_id"],
                "segment_id": receipt["segment_id"],
                "native_step_index": frame.native_step_index,
                "simulation_time_s": frame.simulation_time_s,
                "observation": self._observation_wire(frame),
            }})
        if step.interruption_reason is not None:
            raise RuntimeError(f"Native action interrupted: {step.interruption_reason}.")
        if device.executed_actions - self._last_monitor_action < self._monitor_every_actions:
            return
        if device.executed_actions >= self._request["budget"]["max_control_steps"]:
            return
        if gate.remaining_wall_time() <= 0:
            return
        observation = device.last_observation
        if observation is None:
            raise RuntimeError("Native action receipt has no captured observation.")
        self._last_monitor_action = device.executed_actions
        if gate.snapshot()["state"] == "running":
            await self._publish(observation, self._last_control, require_running=True)

    async def pause(self, arguments: dict[str, Any], *, terminal: bool = False) -> dict[str, Any]:
        async with self._control_lock:
            gate = self._require_gate()
            if "execution_id" in arguments and arguments["execution_id"] != gate.snapshot()["execution_id"]:
                raise ValueError("Stop request belongs to another execution.")
            if gate.snapshot()["state"] == "ended":
                return {"status": self._status, "observation": self._observation_wire(self._latest_observation)}
            reason = "user_stop" if terminal else "planner_pause"
            stopping = asyncio.create_task(gate.pause(reason, terminal=terminal))
            await stopping
            observation = await self._require_device().on_owner(self._environment.observe)
            publication = await self._publish(observation, self._last_control)
            if self._policy is not None:
                await self._policy.close()
                self._policy = None
            if self._pump is not None:
                await self._pump
                self._pump = None
            return publication

    async def resume(self, arguments: dict[str, Any]) -> dict[str, Any]:
        async with self._control_lock:
            self._check_boundary(arguments, require_state_version=True)
            if arguments["owner_id"] != self._request["decision_owner_id"]:
                raise ValueError("Only the admitted decision owner may resume.")
            await self._require_gate().resume()
            self._last_boundary_publication = None
            self._policy = WebSocketPolicyClient(
                self._policy_uri, self._validator, timeout_s=self._policy_timeout_s,
                execution_mode=self._execution_mode,
            )
            observation = await self._require_device().on_owner(self._environment.observe)
            publication = await self._publish(observation)
            self._pump = asyncio.create_task(self._run_policy())
            return publication

    def _check_boundary(self, arguments: dict[str, Any], *, require_state_version: bool = False) -> None:
        status = self._status
        if status is None or status["state"] not in ("paused", "ended") or not status["device_confirmed"]:
            raise RuntimeError("Native check requires a confirmed stopped boundary.")
        if arguments["execution_id"] != status["execution_id"] or arguments["boundary_id"] != status["boundary_event_id"]:
            raise ValueError("Native stopped boundary identity changed.")
        if require_state_version and arguments["state_version"] != status["state_version"]:
            raise ValueError("Native stopped boundary version changed.")

    async def check(self, arguments: dict[str, Any]) -> dict[str, Any]:
        async with self._control_lock:
            self._check_boundary(arguments)
            ids = arguments["check_ids"]
            if not isinstance(ids, list) or not ids or any(value not in self._description.supported_check_ids for value in ids):
                raise ValueError("Unsupported native check ID.")
            observation = await self._require_device().on_owner(self._environment.observe)
            facts = await self._require_device().on_owner(lambda: self._environment.check(ids))
            if [item.check_id for item in facts] != ids:
                raise RuntimeError("Native checks do not match the requested catalog IDs.")
            return {
                "status": self._status,
                "observation": self._observation_wire(observation),
                "facts": [vars(item) for item in facts],
            }

    async def capture(self, arguments: dict[str, Any]) -> dict[str, Any]:
        if self._run_task_id is None or arguments["run_task_id"] != self._run_task_id:
            raise ValueError("Capture requires the current session task identity.")
        run_task_id = self._run_task_id
        observation = await self._require_device().on_owner(self._environment.observe)
        if run_task_id != self._run_task_id or not self._host_connected:
            raise RuntimeError("Native task identity changed during capture.")
        return {"run_task_id": run_task_id, "observation": self._observation_wire(observation)}

    async def turn_view(self, arguments: dict[str, Any]) -> dict[str, Any]:
        direction = arguments["direction"]
        if direction not in self._description.active_view_directions:
            raise ValueError("Active observation direction is unsupported by this provider.")
        run_task_id = self._run_task_id
        if run_task_id is None:
            raise RuntimeError("Active observation requires an open session task.")
        observation = await self._require_device().on_owner(lambda: self._environment.turn_view(direction))
        if run_task_id != self._run_task_id or not self._host_connected:
            raise RuntimeError("Native task identity changed during active observation.")
        return {"run_task_id": run_task_id, "observation": self._observation_wire(observation)}

    async def open_task(self, arguments: dict[str, Any]) -> dict[str, Any]:
        async with self._control_lock:
            if not self._host_connected:
                raise RuntimeError("Native worker host is disconnected.")
            if self._run_task_id is not None:
                raise RuntimeError("Previous session task remains open.")
            if self._gate is not None and (self._gate.snapshot()["state"] != "ended" or not self._gate.snapshot()["device_confirmed"]):
                raise RuntimeError("Previous native execution lacks a confirmed terminal boundary.")
            if arguments["native_task_id"] != self._native_task_id:
                raise ValueError("Task does not match the retained native scene.")
            run_task_id = arguments["run_task_id"]
            catalog_task_id = arguments["catalog_task_id"]
            if (not isinstance(run_task_id, str) or not run_task_id or
                    not isinstance(catalog_task_id, str) or not catalog_task_id or
                    run_task_id in self._seen_run_ids):
                raise ValueError("Session task identities are invalid or reused.")
            await self._require_device().on_owner(lambda: self._environment.bind_task(self._native_task_id))
            if not self._host_connected:
                raise RuntimeError("Native worker host disconnected during task binding.")
            self._catalog_task_id = catalog_task_id
            self._run_task_id = run_task_id
            self._seen_run_ids.add(run_task_id)
            self._lease_active = True
            return {"catalog_task_id": catalog_task_id, "run_task_id": run_task_id, "native_task_id": self._native_task_id}

    async def close_task(self) -> dict[str, Any]:
        if self._gate is None:
            self._catalog_task_id = None
            self._run_task_id = None
            self._lease_active = False
            return {"closed": True}
        if self._gate.snapshot()["state"] != "ended":
            await self.pause({}, terminal=True)
        elif self._policy is not None:
            await self._policy.close()
            self._policy = None
        if self._pump is not None:
            await self._pump
            self._pump = None
        if not self._gate.snapshot()["device_confirmed"]:
            raise RuntimeError("Native task close has no confirmed device boundary.")
        self._catalog_task_id = None
        self._run_task_id = None
        self._lease_active = False
        return {"closed": True, "execution_id": self._gate.snapshot()["execution_id"]}

    async def close(self) -> dict[str, Any]:
        if self._device is None:
            return {"closed": True}
        await self.close_task()
        await self._device.close()
        return {"closed": True}

    async def transport_disconnected(self) -> None:
        self.revoke_lease()
        if self._gate is not None and self._gate.snapshot()["state"] != "ended":
            stopping = asyncio.create_task(self._gate.pause("user_stop", terminal=True))
            if self._policy is not None:
                await self._policy.close()
            await stopping
        if self._device is not None:
            await self._device.close()


def gate_scope(request: dict[str, Any] | None) -> dict[str, str]:
    if request is None:
        raise RuntimeError("Native task request is absent.")
    scope = {key: request[key] for key in ("task_id", "goal_id", "attempt_id")}
    if "recovery_id" in request:
        scope["recovery_id"] = request["recovery_id"]
    return scope


async def serve() -> None:
    loop = asyncio.get_running_loop()
    trace_after = os.environ.get("EDH_WORKER_TRACE_AFTER_S")
    if trace_after is not None:
        interval = float(trace_after)
        if not math.isfinite(interval) or not 1 <= interval <= 300:
            raise ValueError("Worker diagnostic interval must be 1 to 300 seconds.")
        faulthandler.dump_traceback_later(interval, repeat=True, file=sys.stderr)

        def dump_tasks() -> None:
            for task in asyncio.all_tasks(loop):
                print(f"Worker coroutine {task.get_name()}: {task!r}", file=sys.stderr)
                task.print_stack(limit=8, file=sys.stderr)
            loop.call_later(interval, dump_tasks)

        loop.call_later(interval, dump_tasks)
    transport, protocol = await loop.connect_write_pipe(
        asyncio.streams.FlowControlMixin, os.fdopen(3, "wb", buffering=0)
    )
    writer = asyncio.StreamWriter(transport, protocol, None, loop)
    output_lock = asyncio.Lock()

    async def emit(message: dict[str, Any]) -> None:
        serialized = json.dumps(message, allow_nan=False, separators=(",", ":"))
        if len(serialized) > 32 * 1024 * 1024:
            raise ValueError("Native worker message exceeds the transport bound.")
        async with output_lock:
            writer.write((serialized + "\n").encode("utf-8"))
            try:
                async with asyncio.timeout(10):
                    await writer.drain()
            except BaseException:
                session.revoke_lease()
                raise

    session = NativeWorkerSession(emit)
    handlers = {
        "initialize": session.initialize,
        "open_task": session.open_task,
        "start": session.start,
        "pause": session.pause,
        "stop": lambda args: session.pause(args, terminal=True),
        "resume": session.resume,
        "capture": session.capture,
        "turn_view": session.turn_view,
        "check": session.check,
        "close_task": lambda _args: session.close_task(),
        "close": lambda _args: session.close(),
    }
    active: set[asyncio.Task[None]] = set()

    async def handle(message: dict[str, Any]) -> None:
        request_id = message["id"]
        try:
            operation = message["op"]
            if operation not in handlers:
                raise ValueError("Unknown native worker operation.")
            result = await handlers[operation](require_object(message.get("args", {})))
            await emit({"id": request_id, "result": result})
        except Exception as error:
            await emit({"id": request_id, "error": {"type": type(error).__name__, "message": str(error)}})

    while line := await asyncio.to_thread(sys.stdin.readline):
        if len(line) > 32 * 1024 * 1024:
            raise ValueError("Native worker request exceeds the transport bound.")
        message = require_object(json.loads(line))
        task = asyncio.create_task(handle(message))
        active.add(task)
        task.add_done_callback(active.discard)
    await session.transport_disconnected()
    for task in active:
        task.cancel()
    if active:
        await asyncio.gather(*active, return_exceptions=True)


if __name__ == "__main__":
    asyncio.run(serve())
