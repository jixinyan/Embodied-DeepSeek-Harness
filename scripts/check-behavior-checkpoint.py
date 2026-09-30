from __future__ import annotations

import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path

from huggingface_hub import HfApi, hf_hub_download


REPO_ID = "nvidia/GR00T-N1.6-BEHAVIOR1k"
REVISION = "300db814db8ab5dd010026d5631f280048d06b91"
FILES = (
    "config.json",
    "model-00001-of-00002.safetensors",
    "model-00002-of-00002.safetensors",
    "model.safetensors.index.json",
    "processor_config.json",
    "statistics.json",
)


def file_hash(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--cache-directory", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.checkpoint.resolve(strict=True)
    args.cache_directory.mkdir(parents=True, exist_ok=True)
    model = HfApi().model_info(REPO_ID, revision=REVISION, files_metadata=True)
    if model.sha != REVISION:
        raise ValueError("The Hugging Face model revision changed during inspection.")
    siblings = {sibling.rfilename: sibling for sibling in model.siblings}
    hashes: dict[str, str] = {}
    for name in FILES:
        local_hash = file_hash(root / name)
        sibling = siblings[name]
        if sibling.lfs is not None:
            if local_hash != sibling.lfs.sha256:
                raise ValueError(f"Checkpoint file {name} differs from the pinned LFS object.")
        else:
            official = Path(hf_hub_download(
                REPO_ID,
                filename=name,
                revision=REVISION,
                cache_dir=args.cache_directory,
            ))
            if local_hash != file_hash(official):
                raise ValueError(f"Checkpoint file {name} differs from the pinned repository file.")
        hashes[name] = local_hash
    result = {
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "checkpoint_id": REPO_ID,
        "checkpoint_revision": REVISION,
        "checkpoint_files_sha256": hashes,
    }
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
