from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any
from uuid import uuid4

from physical_harness.execution.native_device import NativeActionDevice


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
    if not isinstance(request_id, str) or not request_id or not request_id.isascii() or not all(
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
            "recorded_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
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
