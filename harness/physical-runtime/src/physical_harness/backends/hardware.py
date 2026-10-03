from __future__ import annotations

import copy
from dataclasses import dataclass
import math
from typing import Any, Mapping, Protocol

from physical_harness.validation import ContractValidator


@dataclass(frozen=True)
class HardwareCapabilities:
    device_id: str
    embodiment_id: str
    connection_id: str
    actuator_resources: tuple[str, ...]
    camera_names: tuple[str, ...]
    state_channels: tuple[str, ...]
    coordinate_frames: tuple[str, ...]
    action_spec: Mapping[str, Any]
    supports_pause: bool
    supports_resume: bool
    stop_watchdog_timeout_s: float

    def validate(self, validator: ContractValidator) -> None:
        for identity in (self.device_id, self.embodiment_id, self.connection_id):
            if not isinstance(identity, str) or not identity.strip():
                raise ValueError("Hardware identities require nonempty strings.")
        for names in (self.actuator_resources, self.camera_names, self.state_channels, self.coordinate_frames):
            if not isinstance(names, tuple) or any(not isinstance(name, str) or not name.strip() for name in names):
                raise ValueError("Hardware capabilities require named immutable channel sequences.")
            if len(names) != len(set(names)):
                raise ValueError("Hardware capability names must be unique.")
        if not self.actuator_resources or not self.coordinate_frames or not self.state_channels:
            raise ValueError("Hardware control requires actuator resources, coordinate frames and state channels.")
        if type(self.supports_pause) is not bool or type(self.supports_resume) is not bool:
            raise ValueError("Hardware pause and resume capabilities must be booleans.")
        if self.supports_resume and not self.supports_pause:
            raise ValueError("Hardware resume requires pause support.")
        if (type(self.stop_watchdog_timeout_s) not in (int, float)
                or not math.isfinite(self.stop_watchdog_timeout_s)
                or not 0 < self.stop_watchdog_timeout_s <= 10):
            raise ValueError("Hardware requires a positive independent controller watchdog of at most ten seconds.")
        validator.parse("ActionSpec", dict(self.action_spec))
        if self.action_spec["embodiment_id"] != self.embodiment_id:
            raise ValueError("Hardware ActionSpec differs from the discovered embodiment.")
        if self.action_spec["coordinate_frame"] not in self.coordinate_frames:
            raise ValueError("Hardware action frame is absent from discovered coordinate frames.")


class HardwareBackend(Protocol):
    async def discover(self) -> HardwareCapabilities: ...
    async def arm(self, connection_id: str, execution_id: str, generation: int) -> bool: ...
    async def dispatch(self, connection_id: str, segment: dict[str, Any]) -> dict[str, Any]: ...
    async def stop(self, connection_id: str, execution_id: str, generation: int) -> dict[str, Any]: ...
    async def resume(self, connection_id: str, execution_id: str, generation: int) -> bool: ...
    async def disconnect(self, connection_id: str) -> None: ...


