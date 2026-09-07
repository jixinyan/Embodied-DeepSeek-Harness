"""perception interfaces only; no registered provider implementation."""
from typing import Protocol
from physical_harness.wire import WireObject


class PerceptionProvider(Protocol):
    """Provider boundary; invocation requires a future concrete adapter."""
    async def segment(self, request: WireObject) -> WireObject: ...
