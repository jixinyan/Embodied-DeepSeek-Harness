# SPDX-License-Identifier: MIT
import argparse
import base64
import hashlib
import inspect
import io
import math
import re
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock

import numpy as np
import torch
import uvicorn
from fastapi import FastAPI
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field
import sam3
from sam3.model_builder import build_sam3_multiplex_video_predictor


class SegmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_base64: str = Field(min_length=1, max_length=44_739_244)
    image_mime_type: str = Field(pattern=r"^image/(png|jpeg|webp)$")
    text_prompt: str = Field(min_length=1, max_length=1024)


def checkpoint_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_loaded_checkpoint(path: Path, predictor):
    checkpoint = torch.load(path, map_location="cpu", weights_only=True, mmap=True)
    weights = checkpoint.get("model", checkpoint)
    if not isinstance(weights, dict) or not weights:
        raise ValueError("SAM 3.1 checkpoint has no model weights.")
    if not all(isinstance(key, str) and isinstance(value, torch.Tensor) for key, value in weights.items()):
        raise ValueError("SAM 3.1 checkpoint contains invalid weight entries.")
    loaded = predictor.model.state_dict()
    missing = loaded.keys() - weights.keys()
    unexpected = weights.keys() - loaded.keys()
    if len(missing) != 64 or unexpected:
        raise ValueError(
            f"SAM 3.1 checkpoint keys differ from the model: "
            f"{len(missing)} missing, {len(unexpected)} unexpected."
        )
    for key in missing:
        match = re.fullmatch(
            r"detector\.backbone\.vision_backbone\.trunk\.blocks\.\d+\.attn\.freqs_cis_(real|imag)",
            key,
        )
        if match is None:
            raise ValueError(f"SAM 3.1 checkpoint lacks an ordinary model weight: {key}.")
        base = key.removesuffix(f"_{match.group(1)}")
        if base not in weights or not torch.is_complex(weights[base]):
            raise ValueError(f"SAM 3.1 checkpoint lacks the RoPE source buffer: {base}.")
        expected = weights[base].real if match.group(1) == "real" else weights[base].imag
        if not torch.equal(loaded[key].cpu(), expected):
            raise ValueError(f"SAM 3.1 derived RoPE buffer does not match the checkpoint: {key}.")
    for key, value in weights.items():
        if value.shape != loaded[key].shape or value.dtype != loaded[key].dtype:
            raise ValueError(f"SAM 3.1 checkpoint tensor metadata differs: {key}.")


def encoded_png(image: Image.Image) -> str:
    output = io.BytesIO()
    image.save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("ascii")


def adapt_multiplex_init_state(predictor):
    expected = (
        "resource_path",
        "offload_video_to_cpu",
        "async_loading_frames",
        "use_torchcodec",
        "use_cv2",
        "input_is_mp4",
    )
    original = predictor.model.init_state
    if tuple(inspect.signature(original).parameters) != expected:
        raise ValueError("SAM 3.1 multiplex init_state signature changed.")
    if hasattr(predictor, "video_loader_type"):
        raise ValueError("SAM 3.1 predictor has an unsupported video loader option.")

    def compatible_init_state(
        resource_path,
        offload_video_to_cpu=False,
        offload_state_to_cpu=False,
        async_loading_frames=False,
    ):
        if offload_state_to_cpu:
            raise ValueError("SAM 3.1 multiplex does not support state offloading.")
        return original(
            resource_path=resource_path,
            offload_video_to_cpu=offload_video_to_cpu,
            async_loading_frames=async_loading_frames,
        )

    predictor.model.init_state = compatible_init_state