class HardwareActionDevice:
    def __init__(self, backend: HardwareBackend, capabilities: HardwareCapabilities,
                 validator: ContractValidator) -> None:
        capabilities.validate(validator)
        self.capabilities = copy.deepcopy(capabilities)
        self._backend = backend
        self._validator = validator
        self._execution_id: str | None = None
        self._generation = 0
        self._confirmed = False
        self._accepting = False
        self._boundary_id: str | None = None
        self._closed = False
        self._seen_execution_ids: set[str] = set()

    async def verify_connection(self) -> None:
        discovered = await self._backend.discover()
        discovered.validate(self._validator)
        if discovered != self.capabilities:
            raise RuntimeError("Hardware connection or discovered capabilities changed; explicit readmission is required.")

    async def bind_execution(self, execution_id: str) -> None:
        if self._closed or self._execution_id is not None and not self._confirmed:
            raise RuntimeError("Hardware binding requires a connected confirmed stopped device.")
        if not isinstance(execution_id, str) or not execution_id.strip() or execution_id in self._seen_execution_ids:
            raise ValueError("Hardware execution identity is invalid or reused.")
        if len(self._seen_execution_ids) >= 1024:
            raise RuntimeError("Hardware execution identity history is full; reconnect through explicit readmission.")
        await self.verify_connection()
        self._seen_execution_ids.add(execution_id)
        self._execution_id, self._generation = execution_id, 0
        self._confirmed, self._boundary_id = False, None
        acknowledgement = await self._backend.stop(self.capabilities.connection_id, execution_id, 0)
        self._validator.parse("StopAcknowledgement", acknowledgement)
        if (acknowledgement["execution_id"] != execution_id or acknowledgement["generation"] != 0
                or not acknowledgement["device_confirmed"]):
            raise RuntimeError("Hardware admission requires an identified confirmed stopped device.")
        await self.verify_connection()
        armed = await self._backend.arm(self.capabilities.connection_id, execution_id, 0)
        if armed is not True or self._generation != 0:
            raise RuntimeError("Hardware did not acknowledge the admitted execution generation.")
        self._accepting = True

    async def dispatch(self, segment: dict[str, Any]) -> dict[str, Any]:
        self._validator.parse("ActionSegment", segment)
        if (self._closed or not self._accepting or segment["execution_id"] != self._execution_id
                or segment["generation"] != self._generation
                or segment["action_spec"] != self.capabilities.action_spec):
            raise RuntimeError("Hardware action identity, generation or specification is no longer admitted.")
        await self.verify_connection()
        if not self._accepting or segment["generation"] != self._generation:
            raise RuntimeError("Hardware action was superseded during connection discovery.")
        receipt = await self._backend.dispatch(self.capabilities.connection_id, copy.deepcopy(segment))
        self._validator.parse("ActionReceipt", receipt)
        if (any(receipt[name] != segment[name] for name in ("execution_id", "generation", "segment_id"))
                or receipt["executed_actions"] > len(segment["actions"])):
            raise RuntimeError("Hardware action acknowledgement differs from the admitted segment.")
        return receipt

    async def stop(self, execution_id: str, generation: int) -> dict[str, Any]:
        if (self._closed or execution_id != self._execution_id or type(generation) is not int
                or generation <= self._generation):
            raise RuntimeError("Hardware stop identity or generation is invalid.")
        self._generation, self._confirmed, self._boundary_id = generation, False, None
        self._accepting = False
        acknowledgement = await self._backend.stop(self.capabilities.connection_id, execution_id, generation)
        await self.confirm_stop(acknowledgement)
        return acknowledgement

    async def confirm_stop(self, acknowledgement: dict[str, Any]) -> None:
        self._validator.parse("StopAcknowledgement", acknowledgement)
        if (self._closed or self._accepting or acknowledgement["execution_id"] != self._execution_id
                or acknowledgement["generation"] != self._generation):
            raise RuntimeError("Hardware stop acknowledgement belongs to another control boundary.")
        await self.verify_connection()
        if self._confirmed:
            if not acknowledgement["device_confirmed"] or acknowledgement["boundary_id"] != self._boundary_id:
                raise RuntimeError("Hardware stop acknowledgement conflicts with its confirmed boundary.")
            return
        self._confirmed = acknowledgement["device_confirmed"]
        self._boundary_id = acknowledgement.get("boundary_id") if self._confirmed else None

    async def resume(self, execution_id: str, generation: int) -> bool:
        if (self._closed or not self.capabilities.supports_resume or not self._confirmed
                or execution_id != self._execution_id or generation != self._generation):
            raise RuntimeError("Hardware resume requires discovered support and a matching confirmed boundary.")
        self._confirmed, self._boundary_id = False, None
        await self.verify_connection()
        resumed = await self._backend.resume(self.capabilities.connection_id, execution_id, generation)
        if resumed is not True or generation != self._generation:
            raise RuntimeError("Hardware resume did not confirm the current control generation.")
        self._accepting = True
        return True

    async def close(self) -> None:
        if self._closed:
            return
        if self._execution_id is None:
            await self._backend.disconnect(self.capabilities.connection_id)
            self._closed = True
            return
        if not self._confirmed:
            acknowledgement = await self.stop(self._execution_id, self._generation + 1)
            if not acknowledgement["device_confirmed"]:
                raise RuntimeError("Hardware disconnect requires a confirmed stopped boundary.")
        await self._backend.disconnect(self.capabilities.connection_id)
        self._closed = True
