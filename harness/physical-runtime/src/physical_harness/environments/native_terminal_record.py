from datetime import datetime, timezone
from hashlib import sha256
import inspect
import json
import os
from pathlib import Path
from threading import current_thread
from time import monotonic_ns
from uuid import uuid4


class NativeTerminalRecorder:
    def __init__(self, provider: str) -> None:
        if provider not in {"robotwin", "behavior"}:
            raise ValueError("Unsupported native terminal recorder provider.")
        self.provider = provider
        self.scene_id = str(uuid4())
        self.position = 0
        self.sources = None

    def record(self, *, before: dict, after: dict, current_success: bool, terminated: bool,
               provider_source: Path, predicate, control, termination_source: Path | None = None) -> None:
        if before != after:
            raise RuntimeError("Native terminal query changed its scene identity or counters.")
        if type(current_success) is not bool or type(terminated) is not bool:
            raise ValueError("Native terminal query requires exact boolean facts.")
        configured = os.environ.get("EDH_POLICY_REQUEST_RECORD_DIR")
        if configured is None:
            return
        directory = Path(configured).resolve(strict=True) / "native-episode-status" / self.provider / self.scene_id
        directory.mkdir(parents=True, exist_ok=True)
        if self.sources is None:
            paths = {"provider": provider_source, "recorder": Path(__file__),
                     "predicate": Path(inspect.getsourcefile(predicate)),
                     "control": Path(inspect.getsourcefile(control))}
            if termination_source is not None:
                paths["termination"] = termination_source
            sources = {}
            for name, path in paths.items():
                path = path.resolve(strict=True)
                data = path.read_bytes()
                retained = directory / f"source-{name}.txt"
                with retained.open("xb") as output:
                    output.write(data)
                sources[name] = {"path": str(path), "retained_file": retained.name,
                                 "sha256": sha256(data).hexdigest()}
            self.sources = sources
        record = {"schema_version": "edh.native_episode_status.v1", "provider": self.provider,
                  "scene_id": self.scene_id, "audit_position": self.position,
                  "recorded_at": datetime.now(timezone.utc).isoformat(), "monotonic_ns": monotonic_ns(),
                  "native_pid": os.getpid(), "owner_thread_id": current_thread().ident,
                  "physical_steps": 0, "before": before, "after": after,
                  "current_task_success": current_success, "episode_terminated": terminated,
                  "sources": self.sources}
        with (directory / f"status-{self.position:06d}.json").open("x", encoding="utf-8") as output:
            json.dump(record, output, indent=2, allow_nan=False)
            output.write("\n")
        self.position += 1
