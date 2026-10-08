from __future__ import annotations

import base64
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image


MAX_CAMERA_BYTES = 1024 * 1024
MAX_IMAGE_DIMENSION = 1024


def read_policy_observation(request: dict[str, Any], embodiment_id: str) -> dict[str, Any]:
    observation = request["observation"]
    if not isinstance(observation, dict) or observation.get("schema_version") != "edh.policy_observation.v1":
        raise ValueError("Unsupported policy observation version.")
    if observation.get("source_observation_id") != request["observation_id"]:
        raise ValueError("Policy observation identity does not match the request.")
    if (observation.get("embodiment_id") != embodiment_id
            or request["action_spec"]["embodiment_id"] != embodiment_id):
        raise ValueError("Policy observation and ActionSpec require the selected embodiment.")
    if not isinstance(observation.get("cameras"), dict) or not isinstance(observation.get("proprioception"), dict):
        raise ValueError("Policy observation requires named camera and proprioception groups.")
    return observation


def decode_camera(value: dict[str, Any], *, expected_sizes: tuple[tuple[int, int], ...],
                  resize_to: tuple[int, int] | None = None) -> np.ndarray:
    if not expected_sizes or any(
        len(size) != 2 or any(type(item) is not int or not 0 < item <= MAX_IMAGE_DIMENSION for item in size)
        for size in expected_sizes
    ):
        raise ValueError("Policy camera sizes require bounded positive integer dimensions.")
    if resize_to is not None and (
        len(resize_to) != 2 or any(type(item) is not int or not 0 < item <= MAX_IMAGE_DIMENSION for item in resize_to)
    ):
        raise ValueError("Policy camera resize requires bounded positive integer dimensions.")
    if (not isinstance(value, dict) or value.get("mime_type") != "image/png"
            or type(value.get("width")) is not int or type(value.get("height")) is not int
            or (value["width"], value["height"]) not in expected_sizes):
        raise ValueError("Policy camera metadata differs from its admitted PNG dimensions.")
    encoded = value.get("data_base64")
    if not isinstance(encoded, str) or not 0 < len(encoded) <= 4 * ((MAX_CAMERA_BYTES + 2) // 3):
        raise ValueError("Policy camera encoding exceeds its byte limit.")
    data = base64.b64decode(encoded, validate=True)
    if not 0 < len(data) <= MAX_CAMERA_BYTES:
        raise ValueError("Policy camera PNG exceeds its byte limit.")
    with Image.open(BytesIO(data), formats=["PNG"]) as image:
        if image.mode != "RGB" or image.size != (value["width"], value["height"]):
            raise ValueError("Policy camera bytes differ from their admitted RGB dimensions.")
        pixels = np.array(image, dtype=np.uint8, copy=True)
    if resize_to is not None and pixels.shape[:2] != (resize_to[1], resize_to[0]):
        from cv2 import INTER_AREA, resize
        pixels = resize(pixels, resize_to, interpolation=INTER_AREA)
    return pixels


def decode_state(value: Any, dimension: int) -> np.ndarray:
    if type(dimension) is not int or not 0 < dimension <= 128:
        raise ValueError("Policy state dimension requires an integer within 1..128.")
    if not isinstance(value, list) or len(value) != dimension:
        raise ValueError("Policy proprioception has an invalid dimension.")
    limit = float(np.finfo(np.float32).max)
    if any(type(item) not in (int, float) or not -limit <= item <= limit for item in value):
        raise ValueError("Policy proprioception requires finite numbers representable as float32.")
    return np.asarray(value, dtype=np.float32)
