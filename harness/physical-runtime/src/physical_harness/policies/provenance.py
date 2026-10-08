from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
import re


CONFIG_FILES = (
    "config.json",
    "model.safetensors.index.json",
    "processor_config.json",
    "statistics.json",
    "policy_preprocessor.json",
    "policy_postprocessor.json",
)


def validate_checkpoint_sha256(value: str) -> str:
    if not re.fullmatch(r"[a-f0-9]{64}", value):
        raise ValueError("Checkpoint SHA256 must contain 64 lowercase hexadecimal characters.")
    return value


def checkpoint_identity(checkpoint: str, manifest: Path, *, expected_sha256: str | None = None) -> dict[str, object]:
    if expected_sha256 is not None:
        validate_checkpoint_sha256(expected_sha256)
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
    digest = sha256(encoded).hexdigest()
    if expected_sha256 is not None and digest != expected_sha256:
        raise ValueError("Checkpoint SHA256 differs from the configured identity.")
    revision = known["checkpoint_revision"] if hashes == known["checkpoint_files_sha256"] else None
    return {
        "checkpoint": str(root),
        "checkpoint_revision": revision,
        "checkpoint_digest": digest,
        "checkpoint_files_sha256": hashes,
        "checkpoint_weight_sha256": {
            path.relative_to(root).as_posix(): hashes[path.relative_to(root).as_posix()]
            for path in weights
        },
    }


def recorded_checkpoint_identity(record: dict, manifest: dict, *, expected_sha256: str | None = None) -> dict:
    known = manifest["upstream"]
    reference = known["checkpoint_files_sha256"]
    reference_digest = sha256(json.dumps(reference, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    expected = validate_checkpoint_sha256(expected_sha256) if expected_sha256 is not None else reference_digest
    hashes = record.get("checkpoint_files_sha256")
    if hashes is None:
        if expected != reference_digest:
            raise ValueError("Selected checkpoint requires its complete recorded file identity.")
        hashes = reference
    if not isinstance(hashes, dict) or not hashes:
        raise ValueError("Recorded checkpoint requires a nonempty file identity.")
    for name, digest in hashes.items():
        path = Path(name)
        if (not name or path.is_absolute() or ".." in path.parts or path.as_posix() != name
                or not (name in CONFIG_FILES or path.suffix in {".safetensors", ".bin"})):
            raise ValueError("Recorded checkpoint file path is invalid.")
        validate_checkpoint_sha256(digest)
    weights = {name: digest for name, digest in hashes.items() if Path(name).suffix in {".safetensors", ".bin"}}
    if not weights:
        raise ValueError("Recorded checkpoint has no model weight identity.")
    digest = sha256(json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    revision = known["checkpoint_revision"] if hashes == reference else None
    identity = {"checkpoint_revision": revision, "checkpoint_digest": digest,
                "checkpoint_files_sha256": dict(hashes), "checkpoint_weight_sha256": weights}
    if digest != expected or any(key not in record or record[key] != identity[key] for key in
                                 ("checkpoint_revision", "checkpoint_digest", "checkpoint_weight_sha256")):
        raise ValueError("Recorded checkpoint differs from the selected file identity.")
    return identity
