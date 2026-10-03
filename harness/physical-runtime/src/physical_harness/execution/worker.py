from __future__ import annotations

import asyncio
import base64
from datetime import datetime, timezone
import faulthandler
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time
import traceback
from typing import Any, Awaitable, Callable
from uuid import uuid4

from physical_harness.environments import NativeEnvironment, NativeFrame, NativeObservation, NativeRotation
from physical_harness.execution.action_gate import ActionGate
from physical_harness.execution.modes import ExecutionMode
from physical_harness.execution.native_device import NativeActionDevice
from physical_harness.execution.resources import ResourceArbiter, ResourceBusy, ResourceLease
from physical_harness.execution.watchdog import ExecutionWatchdog
from physical_harness.execution.policy_observation import encode_policy_observation
from physical_harness.policies.client import WebSocketPolicyClient
from physical_harness.validation import ContractValidator


def wire_time() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def require_object(value: Any) -> dict[str, Any]:
    if type(value) is not dict:
        raise ValueError("Expected a JSON object.")
    return value


def validate_recording_directories() -> None:
    for name in ("EDH_POLICY_REQUEST_RECORD_DIR", "EDH_METRIC_CAPTURE_RECORD_DIR"):
        configured = os.environ.get(name)
        if configured is None:
            continue
        path = Path(configured)
        if not path.is_absolute():
            raise ValueError(f"{name} must name an absolute existing recording directory.")
        directory = path.resolve(strict=True)
        if not directory.is_dir():
            raise ValueError(f"{name} must name a recording directory.")
        probe = directory / f".edh-recording-check-{uuid4()}"
        with probe.open("xb") as output:
            output.flush()
            os.fsync(output.fileno())
        probe.unlink()


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


