"""embodiments interfaces only; no registered provider implementation."""
from typing import Protocol
from physical_harness.wire import WireObject


class EmbodimentAdapter(Protocol):
    """Provider boundary; invocation requires a future concrete adapter."""
    async def capabilities(self) -> WireObject: ...
    async def action_specification(self) -> WireObject: ...
    async def observation_specification(self) -> WireObject: ...
