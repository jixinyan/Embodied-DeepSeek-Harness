import hashlib
import json
import math
from pathlib import Path

from jsonschema import Draft202012Validator


_STATISTIC_FIELDS = ("mean", "std", "q01", "q99")
_ARX_X5_STATISTICS = Draft202012Validator({
    "type": "object",
    "required": ["norm_stats"],
    "properties": {
        "norm_stats": {
            "type": "object",
            "required": ["state", "actions"],
            "properties": {
                group: {
                    "type": "object",
                    "required": list(_STATISTIC_FIELDS),
                    "properties": {
                        field: {
                            "type": "array", "minItems": 14, "maxItems": 14,
                            "items": {"type": "number", **({"minimum": 0} if field == "std" else {})},
                        }
                        for field in _STATISTIC_FIELDS
                    },
                }
                for group in ("state", "actions")
            },
        },
    },
})


def verify_arx_x5_normalization(directory: Path) -> dict:
    root = directory.resolve(strict=True)
    path = (root / "assets/arx_x5_sim/norm_stats.json").resolve(strict=True)
    if not path.is_relative_to(root):
        raise ValueError("ARX X5 normalization must belong to its checkpoint directory.")
    data = path.read_bytes()
    document = json.loads(data)
    _ARX_X5_STATISTICS.validate(document)
    for group in ("state", "actions"):
        statistics = document["norm_stats"][group]
        if not all(math.isfinite(value) for field in _STATISTIC_FIELDS for value in statistics[field]):
            raise ValueError("ARX X5 normalization requires finite statistics.")
        if any(low > high for low, high in zip(statistics["q01"], statistics["q99"], strict=True)):
            raise ValueError("ARX X5 normalization quantiles must be ordered.")
    return {"asset_id": "arx_x5_sim", "path": path.relative_to(root).as_posix(),
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
            "dimensions": {"state": 14, "actions": 14}, "use_quantiles": True}


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
