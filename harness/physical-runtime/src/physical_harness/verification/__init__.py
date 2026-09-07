"""verification interfaces only; no registered provider implementation."""
from typing import Protocol
from physical_harness.wire import WireObject


class VerificationProvider(Protocol):
    """Provider boundary; invocation requires a future concrete adapter."""
    async def check(self, request: WireObject) -> WireObject: ...
