"""Validate shared EDH wire contracts; schemas are supplied explicitly by the host."""
from __future__ import annotations

import copy
import json
import math
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator, FormatChecker


class ContractValidationError(ValueError):
    def __init__(self, contract: str, issues: list[dict[str, str]]) -> None:
        self.contract = contract
        self.issues = issues
        super().__init__(f"{contract}: " + "; ".join(f"{x['path'] or '/'} {x['message']}" for x in issues))


def is_wire_timestamp(value: Any) -> bool:
    if not isinstance(value, str):
        return True  # JSON Schema's type validator owns non-string errors.
    if not re.fullmatch(r"(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z", value):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def _is_json(value: Any, parents: set[int] | None = None) -> bool:
    if value is None or isinstance(value, (str, bool, int)):
        return True
    if isinstance(value, float):
        return math.isfinite(value)
    if type(value) not in (dict, list):
        return False
    parents = set() if parents is None else parents
    if id(value) in parents:
        return False
    parents.add(id(value))
    valid = all(_is_json(x, parents) for x in value) if isinstance(value, list) else all(isinstance(k, str) and _is_json(v, parents) for k, v in value.items())
    parents.remove(id(value))
    return valid


class ContractValidator:
    """No coercion, default insertion or field removal. Not sender authentication."""

    def __init__(self, schema: dict[str, Any]) -> None:
        self._schema = copy.deepcopy(schema)
        Draft7Validator.check_schema(self._schema)
        self.lifecycle = copy.deepcopy(self._schema["x-edh-lifecycle"])
        self._formats = FormatChecker()
        self._formats.checks("date-time")(is_wire_timestamp)
        self._validators: dict[str, Draft7Validator] = {}

    @classmethod
    def from_path(cls, path: str | Path) -> ContractValidator:
        return cls(json.loads(Path(path).read_text(encoding="utf-8")))

    def issues(self, name: str, value: Any) -> list[dict[str, str]]:
        if name not in self._schema["$defs"]:
            raise ValueError(f"Unknown contract: {name}")
        if not _is_json(value):
            return [{"path": "", "keyword": "json", "message": "Expected finite, acyclic JSON data."}]
        if name not in self._validators:
            self._validators[name] = Draft7Validator({"$defs": self._schema["$defs"], "$ref": f"#/$defs/{name}"}, format_checker=self._formats)
        errors = [{"path": "/" + "/".join(str(x) for x in error.absolute_path), "keyword": str(error.validator), "message": error.message} for error in self._validators[name].iter_errors(value)]
        return errors or _field_relations(name, value)

    def parse(self, name: str, value: Any) -> Any:
        issues = self.issues(name, value)
        if issues:
            raise ContractValidationError(name, issues)
        return value


def _field_relations(name: str, value: Any) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []

    def add(path: str, message: str) -> None:
        issues.append({"path": path, "keyword": "relation", "message": message})

    def unique(items: list[str], path: str) -> None:
        if len(set(items)) != len(items):
            add(path, "Identifiers must be unique.")

    if name == "SuccessContract":
        unique([x["check_id"] for x in value.get("all", value.get("any", []))], "/checks")
    if name == "ActionSpec":
        unique([x["name"] for x in value["channels"]], "/channels")
        for i, channel in enumerate(value["channels"]):
            if channel["minimum"] > channel["maximum"]:
                add(f"/channels/{i}", "Minimum exceeds maximum.")
    if name == "ActionChannel" and value["minimum"] > value["maximum"]:
        add("", "Minimum exceeds maximum.")
    if name == "SegmentationResult":
        unique([x["detection_id"] for x in value["instances"]], "/instances")
        for i, instance in enumerate(value["instances"]):
            x1, y1, x2, y2 = instance["bbox_xyxy"]
            if x1 > x2 or y1 > y2:
                add(f"/instances/{i}/bbox_xyxy", "Bounding-box coordinates are reversed.")
    if name == "VerificationResult":
        unique([x["check_id"] for x in value["checks"]], "/checks")
    if name in ("SubgoalRequest", "InvocationBrief"):
        issues.extend(_field_relations("SuccessContract", value["success_contract"]))
    if name == "PlanDocument":
        unique([x["goal_id"] for x in value["items"]], "/items")
        for item in value["items"]:
            issues.extend(_field_relations("SuccessContract", item["success_contract"]))
    return issues
