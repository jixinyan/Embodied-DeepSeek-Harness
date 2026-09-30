# SPDX-License-Identifier: AGPL-3.0-only
import argparse
import base64
import hashlib
import io
import math
import subprocess
from pathlib import Path
from threading import Lock

import numpy as np
import ultralytics
import uvicorn
from fastapi import FastAPI
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field
from ultralytics import YOLO


class CameraIntrinsics(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    calibration_id: str = Field(min_length=1, max_length=128)
    fx: float = Field(gt=0)
    fy: float = Field(gt=0)
    cx: float
    cy: float


class DepthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_base64: str = Field(min_length=1, max_length=44_739_244)
    image_mime_type: str = Field(pattern=r"^image/(png|jpeg|webp)$")
    roi_xyxy: tuple[int, int, int, int] | None = None
    mask_png_base64: str | None = Field(default=None, max_length=44_739_244)
    intrinsics: CameraIntrinsics | None = None


def checkpoint_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def decode_image(encoded: str, mime_type: str) -> tuple[Image.Image, bytes]:
    image_bytes = base64.b64decode(encoded, validate=True)
    if base64.b64encode(image_bytes).decode("ascii") != encoded:
        raise ValueError("Image encoding is not canonical base64.")
    if len(image_bytes) > 32 * 1024 * 1024:
        raise ValueError("Image exceeds the 32 MiB input limit.")
    with Image.open(io.BytesIO(image_bytes)) as decoded:
        if decoded.format != mime_type.removeprefix("image/").upper():
            if not (decoded.format == "JPEG" and mime_type == "image/jpeg"):
                raise ValueError("Image bytes do not match their declared media type.")
        decoded.load()
        width, height = decoded.size
        if width < 1 or height < 1 or width * height > 4_000_000:
            raise ValueError("Image dimensions exceed the input limit.")
        return decoded.convert("RGB"), image_bytes


def selected_pixels(request: DepthRequest, width: int, height: int) -> np.ndarray:
    selected = np.ones((height, width), dtype=bool)
    if request.roi_xyxy is not None:
        left, top, right, bottom = request.roi_xyxy
        if not (0 <= left < right <= width and 0 <= top < bottom <= height):
            raise ValueError("ROI must lie within the source image.")
        selected[:] = False
        selected[top:bottom, left:right] = True
    if request.mask_png_base64 is not None:
        mask_bytes = base64.b64decode(request.mask_png_base64, validate=True)
        if base64.b64encode(mask_bytes).decode("ascii") != request.mask_png_base64:
            raise ValueError("Mask encoding is not canonical base64.")
        if len(mask_bytes) > 32 * 1024 * 1024:
            raise ValueError("Mask exceeds the 32 MiB input limit.")
        with Image.open(io.BytesIO(mask_bytes)) as decoded:
            if decoded.format != "PNG" or decoded.size != (width, height):
                raise ValueError("Mask must be a source-sized PNG.")
            decoded.load()
            mask = np.asarray(decoded.convert("L"))
        if not np.all((mask == 0) | (mask == 255)):
            raise ValueError("Mask must contain binary pixels.")
        selected &= mask > 0
    if not selected.any():
        raise ValueError("Selected region contains no pixels.")
    return selected


def depth_once(model, request: DepthRequest, provenance: dict, device: str):
    image, image_bytes = decode_image(request.image_base64, request.image_mime_type)
    width, height = image.size
    selected = selected_pixels(request, width, height)
    result = model.predict(source=image, imgsz=768, device=device, verbose=False)[0]
    if result.depth is None:
        raise ValueError("YOLO26 depth model returned no depth map.")
    depth = result.depth.data.detach().cpu().numpy().astype(np.float32)
    if depth.shape != (height, width):
        raise ValueError("YOLO26 depth dimensions differ from the source image.")
    valid = selected & np.isfinite(depth) & (depth > 0)
    selected_count = int(selected.sum())
    valid_count = int(valid.sum())
    axial = depth[valid]
    camera_range = None
    if request.intrinsics is not None:
        calibration = request.intrinsics
        if not all(math.isfinite(value) for value in (calibration.fx, calibration.fy, calibration.cx, calibration.cy)):
            raise ValueError("Camera intrinsics must be finite.")
        rows, columns = np.nonzero(valid)
        range_values = axial * np.sqrt(
            1.0
            + np.square((columns - calibration.cx) / calibration.fx)
            + np.square((rows - calibration.cy) / calibration.fy)
        )
        if valid_count:
            camera_range = float(np.median(range_values))
    if valid_count == 0:
        raise ValueError("Selected region contains no valid predicted depth pixels.")
    depth_file = io.BytesIO()
    np.save(depth_file, depth, allow_pickle=False)
    depth_bytes = depth_file.getvalue()
    plotted = result.plot()
    if plotted.shape != (height, width, 3):
        raise ValueError("YOLO26 depth visualization has unexpected dimensions.")
    overlay_file = io.BytesIO()
    Image.fromarray(np.ascontiguousarray(plotted[:, :, ::-1]), mode="RGB").save(
        overlay_file, format="PNG"
    )
    return {
        "model": provenance,
        "source_image_sha256": hashlib.sha256(image_bytes).hexdigest(),
        "width": width,
        "height": height,
        "unit": "meter",
        "distance_frame": "camera_axial_depth",
        "measurement_kind": "monocular_prediction",
        "metric_accuracy": "unverified_for_source_camera",
        "scale_calibration": "checkpoint_global_calibration",
        "uncertainty": "not_provided_by_model",
        "calibration_id": request.intrinsics.calibration_id if request.intrinsics else None,
        "region": {
            "roi_xyxy": request.roi_xyxy,
            "mask_png_sha256": (
                hashlib.sha256(base64.b64decode(request.mask_png_base64)).hexdigest()
                if request.mask_png_base64 is not None
                else None
            ),
        },
        "statistics": {
            "selected_pixels": selected_count,
            "valid_pixels": valid_count,
            "valid_fraction": valid_count / selected_count,
            "invalid_pixels": selected_count - valid_count,
            "median_axial_depth_m": float(np.median(axial)) if valid_count else None,
            "p10_axial_depth_m": float(np.percentile(axial, 10)) if valid_count else None,
            "p90_axial_depth_m": float(np.percentile(axial, 90)) if valid_count else None,
            "median_camera_range_m": camera_range,
        },
        "depth_npy_sha256": hashlib.sha256(depth_bytes).hexdigest(),
        "depth_npy_base64": base64.b64encode(depth_bytes).decode("ascii"),
        "overlay_png_base64": base64.b64encode(overlay_file.getvalue()).decode("ascii"),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--checkpoint-sha256", required=True)
    parser.add_argument("--source-revision", required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--device", required=True)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535 or not args.checkpoint.is_file():
        raise ValueError("Checkpoint and listening port must be valid.")
    if args.device != "cpu" and not (
        args.device.startswith("cuda:") and args.device[5:].isdigit()
    ):
        raise ValueError("Device must be cpu or an explicit CUDA device.")
    source_root = Path(ultralytics.__file__).resolve().parent.parent
    revision = subprocess.run(
        ["git", "-C", str(source_root), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if revision != args.source_revision:
        raise ValueError("Installed Ultralytics source differs from the declared revision.")
    actual_digest = checkpoint_digest(args.checkpoint)
    if actual_digest != args.checkpoint_sha256:
        raise ValueError("YOLO26 checkpoint SHA-256 differs from the declared manifest.")
    model = YOLO(str(args.checkpoint), task="depth")
    if model.task != "depth":
        raise ValueError("Checkpoint is not a YOLO depth model.")
    provenance = {
        "provider": "ultralytics-yolo26-depth",
        "source_revision": revision,
        "checkpoint_sha256": actual_digest,
        "device": args.device,
    }
    lock = Lock()
    app = FastAPI()

    @app.get("/health")
    def health():
        return {"ready": True, "model": provenance}

    @app.post("/depth")
    def depth(request: DepthRequest):
        with lock:
            return depth_once(model, request, provenance, args.device)

    uvicorn.run(app, host="127.0.0.1", port=args.port, workers=1)


if __name__ == "__main__":
    main()