def segment_once(predictor, request: SegmentRequest, work_root: Path, provenance: dict):
    encoded = request.image_base64
    image_bytes = base64.b64decode(encoded, validate=True)
    if base64.b64encode(image_bytes).decode("ascii") != encoded:
        raise ValueError("Image encoding is not canonical base64.")
    if len(image_bytes) > 32 * 1024 * 1024:
        raise ValueError("Image exceeds the 32 MiB input limit.")
    with Image.open(io.BytesIO(image_bytes)) as decoded:
        if decoded.format != request.image_mime_type.removeprefix("image/").upper():
            if not (decoded.format == "JPEG" and request.image_mime_type == "image/jpeg"):
                raise ValueError("Image bytes do not match their declared media type.")
        decoded.load()
        width, height = decoded.size
        if width < 1 or height < 1 or width * height > 4_000_000:
            raise ValueError("Image dimensions exceed the input limit.")
        image = decoded.convert("RGB")

    with TemporaryDirectory(prefix="sam31-", dir=work_root) as directory:
        frame_path = Path(directory) / "0.jpg"
        image.save(frame_path, format="JPEG", quality=100, subsampling=0)
        model_input_sha256 = hashlib.sha256(frame_path.read_bytes()).hexdigest()
        session_id = predictor.handle_request(
            {"type": "start_session", "resource_path": directory}
        )["session_id"]
        try:
            response = predictor.handle_request(
                {
                    "type": "add_prompt",
                    "session_id": session_id,
                    "frame_index": 0,
                    "text": request.text_prompt,
                }
            )
        finally:
            predictor.handle_request({"type": "close_session", "session_id": session_id})

    outputs = response["outputs"]
    masks = outputs["out_binary_masks"]
    scores = outputs["out_probs"]
    object_ids = outputs["out_obj_ids"]
    if len(masks) != len(scores) or len(masks) != len(object_ids):
        raise ValueError("SAM 3.1 returned inconsistent object arrays.")
    instances = []
    overlay_pixels = np.asarray(image).copy()
    for index, mask_value in enumerate(masks):
        mask = torch.as_tensor(mask_value).detach().cpu().numpy().astype(bool)
        if mask.shape != (height, width):
            raise ValueError("SAM 3.1 mask dimensions differ from the input image.")
        rows, columns = np.nonzero(mask)
        if not len(rows):
            continue
        score = float(torch.as_tensor(scores[index]).item())
        if not math.isfinite(score) or score < 0 or score > 1:
            raise ValueError("SAM 3.1 returned an invalid confidence score.")
        mask_png = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
        overlay_pixels[mask] = (
            overlay_pixels[mask].astype(np.uint16) * 2
            + np.array([255, 80, 50], dtype=np.uint16)
        ) // 3
        instances.append(
            {
                "object_id": int(torch.as_tensor(object_ids[index]).item()),
                "score": score,
                "bbox_xyxy": [
                    int(columns.min()),
                    int(rows.min()),
                    int(columns.max()) + 1,
                    int(rows.max()) + 1,
                ],
                "area_pixels": int(mask.sum()),
                "mask_png_base64": encoded_png(mask_png),
            }
        )
    return {
        "model": provenance,
        "session_id": session_id,
        "source_image_sha256": hashlib.sha256(image_bytes).hexdigest(),
        "model_input": {
            "media_type": "image/jpeg",
            "sha256": model_input_sha256,
            "conversion": "Pillow RGB JPEG quality 100, subsampling 0",
        },
        "width": width,
        "height": height,
        "instances": instances,
        "overlay_png_base64": encoded_png(Image.fromarray(overlay_pixels, mode="RGB")),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--checkpoint-sha256", required=True)
    parser.add_argument("--source-revision", required=True)
    parser.add_argument("--work-root", type=Path, required=True)
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        raise ValueError("Invalid listening port.")
    if not args.checkpoint.is_file() or not args.work_root.is_dir():
        raise ValueError("Checkpoint and work directory must already exist.")
    source_root = Path(sam3.__file__).resolve().parent.parent
    source_revision = subprocess.run(
        ["git", "-C", str(source_root), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if source_revision != args.source_revision:
        raise ValueError("Installed SAM source differs from the declared revision.")
    actual_digest = checkpoint_digest(args.checkpoint)
    if actual_digest != args.checkpoint_sha256:
        raise ValueError("Checkpoint SHA-256 differs from the declared manifest.")
    predictor = build_sam3_multiplex_video_predictor(
        checkpoint_path=str(args.checkpoint),
        compile=False,
        use_fa3=False,
    )
    validate_loaded_checkpoint(args.checkpoint, predictor)
    adapt_multiplex_init_state(predictor)
    provenance = {
        "provider": "sam3.1-object-multiplex",
        "source_revision": args.source_revision,
        "checkpoint_sha256": actual_digest,
        "session_adapter": "sam31-multiplex-init-state-v1",
    }
    lock = Lock()
    app = FastAPI()

    @app.get("/health")
    def health():
        return {"ready": True, "model": provenance}

    @app.post("/segment")
    def segment(request: SegmentRequest):
        with lock:
            return segment_once(predictor, request, args.work_root, provenance)

    uvicorn.run(app, host="127.0.0.1", port=args.port, workers=1)


if __name__ == "__main__":
    main()