def record_policy_control(segment: dict[str, Any], receipt: dict[str, Any], device: NativeActionDevice,
                          directory: Path) -> None:
    for key in ("execution_id", "request_id", "segment_id"):
        value = segment[key]
        if not isinstance(value, str) or not value or not value.isascii() or not all(
            character.isalnum() or character in "-_.:" for character in value
        ) or value in (".", ".."):
            raise ValueError("Native policy control identity is invalid for local recording.")
    step = device.last_step
    if step is None:
        raise RuntimeError("Native policy control recording has no actual step.")
    target_directory = directory / segment["execution_id"] / segment["request_id"]
    target_directory.mkdir(parents=True, exist_ok=True)
    target = target_directory / f"{segment['segment_id']}.json"
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as output:
        json.dump({
            "schema_version": "edh.native_policy_receipt.v1",
            "recorded_at": wire_time(),
            "control_index": device.executed_actions,
            "segment": segment,
            "receipt": receipt,
            "raw_sim_steps": device.raw_sim_steps,
            "uncertain_actions": device.uncertain_actions,
            "native_step": {
                "executed_actions": step.executed_actions,
                "action_completed": step.action_completed,
                "raw_sim_steps": step.raw_sim_steps,
                "episode_terminated": step.episode_terminated,
                "interruption_reason": step.interruption_reason,
                "observation_id": step.observation.observation_id,
                "native_physics": step.native_physics,
            },
        }, output, allow_nan=False, separators=(",", ":"))
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
        self._provider: str | None = None
        self._gate: ActionGate | None = None
        self._request: dict[str, Any] | None = None
        self._pump: asyncio.Task[None] | None = None
        self._initial_observation: NativeObservation | None = None
        self._latest_observation: NativeObservation | None = None
        self._measurement_observation: NativeObservation | None = None
        self._measurement_control_counts: tuple[int, int] | None = None
        self._status: dict[str, Any] | None = None
        self._clock_id = str(uuid4())
        self._started = 0.0
        self._state_version = 0
        self._policy_calls = 0
        self._policy_timeout_s = 30.0
        self._transport_write_timeout_s = 30.0
        self._policy_max_actions_per_inference = 512
        self._monitor_every_actions = 1
        self._publish_running_images = False
        self._record_simulation_frames = False
        self._video_directory = None
        self._video_recorder = None
        self._last_monitor_action = 0
        self._boundary_at: str | None = None
        self._lease_active = False
        self._host_connected = True
        self._failure_detail: str | None = None
        self._last_motion: dict[str, Any] | None = None
        self._request_keys: dict[str, dict[str, Any]] = {}
        self._control_lock = asyncio.Lock()
        self._publish_lock = asyncio.Lock()
        self._last_boundary_publication: dict[str, Any] | None = None
        self._last_control: dict[str, Any] | None = None
        self._arbiter: ResourceArbiter | None = None
        self._motion_lease: ResourceLease | None = None
        self._watchdog: ExecutionWatchdog | None = None
        self._watchdog_stop: asyncio.Task[None] | None = None
        self._background_fault: Exception | None = None

    def revoke_lease(self) -> None:
        self._lease_active = False
        self._host_connected = False
        if self._device is not None and self._device.execution_id is not None:
            self._device.fence_execution(self._device.execution_id)

    async def _guard_background(self, operation: Awaitable[None]) -> None:
        try:
            await operation
        except Exception as error:
            if self._background_fault is None:
                self._background_fault = error
                self.revoke_lease()
                print(json.dumps({
                    "event": "native_background_fault_diagnostic",
                    "recorded_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
                    "task_scope": gate_scope(self._request),
                    "gate": self._require_gate().snapshot(),
                    "device": self._require_device().diagnostic_snapshot(),
                    "type": type(error).__name__,
                    "message": str(error)[:1000] or type(error).__name__,
                }, allow_nan=False), file=sys.stderr, flush=True)
                traceback.print_exception(error, file=sys.stderr)
                await self._emit({"event": "fault", "data": {
                    "execution_id": self._require_gate().snapshot()["execution_id"],
                    "task_scope": gate_scope(self._request),
                    "type": type(error).__name__,
                    "message": str(error)[:1000] or type(error).__name__,
                }})
            raise

    def _execution_lease_valid(self) -> bool:
        return (self._host_connected and self._lease_active
                and self._motion_lease is not None and self._motion_lease.valid())

    def _release_execution_resources(self) -> None:
        if self._gate is not None:
            snapshot = self._gate.snapshot()
            if snapshot["state"] != "ended" or not snapshot["device_confirmed"]:
                raise RuntimeError("Physical resources require a confirmed terminal boundary before release.")
        if self._watchdog is not None:
            self._watchdog.close()
            self._watchdog = None
        if self._motion_lease is not None:
            self._motion_lease.release()
            self._motion_lease = None

    async def _watchdog_expired(self, gate: ActionGate, reason: str) -> None:
        async with self._control_lock:
            if self._gate is not gate or gate.snapshot()["state"] == "ended":
                return
            self._failure_detail = f"Independent device watchdog: {reason}"
            await gate.pause(reason, terminal=True)
            if self._policy is not None:
                await self._policy.close()
            self._release_execution_resources()
            if self._host_connected:
                await self._publish(await self._require_device().on_owner(self._environment.observe), self._last_control)

    @property
    def transport_write_timeout_s(self) -> float:
        return self._transport_write_timeout_s

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
            "control_generation": snapshot["generation"],
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
        status = self._status_for(observation)
        include_images = status["state"] != "running" or self._publish_running_images
        publication = {
            "status": status,
            "observation": self._observation_wire(observation, include_images=include_images),
            "uncertain_actions": self._require_device().uncertain_actions,
        }
        if self._failure_detail is not None:
            publication["diagnostic"] = self._failure_detail
        return publication

    @staticmethod
    def _observation_wire(observation: NativeObservation | NativeFrame, *, include_images: bool = True) -> dict[str, Any]:
        return {
            "observation_id": observation.observation_id,
            "observed_at": observation.observed_at,
            "images": ({name: base64.b64encode(data).decode("ascii") for name, data in observation.images.items()}
                       if include_images else {}),
            **({"images_omitted": True} if not include_images else {}),
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
        validate_recording_directories()
        transport_write_timeout_s = arguments.get("transport_write_timeout_s", 30)
        if (type(transport_write_timeout_s) not in (int, float)
                or not math.isfinite(transport_write_timeout_s)
                or not 0 < transport_write_timeout_s <= 60):
            raise ValueError("Native transport_write_timeout_s must be positive and at most 60 seconds.")
        self._transport_write_timeout_s = float(transport_write_timeout_s)
        self._provider = arguments["provider"]
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
        self._publish_running_images = arguments.get("publish_running_images", False)
        self._record_simulation_frames = arguments.get("record_simulation_frames", False)
        if type(self._publish_running_images) is not bool or type(self._record_simulation_frames) is not bool:
            raise ValueError("Image publication and frame recording options must be booleans.")
        video_directory = arguments.get("simulation_video_directory")
        if video_directory is not None:
            if not isinstance(video_directory, str) or not Path(video_directory).is_absolute():
                raise ValueError("Simulation video directory must be an absolute worker-local path.")
            self._video_directory = Path(video_directory)
        self._policy_max_actions_per_inference = arguments.get("policy_max_actions_per_inference", 512)
        if type(self._policy_max_actions_per_inference) is not int or not 1 <= self._policy_max_actions_per_inference <= 512:
            raise ValueError("Policy action limit must contain 1 to 512 control commands.")
        self._validator = ContractValidator.from_path(arguments["schema_path"])
        scope = arguments.get("shared_resource_scope", self._clock_id)
        directory = arguments.get("resource_lock_directory")
        if directory is not None and (not isinstance(directory, str) or not Path(directory).is_absolute()):
            raise ValueError("Resource lock directory must be an absolute path.")
        lock_directory = (Path(directory) if directory is not None else
                          Path(arguments["schema_path"]).resolve().parents[3] / ".local" / "physical-resources")
        self._arbiter = ResourceArbiter(lock_directory, scope)
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
            from physical_harness.environments.behavior.process import BehaviorProcessEnvironment
            source_root = Path(arguments["source_root"]).resolve(strict=True)
            environment = BehaviorProcessEnvironment(source_root, self._validator)
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
            "rotation_axes": self._description.rotation_axes,
            "task_instruction": self._description.task_instruction,
            "scene_metadata": self._description.scene_metadata,
            "native_task_id": self._native_task_id,
            "clock_id": self._clock_id,
            "policy_id": self._policy_id,
            "execution_mode": self._execution_mode.value,
            "supports_object_measurement": callable(getattr(self._environment, "measure_object", None)),
        }

    async def start(self, arguments: dict[str, Any]) -> dict[str, Any]:
        if self._arbiter is None:
            raise RuntimeError("Native resource arbiter has not been initialized.")
        if self._motion_lease is not None:
            snapshot = self._require_gate().snapshot()
            if snapshot["state"] != "ended" or not snapshot["device_confirmed"]:
                raise ResourceBusy("Policy execution owns the device motion resources.")
            self._release_execution_resources()
        if self._pump is not None and self._gate is not None and self._gate.snapshot()["state"] == "ended":
            await self._pump
            self._pump = None
        previous_gate = self._gate
        previous_execution = self._require_device().execution_id
        self._motion_lease = self._arbiter.acquire(("motion",))
        try:
            return await self._start(arguments)
        except BaseException:
            if self._gate is not previous_gate:
                await self._gate.pause("backend_error", terminal=True)
            elif self._require_device().execution_id != previous_execution:
                execution_id = self._require_device().execution_id
                self._require_device().fence_execution(execution_id)
                await self._require_device().stop(execution_id, 1)
            if self._policy is not None and self._gate is not previous_gate:
                await self._policy.close()
                self._policy = None
            self._release_execution_resources()
            raise

    async def _start(self, arguments: dict[str, Any]) -> dict[str, Any]:
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
            self._measurement_observation = None
            self._measurement_control_counts = None
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
            if self._video_recorder is not None:
                await asyncio.to_thread(self._video_recorder.close)
            if self._video_directory is not None:
                from physical_harness.execution.video import SimulationVideoRecorder
                self._video_recorder = SimulationVideoRecorder(self._video_directory, execution_id)
            await self._device.bind_execution(execution_id)
            if not self._host_connected or not self._lease_active:
                raise RuntimeError("Native task lease ended during execution binding.")
            self._request = request
            self._policy_timeout_s = float(arguments.get("policy_timeout_s", 30))
            self._started = time.monotonic()
            self._state_version = 0
            self._policy_calls = 0
            self._last_motion = None
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
                lease_valid=self._execution_lease_valid, max_segment_actions=1,
                max_policy_actions=self._policy_max_actions_per_inference,
                observation_ttl_s=arguments.get("observation_ttl_s", 30),
                device_timeout_s=arguments.get("device_timeout_s", 30),
                on_segment=self._on_segment,
            )
            gate = self._gate
            # 保留 native episode 的终止状态，为当前任务取得新的确认边界。
            episode_terminated = await self._device.on_owner(self._environment.episode_terminated)
            if type(episode_terminated) is not bool:
                raise RuntimeError("Native environment returned an invalid episode termination state.")
            if episode_terminated:
                await gate.pause("episode_terminated", terminal=True)
                observation = await self._device.on_owner(self._environment.observe)
                publication = await self._publish(observation)
                self._release_execution_resources()
                return publication
            loop = asyncio.get_running_loop()

            def expired(reason: str) -> None:
                def schedule_stop() -> None:
                    self._watchdog_stop = asyncio.create_task(self._guard_background(self._watchdog_expired(gate, reason)))
                    self._watchdog_stop.add_done_callback(lambda task: None if task.cancelled() else task.exception())
                loop.call_soon_threadsafe(schedule_stop)

            self._watchdog = ExecutionWatchdog(
                deadline=self._started + request["budget"]["max_wall_time_s"],
                lease_valid=self._execution_lease_valid,
                fence=lambda: self._require_device().fence_execution(execution_id),
                notify=expired,
            )
            self._watchdog.start()
            self._policy = WebSocketPolicyClient(
                self._policy_uri, self._validator,
                timeout_s=self._policy_timeout_s,
                execution_mode=self._execution_mode,
            )
            self._policy.tool_handler = self._policy_tool
            self._policy.event_handler = self._policy_event
            observation = await self._device.on_owner(self._environment.observe)
            if not self._host_connected or not self._lease_active:
                raise RuntimeError("Native task lease ended during capture.")
            publication = await self._publish(observation)
            self._pump = asyncio.create_task(self._guard_background(self._run_policy()))
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
                if self._last_motion is not None:
                    policy_observation["movement"] = self._last_motion
                if self._provider == "robodojo":
                    policy_observation["control_context"] = await self._require_device().on_owner(
                        self._environment.policy_context, observation.observation_id
                    )
                if gate.snapshot()["state"] != "running":
                    return
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
                    motion = self._policy.motion
                    if self._provider == "robodojo":
                        source = "student" if self._execution_mode is ExecutionMode.POLICY or (
                            self._execution_mode is ExecutionMode.HYBRID and motion is None and
                            self._policy.last_response.get("review", {}).get("decision") == "allow"
                        ) else "gpt_joint" if motion is None or motion["mode"] == "joint" else "gpt_eef"
                        await self._require_device().on_owner(
                            self._environment.select_control_source, source, "EDH admitted policy decision"
                        )
                    if gate.snapshot()["state"] != "running" or gate.snapshot()["generation"] != ticket["generation"]:
                        return
                    if motion is None:
                        await gate.execute(chunk)
                    else:
                        await self._execute_motion(ticket, chunk, motion)
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
                await gate.pause(gate.failure_reason(), terminal=True)
            if gate.snapshot()["state"] in ("paused", "ended") and gate.snapshot()["stop_reason"] not in ("planner_pause", "user_stop"):
                await self._publish(await self._require_device().on_owner(self._environment.observe), self._last_control)
        except Exception as error:
            traceback.print_exception(error, file=sys.stderr)
            self._failure_detail = f"{type(error).__name__}: {error}"[:1000]
            snapshot = gate.snapshot()
            if snapshot["state"] == "running":
                await gate.pause(gate.failure_reason(), terminal=True)
            elif snapshot["state"] == "pausing":
                await gate.pause(snapshot["stop_reason"], terminal=True)
            if gate.snapshot()["state"] in ("paused", "ended"):
                await self._publish(await self._require_device().on_owner(self._environment.observe), self._last_control)
        finally:
            if self._gate is gate and gate.snapshot()["state"] == "ended" and gate.snapshot()["device_confirmed"]:
                self._release_execution_resources()

    async def _policy_event(self, request: dict[str, Any], event: dict[str, Any]) -> None:
        gate = self._require_gate()
        if (gate.snapshot()["state"] != "running" or
                event["requestId"] != request["request_id"] or
                event["executionId"] != request["execution_id"] or
                event["taskScope"] != request["task_scope"] or
                event["generation"] != request["generation"] or
                event["observationId"] != request["observation_id"] or
                gate.snapshot()["generation"] != request["generation"]):
            raise ValueError("Policy telemetry differs from its current inference scope.")
        await self._emit({"event": "policy", "data": event})

    async def _policy_tool(self, request: dict[str, Any], message: dict[str, Any]) -> Any:
        gate = self._require_gate()
        if (self._provider != "robodojo" or gate.snapshot()["state"] != "running" or
                gate.snapshot()["generation"] != request["generation"] or gate.ticket_remaining_time() <= 0):
            raise ValueError("Policy tools require the admitted RoboDojo inference scope.")
        arguments = require_object(message.get("arguments", {}))
        result = await self._require_device().on_owner(
            self._environment.policy_tool, request["observation_id"], message["operation"], arguments
        )
        return result

    async def _execute_motion(self, ticket: dict[str, Any], chunk: dict[str, Any], motion: dict[str, Any]) -> None:
        if (self._provider != "robodojo" or not isinstance(motion, dict) or
                set(motion) != {"mode", "targets", "steps", "stop_on_reach"} or
                motion["mode"] not in {"eef", "joint"} or type(motion["steps"]) is not int or
                not 1 <= motion["steps"] <= 150 or type(motion["stop_on_reach"]) is not bool):
            raise ValueError("Invalid bounded direct-motion intent.")
        device, gate = self._require_device(), self._require_gate()
        generation = ticket["generation"]
        await device.on_owner(self._environment.motion_status, motion)
        if gate.snapshot()["state"] != "running" or gate.snapshot()["generation"] != generation:
            return
        prepared = await device.on_owner(self._environment.policy_tool, ticket["observation_id"],
                                         "eef_joint_target", {"targets": motion["targets"]})
        if gate.snapshot()["state"] != "running" or gate.snapshot()["generation"] != generation:
            return
        if len(chunk["actions"]) != 1 or chunk["actions"][0] != prepared["action"]:
            raise ValueError("Direct motion action differs from the measured-state tracking command.")
        errors: list[float] = []
        start_actions = device.executed_actions
        for index in range(motion["steps"]):
            if gate.snapshot()["state"] != "running":
                return
            if index:
                observation = await device.on_owner(self._environment.observe)
                if gate.snapshot()["state"] != "running" or gate.snapshot()["generation"] != generation:
                    return
                ticket = gate.request(self._request["instruction"], observation.observation_id,
                                      {"motion_tracking": True}, observed_monotonic=observation.observed_monotonic)
                proposal = await device.on_owner(self._environment.policy_tool, observation.observation_id,
                    "eef_joint_target", {"targets": motion["targets"]})
                if gate.snapshot()["state"] != "running" or gate.snapshot()["generation"] != generation:
                    return
                chunk = {"schema_version": "physical.action_chunk.v1", **{key: ticket[key] for key in
                    ("request_id", "execution_id", "task_scope", "generation", "observation_id", "valid_until", "action_spec")},
                    "actions": [proposal["action"]]}
            await gate.execute(chunk)
            await device.on_owner(self._environment.observe)
            status = await device.on_owner(self._environment.motion_status, motion)
            self._last_motion = {**status, "status": "step_budget", "executed_steps": device.executed_actions - start_actions}
            if device.last_step is not None and device.last_step.episode_terminated:
                self._last_motion["status"] = "terminal"
                await gate.pause("episode_terminated", terminal=True)
                return
            if gate.snapshot()["state"] != "running":
                return
            errors.append(status["error"])
            if motion["stop_on_reach"] and (status["reached"] or
                    len(errors) >= 20 and errors[-20] - min(errors[-19:]) < 1e-4):
                self._last_motion["status"] = "reached" if status["reached"] else "stalled"
                return

    async def _on_segment(self, segment: dict[str, Any], receipt: dict[str, Any]) -> None:
        device = self._require_device()
        gate = self._require_gate()
        step = device.last_step
        if step is None:
            raise RuntimeError("Native action receipt has no completed step.")
        record_directory = os.environ.get("EDH_POLICY_REQUEST_RECORD_DIR")
        if record_directory is not None:
            await asyncio.to_thread(record_policy_control, segment, receipt, device,
                                    Path(record_directory).resolve(strict=True))
        self._last_control = {
            "request_id": segment["request_id"],
            "segment_id": receipt["segment_id"],
            "action": segment["actions"][0],
            "executed_actions": step.executed_actions,
            "action_completed": step.action_completed,
            "raw_sim_steps": step.raw_sim_steps,
        }
        if step.episode_terminated and gate.snapshot()["state"] == "running":
            self._last_monitor_action = device.executed_actions
            await gate.pause("episode_terminated", terminal=True)
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
            if self._video_recorder is not None:
                await asyncio.to_thread(self._video_recorder.append, frame, segment)
            if not self._record_simulation_frames:
                continue
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
        if step.episode_terminated:
            return
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

    async def pause(self, arguments: dict[str, Any], *, terminal: bool = False,
                    review: bool = False) -> dict[str, Any]:
        async with self._control_lock:
            gate = self._require_gate()
            if "execution_id" in arguments and arguments["execution_id"] != gate.snapshot()["execution_id"]:
                raise ValueError("Stop request belongs to another execution.")
            if review:
                if (arguments["execution_id"] != gate.snapshot()["execution_id"] or
                        arguments["owner_id"] != self._request["decision_owner_id"] or
                        arguments["owner_assignment_id"] != self._request["owner_assignment_id"] or
                        arguments["task_scope"] != self._status["task_scope"]):
                    raise ValueError("Terminal review requires the current admitted decision owner and task scope.")
            if gate.snapshot()["state"] == "ended":
                if self._pump is not None:
                    await self._pump
                    self._pump = None
                if (self._status["state"] != "ended" or
                        self._last_boundary_publication is None):
                    await self._publish(await self._require_device().on_owner(self._environment.observe), self._last_control)
                return {"status": self._status, "observation": self._observation_wire(self._latest_observation)}
            reason = "planner_stop" if review else ("user_stop" if terminal else "planner_pause")
            stopping = asyncio.create_task(gate.pause(reason, terminal=terminal))
            if self._policy is not None:
                await self._policy.close()
                self._policy = None
            await stopping
            if self._pump is not None:
                await self._pump
                self._pump = None
            observation = await self._require_device().on_owner(self._environment.observe)
            publication = await self._publish(observation, self._last_control)
            if terminal:
                self._release_execution_resources()
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
            self._policy.tool_handler = self._policy_tool
            self._policy.event_handler = self._policy_event
            observation = await self._require_device().on_owner(self._environment.observe)
            publication = await self._publish(observation)
            self._pump = asyncio.create_task(self._guard_background(self._run_policy()))
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
            run_task_id = self._run_task_id
            self._check_task_boundary(arguments, run_task_id)
            ids = arguments["check_ids"]
            if not isinstance(ids, list) or not ids or any(value not in self._description.supported_check_ids for value in ids):
                raise ValueError("Unsupported native check ID.")
            observation = await self._require_device().on_owner(self._environment.observe)
            self._check_task_boundary(arguments, run_task_id)
            facts = await self._require_device().on_owner(lambda: self._environment.check(ids))
            self._check_task_boundary(arguments, run_task_id)
            if [item.check_id for item in facts] != ids:
                raise RuntimeError("Native checks do not match the requested catalog IDs.")
            return {
                "status": self._status,
                "observation": self._observation_wire(observation),
                "facts": [vars(item) for item in facts],
            }

    def _check_task_boundary(self, arguments: dict[str, Any], run_task_id: str | None) -> None:
        if not self._host_connected or not self._lease_active:
            raise RuntimeError("Native task lease is unavailable for checking.")
        if (run_task_id is None or run_task_id != self._run_task_id
                or self._request is None or self._request["task_id"] != run_task_id):
            raise RuntimeError("Native task identity changed during checking.")
        self._check_boundary(arguments)
        if self._status["task_scope"]["task_id"] != run_task_id:
            raise RuntimeError("Native check status belongs to another session task.")
        snapshot = self._require_gate().snapshot()
        if (snapshot["state"] not in ("paused", "ended") or not snapshot["device_confirmed"]
                or snapshot["execution_id"] != arguments["execution_id"]
                or snapshot["boundary_id"] != arguments["boundary_id"]):
            raise RuntimeError("Native stopped boundary changed during checking.")

    async def capture(self, arguments: dict[str, Any]) -> dict[str, Any]:
        if self._run_task_id is None or arguments["run_task_id"] != self._run_task_id:
            raise ValueError("Capture requires the current session task identity.")
        run_task_id = self._run_task_id
        observation = await self._require_device().on_owner(self._environment.observe)
        if run_task_id != self._run_task_id or not self._host_connected:
            raise RuntimeError("Native task identity changed during capture.")
        if callable(getattr(self._environment, "measure_object", None)):
            self._measurement_observation = observation
            device = self._require_device()
            self._measurement_control_counts = (device.executed_actions, device.raw_sim_steps)
        return {"run_task_id": run_task_id, "observation": self._observation_wire(observation)}

    async def capture_review(self, arguments: dict[str, Any]) -> dict[str, Any]:
        async with self._control_lock:
            if self._run_task_id is None or arguments["run_task_id"] != self._run_task_id:
                raise ValueError("Review capture requires the current session task identity.")
            if arguments["task_scope"] != gate_scope(self._request):
                raise ValueError("Review capture requires the admitted execution scope.")
            gate = self._require_gate()
            generation = arguments["control_generation"]
            if isinstance(generation, bool) or not isinstance(generation, int) or generation < 0:
                raise ValueError("Review capture requires a nonnegative control generation.")

            def current() -> bool:
                snapshot = gate.snapshot()
                return (self._host_connected and snapshot["state"] == "running"
                        and snapshot["execution_id"] == arguments["execution_id"]
                        and snapshot["generation"] == generation)

            if not current():
                return {"review_available": False}
            observation = await self._require_device().on_owner(self._environment.observe)
            if not current():
                return {"review_available": False}
            return {"review_available": True, "run_task_id": self._run_task_id,
                    "execution_id": arguments["execution_id"], "control_generation": generation,
                    "task_scope": gate_scope(self._request),
                    "observation": self._observation_wire(observation)}

    async def measure_object(self, arguments: dict[str, Any]) -> dict[str, Any]:
        async with self._control_lock:
            if not callable(getattr(self._environment, "measure_object", None)):
                raise ValueError("Native provider does not support object measurement.")
            run_task_id = self._run_task_id
            if run_task_id is None or arguments["run_task_id"] != run_task_id or not self._host_connected:
                raise ValueError("Object measurement requires the current connected session task.")
            snapshot = self._gate.snapshot() if self._gate is not None else None
            if snapshot is not None and (snapshot["state"] not in ("paused", "ended")
                                         or not snapshot["device_confirmed"]):
                raise RuntimeError("Object measurement requires a confirmed stopped device.")
            observation = self._measurement_observation
            device = self._require_device()
            counts = (device.executed_actions, device.raw_sim_steps)
            if (observation is None or arguments["observation_id"] != observation.observation_id
                    or counts != self._measurement_control_counts):
                raise ValueError("Object measurement requires an unchanged latest explicit capture.")
            camera = arguments["camera"]
            digest = arguments["source_image_sha256"]
            encoded_mask = arguments["mask_png_base64"]
            if (not isinstance(camera, str) or camera not in observation.images
                    or not isinstance(digest, str) or len(digest) != 64
                    or any(character not in "0123456789abcdef" for character in digest)
                    or hashlib.sha256(observation.images[camera]).hexdigest() != digest):
                raise ValueError("Object measurement camera or source image identity differs from capture.")
            if not isinstance(encoded_mask, str) or not encoded_mask or len(encoded_mask) > 8 * 1024 * 1024:
                raise ValueError("Object measurement mask exceeds its bounded PNG input.")
            mask_png = base64.b64decode(encoded_mask, validate=True)
            result = await device.on_owner(lambda: self._environment.measure_object(
                observation.observation_id, camera, digest, mask_png
            ))
            after = self._gate.snapshot() if self._gate is not None else None
            if (not self._host_connected or self._run_task_id != run_task_id
                    or snapshot != after or self._measurement_observation is not observation
                    or counts != (device.executed_actions, device.raw_sim_steps)):
                raise RuntimeError("Native task or control boundary changed during object measurement.")
            return {"run_task_id": run_task_id, "measurement": result}

    async def turn_view(self, arguments: dict[str, Any]) -> dict[str, Any]:
        async with self._control_lock:
            direction = arguments["direction"]
            if direction not in self._description.active_view_directions:
                raise ValueError("Active observation direction is unsupported by this provider.")
            run_task_id = self._run_task_id
            if run_task_id is None or not self._host_connected or not self._lease_active:
                raise RuntimeError("Active observation requires a connected session task.")
            lease = self._arbiter.acquire(("motion",))
            try:
                observation = await self._require_device().on_owner(lambda: self._environment.turn_view(direction))
                if run_task_id != self._run_task_id or not self._host_connected:
                    raise RuntimeError("Native task identity changed during active observation.")
                return {"run_task_id": run_task_id, "observation": self._observation_wire(observation)}
            finally:
                lease.release()

    async def rotate_view(self, arguments: dict[str, Any]) -> dict[str, Any]:
        async with self._control_lock:
            run_task_id = self._run_task_id
            if (not self._host_connected or not self._lease_active or run_task_id is None
                    or arguments["run_task_id"] != run_task_id):
                raise RuntimeError("Rotation requires the current connected task lease.")
            yaw, pitch = arguments["yaw_deg"], arguments["pitch_deg"]
            for axis, value, limit in (("yaw", yaw, 90), ("pitch", pitch, 45)):
                if type(value) not in (int, float) or not math.isfinite(value) or abs(value) > limit:
                    raise ValueError("Rotation angle exceeds its finite degree limit.")
                if value != 0 and axis not in self._description.rotation_axes:
                    raise ValueError("Rotation axis is unsupported by this device.")
            if not self._description.rotation_axes:
                raise ValueError("This device does not support rotation.")
            snapshot = self._gate.snapshot() if self._gate is not None else None
            if snapshot is not None and (snapshot["state"] != "ended" or not snapshot["device_confirmed"]):
                raise RuntimeError("Rotation requires a confirmed ended execution.")
            if self._pump is not None and not self._pump.done():
                raise RuntimeError("Policy execution still owns the motion resource.")
            lease = self._arbiter.acquire(("motion",))
            try:
                result = await self._require_device().on_owner(lambda: self._environment.rotate_view(
                    float(yaw), float(pitch), lambda: not self._host_connected or not self._lease_active or not lease.valid()
                ))
            finally:
                lease.release()
            if not isinstance(result, NativeRotation):
                raise RuntimeError("Native rotation did not provide its measured receipt.")
            self._measurement_observation = None
            self._measurement_control_counts = None
            self._latest_observation = result.observation
            if not self._host_connected or not self._lease_active or self._run_task_id != run_task_id:
                raise RuntimeError("Task lease changed during rotation; inspect the native motion record.")
            if snapshot != (self._gate.snapshot() if self._gate is not None else None):
                raise RuntimeError("Execution boundary changed during rotation.")
            return {"run_task_id": run_task_id, "observation": self._observation_wire(result.observation),
                    "motion": {key: value for key, value in vars(result).items() if key != "observation"}}

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
            self._measurement_observation = None
            self._measurement_control_counts = None
            self._seen_run_ids.add(run_task_id)
            self._lease_active = True
            return {"catalog_task_id": catalog_task_id, "run_task_id": run_task_id, "native_task_id": self._native_task_id}

    async def close_task(self) -> dict[str, Any]:
        self._measurement_observation = None
        self._measurement_control_counts = None
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
        if self._video_recorder is not None:
            await asyncio.to_thread(self._video_recorder.close)
        self._catalog_task_id = None
        self._run_task_id = None
        self._lease_active = False
        self._release_execution_resources()
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
        if self._gate is not None:
            self._release_execution_resources()
        if self._device is not None:
            await self._device.close()
        if self._video_recorder is not None:
            await asyncio.to_thread(self._video_recorder.close)


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
        try:
            async with asyncio.timeout(session.transport_write_timeout_s):
                async with output_lock:
                    writer.write((serialized + "\n").encode("utf-8"))
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
        "end": lambda args: session.pause(args, terminal=True, review=True),
        "resume": session.resume,
        "capture": session.capture,
        "capture_review": session.capture_review,
        "measure_object": session.measure_object,
        "turn_view": session.turn_view,
        "rotate_view": session.rotate_view,
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
        except Exception as error:
            await emit({"id": request_id, "error": {"type": type(error).__name__, "message": str(error)}})
        else:
            await emit({"id": request_id, "result": result})

    def read_request_line() -> str:
        line = sys.stdin.readline()
        if not line:
            session.revoke_lease()
        return line

    while line := await asyncio.to_thread(read_request_line):
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
