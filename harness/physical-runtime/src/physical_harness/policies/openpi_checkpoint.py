import hashlib
import json
from pathlib import Path


def verify_checkpoint(directory: Path, inventory_path: Path) -> dict:
    directory = directory.resolve(strict=True)
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    prefix = inventory["checkpoint_prefix"]
    records = []
    for item in inventory["checkpoint_files"]:
        if item["type"] != "file" or not item["path"].startswith(prefix):
            raise ValueError("Checkpoint inventory contains a foreign entry.")
        relative = item["path"][len(prefix):]
        if not (relative.startswith("params/") or relative.startswith("assets/") or relative == "_CHECKPOINT_METADATA"):
            continue
        path = (directory / relative).resolve(strict=True)
        expected = item["lfs"]["oid"]
        if not path.is_relative_to(directory) or path.stat().st_size != item["size"]:
            raise ValueError(f"Checkpoint path or size differs: {relative}")
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != expected:
            raise ValueError(f"Checkpoint SHA256 differs: {relative}")
        records.append({"path": relative, "bytes": item["size"], "sha256": digest})
    records.sort(key=lambda item: item["path"])
    paths = {item["path"] for item in records}
    if len(paths) != len(records) or not records:
        raise ValueError("Checkpoint inventory must contain unique files.")
    actual = {str(path.relative_to(directory)) for path in directory.rglob("*") if path.is_file()}
    if actual != paths:
        raise ValueError("Checkpoint directory differs from the complete selected inventory.")
    canonical = json.dumps(records, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {"checkpoint_sha256": hashlib.sha256(canonical).hexdigest(),
            "revision": inventory["revision"], "files": records,
            "bytes": sum(item["bytes"] for item in records)}
