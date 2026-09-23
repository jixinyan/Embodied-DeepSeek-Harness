from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path


CONFIG_FILES = (
    "config.json",
    "model.safetensors.index.json",
    "processor_config.json",
    "statistics.json",
    "policy_preprocessor.json",
    "policy_postprocessor.json",
)


def checkpoint_identity(checkpoint: str, manifest: Path) -> dict[str, object]:
    root = Path(checkpoint).resolve(strict=True)
    with manifest.open(encoding="utf-8") as stream:
        known = json.load(stream)["upstream"]
    files = sorted(
        {path for path in root.rglob("*.safetensors") if path.is_file()}
        | {path for path in root.rglob("*.bin") if path.is_file()}
        | {root / name for name in CONFIG_FILES if (root / name).is_file()}
    )
    weights = [path for path in files if path.suffix in (".safetensors", ".bin")]
    if not weights:
        raise ValueError("Checkpoint has no model weights.")
    hashes: dict[str, str] = {}
    for path in files:
        digest = sha256()
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
                digest.update(block)
        hashes[path.relative_to(root).as_posix()] = digest.hexdigest()
    encoded = json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode("utf-8")
    revision = known["checkpoint_revision"] if hashes == known["checkpoint_files_sha256"] else None
    return {
        "checkpoint": str(root),
        "checkpoint_revision": revision,
        "checkpoint_digest": sha256(encoded).hexdigest(),
        "checkpoint_weight_sha256": {
            path.relative_to(root).as_posix(): hashes[path.relative_to(root).as_posix()]
            for path in weights
        },
    }
