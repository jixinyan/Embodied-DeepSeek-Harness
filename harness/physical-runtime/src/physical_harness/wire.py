"""Wire objects are defined by harness/contracts/schema/physical.schema.json.

These aliases do not validate data. Boundary callers must use validation.ContractValidator
with that source schema; do not maintain separate hand-written DTO field definitions.
"""
from collections.abc import Mapping
from typing import TypeAlias

WireObject: TypeAlias = Mapping[str, object]
