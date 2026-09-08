"""Frozen registrations and pure boundary checks; no routing, authority or I/O."""
import copy
import re
from datetime import datetime
from jsonschema import Draft7Validator, FormatChecker
from .validation import ContractValidator, is_wire_timestamp

_MISSING = object()


def _pointer(value, path):
    for part in path[1:].split("/"):
        part = part.replace("~1", "/").replace("~0", "~")
        if isinstance(value, dict) and part in value:
            value = value[part]
        elif isinstance(value, list) and re.fullmatch(r"0|[1-9][0-9]*", part) and int(part) < len(value):
            value = value[int(part)]
        else:
            return _MISSING
    return value


def _equal(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_equal(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_equal(x, y) for x, y in zip(a, b))
    return a == b


def _instant(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _local_schema(value, root=None):
    root = value if root is None else root
    if isinstance(value, list):
        for child in value:
            _local_schema(child, root)
    elif isinstance(value, dict):
        if "nullable" in value:
            raise ValueError("Use Draft 7 null types, not nullable.")
        if "format" in value and value["format"] != "date-time":
            raise ValueError("Only the shared date-time format is supported.")
        if "$id" in value:
            raise ValueError("Schema IDs are not supported; use a registered reference.")
        if "$ref" in value:
            ref = value["$ref"]
            if not isinstance(ref, str) or (ref != "#" and not ref.startswith("#/")):
                raise ValueError("Only local schema references are supported.")
            if ref != "#" and _pointer(root, ref[1:]) is _MISSING:
                raise ValueError("Unresolved local schema reference.")
        if "$schema" in value and value["$schema"] != "http://json-schema.org/draft-07/schema#":
            raise ValueError("Only JSON Schema Draft 7 is supported.")
        for key in ("properties", "patternProperties", "definitions", "$defs", "dependencies"):
            children = value.get(key)
            if isinstance(children, dict):
                for child in children.values():
                    if not isinstance(child, list):
                        _local_schema(child, root)
        for key in ("items", "additionalItems", "additionalProperties", "contains", "propertyNames", "not", "if", "then", "else", "allOf", "anyOf", "oneOf"):
            if key in value:
                _local_schema(value[key], root)


class PhysicalBoundaryValidator:
    def __init__(self, source, extensions=None):
        self._source = copy.deepcopy(source)
        self.contracts = ContractValidator(self._source)
        self._schemas = {}
        self._messages = {}
        self._constraints = {}
        self._formats = FormatChecker()
        self._formats.checks("date-time")(is_wire_timestamp)
        extensions = extensions or {}
        for reference, schema in extensions.get("schemas", {}).items():
            if not re.fullmatch(r"custom:[A-Za-z][A-Za-z0-9_.-]*\.v[1-9][0-9]*", reference):
                raise ValueError(f"Invalid custom schema reference: {reference}")
            self._schemas[reference] = self._compile(schema)
        for item in [*self._source["x-edh-message-types"].values(), *extensions.get("messages", [])]:
            definition = copy.deepcopy(self.contracts.parse("MessageTypeDefinition", item))
            if definition["type"] in self._messages:
                raise ValueError(f"Duplicate message type: {definition['type']}")
            self._resolve(definition["payload_schema"])
            self._messages[definition["type"]] = definition
            if "payload_constraints" in definition:
                self._constraints[definition["type"]] = self._compile(definition["payload_constraints"])

    def _compile(self, schema):
        schema = copy.deepcopy(schema)
        _local_schema(schema)
        Draft7Validator.check_schema(schema)
        return Draft7Validator(schema, format_checker=self._formats)

    def _resolve(self, reference):
        match = re.fullmatch(r"builtin:([A-Za-z][A-Za-z0-9]*)\.v1", reference)
        if match and match[1] in self._source["$defs"]:
            return match[1]
        if reference in self._schemas:
            return self._schemas[reference]
        raise ValueError(f"Unknown schema reference: {reference}")

    def _valid(self, reference, value):
        schema = self._resolve(reference)
        return not self.contracts.issues(schema, value) if isinstance(schema, str) else schema.is_valid(value)

    def message(self, value):
        message = self.contracts.parse("MessageEnvelope", value)
        definition = self._messages.get(message["type"])
        if definition is None:
            return ["unregistered_message_type"]
        errors = []
        if message["type_version"] != definition["version"]:
            errors.append("message_version_mismatch")
        if message["kind"] != definition["kind"]:
            errors.append("message_kind_mismatch")
        if not self._valid(definition["payload_schema"], message["payload"]) or (message["type"] in self._constraints and not self._constraints[message["type"]].is_valid(message["payload"])):
            errors.append("invalid_message_payload")
        for binding in definition["bindings"]:
            outer = _pointer(message, binding["envelope_pointer"])
            inner = _pointer(message["payload"], binding["payload_pointer"])
            if binding["optional"] and outer is _MISSING and inner is _MISSING:
                continue
            if outer is _MISSING or inner is _MISSING or not _equal(outer, inner):
                errors.append("message_binding_mismatch")
        return list(dict.fromkeys(errors))

    def definition(self, value):
        definition = self.contracts.parse("ToolDefinition", value)
        self._resolve(definition["input_schema"])
        self._resolve(definition["output_schema"])
        return definition

    def call(self, definition_value, call_value):
        definition = self.definition(definition_value)
        call = self.contracts.parse("ToolCall", call_value)
        errors = []
        if call["tool_id"] != definition["tool_id"] or call["tool_version"] != definition["version"]:
            errors.append("tool_binding_mismatch")
        duration = (_instant(call["deadline_at"]) - _instant(call["requested_at"])).total_seconds()
        if duration <= 0 or duration > definition["timeout_s"]:
            errors.append("invalid_call_deadline")
        if not self._valid(definition["input_schema"], call["input"]):
            errors.append("invalid_tool_input")
        return errors

    def result(self, definition_value, call_value, result_value, operation_id=None):
        definition = self.definition(definition_value)
        call = self.contracts.parse("ToolCall", call_value)
        result = self.contracts.parse("ToolResult", result_value)
        errors = self.call(definition, call)
        keys = ("call_id", "tool_id", "tool_version", "agent_id", "assignment_id", "team_run_id", "task_scope")
        if any(not _equal(call[k], result[k]) for k in keys):
            errors.append("result_identity_mismatch")
        if result["provider_id"] != definition["executor"]["provider"] or result["effect"] != definition["effect"]:
            errors.append("result_provider_mismatch")
        if _instant(result["recorded_at"]) < _instant(call["requested_at"]):
            errors.append("result_before_call")
        if definition["execution_mode"] == "sync" and (result["status"] == "running" or "operation_id" in result):
            errors.append("sync_operation_mismatch")
        if definition["execution_mode"] == "async":
            if result["status"] in ("running", "completed", "cancelled") and "operation_id" not in result:
                errors.append("missing_operation_id")
            if operation_id is not None and result.get("operation_id") != operation_id:
                errors.append("operation_identity_mismatch")
            if result["status"] not in ("running", "unknown") and "operation_id" in result and operation_id is None:
                errors.append("missing_operation_context")
        if "data" in result and not self._valid(definition["output_schema"], result["data"]):
            errors.append("invalid_tool_output")
        return list(dict.fromkeys(errors))

    def replay(self, previous_value, next_value):
        """Compare stored call identity; the caller still owns durable deduplication."""
        previous = self.contracts.parse("ToolCall", previous_value)
        next_call = self.contracts.parse("ToolCall", next_value)
        if previous["idempotency_key"] != next_call["idempotency_key"]:
            return ["idempotency_identity_mismatch"]
        return [] if _equal(previous, next_call) else ["idempotency_conflict"]

    def operation(self, definition_value, call_value, previous_value, next_value, reconciled=False):
        definition = self.definition(definition_value)
        call = self.contracts.parse("ToolCall", call_value)
        next_state = self.contracts.parse("ToolOperation", next_value)
        previous = None if previous_value is None else self.contracts.parse("ToolOperation", previous_value)
        errors = self.call(definition, call)
        if definition["execution_mode"] != "async":
            errors.append("sync_operation_mismatch")
        identity = ("call_id", "tool_id", "tool_version", "agent_id", "assignment_id", "team_run_id", "task_scope", "idempotency_key")
        if any(not _equal(call[k], next_state[k]) for k in identity):
            errors.append("operation_call_mismatch")
        if next_state["provider_id"] != definition["executor"]["provider"] or next_state["effect"] != definition["effect"]:
            errors.append("operation_provider_mismatch")
        if _instant(next_state["recorded_at"]) < _instant(call["requested_at"]):
            errors.append("operation_before_call")
        if previous is None:
            if next_state["state"] != "accepted" or next_state["state_version"] != 0:
                errors.append("invalid_initial_operation")
        else:
            if next_state["state"] not in self.contracts.lifecycle["tool_operation"].get(previous["state"], []):
                errors.append("invalid_operation_transition")
            if next_state["state_version"] <= previous["state_version"]:
                errors.append("stale_operation_version")
            if _instant(next_state["recorded_at"]) < _instant(previous["recorded_at"]):
                errors.append("operation_time_regression")
            if any(not _equal(previous[k], next_state[k]) for k in (*identity, "operation_id", "provider_id", "effect")) or sorted(previous["resources"]) != sorted(next_state["resources"]):
                errors.append("operation_identity_mismatch")
            if previous["state"] == "unknown" and next_state["state"] != "unknown" and not reconciled:
                errors.append("reconciliation_required")
        if "result" in next_state:
            result = next_state["result"]
            errors.extend(self.result(definition, call, result, next_state["operation_id"]))
            if next_state["state"] != result["status"] or next_state["recorded_at"] != result["recorded_at"] or sorted(next_state["resources"]) != sorted(result["resources"]):
                errors.append("operation_result_mismatch")
        return list(dict.fromkeys(errors))
