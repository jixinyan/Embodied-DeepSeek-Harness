from __future__ import annotations

import base64
from io import BytesIO
import math

from PIL import Image

from physical_harness.environments import NativeEnvironmentDescription, NativeObservation


def encode_policy_observation(
    description: NativeEnvironmentDescription,
    observation: NativeObservation,
    environment_name: str,
) -> dict:
    if not environment_name or len(description.camera_names) > 8 or set(observation.images) != set(description.camera_names):
        raise ValueError("Policy camera channels differ from the admitted environment description.")
    if set(observation.state) != set(description.state_channels):
        raise ValueError("Policy state channels differ from the admitted environment description.")
    if len(observation.images) == 0:
        raise ValueError("Policy observation requires an actual camera frame.")
    cameras: dict[str, dict] = {}
    total_image_bytes = 0
    for name in description.camera_names:
        encoded = observation.images[name]
        if not isinstance(encoded, bytes) or not 0 < len(encoded) <= 1024 * 1024:
            raise ValueError(f"Policy camera {name} exceeds the PNG byte bound.")
        total_image_bytes += len(encoded)
        if total_image_bytes > 4 * 1024 * 1024:
            raise ValueError("Policy camera batch exceeds the PNG byte bound.")
        with Image.open(BytesIO(encoded)) as image:
            image.load()
            if image.format != "PNG" or image.mode != "RGB" or not 0 < image.width <= 1024 or not 0 < image.height <= 1024:
                raise ValueError(f"Policy camera {name} is not a bounded RGB PNG.")
            width, height = image.size
        cameras[name] = {
            "mime_type": "image/png",
            "width": width,
            "height": height,
            "data_base64": base64.b64encode(encoded).decode("ascii"),
        }
    proprioception: dict[str, list[float]] = {}
    for name in description.state_channels:
        values = observation.state[name]
        if not 0 < len(values) <= 128 or any(not math.isfinite(value) for value in values):
            raise ValueError(f"Policy state channel {name} is invalid.")
        proprioception[name] = list(values)
    return {
        "schema_version": "edh.policy_observation.v1",
        "source_observation_id": observation.observation_id,
        "observed_at": observation.observed_at,
        "environment": environment_name,
        "embodiment_id": description.embodiment_id,
        "cameras": cameras,
        "proprioception": proprioception,
    }
