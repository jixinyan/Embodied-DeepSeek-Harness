"""Wire objects are defined by packages/contracts/schema/physical.schema.json.

These aliases do not validate data. Future RPC boundaries must validate against
that source schema; do not maintain separate hand-written DTO field definitions.
"""
from collections.abc import Mapping
from typing import TypeAlias

WireObject: TypeAlias = Mapping[str, object]
