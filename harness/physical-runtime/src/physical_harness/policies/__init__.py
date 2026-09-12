"""Replaceable inference transport. Policies have no device control authority."""
from typing import Protocol
from physical_harness.wire import WireObject


class SubgoalPolicy(Protocol):
    """Canonical inference boundary; server-specific protocols may implement this port."""
    async def infer(self, request: WireObject) -> WireObject: ...
    async def close(self) -> None: ...
